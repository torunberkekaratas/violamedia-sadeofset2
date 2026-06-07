import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { initLang } from './i18n.js';

gsap.registerPlugin(ScrollTrigger);

// Bilingual content (EN / TR) + language switch.
initLang();

/* ─────────────────────────────────────────────────────────────
   CONFIG
   ───────────────────────────────────────────────────────────── */
const CONFIG = {
  totalFrames: 192, // frames exported per device set
  webDir: '/frames/web', // 1080px-wide set (desktop / tablet)
  mobileDir: '/frames/mobile', // 640px-wide set (phones)
  mobileBreakpoint: 768,
  pad: 4, // zero-padding in frame-XXXX.jpg
  frameSmoothing: 0.18, // ease toward target frame when close (floatier = lower)
  maxFrameStep: 0.5, // HARD CAP: max frames advanced per tick (~30 fps @ 60Hz)
  // → no matter how fast you scroll, the reel plays at a steady, capped speed
  overlayFadeEnd: 0.28, // headline fully gone early in the scroll (snappier)
};

/* ─────────────────────────────────────────────────────────────
   Lenis smooth scroll — the single source of scroll truth
   ───────────────────────────────────────────────────────────── */
const lenis = new Lenis({
  duration: 1.2,
  smoothWheel: true,
  smoothTouch: false,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
});

function rafLenis(time) {
  lenis.raf(time);
  requestAnimationFrame(rafLenis);
}
requestAnimationFrame(rafLenis);

// expose for in-page anchors / programmatic scrolling
window.lenis = lenis;

// smooth-scroll for in-page anchor links
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    const target = document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    lenis.scrollTo(target, { offset: 0, duration: 1.4 });
  });
});

lenis.on('scroll', ScrollTrigger.update);

/* ─────────────────────────────────────────────────────────────
   GSAP text reveals — everything below the hero
   ───────────────────────────────────────────────────────────── */
const ctx = gsap.context(() => {
  gsap.utils.toArray('.reveal-text').forEach((el) => {
    gsap.fromTo(
      el,
      { opacity: 0, y: 50 },
      {
        opacity: 1,
        y: 0,
        duration: 1.4,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: el,
          start: 'top 80%',
          toggleActions: 'play none none none',
          once: true,
        },
      }
    );
  });
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => ctx.revert());
}

window.addEventListener('load', () => ScrollTrigger.refresh());

/* Contact form → opens the visitor's email app addressed to Sade Ofset */
const contactForm = document.getElementById('contactForm');
if (contactForm) {
  contactForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = new FormData(contactForm);
    const get = (k) => (f.get(k) || '').toString().trim();
    const name = get('name');
    const company = get('company');
    const lines = [];
    if (name) lines.push(`Ad Soyad: ${name}`);
    if (get('email')) lines.push(`E-posta: ${get('email')}`);
    if (get('phone')) lines.push(`Telefon: ${get('phone')}`);
    if (company) lines.push(`Firma: ${company}`);
    lines.push('', get('message'));
    const subject = `Web — ${name || company || 'İletişim'}`;
    window.location.href =
      `mailto:info@sadeofset.com.tr?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`;
  });
}

/* ─────────────────────────────────────────────────────────────
   Scroll-driven frame-sequence player (the "video")
   ───────────────────────────────────────────────────────────── */
const hero = document.querySelector('.hero');
const sticky = document.querySelector('.hero__sticky');
const canvas = document.querySelector('.hero__canvas');
const overlay = document.querySelector('.hero__overlay');
const loaderEl = document.getElementById('loader');
const loaderNum = document.getElementById('loaderNum');

const state = {
  isMobile: window.innerWidth < CONFIG.mobileBreakpoint,
  dpr: Math.min(window.devicePixelRatio || 1, 2),
  width: 0,
  height: 0,
  targetFrame: 0,
  currentFrame: 0,
  loaded: false,
};

const ctx2d = canvas.getContext('2d', { alpha: false });
const frames = [];

// tiny offscreen used to paint a soft, blurred ambient fill behind the
// contained frame on mobile (no smears, no bars).
const blurCanvas = document.createElement('canvas');
const blurCtx = blurCanvas.getContext('2d');

function framePath(i) {
  const dir = state.isMobile ? CONFIG.mobileDir : CONFIG.webDir;
  const n = String(i + 1).padStart(CONFIG.pad, '0');
  return `${dir}/frame-${n}.jpg`;
}

function resizeCanvas() {
  state.isMobile = window.innerWidth < CONFIG.mobileBreakpoint;
  state.dpr = Math.min(window.devicePixelRatio || 1, 2);
  state.width = sticky.clientWidth;
  state.height = sticky.clientHeight;
  // Desktop: fill the frame (cover). Mobile (tall screen + ~square source):
  // show the WHOLE frame (contain) so the product is never cropped, and extend
  // the set's edge pixels into the margins so there are no visible bars.
  state.fitMode = state.isMobile ? 'contain' : 'cover';
  canvas.width = Math.round(state.width * state.dpr);
  canvas.height = Math.round(state.height * state.dpr);
  canvas.style.width = state.width + 'px';
  canvas.style.height = state.height + 'px';
  ctx2d.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  drawFrame(Math.round(state.currentFrame));
}

function drawFrame(index) {
  const img = frames[index];
  if (!img || !img.complete || img.naturalWidth === 0) return;
  const cw = state.width;
  const ch = state.height;
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const ir = iw / ih;
  const cr = cw / ch;

  ctx2d.fillStyle = '#07090c';
  ctx2d.fillRect(0, 0, cw, ch);

  let dw, dh, dx, dy;

  if (state.fitMode === 'cover') {
    // fill the viewport, crop overflow
    if (ir > cr) { dh = ch; dw = ch * ir; dx = (cw - dw) / 2; dy = 0; }
    else { dw = cw; dh = cw / ir; dx = 0; dy = (ch - dh) / 2; }
    ctx2d.drawImage(img, dx, dy, dw, dh);
    return;
  }

  // contain: show the whole frame (nothing cropped)…
  if (ir > cr) { dw = cw; dh = cw / ir; dx = 0; dy = (ch - dh) / 2; }
  else { dh = ch; dw = ch * ir; dx = (cw - dw) / 2; dy = 0; }

  // …and fill the margins with a soft, blurred copy of the same frame
  // (cheap: downscale to a tiny offscreen, then upscale — naturally blurred).
  const bw = 90;
  const bh = Math.max(1, Math.round((bw * ch) / cw));
  if (blurCanvas.width !== bw || blurCanvas.height !== bh) {
    blurCanvas.width = bw;
    blurCanvas.height = bh;
  }
  blurCtx.drawImage(img, 0, 0, bw, bh); // stretch-fill the tiny buffer
  ctx2d.imageSmoothingEnabled = true;
  ctx2d.filter = 'blur(22px)'; // true gaussian → silky ambience, no blockiness
  ctx2d.drawImage(blurCanvas, -20, -20, cw + 40, ch + 40); // overscan to hide blur edge bleed
  ctx2d.filter = 'none';
  ctx2d.fillStyle = 'rgba(7, 9, 12, 0.5)'; // mute it so the product pops
  ctx2d.fillRect(0, 0, cw, ch);

  // …then the whole product, sharp, on top.
  ctx2d.drawImage(img, dx, dy, dw, dh);
}

// Map scroll position within the hero section to a target frame.
function updateTargetFromScroll() {
  const total = hero.offsetHeight - window.innerHeight;
  const scrolled = Math.min(Math.max(-hero.getBoundingClientRect().top, 0), total);
  const p = total > 0 ? scrolled / total : 0;

  state.targetFrame = p * (CONFIG.totalFrames - 1);

  // Fade the headline out as the reel runs.
  const o = 1 - Math.min(p / CONFIG.overlayFadeEnd, 1);
  overlay.style.opacity = o.toFixed(3);
  overlay.style.transform = `translateY(${(-30 * (1 - o)).toFixed(1)}px)`;
}

function tick() {
  // Ease toward the scroll target, but clamp the per-tick advance so the reel
  // never races ahead — it always plays at a steady, capped speed.
  let step = (state.targetFrame - state.currentFrame) * CONFIG.frameSmoothing;
  if (step > CONFIG.maxFrameStep) step = CONFIG.maxFrameStep;
  else if (step < -CONFIG.maxFrameStep) step = -CONFIG.maxFrameStep;
  state.currentFrame += step;

  const idx = Math.max(0, Math.min(CONFIG.totalFrames - 1, Math.round(state.currentFrame)));
  drawFrame(idx);
  requestAnimationFrame(tick);
}

function preloadFrames() {
  let loadedCount = 0;
  const onOne = () => {
    loadedCount++;
    const pct = Math.round((loadedCount / CONFIG.totalFrames) * 100);
    if (loaderNum) loaderNum.textContent = pct;
    if (loadedCount >= CONFIG.totalFrames && !state.loaded) {
      state.loaded = true;
      canvas.classList.add('is-ready');
      if (loaderEl) loaderEl.classList.add('is-done');
      ScrollTrigger.refresh();
    }
  };
  for (let i = 0; i < CONFIG.totalFrames; i++) {
    const img = new Image();
    img.decoding = 'async';
    img.onload = onOne;
    img.onerror = onOne;
    img.src = framePath(i);
    frames[i] = img;
  }
}

function initHero() {
  resizeCanvas();
  preloadFrames();
  updateTargetFromScroll();
  tick();

  lenis.on('scroll', updateTargetFromScroll);
  window.addEventListener('resize', resizeCanvas);
  // also keep target fresh independent of scroll events
  window.addEventListener('resize', updateTargetFromScroll);
}

initHero();
