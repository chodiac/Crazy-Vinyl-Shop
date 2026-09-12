/* ==========================================================================
   pdp.js — product page behaviour.

   The record slides out of the sleeve and keeps turning; the RPM control only
   changes how fast it turns. Nothing here plays audio.
   ========================================================================== */

import { loadProducts, related, findBySlug } from './store.js';
import { $, $$, renderGrid, toast, prefersReducedMotion } from './ui.js';
import { cart } from './ui.js';
import { initMotion } from './motion.js';

export async function initProduct() {
  const root = $('#pdp');
  if (!root) return;

  const slug = root.dataset.slug;
  const products = await loadProducts();
  const product = findBySlug(products, slug);

  /* ---- sleeve / record interaction ---- */

  const stage = $('.pdp__stage', root);
  if (stage && !prefersReducedMotion()) {
    const out = () => stage.classList.add('is-out');
    const back = () => stage.classList.remove('is-out');
    stage.addEventListener('pointerenter', out);
    stage.addEventListener('pointerleave', back);
    stage.addEventListener('focusin', out);
    stage.addEventListener('focusout', back);
    // touch: tap the sleeve to pull the record out and push it back
    stage.addEventListener('click', () => stage.classList.toggle('is-out'));
  }

  /* ---- RPM: visual speed only ---- */

  const spin = $('.pdp__disc .vinyl__spin', root);
  $$('[data-rpm]', root).forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('[data-rpm]', root).forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      if (spin) spin.dataset.speed = btn.dataset.rpm;
    });
  });

  /* ---- quantity + add to cart ---- */

  const qtyVal = $('#pdpQty', root);
  let qty = 1;

  const setQty = (n) => {
    qty = Math.min(cart.MAX_QTY, Math.max(1, n));
    if (qtyVal) qtyVal.textContent = String(qty);
    $('[data-qty-dec]', root)?.toggleAttribute('disabled', qty <= 1);
    $('[data-qty-inc]', root)?.toggleAttribute('disabled', qty >= cart.MAX_QTY);
  };

  $('[data-qty-inc]', root)?.addEventListener('click', () => setQty(qty + 1));
  $('[data-qty-dec]', root)?.addEventListener('click', () => setQty(qty - 1));
  setQty(1);

  const addBtn = $('#pdpAdd', root);
  if (addBtn && product) {
    addBtn.addEventListener('click', () => {
      const res = cart.add(product, qty);
      if (!res.ok) {
        toast(res.reason === 'soldout' ? 'Ovaj naslov je rasprodat.' : 'Nije moguće dodati u korpu.', 'err');
        return;
      }
      const bubble = $('.cart-btn');
      bubble?.classList.add('is-bumped');
      window.setTimeout(() => bubble?.classList.remove('is-bumped'), 500);
      toast(`Dodato u korpu (${qty})`);
      setQty(1);
    });
  }

  /* ---- related: same crate ---- */

  const relHost = $('#related');
  if (relHost && product) {
    const picks = related(products, product, 8);
    if (picks.length) renderGrid(relHost, picks);
    else relHost.closest('section')?.remove();
  }

  initMotion(document);
}
