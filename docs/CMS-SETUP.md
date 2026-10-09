# CMS — setup and deployment

Technical notes. For the day-to-day guide see [CMS-UPUTSTVO.md](CMS-UPUTSTVO.md).

## How it fits together

The public site is static HTML built by `tools/build.py` and served by GitHub
Pages. That is what keeps it fast and keeps every heading and meta description
in the rendered HTML, which matters for search. A CMS that rendered content in
the browser would have given that up, so instead:

```
admin panel (browser)  ──write──▶  Supabase: draft
        │                                │
        │  Publish                       │ publish_docs()
        ▼                                ▼
 Edge Function ──dispatch──▶  GitHub Actions
                                   │
                                   │ content.py pull  (published → data/*.json)
                                   │ build.py         (data/*.json → HTML)
                                   ▼
                             GitHub Pages
```

* **Drafts never reach visitors.** They live in `content_docs.draft`; the build
  reads only `content_docs.published`.
* **Preview** does not wait for a build. It loads a real published page in an
  iframe and swaps the elements the build tagged with `data-cms` for the draft
  values — same CSS, same layout, same breakpoints.
* **Restore** loads an old snapshot back into the draft, so it can be checked
  before it goes live.
* **Images** live in Supabase storage and are served from its CDN. The build
  writes their URLs into `data/images.json`.
* `data/*.json` stays in the repo as the fallback. Build locally with no
  credentials at all and you get the current published site.

## 1. Supabase

1. Create a project at <https://supabase.com> (free tier is enough).
2. **SQL Editor → New query** → paste `supabase/migrations/0001_cms.sql` → Run.
3. Same again with `supabase/migrations/0002_seed_content.sql`. This loads the
   website's current text, so nothing changes on the site.

Both files are safe to run again — every statement is `create … if not exists`,
`create or replace`, `drop … if exists` or `on conflict do update`. If you ran
an earlier copy of `0001_cms.sql`, re-run it: the first version left the table
privileges to the project defaults, and on a project that does not apply them
every request fails with `42501 permission denied for table` before any policy
is reached. The current file grants them explicitly, to `authenticated` only.
4. **Project Settings → API** — copy the *Project URL* and the *anon public*
   key into `admin/config.js`.

   Both are public by design. Every table is behind row level security that
   requires an admin profile; the key identifies the project, it grants
   nothing. The **service_role** key is the secret one and must never appear in
   `admin/`, `assets/` or any committed file.

### First admin

1. **Authentication → Users → Add user** → e-mail + password, and tick
   *Auto Confirm User*.
2. **SQL Editor**:

   ```sql
   update public.profiles set role = 'admin'
    where email = 'vasa.adresa@primer.rs';
   ```

That is the only way to become an admin. Signing up creates a `viewer` profile
and the policies give a viewer nothing — a visitor who registers cannot read a
draft, let alone change one.

To keep strangers from registering at all: **Authentication → Providers →
Email → Allow new users to sign up: off**.

### Password reset e-mails

Supabase sends them. **Authentication → URL Configuration → Redirect URLs** must
include `https://crazyvinylshop.rs/admin/` (and your Pages URL if different),
or the link in the mail will be rejected.

## 2. GitHub

### Pages

The build has to run before deployment, so Pages must come from Actions rather
than from a branch:

**Settings → Pages → Build and deployment → Source: GitHub Actions.**

`.github/workflows/build-deploy.yml` then runs on a push to `main`, on the
**Run workflow** button, and on a publish from the admin.

### Secrets

**Settings → Secrets and variables → Actions → New repository secret**

| Name | Value |
| --- | --- |
| `SUPABASE_URL` | the Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | the service_role key |

Without them the workflow still builds — it just uses the `data/*.json` in the
repo instead of the database.

## 3. The publish button

Publishing writes to the database immediately. Rebuilding the site is a
separate step, done by an Edge Function that holds a GitHub token the browser
must never see.

1. **Edge Functions → Deploy a new function**, name it `publish`, paste
   `supabase/functions/publish/index.ts`.
   With the CLI: `supabase functions deploy publish`.
2. **Edge Functions → Secrets**:

   | Name | Value |
   | --- | --- |
   | `GITHUB_TOKEN` | fine-grained PAT, *Contents: read and write* on this repo |
   | `GITHUB_REPO` | `owner/repository` |

Until this is done, publishing still works and the content is stored — the
admin says so and you run **Actions → Build and deploy → Run workflow** by
hand.

## 4. Local use

```bash
pip install pillow

# build from the files in the repo — no credentials needed
python tools/build.py
python tools/audit.py
python tools/serve.py          # http://localhost:5180

# with credentials, refresh the local copy from what is published
set SUPABASE_URL=https://xxx.supabase.co
set SUPABASE_SERVICE_ROLE_KEY=...
python tools/content.py pull

# push the repo's content into a fresh database (alternative to the seed SQL)
python tools/content.py push

# regenerate the seed file after editing data/*.json by hand
python tools/content.py seed-sql
```

The admin panel is served with the site, so `http://localhost:5180/admin/`
works locally too — it talks to the same Supabase project.

## What is deliberately not in the CMS

* **Products.** Artist, title, price, stock, format and tracklist come from the
  shop's own catalogue (`data/products.json`, imported from crazyvinylshop.rs).
  Making them editable here would create a second, competing copy. The one
  thing the catalogue is missing — the sleeve photograph — *is* managed, under
  **Omoti proizvoda**.
* **Layout, colours, animation.** These are code.
* **Online card payment.** The site does not have it; the checkout sends an
  order to the shop. The CMS edits the wording around that, not the mechanism.

## Verifying the security rules

Worth doing once after setup:

1. Register a second account (or add a user without promoting it).
2. Open `/admin/` with it → "Nemate pristup".
3. In that session, from the browser console:

   ```js
   const { data, error } = await window.sb?.from('content_docs').select('*');
   ```

   The policies return no rows. Authorization is in the database, not in the
   interface — hiding the buttons is only a courtesy.
