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

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return json({ error: 'Nedostaje prijava.' }, 401);

  // Run as the caller, so is_admin() answers for them and not for the server.
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: auth } } },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: 'Prijava nije važeća.' }, 401);

  const { data: isAdmin, error } = await supabase.rpc('is_admin');
  if (error) return json({ error: error.message }, 500);
  if (!isAdmin) return json({ error: 'Nemate pravo objavljivanja.' }, 403);

  const token = Deno.env.get('GITHUB_TOKEN');
  const repo = Deno.env.get('GITHUB_REPO');
  if (!token || !repo) {
    return json({ error: 'GITHUB_TOKEN ili GITHUB_REPO nisu podešeni.' }, 500);
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
    return json({ error: `GitHub ${res.status}: ${await res.text()}` }, 502);
  }

  if (body.runId) {
    await supabase.from('publish_runs')
      .update({ status: 'dispatched' }).eq('id', body.runId);
  }

  return json({ ok: true });
});
