-- ===========================================================================
-- Crazy Vinyl Shop — deletion goes through Objavi, like every other change
--
-- Run after 0003_products.sql. Idempotent: safe to run again.
--
-- The bug this closes: `products.deleted` was a single flag, and
-- tools/content.py read it straight off the row. Marking a product for
-- deletion therefore removed it on the very next build — whether or not
-- anyone had pressed Objavi — while the panel, the confirmation dialog and
-- docs/CMS-UPUTSTVO.md all said the page stays up until publication. The
-- editor was told one thing and the build did another.
--
-- The fix is the split that already governs everything else here:
--
--   deleted            what the editor asked for. A draft. The site ignores it.
--   published_deleted  what the last publish accepted. The build reads ONLY this.
--
-- So a deletion can now be reviewed, previewed and undone before it lands,
-- and `publish_products` is the single place where a page actually goes away.
-- ===========================================================================

alter table public.products
  add column if not exists published_deleted boolean not null default false;

comment on column public.products.deleted is
  'The editor asked for this title to go. Draft state — invisible to the website.';
comment on column public.products.published_deleted is
  'Whether the last publish removed it. tools/content.py reads only this column.';

-- Backfill, and the reason it has to exist: under the old behaviour every
-- build since the deletion had already dropped these titles, so the site is
-- live without them right now. Marking them published keeps it that way. Were
-- this left out, the next build would hand every past deletion back to the
-- shop as a live product page.
--
-- `published_at is not null` is the same condition content.py filtered on, so
-- this reproduces exactly what the old code applied — no more, no less. A row
-- marked deleted but never published was not being dropped before either, and
-- is not marked here.
update public.products
   set published_deleted = true
 where deleted
   and published_at is not null
   and not published_deleted;

-- The pending index has to know about the new state too, otherwise a
-- deletion-only change is invisible to it.
drop index if exists public.products_pending_idx;
create index if not exists products_pending_idx
  on public.products (slug)
  where published is null
     or draft::text <> published::text
     or deleted <> published_deleted;

-- -------------------------------------------------------------- publish

-- Same shape as before. Two changes, both about the new column:
--
--   * a row whose only difference is the delete flag now counts as pending,
--     where before the UPDATE's WHERE clause skipped it and the deletion
--     could never have been published even if the build had waited for it;
--   * publishing copies `deleted` into `published_deleted`, which is the
--     moment the page is allowed to disappear.
create or replace function public.publish_products(p_slugs text[] default null,
                                                   p_note text default null)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  run_id bigint;
  n      integer;
begin
  if not public.is_admin() then
    raise exception 'Nije dozvoljeno.' using errcode = 'insufficient_privilege';
  end if;

  -- The snapshot records what was live, so it holds the published delete
  -- state, not the draft one. Restoring a version must not re-apply a
  -- deletion that was never on the site.
  insert into public.product_versions (slug, snapshot, deleted, note, published_by)
  select p.slug, p.published, p.published_deleted, p_note, auth.uid()
    from public.products p
   where p.published_at is not null
     and (p_slugs is null or p.slug = any (p_slugs))
     and (p.published is distinct from p.draft
          or p.deleted is distinct from p.published_deleted);

  update public.products
     set published         = draft,
         published_deleted = deleted,
         published_at      = now(),
         published_by      = auth.uid()
   where (p_slugs is null or slug = any (p_slugs))
     and (published is distinct from draft
          or deleted is distinct from published_deleted
          or published_at is null);

  get diagnostics n = row_count;

  insert into public.publish_runs (requested_by, detail)
  values (auth.uid(), coalesce(p_note, format('proizvodi: %s', n)))
  returning id into run_id;

  return run_id;
end;
$$;

grant execute on function public.publish_products(text[], text) to authenticated;

-- ---------------------------------------------------------------- purge

-- Tightened, for a reason worth spelling out: for a title that came from
-- data/products.json, THIS ROW IS THE ONLY RECORD OF THE DELETION. The
-- repository's catalogue is the pristine import and still contains the title;
-- CI merges the overlay in the workspace and never commits the result. Delete
-- the row and the next build hands the product back, live, with its page and
-- its place in the sitemap.
--
-- So only a title created in the CMS may be purged: there is no base record
-- behind it, and once its deletion is published nothing needs remembering.
-- Everything else keeps its tombstone, which costs one row.
create or replace function public.purge_published_deletions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if not public.is_admin() then
    raise exception 'Nije dozvoljeno.' using errcode = 'insufficient_privilege';
  end if;

  delete from public.products
   where deleted and published_deleted and origin = 'cms';

  get diagnostics n = row_count;
  return n;
end;
$$;

grant execute on function public.purge_published_deletions() to authenticated;
