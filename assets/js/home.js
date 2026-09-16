/* ==========================================================================
   home.js — hydrates the product strips on the front page.

   Section structure and store details are rendered at build time; this fills
   in the parts that must follow the live catalogue.
   ========================================================================== */

import {
  loadProducts, newest, isOnSale, formatPrice, effectivePrice,
  taxonomyLine, buildFacets,
} from './store.js';
import { $, esc, renderGrid, buildMarquee, artworkMarkup, vinylMarkup, mountArtwork } from './ui.js';
import { initMotion, initHeroTransition } from './motion.js';
import { url } from './paths.js';
import { initTvStatic } from './tv.js';

const SELECTED_COUNT = 3;
const NEW_COUNT = 8;

export async function initHome() {
  initHeroTransition();
  initTvStatic(document.getElementById('tvStatic'));

  // The label — logo included — is a child of .vinyl__spin, so the rotation
  // engine already turns it with the record at scroll velocity. Do not add a
  // second tween here; it would spin the logo out of step with the disc.

  const products = await loadProducts();

  /* ---- novo u ponudi: real newest titles ---- */
  const newIn = $('#newIn');
  if (newIn) {
    const picks = newest(products, NEW_COUNT);
    renderGrid(newIn, picks);
  }

  /* ---- genre marquee: real genres, most stocked first ---- */
  const marquee = $('#genreMarquee');
  if (marquee) {
    const facets = buildFacets(products);
    const genres = [...facets.genre.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 14)
      .map(([g]) => g.toUpperCase());
    const extra = [];
    if (facets.origin.has('exYu')) extra.push('EX-YU');
    buildMarquee(marquee, [...genres, ...extra]);
  }

  /* ---- selected records: editorial spreads ---- */
  const selected = $('#selected');
  if (selected) {
    const pool = newest(products.filter((p) => p.available));
    const picks = [];
    // prefer titles that actually carry liner notes / a tracklist
    for (const p of pool) {
      if (picks.length >= SELECTED_COUNT) break;
      if (p.hasNotes || p.trackCount > 0) picks.push(p);
    }
    for (const p of pool) {
      if (picks.length >= SELECTED_COUNT) break;
      if (!picks.includes(p)) picks.push(p);
    }

    selected.innerHTML = picks.map((p, i) => {
      const sale = isOnSale(p);
      const tax = taxonomyLine(p);
      return `
        <article class="selected__item fade-up">
          <div class="selected__art">
            <div class="selected__disc vinyl" aria-hidden="true">
              <div class="vinyl__spin" data-spin data-speed="${(0.5 + i * 0.25).toFixed(2)}">
                <div class="vinyl__label"><span class="vinyl__labeltype">${esc((p.artist || 'CVS').slice(0, 3).toUpperCase())}</span></div>
              </div>
              <span class="vinyl__hole"></span>
            </div>
            ${artworkMarkup(p, { tag: `IZBOR / ${String(i + 1).padStart(2, '0')}` })}
          </div>
          <div>
            <p class="selected__n" aria-hidden="true">${String(i + 1).padStart(2, '0')}</p>
            ${p.artist ? `<h3 class="selected__artist">${esc(p.artist)}</h3>` : ''}
            <p class="selected__title">${esc(p.title || p.slug)}</p>
            ${tax ? `<p class="selected__tax">${tax.split(' · ').map((t) => `<span>${esc(t)}</span>`).join('')}${p.country ? `<span>${esc(p.country)}</span>` : ''}</p>` : ''}
            <div class="selected__row">
              <span class="sticker">${formatPrice(effectivePrice(p))}</span>
              ${sale ? `<s class="text-dim">${formatPrice(p.price)}</s>` : ''}
            </div>
            <div class="selected__row" style="margin-top:1.25rem">
              <a class="btn" href="${esc(p.href)}">Detalji izdanja</a>
              <button type="button" class="btn btn--ghost" data-add="${esc(p.slug)}">Dodaj u korpu</button>
            </div>
          </div>
        </article>`;
    }).join('');
    mountArtwork(selected);
  }

  /* ---- sale band: only ever shows what the catalogue marks as on sale ---- */
  const saleBand = $('#saleBand');
  if (saleBand) {
    const onSale = products.filter(isOnSale);
    const count = onSale.length;
    $('#saleCount')?.replaceChildren(document.createTextNode(String(count)));
    if (count) {
      renderGrid(saleBand, newest(onSale, 4));
    } else {
      saleBand.innerHTML = `
        <div class="empty" style="grid-column:1/-1">
          <div class="empty__disc">${vinylMarkup({ label: 'SALE', spin: false })}</div>
          <p class="t-display">Trenutno nema aktivne rasprodaje</p>
          <p class="text-dim" style="max-width:46ch">Kada neki naslovi odu na sniženje, pojaviće se ovde i na stranici Rasprodaja.</p>
          <a class="btn btn--ghost" href="${esc(url('ploce/'))}">Pogledaj ploče</a>
        </div>`;
    }
  }

  /* ---- live catalogue tallies in the hero rail ---- */
  const tally = $('#heroTally');
  if (tally) {
    const avail = products.filter((p) => p.available).length;
    tally.innerHTML = `<b>${products.length}</b> naslova &nbsp;/&nbsp; <b>${avail}</b> na stanju`;
  }

  initMotion(document);
}
