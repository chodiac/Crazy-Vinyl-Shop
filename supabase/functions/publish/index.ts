// ===========================================================================
// Edge Function: publish
//
// The admin panel runs in the browser, so it cannot hold a GitHub token. This
// function does: it checks that the caller really is an admin, then asks
// GitHub to run the build-and-deploy workflow. The token never leaves here.
//
// Deploy from the Supabase dashboard (Edge Functions → Deploy a new function),
// or with the CLI:  supabase functions deploy publish
//
// Secrets it needs (Edge Functions → Secrets):
//   GITHUB_TOKEN   fine-grained PAT, repo scope "Contents: read and write"
//                  or a classic token with `repo`
//   GITHUB_REPO    e.g. davidtucakovic/Crazy-Vinyl-Shop
// SUPABASE_URL and SUPABASE_ANON_KEY are injected by the platform.
// ===========================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';

// The admin panel is served from the website, so its origin moves with the
// site: GitHub Pages now, the custom domain once it is live, and the local
// preview server while working on it. Access-Control-Allow-Origin carries
// exactly one value, never a list, so the caller's origin is echoed back when
// it is on this list and anything else gets the Pages origin and is refused by
// the browser.
const ALLOWED_ORIGINS = [
  'https://chodiac.github.io',
  'https://crazyvinylshop.rs',
  'https://www.crazyvinylshop.rs',
  'http://localhost:5180',
  'http://127.0.0.1:5180',
];

const DEFAULT_ORIGIN = 'https://chodiac.github.io';

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : DEFAULT_ORIGIN,
    // supabase-js attaches x-client-info and apikey to every call it makes.
    // Leaving them out of this list is what made the preflight fail with
    // "Request header field x-client-info is not allowed".
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    // The response differs per origin, so a cache must not reuse one answer
    // for another site.
    Vary: 'Origin',
  };
}

const json = (body: unknown, status: number, cors: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  const cors = corsHeaders(req);

  // Answer the preflight first and unconditionally: no auth, no body parsing.
  // A browser never sends credentials with OPTIONS, so anything that inspected
  // them here would reject the probe and the real request would never follow.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: cors });
  }

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, cors);

  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return json({ error: 'Nedostaje prijava.' }, 401, cors);

  // Run as the caller, so is_admin() answers for them and not for the server.
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: auth } } },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: 'Prijava nije važeća.' }, 401, cors);

  const { data: isAdmin, error } = await supabase.rpc('is_admin');
  if (error) return json({ error: error.message }, 500, cors);
  if (!isAdmin) return json({ error: 'Nemate pravo objavljivanja.' }, 403, cors);

  const token = Deno.env.get('GITHUB_TOKEN');
  const repo = Deno.env.get('GITHUB_REPO');
  if (!token || !repo) {
    return json({ error: 'GITHUB_TOKEN ili GITHUB_REPO nisu podešeni.' }, 500, cors);
  }

  const body = await req.json().catch(() => ({}));

  const res = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      event_type: 'cms-publish',
      client_payload: { by: user.email, run: body.runId ?? null },
    }),
  });

  if (!res.ok) {
    return json({ error: `GitHub ${res.status}: ${await res.text()}` }, 502, cors);
  }

  if (body.runId) {
    await supabase.from('publish_runs')
      .update({ status: 'dispatched' }).eq('id', body.runId);
  }

  return json({ ok: true }, 200, cors);
});
