-- ===========================================================================
-- Crazy Vinyl Shop — product editing
--
-- Run after 0001_cms.sql. Idempotent: safe to run again.
--
-- This table is NOT a copy of the catalogue. data/products.json stays the
-- base — 1,470 titles imported from the shop's own listing — and a row
-- appears here only for a product someone actually edited, holding just the
-- fields that differ from that base. A product nobody has touched has no row.
--
--   origin = 'catalog'  an overlay on a title that exists in data/products.json
--   origin = 'cms'      a title created here, so the patch is the whole record
--   deleted = true      drop this slug from the built site on publish
--
-- Same draft/published split as content_docs: the build reads `published`,
-- never `draft`.
-- ===========================================================================

create table if not exists public.products (
  slug              text primary key,
  origin            text not null default 'catalog'
                    check (origin in ('catalog', 'cms')),
  draft             jsonb not null default '{}'::jsonb,
  published         jsonb,
  deleted           boolean not null default false,
  draft_updated_at  timestamptz default now(),
  draft_updated_by  uuid references auth.users (id) on delete set null,
  published_at      timestamptz,
  published_by      uuid references auth.users (id) on delete set null
);

comment on table public.products is
  'Per-product edits layered over data/products.json. Only edited slugs appear.';
comment on column public.products.draft is
  'Only the fields that differ from the catalogue base. Invisible to the site.';
comment on column public.products.published is
  'What the last build applied. null means this product has never been published.';

create index if not exists products_published_idx
  on public.products (published_at desc nulls last);

create index if not exists products_pending_idx
  on public.products (slug) where published is null or draft::text <> published::text;

-- A slug has to stay a slug: it is the public URL of the product page, and
-- these are indexed. Letting the editor type anything into it would quietly
-- break links.
create or replace function public.products_check_slug()
returns trigger
language plpgsql
as $$
begin
  if new.slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'Neispravan slug: %. Dozvoljena su mala slova, cifre i crtica.', new.slug;
  end if;
  return new;
end;
$$;

drop trigger if exists products_check_slug on public.products;
create trigger products_check_slug
  before insert or update of slug on public.products
  for each row execute function public.products_check_slug();

-- ------------------------------------------------------------- versions

create table if not exists public.product_versions (
  id            bigint generated always as identity primary key,
  slug          text not null,
  snapshot      jsonb,
  deleted       boolean not null default false,
  note          text,
  published_at  timestamptz not null default now(),
  published_by  uuid references auth.users (id) on delete set null
);

create index if not exists product_versions_slug_idx
  on public.product_versions (slug, published_at desc);

-- -------------------------------------------------------------- publish

-- Mirrors publish_docs: snapshot what is live, copy the draft over it, queue
-- a rebuild. One transaction, so a dropped connection cannot half-publish.
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

  insert into public.product_versions (slug, snapshot, deleted, note, published_by)
  select p.slug, p.published, p.deleted, p_note, auth.uid()
    from public.products p
   where p.published_at is not null
     and (p_slugs is null or p.slug = any (p_slugs))
     and (p.published is distinct from p.draft or p.deleted);

  update public.products
     set published    = draft,
         published_at = now(),
         published_by = auth.uid()
   where (p_slugs is null or slug = any (p_slugs))
     and (published is distinct from draft or published_at is null);

  get diagnostics n = row_count;

  insert into public.publish_runs (requested_by, detail)
  values (auth.uid(), coalesce(p_note, format('proizvodi: %s', n)))
  returning id into run_id;

  return run_id;
end;
$$;

grant execute on function public.publish_products(text[], text) to authenticated;

-- A deleted product is only really gone once the deletion has been published;
-- until then the site still serves it. This keeps the row until that point.
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
   where deleted and published_at is not null;

  get diagnostics n = row_count;
  return n;
end;
$$;

grant execute on function public.purge_published_deletions() to authenticated;

-- =========================================================================
-- Privileges and row level security
--
-- authenticated only; anon is granted nothing. The public site is static HTML
-- and reads products from the built files, never from here.
-- =========================================================================

grant select, insert, update, delete on public.products         to authenticated;
grant select                         on public.product_versions to authenticated;

alter table public.products         enable row level security;
alter table public.product_versions enable row level security;

drop policy if exists products_all on public.products;
create policy products_all on public.products
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists product_versions_select on public.product_versions;
create policy product_versions_select on public.product_versions
  for select to authenticated using (public.is_admin());
