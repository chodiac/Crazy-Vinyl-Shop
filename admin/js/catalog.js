/* ==========================================================================
   catalog.js — the Proizvodi section.

   The catalogue is not duplicated here. data/products.json stays the base,
   and Supabase holds one row per edited title carrying only the fields that
   differ from it. Open a product, change the price, and what gets stored is
   { price: 5200 } — not another copy of the record.

   Slugs are the public URLs of the product pages, so an existing product's
   slug is read-only. A new product gets to choose one, once.
   ========================================================================== */

import * as api from './api.js';
import { SITE_BASE } from '../config.js';
import { $, el, clear, toast, confirmDialog, debounce } from './ui.js';
import { pickMedia, loadMedia, mediaById, thumbUrl } from './media.js';
import { PRODUCT_IMAGE_HINT } from './schema.js';

const PAGE = 30;

/* Everything the CMS may set. Mirrors PRODUCT_FIELDS in tools/content.py —
   a field missing from one side is a field that silently never ships. */
const FIELDS = [
  'artist', 'title', 'price', 'salePrice', 'onSale', 'available', 'condition',
  'format', 'genre', 'year', 'country', 'category', 'notes', 'tracklist',
  'label', 'catalogNumber', 'stock', 'gallery', 'buyLabel', 'buyState',
  'hidden', 'featured', 'related', 'seoTitle', 'seoDescription',
];

const CATEGORIES = [
  ['ploce', 'Ploče'], ['diskovi', 'Diskovi'], ['majice', 'Majice'],
  ['solje', 'Šolje'], ['ostalo', 'Ostalo'],
];

const BUY_STATES = [
  ['auto', 'Prati dostupnost'],
  ['in', 'Uvek dostupno'],
  ['out', 'Uvek rasprodato'],
];

let base = null;            // slug -> catalogue record
let baseOrder = [];         // catalogue order
let edits = new Map();      // slug -> supabase row
let covers = new Map();     // slug -> { media_id }
let facets = { format: new Set(), genre: new Set(), condition: new Set() };

// The publish button lives in app.js and is driven by syncChrome(). Saving a
// product draft changes whether there is anything to publish, so it has to
// say so — otherwise the button stays disabled until something else happens
// to call syncChrome, which in practice meant reloading the page.
const listeners = new Set();
export const onCatalogChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = () => listeners.forEach((fn) => fn());

/* ------------------------------------------------------------------ data */

async function loadBase() {
  if (base) return base;
  const res = await fetch(`${SITE_BASE}/data/products.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error('Katalog (data/products.json) nije dostupan.');
  const list = await res.json();
  base = new Map(list.map((p) => [p.slug, p]));
  baseOrder = list.map((p) => p.slug);
  for (const p of list) {
    if (p.format) facets.format.add(p.format);
    if (p.genre) facets.genre.add(p.genre);
    if (p.condition) facets.condition.add(p.condition);
  }
  return base;
}

async function loadEdits() {
  const rows = await api.fetchProductEdits();
  edits = new Map(rows.map((r) => [r.slug, r]));
  const imgs = await api.fetchProductImages();
  covers = new Map(imgs.map((r) => [r.slug, r]));
  // Every path that refreshes the rows ends here, so this is the one place
  // the count can change — and the only place that needs to announce it.
  emit();
}

/** What the product looks like with the unpublished edits applied. */
function effective(slug) {
  const row = edits.get(slug);
  const b = base.get(slug) || {};
  if (!row) return { ...b };
  return { ...b, ...(row.draft || {}) };
}

/** Is this product's draft ahead of what the site is serving? */
function pending(slug) {
  const row = edits.get(slug);
  if (!row) return false;
  if (row.deleted && row.published_at === null) return true;
  if (row.deleted) return true;
  return JSON.stringify(row.draft ?? {}) !== JSON.stringify(row.published ?? null);
}

/** Edit rows only — cheap, and enough for the publish counter. */
export async function preloadEdits() {
  try { await loadEdits(); } catch { /* the section reports it properly */ }
}

export const pendingSlugs = () => [...edits.keys()].filter(pending);

/**
 * Publishes the edited products and then checks that the database agrees.
 *
 * publish_products() returns a run id whether it updated one row or none, so
 * the only honest way to know is to read the rows back. Whatever is still
 * pending afterwards did not publish, and the caller must say so instead of
 * reporting a success.
 *
 * Nothing here touches `draft`: a product that fails to publish keeps its
 * edit, ready to be tried again.
 */
export async function publishPending(note) {
  const requested = pendingSlugs();
  if (!requested.length) return { requested: [], published: [], stillPending: [], runId: null };

  const runId = await api.publishProducts(requested, note);
  await loadEdits();

  const stillPending = requested.filter((slug) => pending(slug));
  const published = requested.filter((slug) => !stillPending.includes(slug));
  return { requested, published, stillPending, runId };
}

export function pendingCount() {
  let n = 0;
  for (const slug of edits.keys()) if (pending(slug)) n += 1;
  return n;
}

/** Only what differs from the catalogue is stored. */
function diffPatch(slug, edited, origin) {
  const b = origin === 'cms' ? {} : (base.get(slug) || {});
  const patch = {};
  for (const key of FIELDS) {
    const next = edited[key];
    if (next === undefined) continue;
    if (JSON.stringify(next) !== JSON.stringify(b[key] ?? undefined)) patch[key] = next;
  }
  if (origin === 'cms') {
    patch.id = edited.id || `cms-${slug}`;
  }
  return patch;
}

const label = (p) => [p.artist, p.title].filter(Boolean).join(' — ') || p.slug;

const slugify = (s) => String(s || '').toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/* ------------------------------------------------------------------ view */

export async function renderCatalogView(host) {
  clear(host);
  host.append(
    el('h1', { class: 'page-title', text: 'Proizvodi' }),
    el('p', {
      class: 'page-intro',
      text: 'Katalog iz radnje, sa izmenama koje ovde napravite. Čuva se samo ono što promenite — '
        + 'ostalo ostaje kako je uvezeno. Adresa stranice proizvoda se ne menja.',
    }));

  const status = el('p', { class: 'card__note' });
  const search = el('input', { class: 'input', type: 'search', placeholder: 'Izvođač, naziv ili slug…' });

  const selFormat = el('select', { class: 'input' }, el('option', { value: '' }, 'Svi formati'));
  const selGenre = el('select', { class: 'input' }, el('option', { value: '' }, 'Svi žanrovi'));
  const selState = el('select', { class: 'input' },
    el('option', { value: '' }, 'Sva stanja'),
    el('option', { value: 'in' }, 'Na stanju'),
    el('option', { value: 'out' }, 'Rasprodato'),
    el('option', { value: 'sale' }, 'Na sniženju'));
  const selVis = el('select', { class: 'input' },
    el('option', { value: '' }, 'Sve vidljivosti'),
    el('option', { value: 'visible' }, 'Prikazano'),
    el('option', { value: 'hidden' }, 'Skriveno'),
    el('option', { value: 'featured' }, 'Istaknuto'),
    el('option', { value: 'pending' }, 'Ima nacrt'),
    el('option', { value: 'deleted' }, 'Za brisanje'));

  const list = el('div', { class: 'items' });
  const more = el('button', { class: 'btn btn--sm', type: 'button', hidden: true }, 'Prikaži još');

  host.append(el('div', { class: 'card' },
    el('div', { class: 'card__head' },
      el('h2', { class: 'card__title', text: 'Katalog' }),
      status),
    el('div', { style: 'display:flex;gap:.5rem;flex-wrap:wrap;align-items:flex-end' },
      el('button', {
        class: 'btn btn--sm btn--primary', type: 'button',
        onclick: () => openEditor(null, repaint),
      }, 'Novi proizvod')),
    el('label', { class: 'field', style: 'margin-top:.8rem' },
      el('span', { class: 'field__label', text: 'Pretraga' }), search),
    el('div', { class: 'grid-2', style: 'margin-top:.7rem' },
      selFormat, selGenre, selState, selVis),
    el('div', { style: 'height:1rem' }),
    list, more));

  let shown = PAGE;

  function matches() {
    const q = search.value.trim().toLowerCase();
    return baseOrder
      .concat([...edits.keys()].filter((s) => !base.has(s)))
      .filter((slug) => {
        const row = edits.get(slug);
        const p = effective(slug);
        if (q && !(label(p).toLowerCase().includes(q) || slug.includes(q))) return false;
        if (selFormat.value && p.format !== selFormat.value) return false;
        if (selGenre.value && p.genre !== selGenre.value) return false;
        if (selState.value === 'in' && !p.available) return false;
        if (selState.value === 'out' && p.available) return false;
        if (selState.value === 'sale' && !(p.onSale && p.salePrice)) return false;
        if (selVis.value === 'hidden' && !p.hidden) return false;
        if (selVis.value === 'visible' && p.hidden) return false;
        if (selVis.value === 'featured' && !p.featured) return false;
        if (selVis.value === 'pending' && !pending(slug)) return false;
        if (selVis.value === 'deleted' && !row?.deleted) return false;
        return true;
      });
  }

  function repaint() {
    const hits = matches();
    clear(list);
    status.textContent = `${hits.length} prikazano · ${base.size} u katalogu · ${pendingCount()} čeka objavu`;

    if (!hits.length) {
      list.append(el('p', { class: 'empty-note', text: 'Nema rezultata.' }));
      more.hidden = true;
      return;
    }
    for (const slug of hits.slice(0, shown)) list.append(row(slug, repaint));
    more.hidden = hits.length <= shown;
    more.textContent = `Prikaži još (${hits.length - shown})`;
  }

  more.addEventListener('click', () => { shown += PAGE; repaint(); });
  search.addEventListener('input', debounce(() => { shown = PAGE; repaint(); }, 200));
  for (const sel of [selFormat, selGenre, selState, selVis]) {
    sel.addEventListener('change', () => { shown = PAGE; repaint(); });
  }

  list.append(el('p', { class: 'empty-note', text: 'Učitavanje kataloga…' }));
  try {
    await Promise.all([loadBase(), loadEdits(), loadMedia()]);
    for (const f of [...facets.format].sort()) selFormat.append(el('option', { value: f }, f));
    for (const g of [...facets.genre].sort()) selGenre.append(el('option', { value: g }, g));
    repaint();
  } catch (err) {
    clear(list).append(el('p', { class: 'empty-note', text: err.message }));
  }
}

const money = (v) => (v == null || v === '' ? '—' : `${Number(v).toLocaleString('sr-RS')} RSD`);

function row(slug, repaint) {
  const p = effective(slug);
  const er = edits.get(slug);
  const cover = covers.get(slug);
  const media = cover ? mediaById(cover.media_id) : null;

  const badges = [
    er?.deleted && ['pill--hidden', 'za brisanje'],
    pending(slug) && !er?.deleted && ['pill--draft', 'nacrt'],
    p.hidden && ['pill--hidden', 'skriveno'],
    p.featured && ['pill--live', 'istaknuto'],
    !p.available && ['', 'rasprodato'],
    p.onSale && p.salePrice && ['pill--draft', 'sniženo'],
  ].filter(Boolean);

  return el('div', { class: `item${p.hidden || er?.deleted ? ' is-hidden' : ''}` },
    el('div', { class: 'img-slot' },
      media
        ? el('img', { class: 'img-slot__preview', src: thumbUrl(media, 160), alt: '', loading: 'lazy' })
        : el('div', { class: 'img-slot__preview' }),
      el('div', {},
        el('p', { class: 'item__name', text: label(p) }),
        el('p', { class: 'field__help', text: `${slug} · ${money(p.onSale && p.salePrice ? p.salePrice : p.price)}` }),
        el('div', { style: 'display:flex;gap:.3rem;flex-wrap:wrap;margin-top:.35rem' },
          ...badges.map(([cls, txt]) => el('span', { class: `pill ${cls}`, text: txt }))),
        el('div', { style: 'display:flex;gap:.4rem;margin-top:.55rem;flex-wrap:wrap' },
          el('button', { class: 'btn btn--sm', type: 'button', onclick: () => openEditor(slug, repaint) }, 'Uredi'),
          el('a', {
            class: 'btn btn--sm', href: `${SITE_BASE}/proizvod/${slug}/`,
            target: '_blank', rel: 'noopener',
          }, 'Otvori stranicu')))));
}

/* ---------------------------------------------------------------- editor */

function field(labelText, control, help) {
  return el('label', { class: 'field' },
    el('span', { class: 'field__label', text: labelText }),
    control,
    help ? el('span', { class: 'field__help', text: help }) : null);
}

const input = (value, props = {}) =>
  el('input', { class: 'input', type: 'text', value: value ?? '', ...props });

function openEditor(slug, afterSave) {
  const isNew = !slug;
  const er = slug ? edits.get(slug) : null;
  const origin = isNew ? 'cms' : (er?.origin || 'catalog');
  const p = isNew
    ? { category: 'ostalo', condition: 'Novo', currency: 'RSD', available: false,
        onSale: false, price: null, tracklist: [], notes: '', buyState: 'auto' }
    : effective(slug);

  // Edited in place; only the difference from the catalogue is ever stored.
  const draft = JSON.parse(JSON.stringify(p));

  $('#modalTitle').textContent = isNew ? 'Novi proizvod' : label(p);
  const body = clear($('#modalBody'));

  const slugInput = input(isNew ? '' : slug, { disabled: !isNew });
  const errBox = el('p', { class: 'field__err' });

  const bind = (key, control, parse = (v) => v) => {
    control.addEventListener('input', () => { draft[key] = parse(control.value); });
    control.addEventListener('change', () => { draft[key] = parse(control.value); });
    return control;
  };

  const num = (v) => (v === '' ? null : Number(v));
  const check = (key, labelText) => {
    const box = el('input', { type: 'checkbox', checked: !!draft[key] });
    box.addEventListener('change', () => { draft[key] = box.checked; });
    return el('label', { style: 'display:flex;gap:.45rem;align-items:center;font-size:13px' },
      box, labelText);
  };

  /* --- tracklist, one line per track ------------------------------------ */
  const tracks = el('textarea', { class: 'input', rows: 6 });
  tracks.value = (draft.tracklist || []).join('\n');
  tracks.addEventListener('input', () => {
    draft.tracklist = tracks.value.split('\n').map((s) => s.trim()).filter(Boolean);
  });

  /* --- related, one slug per line --------------------------------------- */
  const related = el('textarea', { class: 'input', rows: 3 });
  related.value = (draft.related || []).join('\n');
  const relatedErr = el('span', { class: 'field__err' });
  related.addEventListener('input', () => {
    const slugs = related.value.split('\n').map((s) => s.trim()).filter(Boolean);
    draft.related = slugs;
    const unknown = slugs.filter((s) => !base.has(s) && !edits.has(s));
    relatedErr.textContent = unknown.length
      ? `Ne postoje: ${unknown.slice(0, 4).join(', ')}` : '';
  });

  /* --- cover ------------------------------------------------------------ */
  const coverHost = el('div', { class: 'img-slot' });
  const drawCover = () => {
    clear(coverHost);
    const c = slug ? covers.get(slug) : null;
    const media = c ? mediaById(c.media_id) : null;
    coverHost.append(
      media
        ? el('img', { class: 'img-slot__preview', src: thumbUrl(media, 200), alt: '' })
        : el('div', { class: 'img-slot__preview' }),
      el('div', {},
        el('p', { class: 'field__help', text: `Preporuka: ${PRODUCT_IMAGE_HINT.recommended}` }),
        el('div', { style: 'display:flex;gap:.4rem;margin-top:.5rem;flex-wrap:wrap' },
          el('button', {
            class: 'btn btn--sm', type: 'button',
            disabled: isNew,
            title: isNew ? 'Prvo sačuvajte proizvod' : '',
            onclick: async () => {
              const picked = await pickMedia({ title: 'Omot', hint: PRODUCT_IMAGE_HINT });
              if (!picked) return;
              await api.setProductImage(slug, picked.id);
              covers.set(slug, { slug, media_id: picked.id });
              drawCover();
              toast('Omot dodeljen. Objavite da se vidi na sajtu.', 'ok');
            },
          }, media ? 'Zameni omot' : 'Dodaj omot'))));
  };
  drawCover();

  /* --- gallery ---------------------------------------------------------- */
  const galleryHost = el('div');
  const drawGallery = () => {
    clear(galleryHost);
    const ids = draft.gallery || [];
    const grid = el('div', { class: 'media-grid' });
    for (const [i, id] of ids.entries()) {
      const m = mediaById(id);
      grid.append(el('div', { class: 'media-tile' },
        m ? el('img', { class: 'media-tile__img', src: thumbUrl(m, 160), alt: '', loading: 'lazy' })
          : el('div', { class: 'media-tile__img' }),
        el('button', {
          class: 'btn btn--sm', type: 'button',
          onclick: () => { ids.splice(i, 1); draft.gallery = ids; drawGallery(); },
        }, 'Ukloni')));
    }
    galleryHost.append(
      ids.length ? grid : el('p', { class: 'field__help', text: 'Još nema dodatnih fotografija.' }),
      el('button', {
        class: 'btn btn--sm', type: 'button', style: 'margin-top:.5rem',
        onclick: async () => {
          const picked = await pickMedia({ title: 'Dodatna fotografija', hint: PRODUCT_IMAGE_HINT });
          if (!picked) return;
          draft.gallery = [...(draft.gallery || []), picked.id];
          drawGallery();
        },
      }, 'Dodaj fotografiju'));
  };
  drawGallery();

  /* --- free text ------------------------------------------------------- */
  const notesTa = el('textarea', { class: 'input', rows: 5 });
  notesTa.value = draft.notes || '';
  notesTa.addEventListener('input', () => { draft.notes = notesTa.value; });

  const seoDescTa = el('textarea', { class: 'input', rows: 2 });
  seoDescTa.value = draft.seoDescription || '';
  seoDescTa.addEventListener('input', () => { draft.seoDescription = seoDescTa.value; });

  const section = (title, ...kids) =>
    el('div', { class: 'card', style: 'margin-top:.9rem' },
      el('div', { class: 'card__head' }, el('h3', { class: 'card__title', text: title })),
      ...kids);

  const selectOf = (options, value) =>
    el('select', { class: 'input' },
      ...options.map(([v, t]) => el('option', { value: v, selected: v === value }, t)));

  body.append(
    errBox,

    section('Osnovno',
      el('div', { class: 'grid-2' },
        field('Izvođač', bind('artist', input(draft.artist))),
        field('Naziv albuma', bind('title', input(draft.title)))),
      field('Adresa stranice (slug)', slugInput,
        isNew
          ? 'Postaje /proizvod/<slug>/. Kasnije se ne menja, da link ne pukne.'
          : 'Ne može se menjati — stranica je već na toj adresi.'),
      el('div', { class: 'grid-2' },
        field('Kategorija', bind('category', selectOf(CATEGORIES, draft.category))),
        field('Format', bind('format', input(draft.format), (v) => v)),
        field('Žanr', bind('genre', input(draft.genre))),
        field('Godina', bind('year', input(draft.year, { type: 'number' }), num)),
        field('Zemlja', bind('country', input(draft.country))),
        field('Stanje', bind('condition', input(draft.condition))),
        field('Izdavačka kuća', bind('label', input(draft.label))),
        field('Kataloški broj', bind('catalogNumber', input(draft.catalogNumber))))),

    section('Cena i lager',
      el('div', { class: 'grid-2' },
        field('Cena', bind('price', input(draft.price, { type: 'number', min: '0' }), num),
          'Kada je sniženje uključeno, ovo je precrtana stara cena.'),
        field('Snižena cena', bind('salePrice', input(draft.salePrice, { type: 'number', min: '0' }), num)),
        field('Količina na lageru', bind('stock', input(draft.stock, { type: 'number', min: '0' }), num),
          'Prazno = ne prikazuje se.')),
      el('div', { style: 'display:grid;gap:.4rem;margin-top:.7rem' },
        check('onSale', 'Na sniženju'),
        check('available', 'Na stanju'))),

    section('Dugme za poručivanje',
      el('div', { class: 'grid-2' },
        field('Tekst dugmeta', bind('buyLabel', input(draft.buyLabel)), 'Prazno = „Dodaj u korpu”.'),
        field('Stanje dugmeta', bind('buyState', selectOf(BUY_STATES, draft.buyState || 'auto'))))),

    section('Prikaz',
      el('div', { style: 'display:grid;gap:.4rem' },
        check('hidden', 'Sakriveno — nema stranicu, ne pojavljuje se u katalogu ni u sitemap-u'),
        check('featured', 'Istaknuto'))),

    section('Opis', field('Tekst', notesTa)),

    section('Numere', field('Jedna po redu', tracks, 'Npr. A1 No Bitter End')),

    section('Omot', coverHost),
    section('Dodatne fotografije', galleryHost),

    section('Povezani naslovi',
      field('Slugovi, jedan po redu', related), relatedErr),

    section('SEO',
      field('Naslov', bind('seoTitle', input(draft.seoTitle)), 'Prazno = sastavlja se automatski.'),
      field('Opis', seoDescTa)),
  );

  const foot = clear($('#modalFoot'));

  if (!isNew) {
    foot.append(el('button', {
      class: 'btn btn--danger', type: 'button',
      onclick: async () => {
        const ok = await confirmDialog({
          title: 'Brisanje proizvoda',
          body: `Obrisati „${label(p)}”? Stranica ostaje na sajtu dok ne kliknete Objavi. `
            + 'Posle objave adresa /proizvod/' + slug + '/ više neće postojati.',
          confirmLabel: 'Obriši', danger: true,
        });
        if (!ok) return;
        try {
          if (!edits.has(slug)) await api.saveProductDraft(slug, {}, { origin });
          await api.markProductDeleted(slug, true);
          await loadEdits();
          $('#modal').hidden = true;
          toast('Označeno za brisanje. Objavite da nestane sa sajta.', 'ok');
          afterSave?.();
        } catch (err) { toast(err.message, 'err'); }
      },
    }, 'Obriši'));
  }

  foot.append(
    el('button', { class: 'btn', type: 'button', onclick: () => { $('#modal').hidden = true; } }, 'Zatvori'),
    el('button', {
      class: 'btn btn--primary', type: 'button',
      onclick: async () => {
        const targetSlug = isNew ? slugify(slugInput.value) : slug;
        errBox.textContent = '';

        if (isNew) {
          if (!targetSlug) { errBox.textContent = 'Slug je obavezan.'; return; }
          if (base.has(targetSlug) || edits.has(targetSlug)) {
            errBox.textContent = `Slug „${targetSlug}” već postoji.`; return;
          }
          slugInput.value = targetSlug;
        }

        try {
          const patch = diffPatch(targetSlug, draft, origin);
          await api.saveProductDraft(targetSlug, patch, { origin });
          await loadEdits();
          $('#modal').hidden = true;
          toast('Nacrt sačuvan. Nije još na sajtu — kliknite Objavi.', 'ok');
          afterSave?.();
        } catch (err) { errBox.textContent = err.message; }
      },
    }, 'Sačuvaj nacrt'));

  $('#modal').hidden = false;
}

export { openEditor };
