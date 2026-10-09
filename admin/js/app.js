/* ==========================================================================
   app.js — boot, the login gate, and the router.
   ========================================================================== */

import * as api from './api.js';
import * as store from './store.js';
import { GROUPS, groupById, DOC_LABELS } from './schema.js';
import { renderSection } from './fields.js';
import { renderMediaView, loadMedia } from './media.js';
import { renderProductsView } from './products.js';
import { openPreview } from './preview.js';
import { $, $$, el, clear, toast, confirmDialog, dateTime } from './ui.js';

const view = $('#view');
let profile = null;
let route = 'pocetna';

/* ------------------------------------------------------------------ gate */

const show = (id) => {
  for (const node of ['login', 'recover', 'denied', 'shell']) $(`#${node}`).hidden = node !== id;
};

function gateMessage(host, text, kind = '') {
  const node = $(host);
  node.textContent = text;
  node.className = `gate__msg${kind ? ` is-${kind}` : ''}`;
}

async function boot() {
  if (!api.configured()) {
    show('login');
    gateMessage('#loginMsg',
      'Admin panel nije povezan: upišite podatke projekta u admin/config.js.', 'err');
    $('#loginForm').querySelectorAll('input,button').forEach((n) => { n.disabled = true; });
    return;
  }

  // A password-recovery link lands back here with a session already open.
  if (location.hash.includes('type=recovery')) {
    show('recover');
    return;
  }

  const session = await api.getSession();
  if (!session) { show('login'); return; }

  profile = await api.currentProfile();
  if (profile?.role !== 'admin') { show('denied'); return; }

  await startPanel();
}

$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('#loginBtn');
  const { email, password } = Object.fromEntries(new FormData(e.target));
  btn.disabled = true;
  gateMessage('#loginMsg', 'Prijavljivanje…');
  try {
    await api.signIn(email.trim(), password);
    profile = await api.currentProfile();
    if (profile?.role !== 'admin') { show('denied'); return; }
    await startPanel();
  } catch (err) {
    gateMessage('#loginMsg',
      /invalid/i.test(err.message) ? 'Pogrešan e-mail ili lozinka.' : err.message, 'err');
  } finally {
    btn.disabled = false;
  }
});

$('#forgotBtn').addEventListener('click', async () => {
  const email = $('#loginForm').email.value.trim();
  if (!email) { gateMessage('#loginMsg', 'Prvo upišite e-mail adresu.', 'err'); return; }
  try {
    await api.sendReset(email);
    gateMessage('#loginMsg', 'Poslali smo link za novu lozinku na tu adresu.', 'ok');
  } catch (err) { gateMessage('#loginMsg', err.message, 'err'); }
});

$('#recoverForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const { password } = Object.fromEntries(new FormData(e.target));
  try {
    await api.setPassword(password);
    gateMessage('#recoverMsg', 'Lozinka je promenjena. Prijavljivanje…', 'ok');
    history.replaceState(null, '', location.pathname);
    profile = await api.currentProfile();
    if (profile?.role !== 'admin') { show('denied'); return; }
    await startPanel();
  } catch (err) { gateMessage('#recoverMsg', err.message, 'err'); }
});

$$('[data-logout]').forEach((btn) => btn.addEventListener('click', async () => {
  if (store.isLoaded() && store.isDirty()) {
    const ok = await confirmDialog({
      title: 'Nesačuvane izmene',
      body: 'Imate izmene koje nisu sačuvane. Odjaviti se i odbaciti ih?',
      confirmLabel: 'Odjavi se', danger: true,
    });
    if (!ok) return;
  }
  await api.signOut();
  location.reload();
}));

/* ----------------------------------------------------------------- panel */

async function startPanel() {
  show('shell');
  try {
    await store.load();
    await loadMedia();
  } catch (err) {
    toast(`Sadržaj nije učitan: ${err.message}`, 'err');
    return;
  }
  buildNav();
  store.onChange(syncChrome);
  syncChrome();
  navigate(location.hash.slice(1) || 'pocetna');
}

function buildNav() {
  const nav = clear($('#sidenav'));
  const groups = new Map();
  for (const g of GROUPS) {
    if (!groups.has(g.group)) groups.set(g.group, []);
    groups.get(g.group).push(g);
  }

  for (const [title, items] of groups) {
    nav.append(el('p', { class: 'sidenav__group', text: title }));
    for (const g of items) {
      nav.append(el('button', {
        class: 'sidenav__link', type: 'button', dataset: { route: g.id, doc: g.doc },
        onclick: () => navigate(g.id),
      }, g.nav));
    }
  }

  nav.append(el('p', { class: 'sidenav__group', text: 'Slike' }));
  nav.append(el('button', { class: 'sidenav__link', type: 'button', dataset: { route: 'slike' }, onclick: () => navigate('slike') }, 'Biblioteka slika'));
  nav.append(el('button', { class: 'sidenav__link', type: 'button', dataset: { route: 'omoti' }, onclick: () => navigate('omoti') }, 'Omoti proizvoda'));

  nav.append(el('p', { class: 'sidenav__group', text: 'Objavljivanje' }));
  nav.append(el('button', { class: 'sidenav__link', type: 'button', dataset: { route: 'verzije' }, onclick: () => navigate('verzije') }, 'Istorija i vraćanje'));
}

/** The dot next to a section means: this document differs from the live site. */
function syncChrome() {
  const dirty = store.isDirty();
  $('#saveBtn').disabled = !dirty;
  $('#dirtyDot').hidden = !dirty;

  const ahead = new Set(store.unpublishedKeys());
  $('#publishBtn').disabled = ahead.size === 0;
  $('#publishBtn').textContent = ahead.size ? `Objavi (${ahead.size})` : 'Objavljeno';

  $$('.sidenav__link').forEach((link) => {
    link.setAttribute('aria-current', String(link.dataset.route === route));
    const dot = link.querySelector('.sidenav__dot');
    const flag = link.dataset.doc && ahead.has(link.dataset.doc);
    if (flag && !dot) link.append(el('span', { class: 'sidenav__dot', title: 'Ima neobjavljenih izmena' }));
    if (!flag && dot) dot.remove();
  });
}

function navigate(id) {
  route = id;
  history.replaceState(null, '', `#${id}`);
  closeNav();
  syncChrome();
  view.scrollTo?.(0, 0);
  window.scrollTo(0, 0);

  if (id === 'slike') return void renderMediaView(view);
  if (id === 'omoti') return void renderProductsView(view);
  if (id === 'verzije') return void renderVersionsView(view);

  const group = groupById(id) || GROUPS[0];
  renderGroup(group);
  view.focus({ preventScroll: true });
}

function renderGroup(group) {
  clear(view);
  const meta = store.meta(group.doc);

  view.append(
    el('h1', { class: 'page-title', text: group.title }),
    el('p', { class: 'page-intro', text: group.intro }),
    el('p', { class: 'card__note', style: 'margin-top:.6rem',
      text: `${DOC_LABELS[group.doc]} · nacrt ${dateTime(meta?.draft_updated_at)} · objavljeno ${dateTime(meta?.published_at)}` }),
    el('div', { style: 'display:flex;gap:.4rem;margin-top:.7rem;flex-wrap:wrap' },
      el('button', {
        class: 'btn btn--sm', type: 'button',
        onclick: () => openPreview(group.previewPath || '/'),
      }, 'Pregledaj ovu stranu'),
      el('button', {
        class: 'btn btn--sm', type: 'button',
        onclick: async () => {
          const ok = await confirmDialog({
            title: 'Vraćanje na sačuvani nacrt',
            body: 'Odbaciti izmene koje nisu sačuvane u ovom odeljku?',
            confirmLabel: 'Odbaci', danger: true,
          });
          if (ok) { store.revert(group.doc); navigate(group.id); }
        },
      }, 'Odbaci nesačuvano')));

  for (const section of group.sections) view.append(renderSection(section, group));
}

/* ------------------------------------------------------- save / publish */

$('#saveBtn').addEventListener('click', async () => {
  const btn = $('#saveBtn');
  btn.disabled = true;
  try {
    const saved = await store.saveDrafts();
    toast(saved.length ? 'Nacrt je sačuvan.' : 'Nema izmena za čuvanje.', 'ok');
  } catch (err) {
    toast(`Čuvanje nije uspelo: ${err.message}`, 'err');
  } finally { syncChrome(); }
});

$('#previewBtn').addEventListener('click', () => {
  const group = groupById(route);
  openPreview(group?.previewPath || '/');
});

$('#publishBtn').addEventListener('click', async () => {
  const ahead = store.unpublishedKeys();
  const list = el('ul', { style: 'margin:.6rem 0 0;padding-left:1.1rem;list-style:disc' },
    ...ahead.map((k) => el('li', { text: DOC_LABELS[k] || k })));

  const ok = await confirmDialog({
    title: 'Objavljivanje',
    body: el('div', {},
      el('p', { text: 'Sledeće će postati vidljivo posetiocima:' }),
      list,
      el('p', { style: 'margin-top:.7rem',
        text: 'Sajt se ponovo gradi u pozadini — izmene se vide za minut do dva. '
          + 'Prethodna verzija ostaje sačuvana i može se vratiti.' })),
    confirmLabel: 'Objavi',
  });
  if (!ok) return;

  const btn = $('#publishBtn');
  btn.disabled = true;
  btn.textContent = 'Objavljujem…';
  try {
    const { targets, rebuild } = await store.publishAll();
    if (rebuild === 'ok') {
      toast(`Objavljeno: ${targets.length}. Sajt se osvežava za minut-dva.`, 'ok');
    } else {
      toast('Sadržaj je objavljen, ali izgradnja sajta nije pokrenuta automatski. '
        + 'Pokrenite „Build and deploy” na GitHub-u.', 'err');
      console.warn('[cms] rebuild dispatch:', rebuild);
    }
  } catch (err) {
    toast(`Objavljivanje nije uspelo: ${err.message}`, 'err');
  } finally { syncChrome(); }
});

/* ---------------------------------------------------------- versions view */

async function renderVersionsView(host) {
  clear(host);
  host.append(
    el('h1', { class: 'page-title', text: 'Istorija i vraćanje' }),
    el('p', {
      class: 'page-intro',
      text: 'Svaka objava sačuva prethodno stanje. Vraćanje učitava staru verziju u nacrt — '
        + 'možete je pregledati i tek onda objaviti, pa ništa na sajtu se ne menja odmah.',
    }));

  const card = el('div', { class: 'card' }, el('p', { class: 'empty-note', text: 'Učitavanje…' }));
  host.append(card);

  try {
    const rows = await api.fetchVersions();
    clear(card);
    if (!rows.length) {
      card.append(el('p', { class: 'empty-note', text: 'Još nema prethodnih verzija.' }));
      return;
    }
    const list = el('div', { class: 'items' });
    for (const v of rows) {
      list.append(el('div', { class: 'item' },
        el('div', { class: 'item__bar' },
          el('span', { class: 'item__name', text: DOC_LABELS[v.doc_key] || v.doc_key }),
          el('span', { class: 'pill', text: dateTime(v.published_at) }),
          el('div', { class: 'item__tools' },
            el('button', {
              class: 'btn btn--sm', type: 'button',
              onclick: async () => {
                const ok = await confirmDialog({
                  title: 'Vraćanje verzije',
                  body: `Učitati verziju od ${dateTime(v.published_at)} u nacrt? `
                    + 'Trenutne nesačuvane izmene u tom odeljku biće zamenjene.',
                  confirmLabel: 'Vrati u nacrt',
                });
                if (!ok) return;
                try {
                  await api.restoreVersion(v.id);
                  await store.reload();
                  toast('Verzija je učitana u nacrt. Pregledajte je pa objavite.', 'ok');
                  navigate('verzije');
                } catch (err) { toast(err.message, 'err'); }
              },
            }, 'Vrati u nacrt'))),
        v.note ? el('p', { class: 'field__help', text: v.note }) : null));
    }
    card.append(list);
  } catch (err) {
    clear(card).append(el('p', { class: 'empty-note', text: err.message }));
  }
}

/* ------------------------------------------------------------ chrome bits */

const closeNav = () => {
  $('#sidenav').classList.remove('is-open');
  $('#navScrim').hidden = true;
  $('#navToggle').setAttribute('aria-expanded', 'false');
};

$('#navToggle').addEventListener('click', () => {
  const open = $('#sidenav').classList.toggle('is-open');
  $('#navScrim').hidden = !open;
  $('#navToggle').setAttribute('aria-expanded', String(open));
});
$('#navScrim').addEventListener('click', closeNav);

// Leaving with unsaved edits is almost always a mistake, so the browser asks.
window.addEventListener('beforeunload', (e) => {
  if (store.isLoaded() && store.isDirty()) { e.preventDefault(); e.returnValue = ''; }
});

window.addEventListener('hashchange', () => {
  const id = location.hash.slice(1);
  if (id && id !== route) navigate(id);
});

boot();
