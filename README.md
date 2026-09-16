# Crazy Vinyl Shop — redesign

A complete rebuild of [crazyvinylshop.rs](https://crazyvinylshop.rs/): a multi-page
record-shop storefront carrying the real catalogue, contact details and ordering
model of the live site, with a new art direction.

**1 470 products** imported from the live site (1 469 vinyl + 1 CD), every one with
its own page.

---

## Run it

No build tooling and no backend — Python 3 is the only requirement.

```bash
python tools/serve.py
```

Then open <http://localhost:5180/>. The server disables caching and serves
`404.html` for unknown paths, which is how a static host behaves.

After changing anything in `data/` or `tools/`, regenerate the pages:

```bash
python tools/build.py
```

Check every route and link still resolves:

```bash
python tools/audit.py
```

---

## Publishing (GitHub Pages and friends)

Generated pages link **relatively** — `./assets/...` from the root, `../../assets/...`
from a product page. That is why the site works unchanged at:

- a real domain root (`crazyvinylshop.rs`)
- a GitHub Pages **project** site (`user.github.io/repo/`)
- a GitHub Pages **user** site (`user.github.io/`)
- a plain folder opened from disk

Commit the whole folder and point Pages at the branch root. The build also
writes two files that belong in the repository:

- `.nojekyll` — stops GitHub running the output through Jekyll.
- `.gitattributes` — pins line endings to LF. Every generated file is written
  with LF; on Windows Git's default `core.autocrlf=true` rewrites them to CRLF
  on checkout, warns on each file and makes the whole site look changed after
  every build. If you ever see *"This file uses 'LF' line endings, but Git is
  configured to convert them to 'CRLF'"*, this file went missing.

**Do not add a `<base href>` tag.** It was needed when the pages linked with
absolute paths; with relative links it breaks them. `<base>` changes what *every*
relative URL in the document resolves against, so a product page's
`../../assets/…` would resolve against the base instead of the page and end up
above the site root.

JavaScript cannot use the same relative strings — `data/index.json` would
resolve against whichever page is open — so it derives the site root once from
its own module URL in `assets/js/paths.js`. Never hardcode a leading `/` in a
path inside JS; call `url('data/index.json')` instead.

**One caveat.** GitHub Pages serves `/404.html` for a missing path at *any*
depth, so relative links on that one page can point too high. If you care about
the 404 page on a project site, build with the sub-path instead — every link
then becomes absolute under it:

```bash
python tools/build.py --base /crazy-vinyl-shop
```

Use the repository name as the base. For a user site or a real domain, leave
`--base` off.

---

## Routes

| Route | What it is |
| --- | --- |
| `/` | Home — vinyl hero, the scroll-through-the-record transition, shop sections |
| `/proizvodi/` | Full catalogue with filters, search, sorting, paging |
| `/ploce/` `/diskovi/` `/majice/` `/solje/` `/ostalo/` | Category pages (kept even when empty) |
| `/rasprodaja/` | Sale — shows only what the data marks as on sale |
| `/proizvod/<slug>/` | Product page, one per product, pre-rendered |
| `/korpa/` | Cart |
| `/checkout/` | Order form |
| `/kontakt/` | Kontakt & Tattoo |
| `/politika-privatnosti/` | Privacy policy |
| `/404.html` | Not found |

Filters are reflected in the query string, so a filtered view is shareable:
`/ploce/?genre=Jazz&status=available&sort=price-asc`

---

## Layout

```
data/            the source of truth
  products.json    canonical catalogue — edit this
  site.json        contact, hours, tattoo studio, delivery zones
  categories.json  category routes and copy
  privacy.json     privacy policy, structured
  index.json       generated: compact listing index the storefront fetches
  images.json      generated: which products have a real image file

images/products/ drop artwork here (see below)

assets/css/      base.css (tokens) · components.css · pages.css
assets/js/       store.js  data access, filtering, sorting, search
                 cart.js   cart state + delivery zones
                 ui.js     header, menu, search, drawer, cards, placeholders
                 motion.js vinyl physics, reveals, hero transition
                 shop.js · pdp.js · cartpage.js · checkout.js · home.js
                 main.js   boot, loads the page module on demand

tools/           build.py (generator) · template.py (shared markup)
                 serve.py (preview) · audit.py (link check)
```

Every page, filter value and search result reads from the same product data.
No product metadata is duplicated in a component.

---

## Light and dark

**Light is the default.** A toggle sits in the header — a half-lit record that
turns over — and repeats as a labelled button in the mobile menu. The choice is
remembered in `localStorage` and applied in the document head before first
paint, so pages never flash the wrong theme.

Light is not a separate stylesheet. Every colour is a token in
`assets/css/base.css`, and `:root[data-theme='light']` re-values those tokens:
the ground becomes printing paper, the alternating sections deepen into
cardboard, and the accents darken enough to keep small type above 4.5:1. No
component knows which theme it is in. Records stay black and their labels stay
terracotta in both, because that is what a record looks like.

Since the record is black either way, the light theme washes the hero's text
column and the header bar back to the page ground — otherwise the disc would
swallow the dark type sitting over it.

To make dark the default instead, change the `var t='light'` fallback in
`BOOT_SCRIPT` (`tools/template.py`) and rebuild.

---

## Motion

**Motion is on by default**, at the shop's request. The operating system's
reduced-motion setting no longer switches it off on its own — the **Animacije**
switch in the footer does, and that choice sticks in `localStorage`.
`?motion=0` forces the reduced version for a single visit, `?motion=1` the full
one.

That is a deliberate trade: `prefers-reduced-motion` exists for people who get
motion sickness, and this ignores it until they opt out. To hand the decision
back to the operating system, restore the `matchMedia` branch in `BOOT_SCRIPT`
(`tools/template.py`).

### TV static

The hero runs a dead-channel layer: `assets/js/tv.js` paints noise into a
280×168 canvas that CSS stretches across the stage with
`image-rendering: pixelated`. Broadcast snow is chunky rather than fine, so the
low buffer is the right look *and* costs ~0.5 ms a frame instead of repainting
two million pixels. It runs at 18fps — real static is not smooth — and pauses
via `IntersectionObserver` and `visibilitychange` when it is off screen.

The specks are painted in the theme's own text colour with a **cubed random
alpha**, so most pixels are nearly clear and only a few flash. Flat grey noise
at a uniform alpha does not read as static at all — its average is mid-grey, so
turning the opacity down just thins a grey veil laid over the page instead of
making the snow quieter. Keeping the average near the background and putting
the energy into the sparkle is what makes it subtle.

It composites with plain alpha, no blend mode: `multiply` disappears against
the black record and `screen` disappears against paper, and the hero has both.
Tube scanlines and a slow vertical-hold roll sit on the same layer.

The whole tube sits at the **back** of the hero — the record plays in front of
the dead channel rather than being filtered through it. Hero stacking, front to
back: content 4 · light-theme wash 2 · record 1 · tube 0, with the aperture at 6
once it opens.

Under reduced motion it paints **one** frozen frame — snow without flicker,
which reads as a switched-off screen rather than an empty panel.

Because the static veils the hero, the metadata rail there runs one step
stronger than the usual muted tone, and its tallies use the deeper terracotta in
the light theme; at the usual values they fell to 4.4:1 against the veiled
background.

### How the record spins

The rotation engine drives `.vinyl__spin`, and **everything that should visibly
turn has to live inside that element** — the label and the pressing seam do.
Concentric grooves look identical at every angle, so decoration left on the
static `.vinyl` layer makes a correctly-spinning record look frozen.

### Why the hero timeline has no `invalidateOnRefresh`

Every value in it is a plain constant; nothing depends on viewport size. With
`invalidateOnRefresh` on, any refresh — an image finishing, the fonts landing, a
resize, a phone's URL bar — made GSAP re-record the tweens' start values from
whatever state the record was in at that moment. Refresh while scrolled to the
bottom of the hero and the record's recorded "start" became scale 0, opacity 0,
so scrolling back up shrank it away into nothing instead of returning it.

---

## Logos

Two optional slots, both falling back to type until a file exists:

| File | Where it shows |
| --- | --- |
| `images/logo.png` (or `.svg`, `.webp`) | header mark **and** the centre of every record |
| `images/natpislogo2.png` | the home page hero, in place of the CRAZY / VINYL / SHOP type |
| `images/logo-label.png` *(optional)* | record centre, if it should differ from the header mark |
| `images/natpislogo.png` *(optional)* | wide hero lockup, used only if `natpislogo2` is absent |

Use **transparent** artwork: these sit on paper in the light theme and on the
record's black label, so a baked-in background shows as a box. The opaque
black-background label export has been parked in `images/_unused/`.

Save the file, then run `python tools/build.py` — the build prints which slot it
picked up. With nothing there, the header uses the typographic
`CRAZY VINYL SHOP` lockup and the records print `CVS` on their labels.

The header sizes the emblem off the bar's height (it is roughly square), and
shrinks it as the header compacts on scroll.

**The build resizes the master.** An export at full resolution — the current
emblem is 1254px, 1.7 MB — would cost more on every page than every other asset
put together, for a mark that renders under 80px. `tools/build.py` writes a
right-sized WebP into `images/gen/` and references that, leaving your file as
the untouched source; it is re-derived whenever the master changes. Commit
`images/gen/` along with everything else, it is part of the deployed site.
Without Pillow installed the build falls back to shipping the master and says
so in its output.

When a label logo exists the record's printed terracotta label is replaced by a
pressed black one, which the transparent emblem sits on cleanly. The label is a child of `.vinyl__spin`, so the logo turns with the
record at scroll velocity — that is what makes the whole disc read as spinning.
Do not add a separate rotation tween to the logo; it would run out of step with
the disc underneath it.

On phones the hero lockup and the record's label carry the same artwork, so the
lockup sits high under the metadata rail and the record drops below it; on
desktop they are far enough apart to sit side by side.

The favicon stays a drawn record (`favicon.svg`) — the full emblem is too
detailed to read at 32px.

---

## Product images

**No images were copied from the live site.** Every product renders a designed
placeholder that names the file it is waiting for.

To add real artwork:

1. Save the image as `images/products/<slug>.jpg` — the slug is printed on the
   placeholder itself, e.g. `the-cure-pornography.jpg`.
2. Run `python tools/build.py` to refresh `data/images.json`.

Square images work best (cards and product pages both use a 1:1 frame). The site
only requests files listed in the manifest, so missing artwork costs nothing and
logs no errors.

The product grid is two records to a row on phones, three or more from tablet
up; card type, the price and the buy button all reflow for the narrower cell.

---

## Editing the catalogue

`data/products.json` is the canonical record. Each entry:

```json
{
  "id": "8596",
  "slug": "leb-i-sol-i-taka-nataka-vinyl",
  "artist": "Leb i Sol",
  "title": "I Taka Nataka",
  "category": "ploce",
  "price": 4800,
  "salePrice": null,
  "currency": "RSD",
  "available": true,
  "onSale": false,
  "condition": "Novo",
  "format": "Vinyl",
  "genre": "Jazz",
  "year": 2026,
  "country": "Severna Makedonija",
  "origin": "exYu",
  "tracklist": [],
  "notes": "",
  "image": "/images/products/leb-i-sol-i-taka-nataka-vinyl.jpg",
  "addedAt": "2026-08-18",
  "sourceUrl": "https://crazyvinylshop.rs/vinyls/leb-i-sol-i-taka-nataka-vinyl/"
}
```

Empty fields stay empty — the UI omits them rather than inventing values.

**Putting something on sale:** set `onSale: true` and a `salePrice` below `price`,
then rebuild. The product appears on `/rasprodaja/`, in the sale filter and the
home page sale band, with the old price struck through. Nothing is on sale in the
imported data, so those surfaces currently show their empty state — which is what
the live site shows too.

Filters are generated from whatever is in the data. Add a category or a genre and
it appears; remove the last product using a value and that value disappears.

---

## Ordering

The live shop takes orders over Post Express (cash on delivery in Serbia, export
abroad) and has no card gateway, so this keeps that model rather than pretending
a payment provider is configured. Delivery zones and prices in `site.json` match
the live site's.

`submitOrder()` in `assets/js/checkout.js` is the single seam for a backend. It
currently records the order locally and returns its reference; replace the body
with a POST to your API, Supabase, WooCommerce or a mail endpoint. The order
object it receives already carries customer, items, delivery zone and totals.

---

## Motion

The record's rotation follows scroll velocity with inertia and settles to a slow
idle — one `requestAnimationFrame` loop drives every record on the page, and
off-screen records are skipped via `IntersectionObserver`.

Everything animated is `transform`, `opacity` or `clip-path`. Reveals use
`IntersectionObserver` so content is never left hidden after a jump, a restored
scroll position or an in-page anchor.

`prefers-reduced-motion` is honoured: the head sets an `rm` class before first
paint and both CSS and JS read it, so the two can never disagree. The hero drops
its pinned transition and everything renders in its final state.

`?motion=1` on any URL forces the full experience on for design review. It does
not change anyone's actual setting.

---

## Notes on the imported data

- `Poreklo` (origin) is only partially recoverable. The live site exposes the
  taxonomy in its filter and reports 137 `exYu` and 1 297 `Strano` products, but
  never prints the value on a product page and its filter API ignores the
  parameter. 136 of the 137 `exYu` products were resolved by combining filters;
  the rest are left empty rather than guessed. `Zemlja` (country) is complete and
  is used as the country filter.
- The live site reports every product as `Novo` (its `used` filter returns
  nothing), so `condition` is `Novo` throughout.
- 26 products have no artist — they are compilations where the source lists only
  a title. Those render title-only.
- `addedAt` comes from the real publish date on the live site, so "Najnovije"
  sorting is genuine rather than approximated.
