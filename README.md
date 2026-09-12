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
