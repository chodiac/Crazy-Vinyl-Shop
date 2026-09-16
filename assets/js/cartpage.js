/* ==========================================================================
   cartpage.js — the full /korpa/ page.
   Same cart state as the drawer, rendered as a printed order sheet.
   ========================================================================== */

import { formatPrice } from './store.js';
import { url, productUrl } from './paths.js';
import { $, esc, mountArtwork, toast, cart, vinylMarkup } from './ui.js';
import { initMotion } from './motion.js';

export function initCartPage() {
  const table = $('#cartTable');
  const side = $('#cartSummary');
  if (!table || !side) return;

  function row(l) {
    const name = [l.artist, l.title].filter(Boolean).join(' – ');
    return `
      <div class="cart-row" data-line="${esc(l.slug)}">
        <span class="cart-row__art" data-art="${esc(l.slug)}"><span class="ph__code">IMG</span></span>
        <div class="cart-row__mid">
          <a href="${esc(productUrl(l.slug))}">
            ${l.artist ? `<span class="cart-row__artist">${esc(l.artist)}</span>` : ''}
            <span class="cart-row__title">${esc(l.title || l.slug)}</span>
          </a>
          <span class="t-meta text-dim">${formatPrice(l.price)} / kom.</span>
        </div>
        <div class="cart-row__end">
          <span class="qty">
            <button type="button" class="qty__btn" data-dec="${esc(l.slug)}" aria-label="Smanji količinu"${l.qty <= 1 ? ' disabled' : ''}>−</button>
            <span class="qty__val">${l.qty}</span>
            <button type="button" class="qty__btn" data-inc="${esc(l.slug)}" aria-label="Povećaj količinu"${l.qty >= cart.MAX_QTY ? ' disabled' : ''}>+</button>
          </span>
          <span class="cart-row__price">${formatPrice(l.lineTotal)}</span>
          <button type="button" class="line__remove" data-remove="${esc(l.slug)}" aria-label="Ukloni ${esc(name)}">
            <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M1 1l10 10M11 1L1 11"/></svg>
          </button>
        </div>
      </div>`;
  }

  cart.subscribe((state) => {
    if (!state.lines.length) {
      table.innerHTML = `
        <div class="empty">
          <div class="empty__disc">${vinylMarkup({ label: 'CVS', spin: false })}</div>
          <p class="t-display">Korpa je prazna</p>
          <p class="text-dim" style="max-width:44ch">Dodajte naslov iz kataloga i vratite se ovde da završite poručivanje.</p>
          <a class="btn" href="${esc(url('proizvodi/'))}">Pogledaj katalog</a>
        </div>`;
      side.innerHTML = '';
      return;
    }

    table.innerHTML = state.lines.map(row).join('');
    mountArtwork(table);

    side.innerHTML = `
      <h2 class="summary__title">Pregled</h2>
      <div class="totals">
        <div class="totals__row"><span>Artikala</span><span>${state.count}</span></div>
        <div class="totals__row"><span>Međuzbir</span><span>${formatPrice(state.subtotal)}</span></div>
        <div class="totals__row"><span>Dostava</span><span>Bira se na kasi</span></div>
        <div class="totals__row totals__row--grand"><span>Ukupno</span><span>${formatPrice(state.subtotal)}</span></div>
      </div>
      <a class="btn btn--block" href="${esc(url('checkout/'))}">Nastavi na kasu</a>
      <a class="btn btn--ghost btn--block" href="${esc(url('proizvodi/'))}">Nastavi kupovinu</a>
      <button type="button" class="btn btn--ghost btn--block" data-cart-clear>Isprazni korpu</button>`;
  });

  document.addEventListener('click', (e) => {
    const inc = e.target.closest('[data-inc]');
    const dec = e.target.closest('[data-dec]');
    const rm = e.target.closest('[data-remove]');
    const cl = e.target.closest('[data-cart-clear]');
    if (inc) cart.increment(inc.dataset.inc);
    else if (dec) cart.decrement(dec.dataset.dec);
    else if (rm) { cart.remove(rm.dataset.remove); toast('Uklonjeno iz korpe'); }
    else if (cl) { cart.clear(); toast('Korpa je ispražnjena'); }
  });

  initMotion(document);
}
