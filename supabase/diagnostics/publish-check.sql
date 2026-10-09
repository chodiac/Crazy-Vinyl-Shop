-- ===========================================================================
-- Why did a publish not reach the site?
--
-- READ ONLY. Nothing here writes, drops or grants. Paste the whole file into
-- the Supabase SQL Editor and read the four results.
--
-- The chain is: admin saves a draft -> publish_products() copies draft into
-- published -> GitHub Actions runs tools/content.py pull, which reads rows
-- WHERE published_at IS NOT NULL -> build -> deploy. Each query below checks
-- one link, in order, so the first one that looks wrong is the broken link.
-- ===========================================================================

-- 1 ── the edited products, and whether the publish actually took.
--      published_at NULL, or draft <> published, means the copy did not
--      happen: the problem is in publish_products() or its permissions.
select
  slug,
  origin,
  deleted,
  (published is not distinct from draft) as draft_equals_published,
  published_at,
  draft_updated_at,
  draft,
  published
from public.products
order by draft_updated_at desc nulls last
limit 20;


-- 2 ── what publish_products() reported each time it ran.
--      Its detail column holds 'proizvodi: N', where N is how many rows the
--      UPDATE actually matched. 'proizvodi: 0' means the function ran and
--      changed nothing — the draft never became published.
select id, requested_at, status, detail
  from public.publish_runs
 order by requested_at desc
 limit 15;


-- 3 ── can the build read the table at all?
--      tools/content.py connects as service_role. false on that line means
--      the build gets 401 and ships a site without the edits. Note that
--      0003_products.sql grants only to authenticated — if this is false,
--      that is the cause, and the fix is a grant to service_role.
select
  rolname,
  has_table_privilege(rolname, 'public.products', 'SELECT')         as can_select,
  has_table_privilege(rolname, 'public.product_versions', 'SELECT') as can_select_versions
from unnest(array['anon', 'authenticated', 'service_role']) as rolname;


-- 4 ── the same question for the content tables, as a control.
--      Content publishing is known to work, so whatever this shows for
--      content_docs is what products needs to match.
select
  rolname,
  has_table_privilege(rolname, 'public.content_docs', 'SELECT') as can_select
from unnest(array['anon', 'authenticated', 'service_role']) as rolname;
