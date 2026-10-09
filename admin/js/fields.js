/* ==========================================================================
   fields.js — turns a schema field into DOM bound to the working document.

   Every control writes straight into the working copy and reports the change,
   which is what keeps the dirty indicator, the save button and the preview in
   step with each other.
   ========================================================================== */

import { el, clear, get, set, confirmDialog, validUrl, clone } from './ui.js';
import { IMAGE_SLOTS } from './schema.js';
import { pickMedia, mediaById, thumbUrl } from './media.js';
import * as store from './store.js';

const ICON = {
  up: 'M12 19V5M5 12l7-7 7 7',
  down: 'M12 5v14M19 12l-7 7-7-7',
  trash: 'M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14',
  eye: 'M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z M12 9a3 3 0 100 6 3 3 0 000-6z',
  eyeOff: 'M3 3l18 18M10.6 10.6a3 3 0 004.2 4.2M9.9 5.1A10 10 0 0112 5c7 0 11 7 11 7a18 18 0 01-3.2 4M6.2 6.2A18 18 0 001 12s4 7 11 7a10 10 0 004-.8',
  swap: 'M4 7h12l-3-3M20 17H8l3 3',
};

const icon = (d) => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  for (const part of d.split(' M').map((p, i) => (i ? `M${p}` : p))) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', part);
    svg.append(path);
  }
  return svg;
};

const toolBtn = (label, d, onclick) =>
  el('button', { class: 'icon-btn', type: 'button', title: label, 'aria-label': label, onclick },
    icon(d));

/* ------------------------------------------------------------------------ */

/**
 * @param {object} ctx  { docKey, obj, onInput }  obj is the object the field's
 *                      path is relative to — the document, or one array item.
 */
export function renderField(field, ctx) {
  switch (field.type) {
    case 'items': return renderItems(field, ctx);
    case 'image': return renderImage(field, ctx);
    case 'list': return renderList(field, ctx);
    case 'select': return renderSelect(field, ctx);
    default: return renderInput(field, ctx);
  }
}

function labelled(field, control, extra) {
  const help = field.help ? el('span', { class: 'field__help', text: field.help }) : null;
  return el('label', { class: 'field' },
    el('span', { class: 'field__label', text: field.label }),
    control, extra, help);
}

function renderInput(field, ctx) {
  const value = get(ctx.obj, field.path) ?? '';
  const multiline = field.type === 'textarea';
  const control = el(multiline ? 'textarea' : 'input', {
    class: 'input',
    type: multiline ? null : ({ url: 'text', tel: 'tel', email: 'email', number: 'number' }[field.type] || 'text'),
    value: multiline ? null : value,
    rows: multiline ? 3 : null,
  });
  if (multiline) control.value = value;

  const counter = field.max
    ? el('span', { class: 'field__help' })
    : null;
  const err = el('span', { class: 'field__err' });

  const sync = () => {
    let v = control.value;
    if (field.type === 'number') v = v === '' ? null : Number(v);
    set(ctx.obj, field.path, v);

    let message = '';
    if (field.type === 'url' && !validUrl(control.value)) {
      message = 'Dozvoljeni su http(s), mailto, tel ili putanja koja počinje sa /.';
    } else if (field.type === 'email' && control.value && !control.checkValidity()) {
      message = 'Proverite e-mail adresu.';
    }
    control.setAttribute('aria-invalid', message ? 'true' : 'false');
    err.textContent = message;

    if (counter) {
      const n = control.value.length;
      counter.textContent = `${n} / ${field.max} znakova${n > field.max ? ' — predugačko' : ''}`;
      counter.style.color = n > field.max ? 'var(--warn)' : '';
    }
    ctx.onInput?.(field);
  };

  control.addEventListener('input', sync);
  if (counter) {
    const n = String(value).length;
    counter.textContent = `${n} / ${field.max} znakova`;
  }
  return labelled(field, control, el('span', {}, counter || '', err));
}

function renderSelect(field, ctx) {
  const value = get(ctx.obj, field.path) ?? field.options[0][0];
  const control = el('select', { class: 'input' },
    ...field.options.map(([v, label]) => el('option', { value: v, selected: v === value }, label)));
  control.addEventListener('change', () => {
    set(ctx.obj, field.path, control.value);
    ctx.onInput?.(field);
  });
  return labelled(field, control);
}

/** A plain array of strings, edited one per line. */
function renderList(field, ctx) {
  const value = get(ctx.obj, field.path) || [];
  const control = el('textarea', { class: 'input', rows: Math.max(3, value.length) });
  control.value = value.join('\n');
  control.addEventListener('input', () => {
    set(ctx.obj, field.path,
      control.value.split('\n').map((s) => s.trim()).filter(Boolean));
    ctx.onInput?.(field);
  });
  return labelled(field, control);
}

/* ------------------------------------------------------------- image slot */

function renderImage(field, ctx) {
  const host = el('div', { class: 'img-slot' });
  const hint = IMAGE_SLOTS[field.slot] || {};

  const draw = () => {
    clear(host);
    const id = get(ctx.obj, field.path);
    const row = id ? mediaById(id) : null;

    host.append(
      row
        ? el('img', { class: 'img-slot__preview', src: thumbUrl(row), alt: row.alt || '' })
        : el('div', { class: 'img-slot__preview' }),
      el('div', {},
        el('p', { class: 'field__help', text: hint.recommended || '' }),
        hint.ratio ? el('p', { class: 'field__help', text: `Odnos stranica ${hint.ratio}` }) : null,
        row ? el('p', { class: 'field__help', text: row.filename }) : null,
        el('div', { style: 'display:flex;gap:.4rem;margin-top:.5rem;flex-wrap:wrap' },
          el('button', {
            class: 'btn btn--sm', type: 'button',
            onclick: async () => {
              const picked = await pickMedia({ title: field.label, hint });
              if (!picked) return;
              set(ctx.obj, field.path, picked.id);
              ctx.onInput?.(field);
              draw();
            },
          }, row ? 'Zameni sliku' : 'Izaberi sliku'),
          row
            ? el('button', {
              class: 'btn btn--sm', type: 'button',
              onclick: () => { set(ctx.obj, field.path, null); ctx.onInput?.(field); draw(); },
            }, 'Ukloni')
            : null),
      ),
    );
  };

  draw();
  return el('div', { class: 'field' },
    el('span', { class: 'field__label', text: field.label }),
    hint.help ? el('span', { class: 'field__help', text: hint.help }) : null,
    host);
}

/* -------------------------------------------------------------- repeatable */

function itemTitle(field, item, index) {
  const raw = field.titleFrom ? String(get(item, field.titleFrom) || '') : '';
  const text = raw.trim().slice(0, 70);
  return text || field.emptyTitle || `Stavka ${index + 1}`;
}

function renderItems(field, ctx) {
  const list = get(ctx.obj, field.path);
  if (!Array.isArray(list)) set(ctx.obj, field.path, []);

  const host = el('div', { class: 'items' });

  const draw = () => {
    clear(host);
    const items = get(ctx.obj, field.path);

    if (!items.length) {
      host.append(el('p', { class: 'empty-note', text: 'Još nema stavki.' }));
    }

    items.forEach((item, i) => {
      const hidden = item._hidden === true;
      const card = el('div', { class: `item${hidden ? ' is-hidden' : ''}` });

      const bar = el('div', { class: 'item__bar' },
        el('span', { class: 'item__name', text: itemTitle(field, item, i) }),
        hidden ? el('span', { class: 'pill pill--hidden', text: 'skriveno' }) : null,
        el('div', { class: 'item__tools' },
          field.reorder !== false ? toolBtn('Pomeri gore', ICON.up, () => move(i, -1)) : null,
          field.reorder !== false ? toolBtn('Pomeri dole', ICON.down, () => move(i, 1)) : null,
          toolBtn(hidden ? 'Prikaži' : 'Sakrij', hidden ? ICON.eyeOff : ICON.eye, () => {
            if (hidden) delete item._hidden; else item._hidden = true;
            ctx.onInput?.(field);
            draw();
          }),
          toolBtn('Obriši', ICON.trash, () => remove(i))));

      card.append(bar);
      for (const sub of field.item.fields) {
        card.append(renderField(sub, {
          ...ctx,
          obj: item,
          onInput: (f) => { ctx.onInput?.(f); if (f.path === field.titleFrom) retitle(bar, field, item, i); },
        }));
      }
      host.append(card);
    });

    host.append(el('button', {
      class: 'btn btn--sm', type: 'button',
      onclick: () => {
        const blank = {};
        for (const sub of field.item.fields) {
          set(blank, sub.path, sub.type === 'items' ? [] : (sub.type === 'number' ? null : ''));
        }
        get(ctx.obj, field.path).push(blank);
        ctx.onInput?.(field);
        draw();
      },
    }, field.addLabel || 'Dodaj'));
  };

  function retitle(bar, f, item, i) {
    bar.firstChild.textContent = itemTitle(f, item, i);
  }

  function move(i, delta) {
    const items = get(ctx.obj, field.path);
    const j = i + delta;
    if (j < 0 || j >= items.length) return;
    [items[i], items[j]] = [items[j], items[i]];
    ctx.onInput?.(field);
    draw();
  }

  async function remove(i) {
    const items = get(ctx.obj, field.path);
    const ok = await confirmDialog({
      title: 'Brisanje stavke',
      body: `Obrisati „${itemTitle(field, items[i], i)}”? Ovo se ne može poništiti posle objave.`,
      confirmLabel: 'Obriši',
      danger: true,
    });
    if (!ok) return;
    items.splice(i, 1);
    ctx.onInput?.(field);
    draw();
  }

  draw();
  return el('div', { class: 'field' },
    field.help ? el('span', { class: 'field__help', text: field.help }) : null,
    host);
}

/* ---------------------------------------------------------------- section */

export function renderSection(section, group) {
  // The categories document is a bare array, so its fields hang off an empty
  // path and `obj` is the array itself. get()/set() treat '' as "this object",
  // which is what makes one code path serve both shapes.
  // A section may draw from a different document than its group — the privacy
  // page's heading lives in the pages document even though the policy text is
  // its own document.
  const docKey = section.doc || group.doc;
  const obj = store.doc(docKey);

  const card = el('div', { class: 'card' },
    el('div', { class: 'card__head' }, el('h2', { class: 'card__title', text: section.title })));

  const ctx = { docKey, obj, onInput: () => store.touch() };

  const wide = !group.root
    && section.fields.every((f) => ['text', 'url', 'tel', 'email', 'number'].includes(f.type));
  const body = wide ? el('div', { class: 'grid-2' }) : el('div');
  for (const field of section.fields) body.append(renderField(field, ctx));
  card.append(body);
  return card;
}
