/* ==========================================================================
   tv.js — analogue static behind the hero.

   Rendered into a deliberately tiny canvas (280×168) and stretched by CSS with
   `image-rendering: pixelated`. That is both how broadcast snow actually looks
   — chunky, not fine-grained — and why it costs almost nothing: ~47k pixels a
   frame instead of the two million the viewport actually has.

   It runs at about 18fps rather than 60. Real static is not smooth, and the
   lower rate keeps the main thread free for the record and the scroll.
   ========================================================================== */

import { prefersReducedMotion } from './ui.js';

const W = 280;
const H = 168;
const FPS = 18;

/* Specks are painted in the theme's own text colour, and their alpha is a cubed
   random so most pixels are nearly clear and only a few flash. Flat grey noise
   at a uniform alpha does not read as static — it reads as a grey veil laid
   over the page, because its average is mid-grey no matter how far the opacity
   is turned down. This keeps the average close to the background and puts the
   energy into the sparkle instead. */
const SPECK = { dark: [243, 243, 243], light: [25, 21, 16] };

export function initTvStatic(canvas) {
  if (!canvas || canvas.dataset.tvBound) return;
  canvas.dataset.tvBound = '1';

  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  canvas.width = W;
  canvas.height = H;

  const frameData = ctx.createImageData(W, H);
  const pixels = new Uint32Array(frameData.data.buffer);

  const paint = () => {
    const [r, g, b] = document.documentElement.dataset.theme === 'light'
      ? SPECK.light : SPECK.dark;
    const rgb = (b << 16) | (g << 8) | r; // little-endian ABGR, alpha added below
    for (let i = 0; i < pixels.length; i += 1) {
      const u = Math.random();
      pixels[i] = (((u * u * u * 255) | 0) << 24) | rgb;
    }
    ctx.putImageData(frameData, 0, 0);
  };

  // Reduced motion still gets the texture — one frozen frame of snow, which
  // reads as a switched-off screen rather than a blank panel.
  if (prefersReducedMotion()) {
    paint();
    return;
  }

  let rafId = 0;
  let running = false;
  let lastPaint = 0;
  let onScreen = true;

  const tick = (now) => {
    rafId = requestAnimationFrame(tick);
    if (now - lastPaint < 1000 / FPS) return;
    lastPaint = now;
    paint();
  };

  const start = () => {
    if (running) return;
    running = true;
    lastPaint = 0;
    rafId = requestAnimationFrame(tick);
  };

  const stop = () => {
    running = false;
    cancelAnimationFrame(rafId);
  };

  paint();

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      onScreen = entries.some((e) => e.isIntersecting);
      if (onScreen && !document.hidden) start(); else stop();
    }, { rootMargin: '80px' });
    io.observe(canvas);
  } else {
    start();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else if (onScreen) start();
  });
}
