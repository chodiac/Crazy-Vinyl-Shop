/* ==========================================================================
   checkout.js — order form.

   The live shop takes orders over Post Express (cash on delivery in Serbia,
   export abroad) and has no card gateway, so this keeps that model: validate,
   build the order, hand it over. `submitOrder` is the single seam where a
   backend, e-mail handler or payment provider gets wired in later.
   ========================================================================== */

import { loadSite, formatPrice, formatNumber } from './store.js';
import { $, $$, esc, toast, cart, mountArtwork } from './ui.js';

/* --------------------------------------------------------------------------
   validation
   -------------------------------------------------------------------------- */

const RULES = {
  name: (v) => (v.trim().length >= 3 ? '' : 'Unesite ime i prezime ili naziv firme.'),
  email: (v) => (/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v.trim()) ? '' : 'Unesite ispravnu e-mail adresu.'),
  country: (v) => (v ? '' : 'Izaberite državu.'),
  city: (v) => (v.trim().length >= 2 ? '' : 'Unesite grad.'),
  address: (v) => (v.trim().length >= 5 ? '' : 'Unesite adresu za dostavu.'),
  phone: (v) => (v.replace(/[^\d]/g, '').length >= 8 ? '' : 'Unesite kontakt telefon.'),
  note: () => '',
};

function setError(field, message) {
  const wrap = field.closest('.field');
  if (!wrap) return;
  const slot = $('.field__error', wrap);
  wrap.classList.toggle('has-error', Boolean(message));
  field.setAttribute('aria-invalid', message ? 'true' : 'false');
  if (slot) slot.textContent = message;
}

function validateField(field) {
  const rule = RULES[field.name];
  if (!rule) return true;
  const msg = rule(field.value);
  setError(field, msg);
  return !msg;
}

/* --------------------------------------------------------------------------
   the seam for a real backend
   -------------------------------------------------------------------------- */

/**
 * Hand the order over. There is no payment provider configured, so this
 * records the order locally and returns its reference — replace the body with
 * a POST to your API, Supabase, WooCommerce or a mail endpoint.
 */
async function submitOrder(order) {
  try {
    const key = 'cvs.orders.v1';
    const prev = JSON.parse(localStorage.getItem(key) || '[]');
    prev.push(order);
    localStorage.setItem(key, JSON.stringify(prev.slice(-20)));
  } catch { /* storage unavailable — the reference is still returned */ }
  return { ok: true, reference: order.reference };
}

/* --------------------------------------------------------------------------
   page
   -------------------------------------------------------------------------- */

export async function initCheckout() {
  const form = $('#checkoutForm');
  if (!form) return;

  const site = await loadSite();
  const summaryHost = $('#orderSummary');
  const countrySelect = $('#country', form);
  const emptyNotice = $('#checkoutEmpty');
  const receipt = $('#checkoutReceipt');
  const layout = $('#checkoutLayout');

  /* ---- country list, grouped by the shop's delivery zones ---- */

  if (countrySelect) {
    countrySelect.innerHTML = `<option value="">Izaberite državu</option>${
      (site.checkout.zones || []).map((z) => `
        <optgroup label="${esc(z.cost === null ? `${z.label} — po cenovniku` : `${z.label} — ${formatNumber(z.cost)} RSD`)}">
          ${z.countries.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}
        </optgroup>`).join('')}`;
    countrySelect.value = 'Srbija';
  }

  /* ---- order summary, recalculated on every change ---- */

  function delivery() {
    return cart.deliveryFor(site, countrySelect?.value || '');
  }

  function renderSummary() {
    const state = cart.getState();
    if (!summaryHost) return;

    if (!state.lines.length) {
      summaryHost.innerHTML = '';
      return;
    }

    const { cost, payOnDelivery, zone } = delivery();
    const total = state.subtotal + (cost || 0);

    summaryHost.innerHTML = `
      <h2 class="summary__title">Narudžbenica</h2>
      <div>
        ${state.lines.map((l) => `
          <div class="order-line">
            <span>
              ${l.artist ? `<strong>${esc(l.artist)}</strong> ` : ''}${esc(l.title || l.slug)}
              <span class="order-line__q">× ${l.qty}</span>
            </span>
            <span class="order-line__p">${formatPrice(l.lineTotal)}</span>
          </div>`).join('')}
      </div>
      <div class="totals">
        <div class="totals__row"><span>Međuzbir (${state.count})</span><span>${formatPrice(state.subtotal)}</span></div>
        <div class="totals__row">
          <span>Dostava${zone ? ` — ${esc(zone.label)}` : ''}</span>
          <span>${payOnDelivery ? 'po cenovniku' : (cost ? formatPrice(cost) : '—')}</span>
        </div>
        <div class="totals__row totals__row--grand">
          <span>Ukupno</span>
          <span>${formatPrice(total)}${payOnDelivery ? ' + ptt' : ''}</span>
        </div>
      </div>
      ${payOnDelivery ? `
        <p class="notice">
          Za Srbiju se troškovi dostave obračunavaju po
          <a href="${esc(site.checkout.priceListUrl)}" target="_blank" rel="noopener">cenovniku Post Express-a</a>
          i plaćaju kuriru pouzećem.
        </p>` : ''}`;
  }

  // Once an order goes through the cart empties, but the receipt — not the
  // "cart is empty" notice — is what the buyer needs to see.
  let placed = false;

  cart.subscribe(() => {
    if (placed) return;
    const state = cart.getState();
    const empty = state.lines.length === 0;
    if (emptyNotice) emptyNotice.hidden = !empty;
    if (layout) layout.hidden = empty;
    renderSummary();
  });

  countrySelect?.addEventListener('change', renderSummary);

  /* ---- validation wiring ---- */

  $$('input, select, textarea', form).forEach((field) => {
    field.addEventListener('blur', () => validateField(field));
    field.addEventListener('input', () => {
      if (field.closest('.field')?.classList.contains('has-error')) validateField(field);
    });
  });

  /* ---- submit ---- */

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (cart.isEmpty()) {
      toast('Korpa je prazna.', 'err');
      return;
    }

    const fields = $$('input[name], select[name], textarea[name]', form);
    let firstBad = null;
    for (const field of fields) {
      if (!validateField(field) && !firstBad) firstBad = field;
    }
    if (firstBad) {
      firstBad.focus();
      firstBad.scrollIntoView({ block: 'center', behavior: 'smooth' });
      toast('Proverite označena polja.', 'err');
      return;
    }

    const data = new FormData(form);
    const customer = {
      name: String(data.get('name') || '').trim(),
      email: String(data.get('email') || '').trim(),
      country: String(data.get('country') || ''),
      city: String(data.get('city') || '').trim(),
      address: String(data.get('address') || '').trim(),
      phone: String(data.get('phone') || '').trim(),
      note: String(data.get('note') || '').trim(),
    };

    const order = cart.buildOrder(customer, site);
    const submit = $('#checkoutSubmit', form);
    submit?.setAttribute('disabled', '');
    submit && (submit.textContent = 'Šaljem…');

    const res = await submitOrder(order);

    if (!res.ok) {
      submit?.removeAttribute('disabled');
      submit && (submit.textContent = 'Potvrdi narudžbenicu');
      toast('Slanje nije uspelo. Pozovite nas ili pošaljite e-mail.', 'err');
      return;
    }

    // Show the printed receipt, then release the cart.
    placed = true;
    if (receipt) {
      receipt.hidden = false;
      receipt.innerHTML = `
        <p class="eyebrow eyebrow--paper">Narudžbenica primljena</p>
        <h2 class="t-display">Hvala na poručivanju</h2>
        <p class="receipt__code">${esc(order.reference)}</p>
        <p class="t-body" style="max-width:52ch">
          Narudžbenica je zabeležena. Kontaktiramo vas na <strong>${esc(order.customer.email)}</strong>
          radi potvrde i dogovora o isporuci preko Post Express-a.
          Za sve pre toga: <a href="tel:${esc(site.store.phoneHref)}">${esc(site.store.phone)}</a>.
        </p>
        <div style="display:flex;gap:.6rem;flex-wrap:wrap;justify-content:center">
          <a class="btn" href="/proizvodi/">Nastavi kupovinu</a>
          <a class="btn btn--ghost" href="/kontakt/">Kontakt</a>
        </div>`;
      receipt.scrollIntoView({ block: 'center', behavior: 'smooth' });
      receipt.setAttribute('tabindex', '-1');
      receipt.focus({ preventScroll: true });
    }
    if (layout) layout.hidden = true;
    if (emptyNotice) emptyNotice.hidden = true;
    cart.clear();
    toast('Narudžbenica je poslata');
  });

  renderSummary();
  mountArtwork(document);
}
