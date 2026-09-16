# -*- coding: utf-8 -*-
"""Shared markup for every generated page.

Keeping the chrome in one place means the header, menu, search, cart drawer and
footer are identical across all routes, and the only thing a page supplies is
its own <main>.
"""

import html
import json

SITE_URL = 'https://crazyvinylshop.rs'
GSAP = 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5'

# Runs before first paint so CSS and JS agree on theme and motion.
# Motion is on by default at the shop's request, so the operating system's
# reduced-motion setting no longer switches it off on its own; the footer
# switch and `?motion=0` do, and that choice is remembered.
BOOT_SCRIPT = (
    '<script>(function(){var d=document.documentElement;'
    "d.classList.remove('no-js');"
    # theme first, so the page never paints in the wrong one
    "var t='light';try{var v=localStorage.getItem('cvs.theme');"
    "if(v==='light'||v==='dark')t=v;}catch(e){}"
    "d.setAttribute('data-theme',t);"
    # motion is on by default; only an explicit choice switches it off
    "var m=null;try{m=localStorage.getItem('cvs.motion');}catch(e){}"
    "if(/[?&]motion=(1|force)/.test(location.search))m='full';"
    "else if(/[?&]motion=0/.test(location.search))m='reduced';"
    "if(m==='reduced')d.classList.add('rm');})();</script>"
)

# Logo slots. Set from build.py when a file is actually present in images/;
# until then both fall back to type, the same way product art does.
LOGO = None
LABEL_LOGO = None
WORDMARK = None


def set_logos(logo, label_logo, wordmark=None):
    global LOGO, LABEL_LOGO, WORDMARK
    LOGO, LABEL_LOGO, WORDMARK = logo, label_logo, wordmark


def e(value):
    """Escape for text and attribute contexts."""
    return html.escape('' if value is None else str(value), quote=True)


def vinyl(label='CVS', spin=True, speed=1.0, klass=''):
    """A CSS-drawn record.

    The label and the pressing seam live *inside* the rotating layer. They have
    to: concentric grooves look identical at every angle, so if nothing
    asymmetric turns with the record it reads as frozen no matter how correctly
    the rotation engine is running.
    """
    spin_attr = f' data-spin data-speed="{speed}"' if spin else ' data-spin="off"'
    if LABEL_LOGO:
        label_inner = f'<img class="vinyl__logo" src="{e(LABEL_LOGO)}" alt="">'
    elif label:
        label_inner = f'<span class="vinyl__labeltype">{e(label)}</span>'
    else:
        label_inner = ''
    return f'''<div class="vinyl {klass}" aria-hidden="true">
        <div class="vinyl__spin"{spin_attr}>
          <div class="vinyl__label">{label_inner}</div>
        </div>
        <span class="vinyl__hole"></span>
      </div>'''


def marquee(items, klass='', reverse=False, speed='42s'):
    group = ''.join(
        f'<span class="marquee__item">{e(t)}</span><span class="marquee__dot"></span>' for t in items
    )
    rev = ' marquee--reverse' if reverse else ''
    return f'''<div class="marquee{rev} {klass}" style="--speed:{speed}" aria-hidden="true">
      <div class="marquee__track">
        <div class="marquee__group">{group}</div>
        <div class="marquee__group">{group}</div>
      </div>
    </div>'''


def eyebrow(text, paper=False):
    return f'<p class="eyebrow{" eyebrow--paper" if paper else ""}">{e(text)}</p>'


def crumbs(items):
    """items: list of (label, href|None)."""
    lis = []
    for label, href in items:
        inner = f'<a href="{e(href)}">{e(label)}</a>' if href else f'<span>{e(label)}</span>'
        lis.append(f'<li>{inner}</li>')
    return f'<nav aria-label="Putanja"><ol class="crumbs">{"".join(lis)}</ol></nav>'


# ---------------------------------------------------------------------------
# chrome
# ---------------------------------------------------------------------------

def header(site, categories):
    if LOGO:
        wordmark = f'<img class="wordmark__logo" src="{e(LOGO)}" alt="Crazy Vinyl Shop">'
    else:
        wordmark = ('<span class="wordmark__disc" aria-hidden="true"></span>'
                    '<span class="wordmark__type"><span>Crazy</span><span>Vinyl</span>'
                    '<span>Shop</span></span>')
    nav = ''.join(
        f'<a class="nav__link{" nav__link--accent" if item.get("accent") else ""}" '
        f'href="{e(item["href"])}">{e(item["label"])}</a>'
        for item in site['nav']
    )
    return f'''<header class="header">
  <div class="header__inner">
    <a class="wordmark" href="/" aria-label="Crazy Vinyl Shop, početna">
      {wordmark}
    </a>
    <nav class="nav" aria-label="Glavna navigacija">{nav}
      <a class="nav__link" href="/kontakt/">Kontakt</a>
    </nav>
    <div class="header__tools">
      <button type="button" class="icon-btn theme-btn" data-theme-toggle aria-label="Prebaci na svetlu temu">
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="10" cy="10" r="7.25"/>
          <path class="theme-btn__half" d="M10 2.75a7.25 7.25 0 0 0 0 14.5z"/>
        </svg>
      </button>
      <button type="button" class="icon-btn" id="searchTrigger" aria-expanded="false" aria-controls="searchOverlay">
        <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.75"/><path d="M12.8 12.8L17 17"/></svg>
        <span class="icon-btn__label">Pretraga</span>
      </button>
      <button type="button" class="icon-btn cart-btn" aria-expanded="false" aria-controls="cartDrawer" aria-label="Korpa, prazna">
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 5.5h14l-1.2 10.2a1.5 1.5 0 01-1.5 1.3H5.7a1.5 1.5 0 01-1.5-1.3L3 5.5z"/><path d="M7 5.5V4a3 3 0 016 0v1.5"/></svg>
        <span class="icon-btn__label">Korpa</span>
        <span class="cart-btn__count" aria-hidden="true">0</span>
      </button>
      <button type="button" class="icon-btn burger" id="burger" aria-expanded="false" aria-controls="mobileMenu" aria-label="Meni">
        <span class="burger__bars" aria-hidden="true"><span></span><span></span><span></span></span>
      </button>
    </div>
  </div>
</header>'''


def mobile_menu(site, categories, counts):
    items = []
    for cat in categories:
        n = counts.get(cat['slug'], 0)
        items.append(f'''<li class="mobile-menu__item">
        <a class="mobile-menu__link" href="{e(cat['href'])}" data-close-menu>
          <span>{e(cat['label'])}</span>
          <span class="mobile-menu__code">{e(cat['code'])} · {n}</span>
        </a></li>''')
    items.append('''<li class="mobile-menu__item">
        <a class="mobile-menu__link" href="/rasprodaja/" data-close-menu>
          <span class="text-terra">Rasprodaja</span><span class="mobile-menu__code">SALE</span>
        </a></li>''')
    items.append('''<li class="mobile-menu__item">
        <a class="mobile-menu__link" href="/kontakt/" data-close-menu>
          <span>Kontakt</span><span class="mobile-menu__code">TATTOO</span>
        </a></li>''')

    return f'''<div class="mobile-menu" id="mobileMenu" role="dialog" aria-modal="true" aria-label="Meni" tabindex="-1">
  <div></div>
  <div class="mobile-menu__body">
    <ul class="mobile-menu__list">{''.join(items)}</ul>
  </div>
  <div class="mobile-menu__foot">
    <a class="link-cat" href="/proizvodi/" data-close-menu>Ceo katalog</a>
    <a class="link-cat" href="/korpa/" data-close-menu>Korpa</a>
    <button type="button" class="link-cat" data-theme-toggle data-theme-label>Svetla tema</button>
    <span class="t-meta text-dim">{e(site['store']['city'])} · {e(site['brand']['country'])}</span>
  </div>
</div>'''


def search_overlay(genres):
    chips = ''.join(
        f'<a class="search__chip" href="/proizvodi/?genre={e(g)}">{e(g)}</a>' for g in genres
    )
    return f'''<div class="search" id="searchOverlay" role="dialog" aria-modal="true" aria-label="Pretraga kataloga" tabindex="-1">
  <div class="search__head">
    <div class="wrap">
      <div class="search__row">
        <label class="sr-only" for="searchInput">Pretraži kolekciju</label>
        <input class="search__input" id="searchInput" type="search" autocomplete="off"
               placeholder="Pretraži kolekciju" aria-describedby="searchCount">
        <button type="button" class="search__close" data-close-search aria-label="Zatvori pretragu">ESC</button>
      </div>
      <div class="search__hint" id="searchHint">
        <span class="t-meta text-dim">npr.</span>
        {chips}
      </div>
    </div>
  </div>
  <div class="search__body">
    <div class="wrap">
      <p class="search__count" id="searchCount" role="status" aria-live="polite"></p>
      <div class="search__results" id="searchResults"></div>
    </div>
  </div>
</div>'''


CART_DRAWER = '''<div class="scrim" id="scrim"></div>
<aside class="drawer" id="cartDrawer" role="dialog" aria-modal="true" aria-label="Korpa" tabindex="-1">
  <div class="drawer__head">
    <h2 class="drawer__title">Korpa</h2>
    <button type="button" class="search__close" data-close-cart aria-label="Zatvori korpu">Zatvori</button>
  </div>
  <div class="drawer__body" id="cartDrawerBody"></div>
  <div class="drawer__foot" id="cartDrawerFoot"></div>
</aside>'''


def footer(site, categories, counts):
    cats = ''.join(
        f'<li><a href="{e(c["href"])}">{e(c["label"])} <span class="text-dim">({counts.get(c["slug"], 0)})</span></a></li>'
        for c in categories
    )
    socials = ''.join(
        f'<li><a href="{e(s["url"])}" target="_blank" rel="noopener">{e(s["label"])}</a></li>'
        for s in site['social']
    )
    hours = site['store']['hours']
    store = site['store']
    tattoo = site['tattoo']

    return f'''<footer class="footer">
  <div class="footer__disc" data-parallax="40">{vinyl(label='CVS', speed=0.55)}</div>
  <div class="wrap footer__inner">
    <p class="footer__wordmark" aria-hidden="true"><span>Crazy</span><span>Vinyl</span><span>Shop</span></p>
    <div class="footer__cols">
      <div>
        <h2 class="footer__col-title">Radnja</h2>
        <ul class="footer__list">
          <li><span>{e(store['street'])}</span></li>
          <li><span>{e(store['city'])}, {e(site['brand']['country'])}</span></li>
          <li><a href="tel:{e(store['phoneHref'])}">{e(store['phone'])}</a></li>
          <li><a href="mailto:{e(store['email'])}">{e(store['email'])}</a></li>
        </ul>
      </div>
      <div>
        <h2 class="footer__col-title">Katalog</h2>
        <ul class="footer__list">{cats}
          <li><a href="/proizvodi/">Svi proizvodi</a></li>
          <li><a href="/rasprodaja/">Rasprodaja</a></li>
        </ul>
      </div>
      <div>
        <h2 class="footer__col-title">Radno vreme</h2>
        <ul class="footer__list">
          {''.join(f'<li><span>{e(h["day"][:3])} — {e(h["time"])}</span></li>' for h in hours)}
        </ul>
      </div>
      <div>
        <h2 class="footer__col-title">Tattoo</h2>
        <ul class="footer__list">
          <li><span>{e(tattoo['name'])}</span></li>
          <li><a href="tel:{e(tattoo['phoneHref'])}">{e(tattoo['phone'])}</a></li>
          <li><a href="mailto:{e(tattoo['email'])}">{e(tattoo['email'])}</a></li>
          <li><a href="/kontakt/">Kontakt &amp; Tattoo</a></li>
        </ul>
      </div>
      <div>
        <h2 class="footer__col-title">Mreže</h2>
        <ul class="footer__list">{socials}
          <li><a href="/politika-privatnosti/">Politika privatnosti</a></li>
        </ul>
      </div>
    </div>
    <div class="footer__bottom">
      <p class="footer__legal">{e(site['brand']['copyright'])}</p>
      <p class="footer__legal">
        <button type="button" class="footer__pref" data-motion-toggle>Animacije</button>
      </p>
      <p class="footer__legal">Powered by <a href="{e(site['brand']['poweredBy']['url'])}" target="_blank" rel="noopener">{e(site['brand']['poweredBy']['label'])}</a></p>
    </div>
  </div>
</footer>'''


# ---------------------------------------------------------------------------
# page shell
# ---------------------------------------------------------------------------

def page(*, title, description, path, body, site, categories, counts, genres,
         page_kind='', body_class='', jsonld=None, og_type='website'):
    canonical = f'{SITE_URL}{path}'
    ld = ''
    if jsonld:
        ld = f'<script type="application/ld+json">{json.dumps(jsonld, ensure_ascii=False)}</script>'

    return f'''<!doctype html>
<html lang="sr-Latn-RS" class="no-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(title)}</title>
<meta name="description" content="{e(description)}">
<link rel="canonical" href="{e(canonical)}">
<meta name="theme-color" content="#0e0e10">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/favicon.svg">
<meta property="og:type" content="{e(og_type)}">
<meta property="og:site_name" content="Crazy Vinyl Shop">
<meta property="og:locale" content="sr_RS">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(description)}">
<meta property="og:url" content="{e(canonical)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
{BOOT_SCRIPT}
<link rel="stylesheet" href="/assets/css/base.css">
<link rel="stylesheet" href="/assets/css/components.css">
<link rel="stylesheet" href="/assets/css/pages.css">
{ld}
</head>
<body data-page="{e(page_kind)}" class="{e(body_class)}">
<a class="skip-link" href="#main">Preskoči na sadržaj</a>
<div class="grain" aria-hidden="true"></div>
{header(site, categories)}
{mobile_menu(site, categories, counts)}
{search_overlay(genres)}
{CART_DRAWER}
<main id="main">
{body}
</main>
{footer(site, categories, counts)}
<script src="{GSAP}/gsap.min.js" defer></script>
<script src="{GSAP}/ScrollTrigger.min.js" defer></script>
<script type="module" src="/assets/js/main.js"></script>
</body>
</html>
'''
