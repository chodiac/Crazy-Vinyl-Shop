/* ==========================================================================
   preview.js — the draft, in the real page.

   Rebuilding the site takes a minute or two, which is far too slow to answer
   "does this heading still fit?". So the preview loads the published page in
   an iframe and swaps the elements the build marked with data-cms for their
   draft values. Same stylesheet, same layout, same breakpoints — only the
   words differ. It never touches what visitors see: the iframe is same-origin
   and patched in memory, inside the admin, after login.
   ========================================================================== */

import { el, clear, $ } from './ui.js';
import { SITE_BASE } from '../config.js';
import * as store from './store.js';
import { GROUPS } from './schema.js';

/** data-cms keys are namespaced by document; pages is the unprefixed default. */
function resolve(key) {
  if (key.startsWith('site.')) {
    return dig(store.doc('site'), key.slice(5));
  }
  if (key.startsWith('categories.')) {
    const [, slug, ...rest] = key.split('.');
    const list = store.doc('categories') || [];
    const item = list.find((c) => c.slug === slug);
    return item ? dig(item, rest.join('.')) : undefined;
  }
  return dig(store.doc('pages'), key);
}

const dig = (obj, path) =>
  path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

const SIZES = [['Telefon', 390], ['Tablet', 820], ['Desktop', 0]];

/** Every page the preview can show, taken from the schema. */
const PAGES = (() => {
  const seen = new Map();
  for (const g of GROUPS) {
    if (g.previewPath && !seen.has(g.previewPath)) seen.set(g.previewPath, g.nav);
  }
  return Array.from(seen, ([path, label]) => ({ path, label }));
})();

export function openPreview(startPath = '/') {
  const frame = el('iframe', { class: 'preview__frame', title: 'Pregled nacrta' });

  const select = el('select', { class: 'input' },
    ...PAGES.map((p) => el('option', { value: p.path, selected: p.path === startPath }, p.label)));

  const status = el('span', { class: 'preview__note', text: 'Nacrt — nije objavljeno' });

  const sizes = el('div', { class: 'preview__sizes' },
    ...SIZES.map(([label, width]) => el('button', {
      class: 'btn btn--sm', type: 'button',
      onclick: () => {
        frame.style.width = width ? `${width}px` : '100%';
        frame.style.margin = width ? '0 auto' : '';
      },
    }, label)));

  const overlay = el('div', { class: 'preview' },
    el('div', { class: 'preview__bar' },
      status,
      select,
      sizes,
      el('button', {
        class: 'btn btn--sm', type: 'button',
        onclick: () => { overlay.remove(); document.body.style.overflow = ''; },
      }, 'Zatvori')),
    frame);

  const load = (path) => {
    const clean = path.replace(/^\//, '');
    frame.src = `${SITE_BASE}/${clean}`;
  };

  frame.addEventListener('load', () => {
    try { patch(frame.contentDocument); } catch { /* cross-origin: nothing to patch */ }
  });

  select.addEventListener('change', () => load(select.value));

  document.body.append(overlay);
  document.body.style.overflow = 'hidden';
  load(startPath);
  return overlay;
}

/** Swap text, and the href of any button whose label field has a Href twin. */
function patch(doc) {
  if (!doc) return;
  let n = 0;

  doc.querySelectorAll('[data-cms]').forEach((node) => {
    const key = node.dataset.cms;
    const value = resolve(key);
    if (value === undefined || value === null) return;
    if (node.textContent !== String(value)) { node.textContent = String(value); n += 1; }

    if (node.tagName === 'A' && /Label$/.test(key)) {
      const href = resolve(key.replace(/Label$/, 'Href'));
      if (typeof href === 'string' && href) node.setAttribute('href', href);
    }
  });

  // A band across the top so a preview is never mistaken for the live site.
  if (!doc.getElementById('cmsPreviewFlag')) {
    const flag = doc.createElement('div');
    flag.id = 'cmsPreviewFlag';
    flag.textContent = 'PREGLED NACRTA — ovo nije objavljena verzija';
    flag.style.cssText = 'position:fixed;inset:0 0 auto;z-index:99999;padding:.35rem;'
      + 'font:600 11px/1.4 ui-monospace,monospace;letter-spacing:.14em;text-align:center;'
      + 'text-transform:uppercase;color:#16140f;background:#df6f51';
    doc.body.append(flag);
    doc.body.style.paddingTop = '26px';
  }
  return n;
}
