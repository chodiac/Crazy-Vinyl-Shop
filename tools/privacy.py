# -*- coding: utf-8 -*-
"""Convert the live Politika privatnosti page into structured JSON."""
import json
import re
import sys
import html as H

SRC = sys.argv[1]
OUT = sys.argv[2]

h = open(SRC, encoding='utf-8').read()
i = h.find('</header>')
j = h.find('<footer', i)
body = h[i:j]
body = re.sub(r'<(script|style|svg)\b.*?</\1>', ' ', body, flags=re.S | re.I)
body = re.sub(r'<!--.*?-->', ' ', body, flags=re.S)


def txt(s):
    s = re.sub(r'<br\s*/?>', ' ', s)
    s = re.sub(r'<[^>]+>', '', s)
    s = H.unescape(s).replace(' ', ' ')
    return re.sub(r'\s+', ' ', s).strip()


# Walk the body in document order, collecting headings, paragraphs and lists.
token = re.compile(
    r'<h([1-6])[^>]*>(.*?)</h\1>|<p[^>]*>(.*?)</p>|<ul[^>]*>(.*?)</ul>|<ol[^>]*>(.*?)</ol>',
    re.S | re.I)

sections = []
cur = None
title = ''
for m in token.finditer(body):
    if m.group(1):
        t = txt(m.group(2))
        if not t:
            continue
        if not title:
            title = t
            continue
        cur = {'heading': t, 'blocks': []}
        sections.append(cur)
    elif m.group(3) is not None:
        t = txt(m.group(3))
        if not t:
            continue
        if cur is None:
            cur = {'heading': '', 'blocks': []}
            sections.append(cur)
        cur['blocks'].append({'type': 'p', 'text': t})
    else:
        raw = m.group(4) if m.group(4) is not None else m.group(5)
        items = [txt(x) for x in re.findall(r'<li[^>]*>(.*?)</li>', raw, re.S)]
        items = [x for x in items if x]
        if not items:
            continue
        if cur is None:
            cur = {'heading': '', 'blocks': []}
            sections.append(cur)
        cur['blocks'].append({'type': 'list', 'items': items})

data = {'title': title or 'Politika privatnosti', 'sections': sections}
json.dump(data, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('title:', data['title'])
print('sections:', len(sections))
print('blocks:', sum(len(s['blocks']) for s in sections))
for s in sections[:6]:
    print('  -', s['heading'][:70], '(%d blocks)' % len(s['blocks']))
