/* ==========================================================================
   shop.js — the catalogue: search, facets, sorting, paging, URL state.

   Every filter value is derived from the product data. Values with no matches
   in the current result set are disabled rather than silently dropped, so the
   shape of the catalogue stays visible.
   ========================================================================== */

import {
  loadProducts, buildFacets, applyFilters, sortProducts, priceBounds,
  FACET_KEYS, FACET_LABELS, facetValueLabel, SORTS, formatNumber, isOnSale,
} from './store.js';
import { $, $$, esc, renderGrid, createOverlay, toast } from './ui.js';
import { initMotion, refreshMotion } from './motion.js';

const PAGE = 48;

/** Facet key → query-string name. `availability` reads better as `status`. */
const PARAM = {
  category: 'cat', genre: 'genre', format: 'format', year: 'year',
  country: 'country', condition: 'condition', origin: 'origin', availability: 'status',
};

/* Which groups start open — the ones people actually reach for. */
const OPEN_BY_DEFAULT = new Set(['availability', 'genre', 'format']);

export async function initShop() {
  const root = $('#shop');
  if (!root) return;

  const grid = $('#grid');
  const chipsHost = $('#activeFilters');
  const countHost = $('#resultCount');
  const sortSelect = $('#sortSelect');
  const searchInput = $('#shopSearch');
  const loadMoreHost = $('#loadMore');
  const filterHosts = $$('[data-filters-host]');

  const fixedCategory = root.dataset.fixedCategory || '';
  const saleOnly = root.dataset.saleOnly === 'true';

  const all = await loadProducts();
  const scope = saleOnly
    ? all.filter(isOnSale)
    : (fixedCategory ? all.filter((p) => p.category === fixedCategory) : all);

  // A category (or the sale) with nothing in it isn't a filtering problem.
  // Stand down the whole catalogue UI and leave the designed empty state that
  // the page was built with.
  if (!scope.length) {
    root.querySelector('.filters')?.remove();
    root.querySelector('.toolbar')?.remove();
    $('#filterSheet')?.remove();
    if (grid) grid.remove();
    if (loadMoreHost) loadMoreHost.remove();
    if (chipsHost) chipsHost.remove();
    root.style.display = 'block';
    return;
  }

  const bounds = priceBounds(scope);
  const scopeFacets = buildFacets(scope);

  /* ---------------- state ---------------- */

  const state = {
    q: '',
    sort: 'newest',
    min: 0,
    max: 0,
    shown: PAGE,
  };
  FACET_KEYS.forEach((k) => { state[k] = new Set(); });

  function readURL() {
    const sp = new URLSearchParams(location.search);
    state.q = sp.get('q') || '';
    const sort = sp.get('sort');
    state.sort = SORTS.some((s) => s.value === sort) ? sort : 'newest';
    state.min = Number(sp.get('min')) || 0;
    state.max = Number(sp.get('max')) || 0;
    FACET_KEYS.forEach((key) => {
      const raw = sp.get(PARAM[key]);
      state[key] = new Set(raw ? raw.split(',').map((v) => v.trim()).filter(Boolean) : []);
    });
    if (fixedCategory) state.category = new Set();
    state.shown = PAGE;
  }

  function writeURL(replace = false) {
    const sp = new URLSearchParams();
    if (state.q) sp.set('q', state.q);
    if (state.sort !== 'newest') sp.set('sort', state.sort);
    if (state.min) sp.set('min', String(state.min));
    if (state.max) sp.set('max', String(state.max));
    FACET_KEYS.forEach((key) => {
      if (fixedCategory && key === 'category') return;
      const set = state[key];
      if (set.size) sp.set(PARAM[key], [...set].join(','));
    });
    const qs = sp.toString();
    const url = `${location.pathname}${qs ? `?${qs}` : ''}`;
    if (replace) history.replaceState(null, '', url);
    else history.pushState(null, '', url);
  }

  const activeGroups = () => FACET_KEYS.filter((k) => state[k].size);

  /* ---------------- rendering ---------------- */

  function currentResults() {
    return sortProducts(applyFilters(scope, state), state.sort);
  }

  /**
   * Counts for a group are computed with that group's own filter removed, so a
   * multi-select inside one group still shows what each option would add.
   */
  function countsFor(key, results) {
    const probe = { ...state, [key]: new Set() };
    const base = applyFilters(scope, probe);
    const map = new Map();
    for (const p of base) {
      if (key === 'availability') {
        if (p.available) map.set('available', (map.get('available') || 0) + 1);
        else map.set('sold', (map.get('sold') || 0) + 1);
        if (isOnSale(p)) map.set('sale', (map.get('sale') || 0) + 1);
      } else {
        const v = key === 'year' ? (p.year ? String(p.year) : '') : p[key];
        if (v) map.set(v, (map.get(v) || 0) + 1);
      }
    }
    return map;
  }

  function sortValues(key, values) {
    if (key === 'year') return values.sort((a, b) => Number(b) - Number(a));
    if (key === 'availability') {
      const order = ['available', 'sold', 'sale'];
      return values.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    }
    return values.sort((a, b) => a.localeCompare(b, 'sr-RS'));
  }

  function renderFilters(results) {
    const groups = FACET_KEYS
      .filter((key) => !(fixedCategory && key === 'category'))
      .filter((key) => scopeFacets[key] && scopeFacets[key].size > 0)
      .map((key) => {
        const live = countsFor(key, results);
        const values = sortValues(key, [...scopeFacets[key].keys()]);
        const selected = state[key];
        const open = OPEN_BY_DEFAULT.has(key) || selected.size > 0;

        const opts = values.map((v) => {
          const n = live.get(v) || 0;
          const checked = selected.has(v);
          const empty = n === 0 && !checked;
          return `
            <label class="opt${empty ? ' is-empty' : ''}">
              <input type="checkbox" data-facet="${esc(key)}" value="${esc(v)}"${checked ? ' checked' : ''}${empty ? ' disabled' : ''}>
              <span class="opt__box" aria-hidden="true"></span>
              <span class="opt__label">${esc(facetValueLabel(key, v))}</span>
              <span class="opt__n">${n}</span>
            </label>`;
        }).join('');

        return `
          <div class="filters__group" data-collapsed="${open ? 'false' : 'true'}">
            <button type="button" class="filters__legend" data-toggle-group aria-expanded="${open}">
              <span>${esc(FACET_LABELS[key])}${selected.size ? ` (${selected.size})` : ''}</span>
              <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 4l4 4 4-4"/></svg>
            </button>
            <div class="filters__opts">${opts}</div>
          </div>`;
      });

    const priceGroup = bounds.max > bounds.min ? `
      <div class="filters__group" data-collapsed="${state.min || state.max ? 'false' : 'true'}">
        <button type="button" class="filters__legend" data-toggle-group aria-expanded="${state.min || state.max ? 'true' : 'false'}">
          <span>Cena (RSD)</span>
          <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 4l4 4 4-4"/></svg>
        </button>
        <div class="filters__opts">
          <div class="range">
            <div class="range__row">
              <label class="sr-only" for="priceMin">Najniža cena</label>
              <input class="range__input" id="priceMin" type="number" inputmode="numeric" min="${bounds.min}" max="${bounds.max}"
                     placeholder="${bounds.min}" value="${state.min || ''}" data-price="min">
              <span class="range__sep">–</span>
              <label class="sr-only" for="priceMax">Najviša cena</label>
              <input class="range__input" id="priceMax" type="number" inputmode="numeric" min="${bounds.min}" max="${bounds.max}"
                     placeholder="${bounds.max}" value="${state.max || ''}" data-price="max">
            </div>
            <button type="button" class="btn btn--ghost" data-price-apply>Primeni</button>
          </div>
        </div>
      </div>` : '';

    const html = groups.join('') + priceGroup;
    filterHosts.forEach((host) => {
      // Keep the two copies (sidebar + mobile sheet) identical.
      host.innerHTML = html;
    });
  }

  function renderChips() {
    if (!chipsHost) return;
    const chips = [];
    for (const key of activeGroups()) {
      for (const v of state[key]) {
        chips.push(`
          <button type="button" class="chip" data-remove-facet="${esc(key)}" data-value="${esc(v)}">
            ${esc(facetValueLabel(key, v))}
            <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M1 1l10 10M11 1L1 11"/></svg>
          </button>`);
      }
    }
    if (state.min || state.max) {
      const lo = state.min ? formatNumber(state.min) : formatNumber(bounds.min);
      const hi = state.max ? formatNumber(state.max) : formatNumber(bounds.max);
      chips.push(`
        <button type="button" class="chip" data-remove-price>
          ${lo}–${hi} RSD
          <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M1 1l10 10M11 1L1 11"/></svg>
        </button>`);
    }
    if (state.q) {
      chips.push(`
        <button type="button" class="chip" data-remove-q>
          „${esc(state.q)}“
          <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M1 1l10 10M11 1L1 11"/></svg>
        </button>`);
    }
    if (chips.length) {
      chips.push('<button type="button" class="chip chip--clear" data-clear-all>Obriši filtere</button>');
    }
    chipsHost.innerHTML = chips.join('');
    chipsHost.hidden = chips.length === 0;
  }

  function renderResults(results) {
    const slice = results.slice(0, state.shown);

    if (!results.length) {
      grid.innerHTML = '';
      grid.insertAdjacentHTML('afterbegin', `
        <div class="empty" style="grid-column:1/-1">
          <p class="t-display">Nema rezultata</p>
          <p class="text-dim" style="max-width:44ch">Nijedan naslov ne odgovara izabranim filterima. Uklonite neki filter ili pretražite drugog izvođača.</p>
          <button type="button" class="btn" data-clear-all>Obriši filtere</button>
        </div>`);
    } else {
      renderGrid(grid, slice, { numbered: false });
    }

    if (countHost) {
      countHost.innerHTML = results.length
        ? `Prikazano <strong>${formatNumber(slice.length)}</strong> od <strong>${formatNumber(results.length)}</strong>`
        : 'Nema rezultata';
    }

    if (loadMoreHost) {
      const remaining = results.length - slice.length;
      loadMoreHost.innerHTML = remaining > 0 ? `
        <button type="button" class="btn btn--ghost" data-load-more>Prikaži još ${formatNumber(Math.min(PAGE, remaining))}</button>
        <p class="t-meta text-dim">Još ${formatNumber(remaining)} u ovoj selekciji</p>` : '';
    }

    refreshMotion();
    initMotion(grid);
  }

  function render({ pushUrl = true, replaceUrl = false } = {}) {
    const results = currentResults();
    renderFilters(results);
    renderChips();
    renderResults(results);
    if (searchInput && searchInput.value !== state.q) searchInput.value = state.q;
    if (sortSelect && sortSelect.value !== state.sort) sortSelect.value = state.sort;
    if (pushUrl) writeURL(replaceUrl);
  }

  /* ---------------- events ---------------- */

  document.addEventListener('change', (e) => {
    const box = e.target.closest('[data-facet]');
    if (!box) return;
    const { facet } = box.dataset;
    const set = state[facet];
    if (box.checked) set.add(box.value); else set.delete(box.value);
    state.shown = PAGE;
    render();
  });

  document.addEventListener('click', (e) => {
    const toggle = e.target.closest('[data-toggle-group]');
    if (toggle) {
      const group = toggle.closest('.filters__group');
      const collapsed = group.dataset.collapsed === 'true';
      group.dataset.collapsed = String(!collapsed);
      toggle.setAttribute('aria-expanded', String(collapsed));
      return;
    }

    const rmFacet = e.target.closest('[data-remove-facet]');
    if (rmFacet) {
      state[rmFacet.dataset.removeFacet].delete(rmFacet.dataset.value);
      state.shown = PAGE;
      render();
      return;
    }

    if (e.target.closest('[data-remove-price]')) {
      state.min = 0; state.max = 0; state.shown = PAGE; render(); return;
    }

    if (e.target.closest('[data-remove-q]')) {
      state.q = ''; state.shown = PAGE; render(); return;
    }

    if (e.target.closest('[data-clear-all]')) {
      FACET_KEYS.forEach((k) => state[k].clear());
      state.q = ''; state.min = 0; state.max = 0; state.shown = PAGE;
      render();
      toast('Filteri obrisani');
      return;
    }

    if (e.target.closest('[data-price-apply]')) {
      const lo = Number($('[data-price="min"]')?.value) || 0;
      const hi = Number($('[data-price="max"]')?.value) || 0;
      state.min = lo;
      state.max = hi && hi >= lo ? hi : 0;
      state.shown = PAGE;
      render();
      return;
    }

    if (e.target.closest('[data-load-more]')) {
      state.shown += PAGE;
      const results = currentResults();
      renderResults(results);
      // paging is not part of the shareable URL
      const btn = $('[data-load-more]');
      btn?.focus();
    }
  });

  let searchTimer = 0;
  searchInput?.addEventListener('input', () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      state.q = searchInput.value.trim();
      state.shown = PAGE;
      render({ pushUrl: true, replaceUrl: true });
    }, 180);
  });

  searchInput?.closest('form')?.addEventListener('submit', (e) => e.preventDefault());

  sortSelect?.addEventListener('change', () => {
    state.sort = sortSelect.value;
    render();
  });

  // Back / forward must restore the filtered view.
  window.addEventListener('popstate', () => {
    readURL();
    render({ pushUrl: false });
  });

  /* ---------------- mobile filter sheet ---------------- */

  const sheet = $('#filterSheet');
  if (sheet) {
    const overlay = createOverlay({
      panel: sheet,
      scrim: $('#scrim'),
      triggers: $$('[data-open-filters]'),
      closers: $$('[data-close-filters]', sheet),
      initialFocus: () => $('.filters__legend', sheet),
    });
    $('[data-apply-filters]', sheet)?.addEventListener('click', () => overlay.close());
  }

  /* ---------------- go ---------------- */

  readURL();
  if (sortSelect) {
    sortSelect.innerHTML = SORTS.map((s) => `<option value="${s.value}">${esc(s.label)}</option>`).join('');
  }
  render({ pushUrl: true, replaceUrl: true });
}
