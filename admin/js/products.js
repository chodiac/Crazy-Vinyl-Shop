/* ==========================================================================
   products.js — artwork for catalogue titles.

   The catalogue itself (artist, title, price, stock) belongs to the shop and
   is not edited here. What is missing from it is the sleeve: every title ships
   with a placeholder until a photograph is attached, and this is where that
   happens.
   ========================================================================== */

import * as api from './api.js';
import { el, clear, toast, confirmDialog, debounce } from './ui.js';
import { pickMedia, loadMedia, mediaById, thumbUrl } from './media.js';
import { PRODUCT_IMAGE_HINT } from './schema.js';
import { SITE_BASE } from '../config.js';

const PAGE = 40;

let catalogue = [];   // { slug, artist, title }
let attached = new Map();  // slug -> { media_id, storage_path, alt }

async function loadCatalogue() {
  if (catalogue.length) return catalogue;
  const res = await fetch(`${SITE_BASE}/data/index.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error('Katalog nije dostupan.');
  const { fields, rows } = await res.json();
  const iSlug = fields.indexOf('slug');
  const iArtist = fields.indexOf('artist');
  const iTitle = fields.indexOf('title');
  catalogue = rows.map((r) => ({ slug: r[iSlug], artist: r[iArtist], title: r[iTitle] }));
  return catalogue;
}

async function loadAttached() {
  const rows = await api.fetchProductImages();
  attached = new Map(rows.map((r) => [r.slug, {
    media_id: r.media_id,
    storage_path: r.media?.storage_path,
    alt: r.media?.alt || '',
  }]));
}

const label = (p) => [p.artist, p.title].filter(Boolean).join(' — ') || p.slug;

export async function renderProductsView(host) {
  clear(host);
  host.append(
    el('h1', { class: 'page-title', text: 'Omoti proizvoda' }),
    el('p', {
      class: 'page-intro',
      text: 'Naslovi, cene i stanje dolaze iz kataloga radnje i ne menjaju se ovde. '
        + 'Ovde se svakom naslovu dodaje slika omota umesto praznog mesta.',
    }));

  const status = el('p', { class: 'card__note' });
  const search = el('input', {
    class: 'input', type: 'search',
    placeholder: 'Pretraga po izvođaču, naslovu ili oznaci…',
  });
  const onlyMissing = el('input', { type: 'checkbox' });

  const list = el('div', { class: 'items' });
  const more = el('button', { class: 'btn btn--sm', type: 'button', hidden: true }, 'Prikaži još');

  host.append(el('div', { class: 'card' },
    el('div', { class: 'card__head' },
      el('h2', { class: 'card__title', text: 'Katalog' }), status),
    el('label', { class: 'field' },
      el('span', { class: 'field__label', text: 'Pretraga' }), search),
    el('label', { style: 'display:flex;gap:.45rem;align-items:center;margin-top:.7rem;font-size:13px' },
      onlyMissing, 'Prikaži samo naslove bez slike'),
    el('p', { class: 'field__help', style: 'margin-top:.5rem',
      text: `Preporuka: ${PRODUCT_IMAGE_HINT.recommended} (odnos ${PRODUCT_IMAGE_HINT.ratio}).` }),
    el('div', { style: 'height:1rem' }),
    list, more));

  let shown = PAGE;

  function filtered() {
    const q = search.value.trim().toLowerCase();
    return catalogue.filter((p) => {
      if (onlyMissing.checked && attached.has(p.slug)) return false;
      if (!q) return true;
      return label(p).toLowerCase().includes(q) || p.slug.includes(q);
    });
  }

  function paint() {
    const matches = filtered();
    clear(list);
    status.textContent = `${attached.size} od ${catalogue.length} sa slikom`;

    if (!matches.length) {
      list.append(el('p', { class: 'empty-note', text: 'Nema rezultata.' }));
      more.hidden = true;
      return;
    }

    for (const p of matches.slice(0, shown)) list.append(row(p, paint));
    more.hidden = matches.length <= shown;
    more.textContent = `Prikaži još (${matches.length - shown})`;
  }

  more.addEventListener('click', () => { shown += PAGE; paint(); });
  search.addEventListener('input', debounce(() => { shown = PAGE; paint(); }, 200));
  onlyMissing.addEventListener('change', () => { shown = PAGE; paint(); });

  list.append(el('p', { class: 'empty-note', text: 'Učitavanje kataloga…' }));
  try {
    await Promise.all([loadCatalogue(), loadAttached(), loadMedia()]);
    paint();
  } catch (err) {
    clear(list).append(el('p', { class: 'empty-note', text: err.message }));
  }
}

function row(p, repaint) {
  const current = attached.get(p.slug);
  const media = current ? mediaById(current.media_id) : null;

  const preview = media
    ? el('img', { class: 'img-slot__preview', src: thumbUrl(media, 160), alt: media.alt || '', loading: 'lazy' })
    : el('div', { class: 'img-slot__preview' });

  const attach = async () => {
    const picked = await pickMedia({ title: label(p), hint: PRODUCT_IMAGE_HINT });
    if (!picked) return;
    try {
      await api.setProductImage(p.slug, picked.id);
      attached.set(p.slug, { media_id: picked.id, storage_path: picked.storage_path, alt: picked.alt });
      toast('Slika je dodeljena. Objavite da se vidi na sajtu.', 'ok');
      repaint();
    } catch (err) { toast(err.message, 'err'); }
  };

  const detach = async () => {
    const ok = await confirmDialog({
      title: 'Uklanjanje slike',
      body: `Vratiti prazno mesto za „${label(p)}”? Slika ostaje u biblioteci.`,
      confirmLabel: 'Ukloni', danger: true,
    });
    if (!ok) return;
    try {
      await api.clearProductImage(p.slug);
      attached.delete(p.slug);
      repaint();
    } catch (err) { toast(err.message, 'err'); }
  };

  return el('div', { class: 'item' },
    el('div', { class: 'img-slot' },
      preview,
      el('div', {},
        el('p', { class: 'item__name', text: label(p) }),
        el('p', { class: 'field__help', text: p.slug }),
        media ? el('p', { class: 'field__help', text: `${media.filename} · ${media.alt ? 'alt: ' + media.alt : 'bez alt teksta'}` }) : null,
        el('div', { style: 'display:flex;gap:.4rem;margin-top:.5rem;flex-wrap:wrap' },
          el('button', { class: 'btn btn--sm', type: 'button', onclick: attach },
            media ? 'Zameni' : 'Dodaj sliku'),
          media ? el('button', { class: 'btn btn--sm', type: 'button', onclick: detach }, 'Ukloni') : null,
          el('a', {
            class: 'btn btn--sm', href: `${SITE_BASE}/proizvod/${p.slug}/`,
            target: '_blank', rel: 'noopener',
          }, 'Otvori stranicu')))));
}
