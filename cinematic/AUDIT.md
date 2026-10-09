# FSCHOOL AI — current repo audit (Ryan, QA/perf/a11y/mobile)

Written 2026-10-07 from reading the code. Repo: `/home/ashwik/.gemini/antigravity-ide/scratch/fschool-ai`.

## 1. Framework and entry
- **No framework, no build.** Plain HTML + vanilla ES modules. `index.html` → `<script type="module" src="app.js">`.
- **three.js 0.160.0 via importmap** from `unpkg.com` (`three`, `three/addons/`). Needs internet; no local copy.
- **Routes:** none. One page, three `<section>`s stacked: `#intro` (scroll frames) → `#reception` (3D lobby) → `#room` (hidden until a career is picked).
- **State:** module-level variables in `app.js` (`greeted`, `voiceOn`, `lobby`). No store. New shared store = `cinematic/state.js` (Jim).
- **Fonts:** Google Fonts Inter, Outfit, JetBrains Mono.
- **Run:** `cd fschool-ai && python3 -m http.server 8000` → http://localhost:8000. Must be served (ES modules + importmap fail on `file://`).

## 2. What each file does
| File | Size | Role |
|---|---|---|
| `index.html` | 3.6 KB | Markup for 3 scenes, loader, chat form, chips |
| `app.js` | 12 KB | Scroll-scrubbed frame intro (canvas 2D), voice (speechSynthesis + SpeechRecognition), keyword routing to 4 rooms, roadmap render, hacker "matrix" rain |
| `lobby.js` | 15 KB | three.js lobby: corridor, 4 doors, canvas-texture signs/logo, Xbot.glb receptionist "Fia" with walk animation, scroll-driven camera, `walkTo(key)`/`reset()` API |
| `styles.css` | 10 KB | All styles; one 860px breakpoint; global reduced-motion kill switch |

## 3. Animation
- **Intro:** 150 JPEG frames (1280×720, 6.1 MB total) drawn to `<canvas>` by scroll progress; 0–55 % plays frames, 55–100 % CSS `scale()` up to 6.5× + white "door flash".
- **Lobby:** three.js `requestAnimationFrame` loop, `AnimationMixer` on Xbot clips, camera eased by scroll + pointer parallax.
- **No GSAP / Lenis / Framer.** All hand-rolled easing (`t*t*(3-2t)`).
- **Room:** IntersectionObserver reveals roadmap `<li>`s (`.in` class); matrix rain RAF loop for hacker room.

## 4. Assets
- `assets/frames/f_001..150.jpg` — 6.1 MB, 1280×720 baseline JPEG. **All 150 preloaded before the loader hides** (blocks first paint on slow links).
- `assets/models/Xbot.glb` — 2.9 MB (three.js sample robot, not compressed / no Draco).
- `/home/ashwik/Downloads`: `fschoolai-logo.jpeg` (43 KB), 6 MP4 clips 2.9–5.6 MB each, H.264 1280×720 + AAC (Doors opening, Mist clears above entrance, Camera gliding, Receptionist welcoming, 2 WhatsApp videos). **Clips have audio tracks** → must be `muted playsinline` to autoplay.
- Logo in the lobby is drawn procedurally on a canvas, not the real JPEG.

## 5. Existing AI / mic / voice
- **No AI backend.** No fetch calls at all. "Classification" = 4 regexes (`MATCH` in app.js). Comment says swap `say()` for a Fish Audio `/api/tts` later — no server exists.
- **TTS:** `speechSynthesis`, voice ON by default, speaks on first lobby view (fires without a user gesture on some browsers → may be blocked/silent).
- **Mic:** `webkitSpeechRecognition` only; button hidden if unsupported (Firefox, many mobile browsers). No `onerror` handler → denied permission leaves the mic button stuck in `.live` until `onend`; no user message. Typed input always present (good).
- No auth, no DB, no env config, no API keys.

## 6. Responsive
- One breakpoint `@media(max-width:860px)` targeting `.rec-wrap/.rec-3d` — **those classes are not in index.html** (dead rule). Lobby canvas is full viewport at any size.
- `devicePixelRatio` capped at 2 for both canvases (good). No device-tier logic; mobile renders the same 3D scene with `antialias:true`.
- Intro canvas resizes on `resize` only (no `orientationchange`/`visualViewport`).

## 7. Accessibility
- `prefers-reduced-motion`: only CSS (`animation/transition:none`). **JS motion is not reduced**: scroll frame scrub, 6.5× zoom, 3D camera moves, matrix rain all still run.
- Emoji as UI (🎙️ 🔊 chips with 🩺💻⚙️🎨, door signs) — spec bans emoji UI.
- `aria-label` on mic + canvases, `.sr` label on input (good). Chips/door choice is button-driven (spec says no career buttons).
- No focus styles audited yet; no skip link; `#room` uses `hidden` (fine).

## 8. Deploy
- No package.json, no CI, no hosting config. Static folder; any static host works if it serves `.js` as `text/javascript`.
- Hard dependency on unpkg.com and Google Fonts at runtime.

## 9. Gap analysis (spec §3)
- **Reusable as-is:** Xbot receptionist + walk/idle animation, `lobby.js` scroll-camera pattern, frame-scrub technique, typed input, IntersectionObserver reveal, DPR cap.
- **Needs refinement:** palette (current = dark navy + neon cyan/green/pink; spec = cream/charcoal/navy/wood), emoji UI, career chips, matrix rain (banned cliché), reduced-motion in JS, mic error states, TTS autoplay.
- **Missing:** state machine (now `state.js`), AI classification with loading/timeout/fallback, chapter progress indicator, audio manager, device tiers, lazy scene loading, real logo use, app-entry handoff.
- **Technically risky:** 6.1 MB frame preload + 2.9 MB GLB + CDN three.js before anything interactive; SpeechRecognition support (Chrome/Edge only); MP4s with audio autoplay; unpkg outage = no lobby.
- **Performance-sensitive:** frame sequence (convert to WebP, ~40–60 % smaller, load first ~20 then stream), GLB (Draco/meshopt), three.js renderer on mobile (antialias off, DPR ≤1.5, no shadows), RAF loops must stop when offscreen.

## 10. Rules for the cinematic build (from QA)
- Mount behind one flag: `?cinematic=1` (or `#cinematic`) — old flow stays default until sign-off.
- Import `cinematic/quality.js` for `tier`, `reducedMotion`, `lazy()`, `onVisible()`; import `cinematic/audio.js` for sounds (muted by default).
- Every RAF loop: pause when its scene is offscreen (`onVisible`) and on `document.hidden`.
- Every three.js scene: `dispose()` geometries/materials/textures on exit.
- Videos: `muted playsinline preload="metadata"`, poster frame, load only when the scene is near.
