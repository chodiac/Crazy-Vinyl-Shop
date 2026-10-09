/* ==========================================================================
   api.js — the only module that talks to Supabase.

   Everything here runs with the visitor's own session. Authorization is not
   decided in this file: the database policies decide, and a non-admin simply
   gets empty results and errors. Hiding the UI is a courtesy, not the control.
   ========================================================================== */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';

export const configured = () =>
  /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(SUPABASE_URL) &&
  SUPABASE_ANON_KEY.length > 40;

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

/** Throws with the Postgres message, which the policies write in Serbian. */
function unwrap({ data, error }) {
  if (error) throw new Error(error.message || 'Greška u komunikaciji sa bazom.');
  return data;
}

/* ------------------------------------------------------------------ auth */

export const getSession = async () => (await sb.auth.getSession()).data.session;

export const signIn = (email, password) =>
  sb.auth.signInWithPassword({ email, password }).then(unwrap);

export const signOut = () => sb.auth.signOut();

export const sendReset = (email) =>
  sb.auth.resetPasswordForEmail(email, {
    redirectTo: `${location.origin}${location.pathname}`,
  }).then(unwrap);

export const setPassword = (password) =>
  sb.auth.updateUser({ password }).then(unwrap);

/** The profile row decides everything. No profile, or role !== admin, no access. */
export async function currentProfile() {
  const session = await getSession();
  if (!session) return null;
  const { data, error } = await sb
    .from('profiles').select('id,email,role').eq('id', session.user.id).maybeSingle();
  if (error) return { id: session.user.id, email: session.user.email, role: 'viewer' };
  return data || { id: session.user.id, email: session.user.email, role: 'viewer' };
}

/* -------------------------------------------------------------- content */

export const fetchDocs = () =>
  sb.from('content_docs')
    .select('key,label,draft,published,draft_updated_at,published_at')
    .then(unwrap);

export const saveDraft = (key, draft) =>
  sb.from('content_docs')
    .update({ draft, draft_updated_at: new Date().toISOString() })
    .eq('key', key)
    .then(unwrap);

export const publish = (keys, note) =>
  sb.rpc('publish_docs', { p_keys: keys, p_note: note || null }).then(unwrap);

export const fetchVersions = (limit = 40) =>
  sb.from('content_versions')
    .select('id,doc_key,note,published_at')
    .order('published_at', { ascending: false })
    .limit(limit)
    .then(unwrap);

export const fetchVersion = (id) =>
  sb.from('content_versions').select('id,doc_key,snapshot,published_at')
    .eq('id', id).single().then(unwrap);

export const restoreVersion = (id) =>
  sb.rpc('restore_version', { p_version_id: id }).then(unwrap);

/**
 * Ask the Edge Function to kick off the rebuild. It holds the GitHub token;
 * the browser never sees it. A failure here does not undo the publish — the
 * content is live in the database, the site just has not been regenerated, and
 * the workflow can be run by hand.
 */
export async function requestRebuild(runId) {
  const { data, error } = await sb.functions.invoke('publish', { body: { runId } });
  if (error) throw new Error(error.message || 'Pokretanje izgradnje nije uspelo.');
  return data;
}

export const lastPublishRun = () =>
  sb.from('publish_runs').select('id,requested_at,status,detail')
    .order('requested_at', { ascending: false }).limit(1).maybeSingle().then(unwrap);

/* ---------------------------------------------------------------- media */

export const fetchMedia = () =>
  sb.from('media')
    .select('id,storage_path,filename,mime,bytes,width,height,alt,created_at')
    .order('created_at', { ascending: false })
    .then(unwrap);

export const mediaUsage = (id) =>
  sb.rpc('media_usage', { p_media_id: id }).then(unwrap);

export const updateAlt = (id, alt) =>
  sb.from('media').update({ alt }).eq('id', id).then(unwrap);

export async function deleteMedia(row) {
  // The database refuses if the image is still referenced; only then is the
  // stored file removed, so the two never drift apart.
  await sb.from('media').delete().eq('id', row.id).then(unwrap);
  await sb.storage.from('media').remove([row.storage_path]);
}

export function publicUrl(storagePath) {
  return sb.storage.from('media').getPublicUrl(storagePath).data.publicUrl;
}

export async function uploadMedia(file, { width, height, onProgress } = {}) {
  const session = await getSession();
  const safe = file.name.toLowerCase()
    .replace(/\.[^.]+$/, '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'slika';
  const ext = (file.name.match(/\.([a-z0-9]+)$/i)?.[1] || 'jpg').toLowerCase();
  // Unique by construction, so an upload never silently replaces another file.
  const path = `${new Date().toISOString().slice(0, 7)}/${safe}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

  onProgress?.(0.1);
  const up = await sb.storage.from('media')
    .upload(path, file, { cacheControl: '31536000', upsert: false, contentType: file.type });
  if (up.error) throw new Error(up.error.message);
  onProgress?.(0.75);

  const row = await sb.from('media').insert({
    storage_path: path,
    filename: file.name,
    mime: file.type,
    bytes: file.size,
    width: width ?? null,
    height: height ?? null,
    created_by: session?.user?.id ?? null,
  }).select().single().then(unwrap);

  onProgress?.(1);
  return row;
}

/* ------------------------------------------------------- product artwork */

export const fetchProductImages = () =>
  sb.from('product_images')
    .select('slug,media_id,updated_at,media(storage_path,alt)')
    .then(unwrap);

export async function setProductImage(slug, mediaId) {
  const session = await getSession();
  return sb.from('product_images').upsert({
    slug, media_id: mediaId, updated_at: new Date().toISOString(),
    updated_by: session?.user?.id ?? null,
  }).then(unwrap);
}

export const clearProductImage = (slug) =>
  sb.from('product_images').delete().eq('slug', slug).then(unwrap);
