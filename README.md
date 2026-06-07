# Sade Ofset — Printing & Packaging

A dark, cinematic one-page site for Sade Ofset (Istanbul, est. 1975). The hero
is a **scroll-driven frame-sequence "video"**: scrolling runs a 192-frame reel
of the studio's product showcase, drawn to a `<canvas>` and scrubbed by scroll
position. Smooth scroll via **Lenis**, text reveals via **GSAP ScrollTrigger**.
Vanilla JS + Vite. No frameworks.

---

## Why a frame sequence instead of a `<video>`?

`<video>` + `currentTime` scrubbing stutters on many browsers (especially
mobile/Safari) because seeking isn't frame-accurate. Exporting the clip to
images and drawing the right frame to a canvas on each scroll tick gives
Apple-style, buttery, fully-synced scrubbing — forwards and backwards.

### No more black bars
The source clips had the product centred with black pillars on the sides. We:
1. **Crop** the black away with FFmpeg (content bounds detected per file), and
2. Draw each frame with **`object-fit: cover`** so it always fills the viewport.

Two device sets are produced and only one loads at runtime:
- **`/frames/web`** — from `1920x1080.mp4`, cropped to `1610×1080`, scaled to 1080w
- **`/frames/mobile`** — from `1440x1440.mp4`, cropped to `1206×1440`, scaled to 640w

On a desktop (16:9) the web set fills width; on a phone (9:16) the mobile set
fills height and the (already-black) sides are cropped out by `cover`. Result:
**zero black bars on either device.**

---

## Install & run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build → dist/
npm run preview
```

---

## Project structure

```
.
├── index.html          # semantic markup, all copy
├── vite.config.js      # dev server on :5173
└── src/
    ├── script.js       # Lenis + GSAP reveals + canvas frame player
    └── styles.css      # all styling (dark + brand cyan + CMYK diamond)
public/
├── brand/              # logo, favicon, og image
├── clients/white/      # 19 client logos as white silhouettes (PNG)
├── products/           # sector showcase renders
├── certs/              # ISO 9001 / 14001 / OHSAS 18001 badges
└── frames/
    ├── web/            # frame-0001.jpg … frame-0192.jpg (desktop)
    └── mobile/         # frame-0001.jpg … frame-0192.jpg (phones)
```

---

## CONFIG (top of `src/script.js`)

| Key | Meaning |
| --- | --- |
| `totalFrames` | number of frames per set (192) |
| `webDir` / `mobileDir` | folders for each device set |
| `mobileBreakpoint` | px width below which the mobile set loads |
| `pad` | zero-padding in `frame-XXXX.jpg` |
| `frameSmoothing` | lerp toward the target frame (lower = floatier scrub) |
| `overlayFadeEnd` | scroll progress at which the headline is fully gone |

The hero scroll length is set in CSS: `.hero { height: 520vh }` (desktop) /
`460vh` (mobile). Longer = slower, more deliberate reel.

---

## How it works

1. **Preload** — all 192 frames of the chosen set load up front behind a `%`
   loader; the canvas fades in when ready.
2. **Scroll → frame** — within the tall sticky hero, scroll progress `0→1` maps
   to frame `0→191`. A rAF loop eases the current frame toward that target and
   draws it `cover`-fit to the canvas.
3. **Headline fade** — the overlay headline fades + lifts out over the first
   `overlayFadeEnd` of the hero, then the bare reel plays.
4. **Reveals** — every `.reveal-text` below the hero fades up once at
   `top 80%` via GSAP ScrollTrigger, kept in sync with Lenis.

### Replacing the video
Drop new `frame-0001.jpg …` into `public/frames/web` and `…/mobile` (update
`totalFrames` if the count changes). To regenerate from a new MP4:

```bash
ffmpeg -i web.mp4   -vf "crop=W:H:X:Y,scale=1080:-2" -qscale:v 5 public/frames/web/frame-%04d.jpg
ffmpeg -i mobile.mp4 -vf "crop=W:H:X:Y,scale=640:-2"  -qscale:v 5 public/frames/mobile/frame-%04d.jpg
```

Find the crop `W:H:X:Y` (to kill any black bars) with `ffmpeg -i in.mp4 -vf cropdetect -f null -`.
```
# violamedia-sadeofset2
