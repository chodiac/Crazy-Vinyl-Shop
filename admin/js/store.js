/* ==========================================================================
   store.js — the draft the admin is editing, and what it knows about the
   published site.

   Documents are loaded once, edited in memory, and written back as whole
   jsonb values. `dirty` is the difference between what is on screen and what
   the database last accepted — it drives the save button, the unsaved-changes
   warning, and the dots in the sidebar.
   ========================================================================== */

import * as api from './api.js';
import { clone, same } from './ui.js';

const state = {
  docs: {},          // key -> { label, draft, published, draft_updated_at, published_at }
  working: {},       // key -> the live, edited copy of draft
  loaded: false,
};

const listeners = new Set();
export const onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = () => listeners.forEach((fn) => fn());

export async function load() {
  const rows = await api.fetchDocs();
  state.docs = {};
  state.working = {};
  for (const row of rows) {
    state.docs[row.key] = row;
    state.working[row.key] = clone(row.draft) ?? {};
  }
  state.loaded = true;
  emit();
  return rows;
}

export const isLoaded = () => state.loaded;
export const doc = (key) => state.working[key];
export const meta = (key) => state.docs[key];
export const keys = () => Object.keys(state.docs);

/** Which documents differ from what the database holds as their draft. */
export const dirtyKeys = () =>
  keys().filter((k) => !same(state.working[k], state.docs[k].draft));

export const isDirty = () => dirtyKeys().length > 0;

/** Documents whose draft is ahead of what the website is serving. */
export const unpublishedKeys = () =>
  keys().filter((k) => !same(state.working[k], state.docs[k].published));

export function touch() { emit(); }

export async function saveDrafts(onlyKeys) {
  const targets = (onlyKeys || dirtyKeys()).filter((k) => state.working[k]);
  for (const key of targets) {
    await api.saveDraft(key, state.working[key]);
    state.docs[key].draft = clone(state.working[key]);
    state.docs[key].draft_updated_at = new Date().toISOString();
  }
  emit();
  return targets;
}

/**
 * Publishing always saves first. Anything else would let the two drift: the
 * button says "publish what I see", and what the user sees is the working copy.
 */
/**
 * Publishes the content documents only, and reports what the database
 * actually accepted rather than what it was asked to do.
 *
 * It does not dispatch the rebuild: products publish through their own module
 * and both have to land before the site is regenerated, so the caller fires
 * that once, at the end.
 */
export async function publishAll(note) {
  await saveDrafts();
  const requested = unpublishedKeys();
  if (!requested.length) return { requested: [], published: [], runId: null };

  const runId = await api.publish(requested, note);

  // Re-read instead of assuming. A publish that matched no rows returns
  // perfectly happily, and claiming success on the strength of having asked
  // is how a failure ends up looking like a success.
  await load();
  const published = requested.filter((k) => !unpublishedKeys().includes(k));

  return { requested, published, runId };
}

/** Throw away local edits for one document and go back to the stored draft. */
export function revert(key) {
  state.working[key] = clone(state.docs[key].draft) ?? {};
  emit();
}

export async function reload() { return load(); }
