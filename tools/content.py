# -*- coding: utf-8 -*-
"""Content bridge between Supabase and the static build.

The build itself never talks to Supabase. It reads data/*.json, exactly as it
always has, which is what keeps a local build working with no credentials and
gives the repository a readable history of every content change.

This script is the thing that moves content across:

    python tools/content.py pull      published content  -> data/*.json
    python tools/content.py push      data/*.json        -> draft + published
    python tools/content.py seed-sql  data/*.json        -> a .sql file to paste

`pull` runs in CI before the build. `push` and `seed-sql` are for first setup.

Credentials come from the environment (see .env.example):

    SUPABASE_URL                 https://xxxx.supabase.co
    SUPABASE_SERVICE_ROLE_KEY    server-side key — never ships to the browser
"""
import io
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'data')

# key -> (file, human label). These four documents are the whole editable
# surface of the site; products come from the shop's own catalogue and are not
# edited here.
DOCS = {
    'site': ('site.json', 'Podaci radnje'),
    'categories': ('categories.json', 'Odeljenja'),
    'pages': ('pages.json', 'Tekstovi stranica'),
    'privacy': ('privacy.json', 'Politika privatnosti'),
}

BUCKET = 'media'

# Fields the CMS is allowed to set on a product. Anything else in a stored
# patch is ignored, so a malformed row can never reach into the catalogue's
# own bookkeeping (id, sourceUrl, addedAt) or invent a key the build does not
# know about.
PRODUCT_FIELDS = {
    # already in the catalogue
    'artist', 'title', 'price', 'salePrice', 'onSale', 'available', 'condition',
    'format', 'genre', 'year', 'country', 'category', 'notes', 'tracklist',
    # added for the CMS — empty on every imported title, never invented
    'label', 'catalogNumber', 'stock', 'gallery', 'buyLabel', 'buyState',
    'hidden', 'featured', 'related', 'seoTitle', 'seoDescription',
}

# A product created in the CMS has no catalogue row behind it, so it also
# supplies these.
PRODUCT_OWN_FIELDS = {'slug', 'id', 'currency', 'image', 'addedAt', 'sourceUrl'}


# ---------------------------------------------------------------- utilities

def env(name, required=True):
    v = os.environ.get(name, '').strip()
    if required and not v:
        sys.exit(f'[content] nedostaje promenljiva okruženja {name}')
    return v


def read_json(path):
    with io.open(path, encoding='utf-8') as fh:
        return json.load(fh)


def write_json(path, obj):
    with io.open(path, 'w', encoding='utf-8', newline='\n') as fh:
        json.dump(obj, fh, ensure_ascii=False, indent=2)
        fh.write('\n')


def configured():
    return bool(os.environ.get('SUPABASE_URL') and
                os.environ.get('SUPABASE_SERVICE_ROLE_KEY'))


def api(path, method='GET', body=None, prefer=None, optional=False):
    """optional=True returns None instead of aborting.

    For a table the project may not have yet: shipping code that reads a new
    table must not take the whole deploy down before its migration is run.
    """
    base = env('SUPABASE_URL').rstrip('/')
    key = env('SUPABASE_SERVICE_ROLE_KEY')
    req = urllib.request.Request(
        f'{base}/rest/v1/{path}', method=method,
        data=json.dumps(body, ensure_ascii=False).encode('utf-8') if body is not None else None,
        headers={
            'apikey': key,
            'Authorization': f'Bearer {key}',
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            **({'Prefer': prefer} if prefer else {}),
        })
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            raw = r.read().decode('utf-8')
            return json.loads(raw) if raw.strip() else None
    except urllib.error.HTTPError as err:
        detail = err.read().decode('utf-8', 'replace')[:400]
        if optional:
            print(f'[content] preskočeno ({err.code}): {path}')
            return None
        sys.exit(f'[content] Supabase {err.code} na {path}\n{detail}')
    except urllib.error.URLError as err:
        if optional:
            print(f'[content] preskočeno (nedostupno): {path}')
            return None
        sys.exit(f'[content] Supabase nedostupan: {err.reason}')


def public_url(storage_path):
    base = env('SUPABASE_URL').rstrip('/')
    return f'{base}/storage/v1/object/public/{BUCKET}/{urllib.parse.quote(storage_path)}'


# --------------------------------------------------------------------- pull

def strip_hidden(node):
    """Drop list entries the editor marked hidden, and the marker itself.

    Hiding is an editing state, not a publishing one: the draft keeps the item
    so it can come back, the website never sees it.
    """
    if isinstance(node, list):
        return [strip_hidden(v) for v in node
                if not (isinstance(v, dict) and v.get('_hidden') is True)]
    if isinstance(node, dict):
        return {k: strip_hidden(v) for k, v in node.items() if k != '_hidden'}
    return node


def download_site_images(site):
    """Logos chosen in the CMS land in images/ under the names the build expects."""
    slots = {'logo': 'logo', 'wordmark': 'natpislogo2'}
    chosen = (site or {}).get('images') or {}
    ids = [v for v in (chosen.get(k) for k in slots) if v]
    if not ids:
        return 0

    quoted = ','.join(f'"{i}"' for i in ids)
    rows = api(f'media?select=id,storage_path&id=in.({quoted})') or []
    by_id = {r['id']: r['storage_path'] for r in rows}

    saved = 0
    for slot, stem in slots.items():
        path = by_id.get(chosen.get(slot))
        if not path:
            continue
        ext = os.path.splitext(path)[1].lower() or '.png'
        target = os.path.join(ROOT, 'images', f'{stem}{ext}')
        with urllib.request.urlopen(public_url(path), timeout=60) as r:
            data = r.read()
        with open(target, 'wb') as fh:
            fh.write(data)
        print(f'  slika sajta: {stem}{ext} ({len(data) // 1024} kB)')
        saved += 1
    return saved


def merge_products(media_urls):
    """Lay published product edits over data/products.json.

    The catalogue in the repository stays the base; a row in Supabase exists
    only for a title somebody edited, and carries only the fields that differ.
    Nothing here invents a value: a field the editor never filled in stays
    absent, and the page goes on not showing it.
    """
    path = os.path.join(DATA, 'products.json')
    base = read_json(path)
    by_slug = {p['slug']: p for p in base}
    order = [p['slug'] for p in base]

    # Optional on purpose: before 0003_products.sql has been run the table
    # does not exist, and a build that died over that would take the live site
    # down for a migration nobody had got to yet.
    rows = api('products?select=slug,origin,published,deleted'
               '&published_at=not.is.null', optional=True)
    if rows is None:
        print('[content] proizvodi: tabela ne postoji — koristi se data/products.json')
        return base

    changed = created = removed = 0
    for row in rows:
        slug = row['slug']
        patch = row.get('published') or {}

        if row.get('deleted'):
            if by_slug.pop(slug, None) is not None:
                removed += 1
            continue

        if slug in by_slug:
            target = by_slug[slug]
            changed += 1
        elif row.get('origin') == 'cms':
            target = {
                'slug': slug,
                'id': str(patch.get('id') or f'cms-{slug}'),
                'currency': 'RSD',
                'image': f'/images/products/{slug}.jpg',
                'addedAt': (row.get('published_at') or '')[:10],
                'sourceUrl': '',
                'category': 'ostalo',
                'condition': 'Novo',
                'available': False,
                'onSale': False,
                'salePrice': None,
                'tracklist': [],
                'notes': '',
            }
            by_slug[slug] = target
            order.append(slug)
            created += 1
        else:
            # An overlay whose base title is gone from the catalogue. Skip it
            # rather than resurrect a half-record.
            print(f'  preskočen overlay bez osnove: {slug}')
            continue

        for key, value in patch.items():
            if key in PRODUCT_FIELDS or (row.get('origin') == 'cms' and key in PRODUCT_OWN_FIELDS):
                target[key] = value

        # Gallery entries are stored as media ids; the site needs URLs.
        gallery = target.get('gallery')
        if isinstance(gallery, list) and gallery:
            target['gallery'] = [media_urls[g] for g in gallery if g in media_urls]

    merged = [by_slug[s] for s in order if s in by_slug]
    write_json(path, merged)
    print(f'[content] proizvodi: {len(merged)} ukupno '
          f'(izmenjeno {changed}, novo {created}, uklonjeno {removed})')
    return merged


def pull():
    """Published content -> data/*.json. Drafts are deliberately ignored."""
    rows = api('content_docs?select=key,published,published_at') or []
    by_key = {r['key']: r for r in rows}

    touched = []
    for key, (fname, _label) in DOCS.items():
        row = by_key.get(key)
        if not row or row.get('published') in (None, {}, []):
            print(f'  {key:<12} nije objavljen u bazi — zadržan data/{fname}')
            continue
        doc = strip_hidden(row['published'])
        write_json(os.path.join(DATA, fname), doc)
        touched.append(f'{key} ({row.get("published_at") or "?"})')
        if key == 'site':
            download_site_images(doc)

    # ---- product artwork manifest -----------------------------------------
    # {slug: {url, alt}} — the site swaps a placeholder for this URL. Images
    # live on Supabase storage rather than in the repo, so 1,470 sleeves never
    # bloat the checkout.
    imgs = api('product_images?select=slug,media(storage_path,alt)') or []
    manifest = {}
    for row in imgs:
        m = row.get('media') or {}
        if not m.get('storage_path'):
            continue
        manifest[row['slug']] = {'url': public_url(m['storage_path']),
                                 'alt': m.get('alt') or ''}
    write_json(os.path.join(DATA, 'images.json'), manifest)

    # ---- product edits ----------------------------------------------------
    media_rows = api('media?select=id,storage_path,alt') or []
    media_urls = {m['id']: {'url': public_url(m['storage_path']), 'alt': m.get('alt') or ''}
                  for m in media_rows}
    merge_products(media_urls)

    print(f'[content] povučeno: {", ".join(touched) or "ništa"}')
    print(f'[content] omota proizvoda: {len(manifest)}')
    return manifest


# --------------------------------------------------------------------- push

def push():
    """data/*.json -> draft AND published, for the initial load."""
    payload = []
    for key, (fname, label) in DOCS.items():
        doc = read_json(os.path.join(DATA, fname))
        payload.append({'key': key, 'label': label, 'draft': doc, 'published': doc,
                        'published_at': 'now()'})
    # published_at must be a real timestamp, not a SQL expression, over REST
    import datetime
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    for row in payload:
        row['published_at'] = now
        row['draft_updated_at'] = now

    api('content_docs?on_conflict=key', method='POST', body=payload,
        prefer='resolution=merge-duplicates,return=minimal')
    print(f'[content] poslato dokumenata: {len(payload)}')


# ----------------------------------------------------------------- seed-sql

def seed_sql():
    """A .sql file the owner can paste into the Supabase SQL editor.

    Dollar-quoted so none of the Serbian text, quotes or backslashes in the
    content need escaping.
    """
    out = [
        '-- Crazy Vinyl Shop — seed the CMS with the website as it stands today.',
        '-- Generated by tools/content.py seed-sql. Run after 0001_cms.sql.',
        '-- Draft and published start identical, so nothing on the site changes.',
        '',
    ]
    for key, (fname, label) in DOCS.items():
        doc = read_json(os.path.join(DATA, fname))
        blob = json.dumps(doc, ensure_ascii=False)
        assert '$doc$' not in blob, f'{fname} sadrži $doc$ — promenite oznaku'
        out += [
            f'-- {label} ({fname})',
            'insert into public.content_docs (key, label, draft, published, published_at)',
            f"values ('{key}', '{label}', $doc${blob}$doc$::jsonb, $doc${blob}$doc$::jsonb, now())",
            'on conflict (key) do update',
            '  set label = excluded.label,',
            '      draft = excluded.draft,',
            '      published = excluded.published,',
            '      published_at = now();',
            '',
        ]
    path = os.path.join(ROOT, 'supabase', 'migrations', '0002_seed_content.sql')
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with io.open(path, 'w', encoding='utf-8', newline='\n') as fh:
        fh.write('\n'.join(out))
    print(f'[content] napisano {os.path.relpath(path, ROOT)} ({len(out)} linija)')


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    if cmd == 'pull':
        pull()
    elif cmd == 'push':
        push()
    elif cmd == 'seed-sql':
        seed_sql()
    else:
        sys.exit(__doc__)
