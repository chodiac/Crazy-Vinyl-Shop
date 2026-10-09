/* ==========================================================================
   media.js — the image library: upload, browse, alt text, usage, deletion.

   Files live in Supabase storage and are served straight from its CDN, so the
   built site links at them rather than carrying 1,470 sleeves in the repo.
   ========================================================================== */

import * as api from './api.js';
import { el, clear, $, toast, confirmDialog, bytes, dateTime } from './ui.js';

const ACCEPT = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml'];
const MAX_BYTES = 10 * 1024 * 1024;

let rows = [];
let loaded = false;

export async function loadMedia(force = false) {
  if (loaded && !force) return rows;
  rows = await api.fetchMedia();
  loaded = true;
  return rows;
}

export const allMedia = () => rows;
export const mediaById = (id) => rows.find((r) => r.id === id) || null;

/** Storage serves the original; the grid just asks the CDN to scale it. */
export function thumbUrl(row, size = 320) {
  const base = api.publicUrl(row.storage_path);
  return row.mime === 'image/svg+xml' ? base : `${base}?width=${size}&quality=70`;
}

export function fullUrl(row) { return api.publicUrl(row.storage_path); }

/* --------------------------------------------------------------- upload */

function readDimensions(file) {
  return new Promise((resolve) => {
    if (file.type === 'image/svg+xml') return resolve({});
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(url); resolve({ width: img.naturalWidth, height: img.naturalHeight }); };
    img.onerror = () => { URL.revokeObjectURL(url); resolve({}); };
    img.src = url;
  });
}

export function validateFile(file) {
  if (!ACCEPT.includes(file.type)) {
    return `„${file.name}”: dozvoljeni su JPG, PNG, WebP, AVIF i SVG.`;
  }
  if (file.size > MAX_BYTES) {
    return `„${file.name}” je ${bytes(file.size)} — najviše ${bytes(MAX_BYTES)}.`;
  }
  return null;
}

export async function uploadFiles(fileList, onEach) {
  const files = Array.from(fileList);
  const added = [];
  for (const file of files) {
    const problem = validateFile(file);
    if (problem) { toast(problem, 'err'); continue; }
    try {
      const dims = await readDimensions(file);
      const row = await api.uploadMedia(file, dims);
      rows.unshift(row);
      added.push(row);
      onEach?.(row);
    } catch (err) {
      toast(`Otpremanje nije uspelo: ${err.message}`, 'err');
    }
  }
  if (added.length) toast(`Otpremljeno slika: ${added.length}`, 'ok');
  return added;
}

/** A drop target that also opens the file dialog. */
export function dropzone(onFiles, note) {
  const input = el('input', {
    type: 'file', accept: ACCEPT.join(','), multiple: true, hidden: true,
    onchange: () => { onFiles(input.files); input.value = ''; },
  });

  const zone = el('div', { class: 'dropzone', role: 'button', tabindex: '0' },
    el('strong', { text: 'Prevucite slike ovde' }),
    el('span', { text: 'ili kliknite da izaberete — JPG, PNG, WebP, AVIF, SVG, do 10 MB' }),
    note ? el('span', { text: note }) : null,
    input);

  const open = () => input.click();
  zone.addEventListener('click', (e) => { if (e.target !== input) open(); });
  zone.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('is-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('is-over'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('is-over');
    onFiles(e.dataTransfer.files);
  });
  return zone;
}

/* ---------------------------------------------------------------- picker */

/** Modal image picker. Resolves to a media row, or null if cancelled. */
export async function pickMedia({ title = 'Izaberite sliku', hint = {} } = {}) {
  await loadMedia();

  return new Promise((resolve) => {
    let chosen = null;

    $('#modalTitle').textContent = title;
    const body = clear($('#modalBody'));
    const grid = el('div', { class: 'media-grid' });

    const paint = () => {
      clear(grid);
      if (!rows.length) {
        grid.append(el('p', { class: 'empty-note', text: 'Biblioteka je prazna. Otpremite prvu sliku.' }));
      }
      for (const row of rows) {
        const tile = el('button', {
          class: 'media-tile', type: 'button',
          'aria-pressed': chosen?.id === row.id ? 'true' : 'false',
          onclick: () => { chosen = row; paint(); },
        },
          el('img', { class: 'media-tile__img', src: thumbUrl(row, 240), alt: row.alt || '', loading: 'lazy' }),
          el('span', { class: 'media-tile__name', text: row.filename }));
        grid.append(tile);
      }
    };

    paint();
    body.append(
      hint.recommended ? el('p', { class: 'field__help', text: `Preporuka: ${hint.recommended}` }) : null,
      dropzone(async (files) => { await uploadFiles(files); paint(); }),
      el('div', { style: 'height:.8rem' }),
      grid);

    const foot = clear($('#modalFoot'));
    foot.append(
      el('button', { class: 'btn', type: 'button', onclick: () => done(null) }, 'Odustani'),
      el('button', { class: 'btn btn--primary', type: 'button', onclick: () => done(chosen) }, 'Izaberi'));

    function done(value) {
      $('#modal').hidden = true;
      resolve(value);
    }

    $('#modal').hidden = false;
  });
}

/* ----------------------------------------------------------------- view */

export async function renderMediaView(host) {
  clear(host);
  host.append(
    el('h1', { class: 'page-title', text: 'Slike' }),
    el('p', {
      class: 'page-intro',
      text: 'Sve slike sajta na jednom mestu. Alternativni tekst opisuje sliku onima koji je ne vide i pomaže pretraživačima.',
    }));

  const grid = el('div', { class: 'media-grid' });
  const card = el('div', { class: 'card' },
    dropzone(async (files) => { await uploadFiles(files); paint(); }),
    el('div', { style: 'height:1rem' }),
    grid);
  host.append(card);

  async function paint() {
    clear(grid);
    const list = await loadMedia(true);
    if (!list.length) {
      grid.append(el('p', { class: 'empty-note', text: 'Još nema otpremljenih slika.' }));
      return;
    }
    for (const row of list) grid.append(tile(row, paint));
  }

  await loadMedia(true);
  paint();
}

function tile(row, repaint) {
  return el('button', {
    class: 'media-tile', type: 'button',
    onclick: () => openDetail(row, repaint),
  },
    el('img', { class: 'media-tile__img', src: thumbUrl(row, 240), alt: row.alt || '', loading: 'lazy' }),
    el('span', { class: 'media-tile__name', text: row.filename }),
    el('span', { class: 'media-tile__name', text: `${row.width || '?'}×${row.height || '?'} · ${bytes(row.bytes)}` }));
}

async function openDetail(row, repaint) {
  const usage = await api.mediaUsage(row.id).catch(() => []);

  $('#modalTitle').textContent = row.filename;
  const body = clear($('#modalBody'));

  const altInput = el('input', { class: 'input', type: 'text', value: row.alt || '' });

  body.append(
    el('img', { src: thumbUrl(row, 640), alt: row.alt || '', style: 'width:100%;max-height:300px;object-fit:contain;background:var(--paper-2)' }),
    el('p', { class: 'field__help', text: `${row.width || '?'} × ${row.height || '?'} px · ${bytes(row.bytes)} · ${dateTime(row.created_at)}` }),
    el('label', { class: 'field', style: 'margin-top:.8rem' },
      el('span', { class: 'field__label', text: 'Alternativni tekst' }),
      altInput,
      el('span', { class: 'field__help', text: 'Kratak opis onoga što se na slici vidi.' })),
    el('p', { class: 'field__help', style: 'margin-top:.8rem',
      text: usage.length
        ? `U upotrebi na ${usage.length} mesta: ${usage.slice(0, 8).map((u) => u.ref).join(', ')}${usage.length > 8 ? '…' : ''}`
        : 'Nije nigde u upotrebi.' }));

  const foot = clear($('#modalFoot'));
  foot.append(
    el('button', {
      class: 'btn btn--danger', type: 'button',
      disabled: usage.length > 0,
      title: usage.length ? 'Slika je u upotrebi — prvo je zamenite' : '',
      onclick: async () => {
        const ok = await confirmDialog({
          title: 'Brisanje slike',
          body: `Trajno obrisati „${row.filename}”?`,
          confirmLabel: 'Obriši', danger: true,
        });
        if (!ok) return;
        try {
          await api.deleteMedia(row);
          rows = rows.filter((r) => r.id !== row.id);
          $('#modal').hidden = true;
          toast('Slika je obrisana.', 'ok');
          repaint?.();
        } catch (err) {
          toast(err.message, 'err');
        }
      },
    }, 'Obriši'),
    el('button', { class: 'btn', type: 'button', onclick: () => { $('#modal').hidden = true; } }, 'Zatvori'),
    el('button', {
      class: 'btn btn--primary', type: 'button',
      onclick: async () => {
        try {
          await api.updateAlt(row.id, altInput.value);
          row.alt = altInput.value;
          $('#modal').hidden = true;
          toast('Sačuvano.', 'ok');
          repaint?.();
        } catch (err) { toast(err.message, 'err'); }
      },
    }, 'Sačuvaj'));

  $('#modal').hidden = false;
}
