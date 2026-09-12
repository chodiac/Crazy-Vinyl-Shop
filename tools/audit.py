# -*- coding: utf-8 -*-
"""Link and route audit for the generated site.

Walks every generated HTML file, collects internal links, and checks each one
resolves to a real file. Also verifies that every product in the catalogue has
a page and that every page references the shared assets.

    python tools/audit.py
"""

import json
import os
import re
import sys
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP_DIRS = {'.git', 'tools', 'node_modules', '.claude'}

HREF = re.compile(r'(?:href|src)="(/[^"#?]*)(?:[#?][^"]*)?"')


def resolves(path):
    """Mirror how a static host resolves a URL path."""
    rel = path.lstrip('/')
    target = os.path.join(ROOT, rel.replace('/', os.sep))
    if os.path.isfile(target):
        return True
    if path.endswith('/') or os.path.isdir(target):
        return os.path.isfile(os.path.join(target, 'index.html'))
    return False


def main():
    pages = []
    for base, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not d.startswith('.')]
        for f in files:
            if f.endswith('.html'):
                pages.append(os.path.join(base, f))

    broken = Counter()
    checked = set()
    total_links = 0
    missing_assets = []

    for p in pages:
        html = open(p, encoding='utf-8').read()
        rel_page = os.path.relpath(p, ROOT).replace(os.sep, '/')
        for m in HREF.finditer(html):
            link = m.group(1)
            total_links += 1
            if link in checked:
                continue
            checked.add(link)
            if not resolves(link):
                broken[f'{link}  (first seen in {rel_page})'] += 1
        for asset in ('/assets/css/base.css', '/assets/js/main.js'):
            if asset not in html:
                missing_assets.append((rel_page, asset))

    products = json.load(open(os.path.join(ROOT, 'data', 'products.json'), encoding='utf-8'))
    missing_pages = [
        p['slug'] for p in products
        if not os.path.isfile(os.path.join(ROOT, 'proizvod', p['slug'], 'index.html'))
    ]

    index = json.load(open(os.path.join(ROOT, 'data', 'index.json'), encoding='utf-8'))
    slug_i = index['fields'].index('slug')
    index_slugs = {r[slug_i] for r in index['rows']}
    data_slugs = {p['slug'] for p in products}

    print(f'html pages            : {len(pages)}')
    print(f'internal links seen   : {total_links} ({len(checked)} unique)')
    print(f'broken links          : {len(broken)}')
    for b in list(broken)[:20]:
        print(f'   ! {b}')
    print(f'products missing page : {len(missing_pages)}')
    for s in missing_pages[:10]:
        print(f'   ! {s}')
    print(f'index vs data mismatch: {len(index_slugs ^ data_slugs)}')
    print(f'pages missing assets  : {len(missing_assets)}')
    for pg, a in missing_assets[:10]:
        print(f'   ! {pg} -> {a}')

    ok = not broken and not missing_pages and not missing_assets and index_slugs == data_slugs
    print('\nAUDIT:', 'PASS' if ok else 'FAIL')
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
