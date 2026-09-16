/* ==========================================================================
   paths.js — where the site lives.

   The generated HTML uses relative links, so the build works at a domain root,
   inside a GitHub Pages project sub-path (user.github.io/repo/) or straight
   off the file system. JavaScript cannot use relative strings the same way —
   "data/index.json" would resolve against whatever page happens to be open, so
   it breaks on a product page two levels deep.

   Instead the site root is derived once from this module's own URL. This file
   is always at <root>/assets/js/paths.js, so stepping up two levels is the
   root, wherever that is.
   ========================================================================== */

const ROOT = new URL('../../', import.meta.url).href;

/**
 * Resolve a site-root-relative path to an absolute URL.
 * `url('data/index.json')` and `url('/data/index.json')` are equivalent.
 */
export function url(path = '') {
  return new URL(String(path).replace(/^\/+/, ''), ROOT).href;
}

/** The site root itself, as an absolute URL. */
export const root = () => ROOT;

/** Product page URL for a slug. */
export const productUrl = (slug) => url(`proizvod/${slug}/`);

/** Product artwork URL for a slug. */
export const imageUrl = (slug) => url(`images/products/${slug}.jpg`);

/**
 * True when `href` points at the page currently open. Compares resolved URLs,
 * so it works with relative hrefs at any depth.
 */
export function isCurrent(href) {
  try {
    return new URL(href, location.href).pathname.replace(/index\.html$/, '')
      === location.pathname.replace(/index\.html$/, '');
  } catch {
    return false;
  }
}
