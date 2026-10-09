/* ==========================================================================
   ui.js — small shared pieces: DOM helpers, toasts, modals, path access.
   ========================================================================== */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** Builds an element. Text content is set as text, never as HTML. */
export function el(tag, props = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid === null || kid === undefined || kid === false) continue;
    node.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return node;
}

export const clear = (node) => { while (node.firstChild) node.firstChild.remove(); return node; };

/* ---------------------------------------------------------------- paths */

/** get(obj, 'a.b.c') — undefined rather than a throw on a missing branch. */
export function get(obj, path) {
  if (!path) return obj;
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

/** set(obj, 'a.b.c', v) — creates the branch as it goes. Mutates obj. */
export function set(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  let cur = obj;
  for (const k of keys) {
    if (cur[k] == null || typeof cur[k] !== 'object') cur[k] = {};
    cur = cur[k];
  }
  cur[last] = value;
  return obj;
}

export const clone = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
export const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/* --------------------------------------------------------------- toasts */

export function toast(message, variant = '') {
  const host = $('#toasts');
  const node = el('div', { class: `toast${variant ? ` toast--${variant}` : ''}`, text: message });
  host.append(node);
  setTimeout(() => node.remove(), variant === 'err' ? 6500 : 3800);
  return node;
}

/* ---------------------------------------------------------------- modal */

let modalResolve = null;

function closeModal(value) {
  $('#modal').hidden = true;
  modalResolve?.(value);
  modalResolve = null;
}

$('#modal').addEventListener('click', (e) => {
  if (e.target.hasAttribute('data-modal-close')) closeModal(false);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('#modal').hidden) closeModal(false);
});

/**
 * A yes/no the user must answer. Destructive actions pass danger:true so the
 * confirming button reads as the dangerous one.
 */
export function confirmDialog({ title, body, confirmLabel = 'Potvrdi', danger = false }) {
  $('#modalTitle').textContent = title;
  const bodyHost = clear($('#modalBody'));
  bodyHost.append(typeof body === 'string' ? el('p', { text: body }) : body);

  const foot = clear($('#modalFoot'));
  foot.append(
    el('button', { class: 'btn', type: 'button', onclick: () => closeModal(false) }, 'Odustani'),
    el('button', {
      class: `btn ${danger ? 'btn--danger' : 'btn--primary'}`, type: 'button',
      onclick: () => closeModal(true),
    }, confirmLabel),
  );

  $('#modal').hidden = false;
  foot.lastElementChild.focus();
  return new Promise((res) => { modalResolve = res; });
}

/* --------------------------------------------------------------- misc */

export function debounce(fn, ms = 400) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

export const bytes = (n) =>
  (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} kB`);

export const dateTime = (iso) =>
  iso ? new Date(iso).toLocaleString('sr-RS', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

/**
 * Only http(s), mailto, tel and site-relative paths are allowed through, so a
 * pasted `javascript:` link can never become a button destination.
 */
export function validUrl(value) {
  const v = String(value || '').trim();
  if (!v) return true;
  if (v.startsWith('/') || v.startsWith('#') || v.startsWith('./')) return true;
  return /^(https?:|mailto:|tel:)/i.test(v);
}
