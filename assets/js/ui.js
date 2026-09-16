/* ==========================================================================
   ui.js — shared chrome and shared markup.

   header · mobile menu · search overlay · cart drawer · toasts
   product card · artwork placeholders · vinyl markup · marquee
   ========================================================================== */

import * as cart from './cart.js';
import { url, productUrl, imageUrl, isCurrent } from './paths.js';
import {
  loadProducts, loadSite, loadImageManifest, searchProducts,
  formatPrice, taxonomyLine, isOnSale, effectivePrice, displayName,
} from './store.js';

/* --------------------------------------------------------------------------
   helpers
   -------------------------------------------------------------------------- */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* Mirrors the `rm` class set in the head, so CSS and JS never disagree. */
export const prefersReducedMotion = () =>
  document.documentElement.classList.contains('rm');

/* --------------------------------------------------------------------------
   scroll lock — keeps the page from jumping when a drawer opens
   -------------------------------------------------------------------------- */

let lockCount = 0;
let savedScroll = 0;

export function lockScroll() {
  if (lockCount === 0) {
    savedScroll = window.scrollY;
    const sbw = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.paddingRight = sbw > 0 ? `${sbw}px` : '';
    document.body.classList.add('is-locked');
  }
  lockCount += 1;
}

export function unlockScroll() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.body.classList.remove('is-locked');
    document.body.style.paddingRight = '';
    window.scrollTo({ top: savedScroll, behavior: 'instant' });
  }
}

/* --------------------------------------------------------------------------
   focus trap for overlays
   -------------------------------------------------------------------------- */

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

function trapFocus(container) {
  const onKey = (e) => {
    if (e.key !== 'Tab') return;
    const items = $$(FOCUSABLE, container).filter((el) => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  container.addEventListener('keydown', onKey);
  return () => container.removeEventListener('keydown', onKey);
}

/**
 * Wire a panel that opens/closes with a scrim, ESC, focus trap and scroll lock.
 * Returns { open, close, toggle, isOpen }.
 */
export function createOverlay({ panel, scrim, triggers = [], closers = [], initialFocus, onOpen, onClose }) {
  if (!panel) return { open() {}, close() {}, toggle() {}, isOpen: () => false };

  let open = false;
  let untrap = null;
  let lastFocused = null;

  const setState = (next) => {
    if (next === open) return;
    open = next;
    panel.dataset.open = String(open);
    panel.setAttribute('aria-hidden', String(!open));
    if (scrim) scrim.dataset.open = String(open);
    triggers.forEach((t) => t.setAttribute('aria-expanded', String(open)));

    if (open) {
      lastFocused = document.activeElement;
      lockScroll();
      untrap = trapFocus(panel);
      const target = typeof initialFocus === 'function' ? initialFocus() : initialFocus;
      window.setTimeout(() => { (target || panel).focus?.({ preventScroll: true }); }, 60);
      onOpen?.();
    } else {
      unlockScroll();
      untrap?.();
      untrap = null;
      onClose?.();
      lastFocused?.focus?.({ preventScroll: true });
    }
  };

  triggers.forEach((t) => t.addEventListener('click', (e) => { e.preventDefault(); setState(!open); }));
  closers.forEach((c) => c.addEventListener('click', (e) => { e.preventDefault(); setState(false); }));
  scrim?.addEventListener('click', () => setState(false));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) setState(false); });

  panel.dataset.open = 'false';
  panel.setAttribute('aria-hidden', 'true');

  return {
    open: () => setState(true),
    close: () => setState(false),
    toggle: () => setState(!open),
    isOpen: () => open,
  };
}

/* --------------------------------------------------------------------------
   toasts
   -------------------------------------------------------------------------- */

let toastHost = null;

export function toast(message, variant = '') {
  if (!toastHost) {
    toastHost = document.createElement('div');
    toastHost.className = 'toasts';
    toastHost.setAttribute('role', 'status');
    toastHost.setAttribute('aria-live', 'polite');
    document.body.appendChild(toastHost);
  }
  const el = document.createElement('div');
  el.className = `toast${variant ? ` toast--${variant}` : ''}`;
  el.textContent = message;
  toastHost.appendChild(el);
  window.setTimeout(() => {
    el.classList.add('is-out');
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }, 2600);
}

/* --------------------------------------------------------------------------
   vinyl markup
   -------------------------------------------------------------------------- */

/**
 * A CSS-drawn record. `spin` registers it with the scroll-velocity engine.
 * @param {{label?:string, spin?:boolean, speed?:number, className?:string}} o
 */
export function vinylMarkup(o = {}) {
  const { label = 'CVS', spin = true, speed = 1, className = '' } = o;
  return `
    <div class="vinyl ${className}" aria-hidden="true">
      <div class="vinyl__spin" data-spin${spin ? '' : '="off"'} data-speed="${speed}">
        <div class="vinyl__label">${label ? `<span class="vinyl__labeltype">${esc(label)}</span>` : ''}</div>
      </div>
      <span class="vinyl__hole"></span>
    </div>`;
}

/* --------------------------------------------------------------------------
   artwork — designed placeholder until a real file exists
   -------------------------------------------------------------------------- */

/**
 * The placeholder is intentionally legible: it names the product it is waiting
 * for, so dropping `images/products/<slug>.jpg` in place is unambiguous.
 */
export function artworkMarkup(p, { tag = 'OMOT / ARTWORK' } = {}) {
  return `
    <figure class="sleeve" data-art="${esc(p.slug)}">
      <div class="ph">
        <span class="ph__tag">${esc(tag)}</span>
        <span class="ph__mid">
          ${p.artist ? `<span class="ph__artist">${esc(p.artist)}</span>` : ''}
          ${p.title ? `<span class="ph__title">${esc(p.title)}</span>` : ''}
        </span>
        <span class="ph__code">${esc(p.slug)}.jpg</span>
      </div>
    </figure>`;
}

/**
 * Swap placeholders for real artwork, but only for slugs the manifest lists —
 * that way a catalogue with no images requests nothing and logs no 404s.
 */
export async function mountArtwork(root = document) {
  const slots = $$('[data-art]', root).filter((el) => !el.dataset.artDone);
  if (!slots.length) return;

  const manifest = await loadImageManifest();
  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        io.unobserve(entry.target);
        inject(entry.target);
      });
    }, { rootMargin: '300px' })
    : null;

  function inject(slot) {
    const slug = slot.dataset.art;
    slot.dataset.artDone = '1';
    if (!manifest.has(slug)) return;
    const img = new Image();
    img.src = imageUrl(slug);
    img.alt = slot.dataset.artAlt || '';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.addEventListener('load', () => {
      slot.querySelector('.ph')?.remove();
      slot.prepend(img);
    }, { once: true });
  }

  slots.forEach((slot) => { if (io) io.observe(slot); else inject(slot); });
}

/* --------------------------------------------------------------------------
   product card
   -------------------------------------------------------------------------- */

export function productCard(p, { index, showAdd = true } = {}) {
  const sold = !p.available;
  const sale = isOnSale(p);
  const price = effectivePrice(p);
  const tax = taxonomyLine(p);
  const name = displayName(p);
  const num = typeof index === 'number' ? String(index + 1).padStart(3, '0') : '';

  const flags = [];
  if (sold) flags.push('<span class="flag flag--sold">Rasprodato</span>');
  else if (sale) flags.push('<span class="flag flag--sale">Sniženo</span>');

  const action = sold
    ? '<span class="card__sold">Nije dostupno</span>'
    : (showAdd
      ? `<button type="button" class="card__add" data-add="${esc(p.slug)}" aria-label="Dodaj ${esc(name)} u korpu">Dodaj u korpu</button>`
      : '');

  return `
    <article class="card${sold ? ' is-sold' : ''} fade-up" data-slug="${esc(p.slug)}">
      <a class="card__link" href="${esc(p.href)}">
        <div class="card__crate">
          <div class="card__disc vinyl" aria-hidden="true">
            <div class="vinyl__label"><span class="vinyl__labeltype">${esc((p.artist || p.title || 'CVS').slice(0, 3).toUpperCase())}</span></div>
            <span class="vinyl__hole"></span>
          </div>
          ${artworkMarkup(p)}
          ${flags.join('')}
        </div>
        <div class="card__meta">
          ${p.artist ? `<h3 class="card__artist">${esc(p.artist)}</h3>` : ''}
          <p class="card__title">${esc(p.title || p.artist || p.slug)}</p>
          ${tax ? `<p class="card__tax">${esc(tax)}${num ? ` · ${num}` : ''}</p>` : ''}
        </div>
      </a>
      <div class="card__foot">
        <span class="card__price">${sale ? `<s>${formatPrice(p.price)}</s>` : ''}${formatPrice(price)}</span>
        ${action}
      </div>
    </article>`;
}

export function renderGrid(host, products, opts = {}) {
  if (!host) return;
  host.innerHTML = products.map((p, i) => productCard(p, { ...opts, index: opts.numbered ? i : undefined })).join('');
  mountArtwork(host);
}

/* --------------------------------------------------------------------------
   add to cart — a small record flies to the cart icon
   -------------------------------------------------------------------------- */

function flyToCart(fromEl) {
  if (prefersReducedMotion() || !fromEl) return;
  const target = $('.cart-btn');
  if (!target) return;

  const a = fromEl.getBoundingClientRect();
  const b = target.getBoundingClientRect();
  const disc = document.createElement('span');
  disc.className = 'fly-disc';
  disc.style.left = `${a.left + a.width / 2 - 23}px`;
  disc.style.top = `${a.top + a.height / 2 - 23}px`;
  document.body.appendChild(disc);

  const dx = (b.left + b.width / 2) - (a.left + a.width / 2);
  const dy = (b.top + b.height / 2) - (a.top + a.height / 2);

  disc.animate([
    { transform: 'translate(0,0) scale(1) rotate(0deg)', opacity: 1 },
    { transform: `translate(${dx * 0.55}px, ${dy * 0.55 - 60}px) scale(.8) rotate(280deg)`, opacity: 1, offset: 0.6 },
    { transform: `translate(${dx}px, ${dy}px) scale(.15) rotate(520deg)`, opacity: 0 },
  ], { duration: 680, easing: 'cubic-bezier(.3,.7,.2,1)' })
    .addEventListener('finish', () => disc.remove());
}

/** Delegate every `[data-add]` button on the page to the cart. */
export function wireAddButtons(products) {
  const bySlug = new Map(products.map((p) => [p.slug, p]));

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-add]');
    if (!btn) return;
    e.preventDefault();

    const product = bySlug.get(btn.dataset.add);
    if (!product) return;

    const res = cart.add(product, 1);
    if (!res.ok) {
      const msg = res.reason === 'soldout'
        ? 'Ovaj naslov je rasprodat.'
        : res.reason === 'max'
          ? 'Dostigli ste najveću količinu za ovaj naslov.'
          : 'Nije moguće dodati u korpu.';
      toast(msg, 'err');
      return;
    }

    flyToCart(btn);
    btn.classList.add('is-added');
    const label = btn.textContent;
    if (btn.classList.contains('card__add')) btn.textContent = 'Dodato';
    window.setTimeout(() => {
      btn.classList.remove('is-added');
      if (btn.classList.contains('card__add')) btn.textContent = label;
    }, 1400);

    const bubble = $('.cart-btn');
    bubble?.classList.add('is-bumped');
    window.setTimeout(() => bubble?.classList.remove('is-bumped'), 500);
    toast(`${displayName(product)} — dodato u korpu`);
  });
}

/* --------------------------------------------------------------------------
   theme

   The head sets data-theme before first paint; this only handles the toggle
   and remembers the choice. Nothing else in the CSS or JS knows which theme
   is active — it is all token values.
   -------------------------------------------------------------------------- */

const THEME_KEY = 'cvs.theme';

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);

  const toLight = theme === 'dark';
  $$('[data-theme-toggle]').forEach((btn) => {
    btn.setAttribute('aria-label', toLight ? 'Prebaci na svetlu temu' : 'Prebaci na tamnu temu');
    btn.setAttribute('title', toLight ? 'Svetla tema' : 'Tamna tema');
    if (btn.hasAttribute('data-theme-label')) btn.textContent = toLight ? 'Svetla tema' : 'Tamna tema';
  });

  const meta = $('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'light' ? '#f4efe4' : '#0e0e10');
}

/* --------------------------------------------------------------------------
   motion preference

   The operating system's reduced-motion setting is the default, but it is a
   default, not a verdict: a visitor who wants the record to spin can say so and
   it sticks. That is what the `?motion=1` flag used to be needed for.
   -------------------------------------------------------------------------- */

const MOTION_KEY = 'cvs.motion';

function motionLabel() {
  const on = !prefersReducedMotion();
  $$('[data-motion-toggle]').forEach((btn) => {
    btn.textContent = on ? 'Animacije: uključene' : 'Animacije: isključene';
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('title', on ? 'Isključi animacije' : 'Uključi animacije');
  });
}

function initMotionPref() {
  motionLabel();

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-motion-toggle]');
    if (!btn) return;
    e.preventDefault();
    const next = prefersReducedMotion() ? 'full' : 'reduced';
    try { localStorage.setItem(MOTION_KEY, next); } catch { /* private mode */ }
    // The hero rig, spinners and reveals are built from this at boot, so the
    // honest way to apply it is a reload rather than half-rewiring them.
    location.reload();
  });
}

function initTheme() {
  const current = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  applyTheme(current);

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-theme-toggle]');
    if (!btn) return;
    e.preventDefault();
    const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    applyTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch { /* private mode */ }
  });

  // another tab changed it
  window.addEventListener('storage', (e) => {
    if (e.key === THEME_KEY && (e.newValue === 'light' || e.newValue === 'dark')) applyTheme(e.newValue);
  });
}

/* --------------------------------------------------------------------------
   header
   -------------------------------------------------------------------------- */

function initHeader() {
  const header = $('.header');
  if (!header) return;
  let last = window.scrollY;

  const onScroll = () => {
    const y = window.scrollY;
    header.classList.toggle('is-stuck', y > 40);
    // hide on the way down, reveal on the way up, but never over the hero
    const goingDown = y > last && y > 320;
    header.classList.toggle('is-hidden', goingDown && !document.body.classList.contains('is-locked'));
    last = y;
  };

  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}

/* --------------------------------------------------------------------------
   mobile menu
   -------------------------------------------------------------------------- */

function initMobileMenu() {
  const panel = $('#mobileMenu');
  const burger = $('#burger');
  if (!panel || !burger) return;
  createOverlay({
    panel,
    triggers: [burger],
    closers: $$('[data-close-menu]', panel),
    initialFocus: () => $('.mobile-menu__link', panel),
  });
}

/* --------------------------------------------------------------------------
   search overlay
   -------------------------------------------------------------------------- */

async function initSearch() {
  const panel = $('#searchOverlay');
  const trigger = $('#searchTrigger');
  if (!panel || !trigger) return;

  const input = $('#searchInput', panel);
  const results = $('#searchResults', panel);
  const count = $('#searchCount', panel);
  const hint = $('#searchHint', panel);

  const overlay = createOverlay({
    panel,
    triggers: [trigger],
    closers: $$('[data-close-search]', panel),
    initialFocus: () => input,
  });

  // "/" focuses search the way a catalogue terminal would
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '')) {
      e.preventDefault();
      overlay.open();
    }
  });

  const products = await loadProducts();

  const render = (q) => {
    const hits = searchProducts(products, q);
    if (q.trim().length < 2) {
      results.innerHTML = '';
      count.textContent = `${products.length} naslova u katalogu`;
      hint.hidden = false;
      return;
    }
    hint.hidden = true;
    if (!hits.length) {
      count.textContent = 'Nema rezultata';
      results.innerHTML = `<p class="search__none text-dim">Nema rezultata za „${esc(q)}“. Probajte drugog izvođača ili žanr.</p>`;
      return;
    }
    count.textContent = `${hits.length} ${hits.length === 1 ? 'rezultat' : 'rezultata'}`;
    results.innerHTML = hits.map((p) => `
      <a class="search__result" href="${esc(p.href)}">
        <span class="search__result-art" data-art="${esc(p.slug)}"><span class="ph__code">IMG</span></span>
        <span>
          ${p.artist ? `<span class="search__result-artist">${esc(p.artist)}</span>` : ''}
          <span class="search__result-title">${esc(p.title || p.slug)}${p.year ? ` · ${p.year}` : ''}</span>
        </span>
        <span class="search__result-side">
          ${formatPrice(effectivePrice(p))}<br>
          <span class="${p.available ? 'text-terra' : 'text-dim'}">${p.available ? 'Na stanju' : 'Rasprodato'}</span>
        </span>
      </a>`).join('');
    mountArtwork(results);
  };

  let t = 0;
  input.addEventListener('input', () => {
    window.clearTimeout(t);
    t = window.setTimeout(() => render(input.value), 110);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const q = input.value.trim();
      if (q) window.location.href = url(`proizvodi/?q=${encodeURIComponent(q)}`);
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      $('.search__result', results)?.focus();
    }
  });

  render('');
}

/* --------------------------------------------------------------------------
   cart drawer
   -------------------------------------------------------------------------- */

function lineMarkup(l) {
  const name = [l.artist, l.title].filter(Boolean).join(' – ');
  return `
    <div class="line" data-line="${esc(l.slug)}">
      <span class="line__art" data-art="${esc(l.slug)}"><span class="ph__code">IMG</span></span>
      <div>
        <div class="line__head">
          <a href="${esc(productUrl(l.slug))}">
            ${l.artist ? `<span class="line__artist">${esc(l.artist)}</span>` : ''}
            <span class="line__title">${esc(l.title || l.slug)}</span>
          </a>
          <button type="button" class="line__remove" data-remove="${esc(l.slug)}" aria-label="Ukloni ${esc(name)} iz korpe">
            <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M1 1l10 10M11 1L1 11"/></svg>
          </button>
        </div>
        <div class="line__bottom">
          <span class="qty">
            <button type="button" class="qty__btn" data-dec="${esc(l.slug)}" aria-label="Smanji količinu"${l.qty <= 1 ? ' disabled' : ''}>−</button>
            <span class="qty__val" aria-live="polite">${l.qty}</span>
            <button type="button" class="qty__btn" data-inc="${esc(l.slug)}" aria-label="Povećaj količinu"${l.qty >= cart.MAX_QTY ? ' disabled' : ''}>+</button>
          </span>
          <span class="line__price">${formatPrice(l.lineTotal)}</span>
        </div>
      </div>
    </div>`;
}

function initCartDrawer() {
  const panel = $('#cartDrawer');
  const trigger = $('.cart-btn');
  if (!panel || !trigger) return;

  const scrim = $('#scrim');
  const body = $('#cartDrawerBody', panel);
  const foot = $('#cartDrawerFoot', panel);

  const overlay = createOverlay({
    panel,
    scrim,
    triggers: [trigger],
    closers: $$('[data-close-cart]', panel),
    initialFocus: () => $('[data-close-cart]', panel),
  });

  cart.subscribe((state) => {
    trigger.classList.toggle('has-items', state.count > 0);
    const badge = $('.cart-btn__count', trigger);
    if (badge) badge.textContent = String(state.count);
    trigger.setAttribute('aria-label', state.count
      ? `Korpa, ${state.count} ${state.count === 1 ? 'artikal' : 'artikala'}`
      : 'Korpa, prazna');

    if (!state.lines.length) {
      body.innerHTML = `
        <div class="drawer__empty">
          <div style="width:120px">${vinylMarkup({ label: 'CVS', spin: false })}</div>
          <p class="t-meta text-dim">Korpa je prazna</p>
          <a class="btn btn--ghost" href="${esc(url('proizvodi/'))}" data-close-cart>Nastavi kupovinu</a>
        </div>`;
      foot.innerHTML = '';
      return;
    }

    body.innerHTML = state.lines.map(lineMarkup).join('');
    mountArtwork(body);
    foot.innerHTML = `
      <div class="totals">
        <div class="totals__row"><span>Međuzbir (${state.count})</span><span>${formatPrice(state.subtotal)}</span></div>
        <div class="totals__row"><span>Dostava</span><span>Računa se na kasi</span></div>
        <div class="totals__row totals__row--grand"><span>Ukupno</span><span>${formatPrice(state.subtotal)}</span></div>
      </div>
      <a class="btn btn--block" href="${esc(url('checkout/'))}">Na kasu</a>
      <div style="display:grid;grid-auto-flow:column;gap:.6rem">
        <a class="btn btn--ghost" href="${esc(url('korpa/'))}">Korpa</a>
        <button type="button" class="btn btn--ghost" data-cart-clear>Isprazni</button>
      </div>`;
  });

  panel.addEventListener('click', (e) => {
    const inc = e.target.closest('[data-inc]');
    const dec = e.target.closest('[data-dec]');
    const rm = e.target.closest('[data-remove]');
    const cl = e.target.closest('[data-cart-clear]');
    if (inc) cart.increment(inc.dataset.inc);
    else if (dec) cart.decrement(dec.dataset.dec);
    else if (rm) { cart.remove(rm.dataset.remove); toast('Uklonjeno iz korpe'); }
    else if (cl) { cart.clear(); toast('Korpa je ispražnjena'); }
  });

  // Deep link: /?cart=open or a link to #korpa opens the drawer.
  if (new URLSearchParams(location.search).get('cart') === 'open') overlay.open();
}

/* --------------------------------------------------------------------------
   marquee — duplicated once so the loop is seamless
   -------------------------------------------------------------------------- */

export function buildMarquee(host, items) {
  if (!host || !items.length) return;

  // Rebuild the track only. The .marquee wrapper carries --speed, the rules
  // above and below, and the hover pause; replacing the host's whole contents
  // threw it away, the animation shorthand resolved against an empty --speed,
  // and the strip could then only be moved by something outside itself.
  const frame = host.classList.contains('marquee') ? host : host.querySelector('.marquee');
  const track = frame && frame.querySelector('.marquee__track');
  if (!track) return;

  const group = items.map((t) => `<span class="marquee__item">${esc(t)}</span><span class="marquee__dot"></span>`).join('');
  track.innerHTML = `<div class="marquee__group">${group}</div><div class="marquee__group" aria-hidden="true">${group}</div>`;
}

/* --------------------------------------------------------------------------
   current-page marking
   -------------------------------------------------------------------------- */

function markCurrent() {
  // resolved URLs, so this works with relative hrefs at any depth
  $$('.nav a[href], .mobile-menu a[href], .cat-rail a[href]').forEach((a) => {
    if (isCurrent(a.href)) a.setAttribute('aria-current', 'page');
  });
}

/* --------------------------------------------------------------------------
   boot
   -------------------------------------------------------------------------- */

export async function initChrome() {
  document.documentElement.classList.remove('no-js');
  initTheme();
  initMotionPref();
  initHeader();
  initMobileMenu();
  initCartDrawer();
  markCurrent();
  initSearch();
  const products = await loadProducts();
  wireAddButtons(products);
  mountArtwork(document);
  return products;
}

export { cart, loadSite };
