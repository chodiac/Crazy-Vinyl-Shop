/* ==========================================================================
   cart.js — persistent cart.

   State lives in localStorage under `cvs.cart.v1`, so a refresh keeps it.
   Every consumer subscribes; nothing reads localStorage directly.
   ========================================================================== */

const KEY = 'cvs.cart.v1';
const MAX_QTY = 20;

/** @typedef {{slug:string,id:string,artist:string,title:string,price:number,qty:number}} Line */

let lines = [];
const listeners = new Set();

/* --------------------------------------------------------------------------
   persistence
   -------------------------------------------------------------------------- */

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((l) => l && typeof l.slug === 'string' && Number(l.price) >= 0)
      .map((l) => ({
        slug: l.slug,
        id: String(l.id ?? ''),
        artist: String(l.artist ?? ''),
        title: String(l.title ?? ''),
        price: Number(l.price) || 0,
        qty: Math.min(MAX_QTY, Math.max(1, parseInt(l.qty, 10) || 1)),
      }));
  } catch {
    return [];
  }
}

function write() {
  try {
    localStorage.setItem(KEY, JSON.stringify(lines));
  } catch {
    /* private mode or full quota — the cart still works for this page view */
  }
}

function emit() {
  const snapshot = getState();
  listeners.forEach((fn) => fn(snapshot));
}

lines = read();

/* Keep multiple tabs in sync. */
window.addEventListener('storage', (e) => {
  if (e.key !== KEY) return;
  lines = read();
  emit();
});

/* --------------------------------------------------------------------------
   public API
   -------------------------------------------------------------------------- */

export function subscribe(fn) {
  listeners.add(fn);
  fn(getState());
  return () => listeners.delete(fn);
}

export function getState() {
  return {
    lines: lines.map((l) => ({ ...l, lineTotal: l.price * l.qty })),
    count: lines.reduce((n, l) => n + l.qty, 0),
    distinct: lines.length,
    subtotal: lines.reduce((n, l) => n + l.price * l.qty, 0),
  };
}

export const isEmpty = () => lines.length === 0;
export const has = (slug) => lines.some((l) => l.slug === slug);

/**
 * Add a product. Sold-out products are refused — the caller should not offer
 * the control at all, this is the second line of defence.
 * @returns {{ok:boolean, reason?:string}}
 */
export function add(product, qty = 1) {
  if (!product || !product.slug) return { ok: false, reason: 'invalid' };
  if (product.available === false) return { ok: false, reason: 'soldout' };

  const price = Number(product.salePrice > 0 && product.onSale ? product.salePrice : product.price);
  if (!Number.isFinite(price) || price <= 0) return { ok: false, reason: 'noprice' };

  const existing = lines.find((l) => l.slug === product.slug);
  const want = Math.max(1, parseInt(qty, 10) || 1);

  if (existing) {
    if (existing.qty >= MAX_QTY) return { ok: false, reason: 'max' };
    existing.qty = Math.min(MAX_QTY, existing.qty + want);
  } else {
    lines.push({
      slug: product.slug,
      id: String(product.id ?? ''),
      artist: product.artist || '',
      title: product.title || '',
      price,
      qty: Math.min(MAX_QTY, want),
    });
  }
  write();
  emit();
  return { ok: true };
}

export function remove(slug) {
  const before = lines.length;
  lines = lines.filter((l) => l.slug !== slug);
  if (lines.length !== before) { write(); emit(); }
}

export function setQty(slug, qty) {
  const line = lines.find((l) => l.slug === slug);
  if (!line) return;
  const next = parseInt(qty, 10);
  if (!Number.isFinite(next) || next < 1) { remove(slug); return; }
  line.qty = Math.min(MAX_QTY, next);
  write();
  emit();
}

export const increment = (slug) => {
  const line = lines.find((l) => l.slug === slug);
  if (line) setQty(slug, line.qty + 1);
};

export const decrement = (slug) => {
  const line = lines.find((l) => l.slug === slug);
  if (line) setQty(slug, line.qty - 1);
};

export function clear() {
  if (!lines.length) return;
  lines = [];
  write();
  emit();
}

export { MAX_QTY };

/* --------------------------------------------------------------------------
   delivery — mirrors the zone pricing used by the current shop
   -------------------------------------------------------------------------- */

/** @returns {{zone:object|null, cost:number|null, payOnDelivery:boolean}} */
export function deliveryFor(site, country) {
  const zones = site?.checkout?.zones || [];
  const zone = zones.find((z) => z.countries.includes(country)) || null;
  return {
    zone,
    cost: zone ? zone.cost : null,
    // Serbia pays postage to the courier by the Post Express price list.
    payOnDelivery: Boolean(zone && zone.cost === null),
  };
}

export function countryOptions(site) {
  const groups = [];
  for (const zone of site?.checkout?.zones || []) {
    groups.push({
      label: zone.cost === null
        ? `${zone.label} — po cenovniku`
        : `${zone.label} — ${new Intl.NumberFormat('sr-RS').format(zone.cost)} RSD`,
      countries: zone.countries,
    });
  }
  return groups;
}

/** Build the order payload a backend or e-mail handler would receive. */
export function buildOrder(customer, site) {
  const state = getState();
  const { cost, payOnDelivery, zone } = deliveryFor(site, customer.country);
  return {
    reference: `CVS-${Date.now().toString(36).toUpperCase()}`,
    createdAt: new Date().toISOString(),
    paymentMethod: site?.checkout?.paymentMethod?.value || 'pe',
    customer,
    items: state.lines.map((l) => ({
      slug: l.slug, id: l.id, artist: l.artist, title: l.title,
      price: l.price, qty: l.qty, lineTotal: l.lineTotal,
    })),
    subtotal: state.subtotal,
    delivery: { zone: zone ? zone.label : null, cost, payOnDelivery },
    total: state.subtotal + (cost || 0),
    currency: 'RSD',
  };
}
