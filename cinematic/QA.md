# QA report (Ryan) — 2026-10-07, first pass

Runner: `~/HarnessAgents/hive/agents/ryan-muy2kmup/qa/qa.mjs` (Playwright-core + Brave, run with the hive node 20: `/home/ashwik/HarnessAgents/hive/bin/runtime/node qa.mjs`; serve repo on :8765 first). Machine: 7.8 GB RAM, software WebGL.

## Findings (existing flow, `index.html`)
1. **HIGH, memory: scroll intro holds 150 decoded 1280x720 frames = ~553 MB** (`app.js` frames[]). Headless Brave died on the first wheel scroll of the real page; a plain 5000px page scrolled fine. On phones this will crash the tab. Fix: keep a window of ~12 frames (or use ImageBitmap + drop), load every 2nd frame on `tier:low`, WebP. Owner of new intro should NOT reuse this pattern.
2. **HIGH, load: loader blocks until all 150 frames (6.1 MB) finish**. Load first ~20, stream the rest.
3. **MED: one 404 on page load** (a missing resource; likely favicon). Add a favicon / `<link rel="icon" href="data:,">`.
4. **MED: reduced motion is CSS-only.** JS frame scrub, 6.5x zoom, 3D camera and matrix rain still run. Use `reducedMotion` / `motion.scrub` from `quality.js`.
5. **MED: mic has no `onerror`.** Denied permission leaves the button in `.live` with no message. Spec text: "That's okay. Type what you want to become."
6. **MED: TTS speaks on lobby view without a user gesture** (blocked/silent on most browsers; intrusive where allowed). Default voice should be off or gesture-gated.
7. **LOW: dead CSS** (`@media 860px` targets `.rec-wrap/.rec-3d`, not in markup), so there is no real mobile layout. Lobby renders `antialias:true` at DPR 2 on every device.
8. **LOW, spec: emoji UI, career chips, matrix rain, neon palette** all conflict with the brief (expected, being replaced).
9. **LOW, availability: three.js + fonts load from unpkg/Google at runtime.** If unpkg is down the lobby fails.

## Not yet verified (blocked by finding 1 / waiting on modules)
FPS numbers, mobile screenshots, keyboard path, screen-reader order for the cinematic flow. Will run `qa.mjs` against `?cinematic=1` once Jim's entry lands; the script already covers desktop, mobile (390x844) and reduced-motion, console errors, failed requests, h-scroll, unlabeled controls, emoji UI, tab order.

## Test checklist (per scene)
- [ ] No console errors/warnings; no 4xx
- [ ] `?quality=low|mid|high` and `?motion=reduce` each render the full story
- [ ] 390x844 and 844x390: no horizontal scroll, mic/typed input reachable with one thumb
- [ ] Tab order logical, visible focus ring, Esc/Enter work, `aria-live` for transcript/state changes
- [ ] Mic denied / unsupported / timeout: friendly message, typed input still works, never a raw error
- [ ] AI call: loading state, timeout (<=8 s via `withTimeout`), fallback "Let's explore."
- [ ] Sound off by default, no autoplay; toggle labelled and keyboard operable
- [ ] RAF loops stop offscreen / hidden tab; scene dispose frees GPU memory
- [ ] Back to old flow (no `?cinematic`) still works unchanged

# Second pass: full cinematic flow (`/cinematic/index.html`), 2026-10-07
Tools: `qa/cine.mjs` (4 profiles) and `qa/flow.mjs` (typed/mic end-to-end), Brave headless, software WebGL.

**Passes**
- Desktop 1440x900, mobile 390x844 (touch), `?motion=reduce`, `?quality=low`: no crashes, no horizontal scroll, no console errors, no failed requests (only Google Fonts blocked offline in one run -> falls back to system serif).
- State trail is correct in every run: WELCOME > SCHOOL_ENTRANCE > SCHOOL_HALLWAY > RECEPTION > QUESTION > CAREER_IDENTIFIED > CAREER_TRANSITION > PERSONALIZED_PATH.
- Typed fallback: "doctor", "build rockets" (astronaut), and gibberish ("asdf qwerty zzz" -> open discovery school) all reach the path. No dead ends.
- Mic unavailable/denied: shows "Tell us in writing.", typed form opens focused. No raw errors.
- All buttons/inputs have accessible names; no emoji UI; tab order is sensible (mic, type, chapters, skip).
- Skip to reception / Skip to your path work.

**Bugs**
1. Contrast (Jim + Stanley): cream text over the bright cream reception wall is hard to read: "Tap and tell us." / "You can speak naturally." on desktop, and "Where do you want to go?" overlapping the logo on mobile. Needs a darker scrim behind the text block or charcoal text, minimum 4.5:1.
2. Wait time (Jim/Phyllis): typed answer to path takes 9 s (reduced motion) to 17-21 s (full) with no way to hurry except Skip. Make Skip visible during CAREER_TRANSITION, and keep a live "Got it." message so it never looks stuck.
3. Classifier timeout not testable yet (`CLASSIFIER_ENDPOINT = null` in CareerClassifier.js; offline path used). Code review: 6 s abort + offline fallback is correct. Re-test when an endpoint is set.
4. Mic path with real speech is untested here (headless has no microphone). Needs a manual run in Chrome/Edge: allow, deny, silence (nocatch).
5. Tier detects `low` in this environment (software GPU), as intended. Real-device FPS not measured; run `?quality=high` manually on a real GPU and watch `window.__quality.fpsGovernor.fps`.
6. Fonts load from Google; if offline the serif falls back. Acceptable, but add `font-display:swap` (already in the URL) and a Georgia fallback stack (Stanley's CSS has it).

# 3D performance guidance (real-time three.js build)
Budgets live in `quality.js` (`BUDGETS`, `budget()`, `budgetCheck(renderer, scene)`, `applyTier(renderer)`, `watchBudget`; add `?stats` to the URL to log them every 2 s).

| Tier | Frame | Draw calls | Triangles | Textures | Lights | Shadows |
|---|---|---|---|---|---|---|
| low | 33 ms (30 fps) | 60 | 80k | 48 MB | 2 | off |
| mid | 20 ms | 120 | 200k | 96 MB | 4 | off |
| high | 16.6 ms (60 fps) | 250 | 500k | 192 MB | 6 | on |

Rules for scene owners:
- **Instancing:** repeated objects (desks, lockers, books, ceiling lights, plants) use `InstancedMesh`; merge static geometry (`BufferGeometryUtils.mergeGeometries`) so a hallway is a handful of draw calls, not hundreds.
- **Share** geometries and materials between meshes; one material per look.
- **Textures:** power-of-two, max `quality.textureMax`, KTX2/WebP where possible; never create canvas textures per frame; generated canvas textures need `dispose()`.
- **Lights:** baked/fake lighting plus 1 hemisphere + 1 directional; no real-time shadows below high; no post-processing on low/mid.
- **Dispose on exit:** `disposeThree(group)` for every scene leaving view, then `renderer.info.memory` should return to baseline (check `geometries`/`textures` do not grow when re-entering a scene).
- **Loop:** use `loop(el, step)` from quality.js (pauses offscreen/hidden), call `fpsGovernor.tick` (already inside `loop`), and listen to `quality:downgrade` to drop pixel ratio / shadows / particles live.
- **Characters:** one skinned mesh per character on low; update the mixer only when visible.
- **Mobile 390x844:** pixel ratio <= 1.5, no antialias, camera distance and FOV tuned for portrait, tap targets >= 44 px.
- **Reduced motion:** cut between camera positions (`motion.scrub`), no idle sway.
- **Software GL test:** the QA runner uses SwiftShader, so it checks correctness (renders, no errors, correct states), not speed. Speed is judged with `?stats` on a real GPU.

# Third pass: real-time 3D build (2026-10-07, 18:5x)
Tools in my workspace `qa/`: `w3d.mjs` (scene sweep + draw calls), `e2e.mjs` (typed to APP_ENTRY), `flow2.mjs` (mic stubs). Software WebGL (SwiftShader), so FPS is not meaningful (1-4 fps); **correctness, draw calls and triangles are**. `quality.js` change: a forced `?quality=` is no longer auto-downgraded by the FPS governor.

**Pass**
- No console errors, no failed requests (the `world3d/index.js` 404 is gone), no horizontal scroll, in desktop 1440x900 high/mid/low, mobile 390x844 mid/low, `?motion=reduce`.
- Typed to APP_ENTRY: doctor, engineer, "I don't know" all reach PERSONALIZED_PATH, show "Begin with Biology/Physics/Science", and Begin navigates to `/index.html?onboarded=1`. Profile = doctor / engineer / undecided (discovery). No errors.
- Mic denied (stubbed `not-allowed`): "That's okay. Type what you want to become." with the typed input focused; typed answer then completes the flow.
- Earlier bug 2 (Skip visible during the transition): fixed, Skip visible in 43/43 and 70/70 samples.
- Typed to path: 11-18 s under software GL (was 9-21 s); cannot judge real-GPU speed here.

**Budgets (max over 8 scroll points, triangles are tiny, draw calls are the problem)**
| Profile | Max draw calls | Budget | Max triangles | Budget |
|---|---|---|---|---|
| desktop high | 199 | 250 ok | 3.9k | 500k ok |
| desktop mid | 210 | 120 OVER | 8.7k | 200k ok |
| desktop low | 193 | 60 OVER (3x) | 7.9k | 80k ok |
| mobile mid | 182 | 120 OVER | 17k | 200k ok |
| mobile low | 183 | 60 OVER (3x) | 8.3k | 80k ok |
| reduced (mid) | 204 | 120 OVER | 16.9k | 200k ok |

**Bugs**
1. HIGH, perf (Jim, Phyllis): draw calls 180-210 on every tier regardless of `quality`, 3x the low-tier budget; the low tier renders the same scene as high. Fix: merge static meshes per zone (`BufferGeometryUtils.mergeGeometries`), `InstancedMesh` for slats, books, plants, ceiling lights, doors; hide zones not near the camera (`zone.visible=false`, then draw calls drop sharply); on low skip small props. Re-check with `?stats` + `budgetCheck`.
2. MED, contrast (Jim/Stanley): at RECEPTION on the 3D wood wall, "You can speak naturally." and "Type instead" (cream, small) are hard to read over tan slats; "Where do you want to go?" was not visible in the captured frame. Add a dark scrim behind the voice block (the old bug 1 is improved: title is readable, secondary text is not).
3. MED, contrast (Phyllis/Jim): on the path screen the top-left FSCHOOL wordmark and the "Skip" control are almost invisible (pale grey on cream, about 1.5:1). Use charcoal/navy at full opacity.
4. LOW (Jim): receptionist's head overlaps the F logo panel at the reception stop; nudge the camera or the logo up.
5. LOW (Stanley): mic and Send buttons remain in the tab order during the path screen (offsetParent still set); set `inert`/`hidden` on `#voice-mount` once state is CAREER_IDENTIFIED or later.
6. Not verified: real microphone speech, classifier endpoint timeout (`CLASSIFIER_ENDPOINT` still null), real-GPU frame time. The 'mic-nospeech' stub run crashed the headless browser (software GL memory), so the "We didn't catch that" path is checked by code review only.

# Fourth pass: after draw-call and contrast fixes (2026-10-07)
Scripts: `qa/w3d.mjs`, `w3d2.mjs`, `e2e.mjs`, `inert.mjs` (software GL, so draw calls and correctness count, FPS does not).

**Draw calls (max over 8 scroll points; was 180-210 everywhere)**
| Profile | Draw calls | Budget | Triangles | Status |
|---|---|---|---|---|
| desktop high | 97 | 250 | 21k | ok |
| desktop mid | 95 | 120 | 21k | ok |
| mobile mid (390x844) | 95 | 120 | 21k | ok |
| reduced motion (mid) | 96 | 120 | 21k | ok |
| desktop low | 62 | 60 | 12k | 2 over (RECEPTION stop at 0.85 only; 49 at the end) |
| mobile low | not re-run (headless browser dies after several contexts) | 60 | | check once |
HIGH bug closed except low tier is 2 draw calls over at one scroll point. All scenes: no console/network errors.

**Closed**: reception contrast (dark scrim, all text readable); voice buttons no longer in tab order after the answer (`#voice-mount` is hidden, tab goes Skip > Begin > chapters); path-screen cards and Begin readable; doctor/engineer/"I don't know" still reach APP_ENTRY (`/index.html?onboarded=1`) with zero errors.

**Still open (all LOW)**
1. Path screen: top-left FSCHOOL wordmark and top-right "Skip" text are almost invisible (cream on cream); Skip shows only as a faint box (Phyllis).
2. "RECEPTION" label overlaps the logo panel at the reception stop (Jim).
3. Typed-to-path 12-28 s under software GL (varies with machine load, 3D now heavier per frame than the earlier 1-3k triangle scene: WELCOME is 11.5k triangles); judge on a real GPU.
4. Flaky Playwright clicks on Begin when the machine is loaded (button never "stable"); passed on retry; not a user-facing bug.
5. Still unverified: real microphone speech, "we didn't catch that", classifier endpoint timeout, real-GPU FPS.

# Fifth pass: after Jim's merge/cull fix (2026-10-07)
Draw calls (max over 8 scroll points, software GL): desktop high 54 (budget 250), desktop low 52 (budget 60), mobile low 58 (budget 60); was 62 / 97. No console or network errors. All budgets met. Note (Jim): on low the reception zone is hidden until the camera passes z<-19, so the arch shows plain sky from mid-hallway; acceptable on low, but check on a real device that it does not pop visibly.
The "all 3D broken" alarm was retracted by god (sites readyplayer.me/mixamo, not our pages); I did no ?debug work.
