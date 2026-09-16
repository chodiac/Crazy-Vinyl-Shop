/* ==========================================================================
   motion.js — vinyl physics, scroll reveals, the hero aperture transition.

   One rAF loop drives every record on the page. Rotation follows scroll
   velocity with inertia, then settles back to a slow idle — it is never bound
   directly to scrollY.
   ========================================================================== */

import { prefersReducedMotion, $, $$ } from './ui.js';

const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;
const hasGsap = Boolean(gsap && ScrollTrigger);

if (hasGsap) gsap.registerPlugin(ScrollTrigger);

/* ==========================================================================
   vinyl rotation engine
   ========================================================================== */

const IDLE_DPS = 7;        // degrees per second when nothing is happening
const VEL_TO_DPS = 0.62;   // scroll px/ms → extra degrees per second
const MAX_DPS = 1400;
const EASING = 0.075;      // lerp factor, gives the record its inertia

const spinners = [];
let rotation = 0;
let currentDps = IDLE_DPS;
let targetDps = IDLE_DPS;
let rafId = 0;
let running = false;

let lastY = window.scrollY;
let lastT = performance.now();

function onScroll() {
  const now = performance.now();
  const dt = Math.max(1, now - lastT);
  const dy = window.scrollY - lastY;
  // px per ms, signed: scrolling up spins the record the other way
  const v = dy / dt;
  targetDps = clamp(IDLE_DPS + v * 1000 * VEL_TO_DPS, -MAX_DPS, MAX_DPS);
  lastY = window.scrollY;
  lastT = now;
}

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

function tick(now) {
  const dt = Math.min(64, now - (tick.prev || now));
  tick.prev = now;

  // with no fresh scroll input the target decays back to the idle spin
  targetDps += (IDLE_DPS - targetDps) * 0.06;
  currentDps += (targetDps - currentDps) * EASING;
  rotation += (currentDps * dt) / 1000;

  for (const s of spinners) {
    if (!s.visible) continue;
    s.el.style.transform = `rotate(${rotation * s.speed}deg)`;
  }

  rafId = requestAnimationFrame(tick);
}

function start() {
  if (running) return;
  running = true;
  tick.prev = 0;
  rafId = requestAnimationFrame(tick);
}

function stop() {
  running = false;
  cancelAnimationFrame(rafId);
}

/** Register every record on the page, and only animate the visible ones. */
export function initVinyl(root = document) {
  if (prefersReducedMotion()) return;

  const els = $$('[data-spin]:not([data-spin="off"])', root).filter((el) => !el.dataset.spinBound);
  if (!els.length) return;

  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        const rec = spinners.find((s) => s.el === e.target);
        if (rec) rec.visible = e.isIntersecting;
      });
      const anyVisible = spinners.some((s) => s.visible);
      if (anyVisible) start(); else stop();
    }, { rootMargin: '120px' })
    : null;

  els.forEach((el) => {
    el.dataset.spinBound = '1';
    const rec = { el, speed: parseFloat(el.dataset.speed) || 1, visible: !io };
    spinners.push(rec);
    io?.observe(el);
  });

  if (!spinners.some((s) => s.el.dataset.scrollBound)) {
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stop();
      else if (spinners.some((s) => s.visible)) start();
    });
  }
  if (!io) start();
}

/* ==========================================================================
   scroll reveals
   ========================================================================== */

/**
 * Reveals use IntersectionObserver rather than scroll-position triggers:
 * an observer reports the current state as soon as it observes an element, so
 * a restored scroll position, an in-page anchor or a jump all reveal correctly
 * instead of leaving content invisible below the fold.
 */
export function initReveals(root = document) {
  const show = (els) => els.forEach((el) => {
    el.style.transform = 'none';
    el.style.opacity = '1';
  });

  if (prefersReducedMotion() || !hasGsap) {
    show($$('.fade-up, .reveal > *', root));
    return;
  }

  // masked wipe for headings
  const boxes = $$('.reveal', root).filter((b) => !b.dataset.revealBound && b.children.length);
  if (boxes.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        io.unobserve(entry.target);
        gsap.to(entry.target.children, {
          yPercent: 0, duration: 1.05, ease: 'expo.out', stagger: 0.07, overwrite: true,
        });
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.01 });
    boxes.forEach((b) => { b.dataset.revealBound = '1'; io.observe(b); });
  }

  // staggered covers and blocks; claimed up front so a second initMotion pass
  // (page module + boot) cannot double-bind the same elements
  const ups = $$('.fade-up', root).filter((el) => !el.dataset.revealBound);
  if (!ups.length) return;
  ups.forEach((el) => { el.dataset.revealBound = '1'; });

  const io = new IntersectionObserver((entries) => {
    const hit = entries.filter((e) => e.isIntersecting).map((e) => e.target);
    if (!hit.length) return;
    hit.forEach((el) => io.unobserve(el));
    gsap.to(hit, {
      opacity: 1, y: 0, duration: .8, ease: 'power3.out', stagger: 0.055, overwrite: true,
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.01 });

  ups.forEach((el) => io.observe(el));
}

/* ==========================================================================
   the hero: scrolling into the record
   ========================================================================== */

export function initHeroTransition() {
  const rig = $('#heroRig');
  if (!rig) return;

  if (prefersReducedMotion() || !hasGsap) {
    const ap = $('.aperture', rig);
    if (ap) ap.style.display = 'none';
    return;
  }

  const disc = $('.hero-disc', rig);
  const type = $('.hero-type', rig);
  const rail = $('.hero-rail', rig);
  const actions = $('.hero-actions', rig);
  const aperture = $('.aperture', rig);

  // --disc-x counts in vw, --disc-s is a ratio, --ap is a percentage; all three
  // are plain numbers so the scrub only ever interpolates numbers.
  // must match the CSS resting offset, or the disc jumps on load
  const START_X = 22;

  gsap.set(disc, { '--disc-x': START_X, '--disc-s': 1, opacity: 1 });
  gsap.set(aperture, { '--ap': 0 });

  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: rig,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 0.55,
      // No invalidateOnRefresh. Every value below is a plain constant, nothing
      // here depends on viewport size — but a refresh (an image finishing, the
      // fonts landing, a resize, a mobile URL bar) would make GSAP re-record
      // the tweens' start values from whatever state the disc happened to be
      // in. Refresh while scrolled to the end and the record's "start" became
      // scale 0, opacity 0 — scrolling back up then shrank it away to nothing.
    },
  });

  // 1 — the record slides to centre and grows: we move toward the label
  tl.to(disc, { '--disc-x': 0, '--disc-s': 1.55, duration: 0.5 }, 0)
    // 2 — the wordmark lifts out of frame
    .to(type, { yPercent: -36, opacity: 0, duration: 0.4 }, 0)
    .to([rail, actions], { opacity: 0, y: -24, duration: 0.3 }, 0)
    // 3 — keep pushing in until the centre label fills the frame
    .to(disc, { '--disc-s': 4.4, duration: 0.34 }, 0.48)
    // 4 — the spindle hole opens and becomes the window onto the shop
    .to(aperture, { '--ap': 9, duration: 0.14 }, 0.58)
    .to(aperture, { '--ap': 115, duration: 0.23 }, 0.72)
    // the record fades out behind the fully open aperture
    .to(disc, { opacity: 0, duration: 0.08 }, 0.9);

}

/* ==========================================================================
   parallax: the catalogue strip drifts against vertical scroll
   ========================================================================== */

export function initParallax(root = document) {
  if (prefersReducedMotion() || !hasGsap) return;

  $$('[data-parallax]', root).forEach((el) => {
    if (el.dataset.parallaxBound) return;
    el.dataset.parallaxBound = '1';
    const amount = parseFloat(el.dataset.parallax) || 60;
    gsap.fromTo(el, { y: amount }, {
      y: -amount,
      ease: 'none',
      scrollTrigger: { trigger: el.closest('section') || el, start: 'top bottom', end: 'bottom top', scrub: true },
    });
  });

  $$('[data-drift]', root).forEach((el) => {
    if (el.dataset.driftBound) return;
    el.dataset.driftBound = '1';
    const amount = parseFloat(el.dataset.drift) || 120;
    gsap.fromTo(el, { x: amount }, {
      x: -amount,
      ease: 'none',
      scrollTrigger: { trigger: el.closest('section') || el, start: 'top bottom', end: 'bottom top', scrub: true },
    });
  });
}

/* ==========================================================================
   boot
   ========================================================================== */

export function initMotion(root = document) {
  initVinyl(root);
  initReveals(root);
  initParallax(root);
  if (hasGsap) {
    // Fonts change metrics; recalculate once they land.
    document.fonts?.ready.then(() => ScrollTrigger.refresh());
  }
}

/** Release triggers created for a subtree (used when a grid is re-rendered). */
export function refreshMotion() {
  if (hasGsap) ScrollTrigger.refresh();
}

export { hasGsap };
