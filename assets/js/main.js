/* ==========================================================================
   main.js — boot. Shared chrome always; page modules on demand.
   ========================================================================== */

import { initChrome, toast } from './ui.js';
import { initMotion } from './motion.js';

const page = document.body.dataset.page || '';

// This module is loaded as main.js?v=<hash>; pass the same version on to the
// page modules so a publish reaches them too instead of waiting out the host's
// cache lifetime.
const VER = new URL(import.meta.url).search;

async function boot() {
  try {
    await initChrome();
  } catch (err) {
    // The catalogue failed to load — say so instead of leaving empty shelves.
    console.error('[cvs] katalog nije učitan', err);
    toast('Katalog trenutno nije dostupan. Osvežite stranicu.', 'err');
  }

  try {
    switch (page) {
      case 'home': {
        const { initHome } = await import(`./home.js${VER}`);
        await initHome();
        break;
      }
      case 'shop': {
        const { initShop } = await import(`./shop.js${VER}`);
        await initShop();
        break;
      }
      case 'product': {
        const { initProduct } = await import(`./pdp.js${VER}`);
        await initProduct();
        break;
      }
      case 'cart': {
        const { initCartPage } = await import(`./cartpage.js${VER}`);
        initCartPage();
        break;
      }
      case 'checkout': {
        const { initCheckout } = await import(`./checkout.js${VER}`);
        await initCheckout();
        break;
      }
      default:
        initMotion(document);
    }
  } catch (err) {
    console.error(`[cvs] modul "${page}" nije učitan`, err);
  }

  initMotion(document);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
