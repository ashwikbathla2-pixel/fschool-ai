// Cinematic onboarding: one continuous scroll that moves a camera through the school. Owner: Jim.
// Entry: open cinematic/index.html. Scroll position -> (scene, q) -> camera pose on CatmullRom paths in a live three.js world (world3d/);
// GSAP ScrollTrigger gives the inertia.
// State machine lives in state.js; this file drives WELCOME..QUESTION and gates APP_ENTRY.
import { STATES, on, get, set, emit, profile } from './state.js';
import { reducedMotion, pixelRatio, fpsGovernor, quality } from './quality.js';
import { syncLanding } from './app/bridge.js';
import { fadeVeil, leave } from './SceneTransition.js';
import { mountProgress } from './ProgressIndicator.js';
import { createPlate } from './PlatePlayer.js';
import { mountReceptionist } from './scenes/Receptionist.js';
import Welcome from './scenes/Welcome.js';
import SchoolEntrance from './scenes/SchoolEntrance.js';
import SchoolHallway from './scenes/SchoolHallway.js';
import ReceptionScene from './scenes/ReceptionScene.js';

const SCENES = [Welcome, SchoolEntrance, SchoolHallway, ReceptionScene];
const PREFLOW = new Set([STATES.WELCOME, STATES.SCHOOL_ENTRANCE, STATES.SCHOOL_HALLWAY, STATES.RECEPTION, STATES.QUESTION]);

const $ = id => document.getElementById(id);
const root = document.body, stage = $('cine-stage'), canvas = $('cine-canvas'), scroller = $('cine-scroll');
const hero = $('cine-hero'), cue = $('cine-cue'), capLayer = $('cine-captions'), live = $('cine-live');
const veil = $('cine-veil'), skip = $('cine-skip'), loader = $('cine-loader');

const mobile = matchMedia('(max-width: 820px)').matches;
const WEIGHT = mobile ? 0.7 : 1;
const clamp = (v, a = 0, b = 1) => Math.min(Math.max(v, a), b);
const smooth = t => t * t * (3 - 2 * t);

/* ---------- timeline: each scene owns a slice of scroll (in vh) ---------- */
const sceneRanges = [];
let totalVh = 0;
SCENES.forEach(scene => { const w = scene.weight * WEIGHT; sceneRanges.push({ scene, startVh: totalVh, endVh: totalVh + w }); totalVh += w; });
const keyMap = (keys, q) => { for (let i = 1; i < keys.length; i++) if (q <= keys[i][0]) { const [q0, v0] = keys[i - 1], [q1, v1] = keys[i]; return v0 + (v1 - v0) * clamp((q - q0) / (q1 - q0 || 1)); } return 1; };

/* ---------- 3D world (three.js, loaded lazily so the first paint is just the logo) ---------- */
let world = null, plate = null, plateEndY = 1, plateState = { covering: false, needWorld: true }, needDraw = true, curY = 0, introDone = false, lastScene = '';
const veilFlash = () => { veil.style.transitionDuration = '260ms'; veil.style.opacity = '0.85'; setTimeout(() => { veil.style.transitionDuration = '420ms'; veil.style.opacity = '0'; }, 280); };
async function loadWorld() {
  try {
    const m = await import('./world3d/World.js');
    world = m.createWorld({ canvas, quality, reducedMotion });
    sizeCanvas(); return true;
  } catch (err) {
    console.warn('[cinematic] 3D unavailable, using still backdrop', err);
    document.body.classList.add('cine-nogl'); return false;
  }
}
function sizeCanvas() {
  const d = mobile ? Math.min(pixelRatio(), 1.5) : pixelRatio();
  world?.resize(innerWidth, innerHeight, d);
  plate?.resize(innerWidth, innerHeight, d);
}
const capEls = [];
sceneRanges.forEach(r => (r.scene.captions || []).forEach(c => {
  const el = document.createElement('p'); el.className = 'cine-cap ' + (c.pos || 'low'); el.textContent = c.text; el.setAttribute('aria-hidden', 'true');
  capLayer.appendChild(el); capEls.push({ el, c, r, last: -1 });
}));

function stateForY(y) {
  if (y / totalVh >= (ReceptionScene.questionAt || 0.985)) return STATES.QUESTION;
  const r = sceneRanges.find(r => y < r.endVh) || sceneRanges[sceneRanges.length - 1];
  return r.scene.state;
}
function applyProgress(p) {
  const y = p * totalVh; curY = y; needDraw = true;
  const r = sceneRanges.find(r => y < r.endVh) || sceneRanges[sceneRanges.length - 1];
  let q = clamp((y - r.startVh) / (r.endVh - r.startVh));
  if (reducedMotion) { q = r.scene.stop; if (lastScene && lastScene !== r.scene.id) veilFlash(); }
  lastScene = r.scene.id;
  world?.set(r.scene.id, keyMap(r.scene.keys, q));
  if (plate) plateState = plate.update(y / plateEndY);   // pre-rendered Unreal flythrough covers the live 3D until the doors

  // hero: wordmark rises and fades while the camera starts to move
  const h = clamp(y / (sceneRanges[0].endVh * 0.42));
  hero.style.opacity = String(1 - smooth(clamp((h - 0.15) / 0.85)));
  hero.style.transform = `translate3d(0,${-h * 8}vh,0) scale(${1 - h * 0.18})`;
  cue.style.opacity = String(introDone ? 0.8 * (1 - clamp(y / 14)) : 0);

  // captions: soft fade in/out inside their scene-local window
  for (const cap of capEls) {
    const q2 = (y - cap.r.startVh) / (cap.r.endVh - cap.r.startVh);
    const { from, to } = cap.c, span = to - from, e = 0.28;
    const o = q2 <= from || q2 >= to ? 0 : smooth(clamp(Math.min((q2 - from) / (span * e), (to - q2) / (span * e))));
    if (Math.abs(o - cap.last) > 0.004) {
      cap.last = o; cap.el.style.opacity = String(o);
      cap.el.style.transform = reducedMotion ? 'none' : `translate3d(0,${(1 - o) * 18}px,0)`;
      if (o > 0.9 && live.textContent !== cap.c.text) live.textContent = cap.c.text;
    }
  }
  skip.classList.toggle('hide', y / totalVh > 0.9 || !PREFLOW.has(get('state')));

  if (PREFLOW.has(get('state'))) {
    const next = stateForY(y);
    if (next !== get('state')) set('state', next);
  }
}

/* ---------- scroll driver ---------- */
let scrollMax = 1;
function sizeScroller() {
  scroller.style.height = Math.round((totalVh / 100 + 1) * innerHeight) + 'px';
  scrollMax = scroller.offsetHeight - innerHeight;
}
function yScroll(vh) { return clamp(vh / totalVh) * scrollMax; }
addEventListener('quality:downgrade', e => { world?.setQuality(e.detail); sizeCanvas(); });

function startDriver() {
  if (window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.config({ ignoreMobileResize: true });
    const o = { p: 0 };
    gsap.to(o, { p: 1, ease: 'none', onUpdate: () => applyProgress(o.p),
      scrollTrigger: { trigger: scroller, start: 'top top', end: 'bottom bottom', scrub: reducedMotion ? 0 : 0.6, invalidateOnRefresh: true } });
    addEventListener('resize', () => { sizeScroller(); ScrollTrigger.refresh(); });
  } else {
    // fallback without GSAP: ease toward the real scroll position ourselves
    let target = 0, cur = 0;
    const read = () => { target = clamp(scrollY / Math.max(1, scrollMax)); };
    addEventListener('scroll', read, { passive: true }); addEventListener('resize', () => { sizeScroller(); read(); });
    (function tick() { cur += (target - cur) * (reducedMotion ? 1 : 0.14); if (Math.abs(target - cur) > 1e-4 || needDraw) applyProgress(cur); requestAnimationFrame(tick); })();
  }
}

const clock = { last: 0 };
function renderLoop(now) {
  requestAnimationFrame(renderLoop);
  fpsGovernor.tick(now);
  if (!world || studyOn || (plate && plateState.covering && !plateState.needWorld)) return;
  const dt = Math.min((now - (clock.last || now)) / 1000, 0.05); clock.last = now;
  world.update(now / 1000, dt);
}

/* ---------- state reactions: scroll lock, mounts, handoff ---------- */
const voiceMount = $('voice-mount'), careerMount = $('career-mount');
function lockScroll(lock) { document.documentElement.style.overflow = lock ? 'hidden' : ''; document.body.style.overflow = lock ? 'hidden' : ''; }
let handedOff = false, studyOn = false;

on('change:state', ({ value }) => {
  const S = STATES;
  lockScroll(![S.WELCOME, S.SCHOOL_ENTRANCE, S.SCHOOL_HALLWAY, S.RECEPTION, S.QUESTION].includes(value));
  voiceMount.classList.toggle('live', value === S.QUESTION || value === S.LISTENING || value === S.PROCESSING);
  careerMount.classList.add('live');   // Phyllis's overlay manages its own visibility
  $('cine-progress').style.opacity = value === S.PERSONALIZED_PATH || value === S.APP_ENTRY ? '0' : '';
  const g = world?.girl;
  if (g) {
    g.setListening(value === S.LISTENING); g.setThinking(value === S.PROCESSING);
    if (value === S.QUESTION) { if (!world.__greeted) { world.__greeted = true; g.greet(); g.speak('Welcome to FSCHOOL. Where do you want to go?'); } }
    if (value === S.CAREER_IDENTIFIED) { g.nod(); g.speak('Got it.'); }
    if (value === S.PROCESSING) g.express('curious', 2.5);
  }
  if (value === S.APP_ENTRY && !window.__studyActive) enterApp();
});
on('speak', e => world?.girl.speak(typeof e === 'string' ? e : e?.text || ''));
on('mic-level', e => world?.girl.setMic(typeof e === 'number' ? e : e?.level ?? 0));
on('app-entry', () => { if (!window.__studyActive) enterApp(); });
// the study room (Phyllis's CareerTransition) takes over the screen: remember the profile, stop drawing the reception world
on('enter-study', () => { studyOn = true; });
on('profile', p => { try { syncLanding(p); } catch { /* app profile is best-effort */ } });
on('study-ready', () => {
  try { localStorage.setItem('fschool.profile', JSON.stringify(profile)); syncLanding(profile); sessionStorage.setItem('fschool.onboarded', '1'); } catch { /* storage blocked */ }
  if (get('state') !== STATES.APP_ENTRY) set('state', STATES.APP_ENTRY);
  document.body.classList.remove('cine-active');
});

// journey flow (?flow=journey) ends here: open the study room directly instead of redirecting anywhere
async function enterApp() {
  if (handedOff) return; handedOff = true;
  try { localStorage.setItem('fschool.profile', JSON.stringify(profile)); syncLanding(profile); sessionStorage.setItem('fschool.onboarded', '1'); } catch { /* storage blocked: still proceed */ }
  if (get('state') !== STATES.APP_ENTRY) set('state', STATES.APP_ENTRY);
  document.body.classList.remove('cine-active');
  emit('app-handoff', { profile });
  // Hand off to the Study World app (room first). ?legacy=1 keeps the old in-page study room.
  if (!new URLSearchParams(location.search).has('legacy')) { await fadeVeil(veil, 1, 400); location.assign(new URL('app/index.html', document.baseURI).href); return; }
  try {
    const sw = await import('./world3d/study/StudyWorld.js');
    studyOn = true; window.__studyActive = true;
    careerMount.classList.add('live');
    await sw.createStudyWorld(careerMount, { career: profile.career_goal && profile.career_goal !== 'unknown' ? profile.career_goal : 'default', intro: true });
    await fadeVeil(veil, 0, 400);
  } catch (err) { console.warn('[cinematic] study room unavailable', err); studyOn = false; await fadeVeil(veil, 0, 300); }
}

/* ---------- intro (time based, not scroll) ---------- */
function playIntro() {
  loader.classList.add('done');
  const word = hero.querySelector('.cine-wordmark'), tag = hero.querySelector('.cine-tagline');
  if (reducedMotion || !window.gsap) {
    word.style.transform = tag.style.transform = 'none'; introDone = true; applyProgress(0); return;
  }
  word.style.opacity = tag.style.opacity = '0';
  const tl = gsap.timeline({ delay: 0.35, onComplete: () => { introDone = true; applyProgress(curY / totalVh); } });
  tl.fromTo(word, { opacity: 0, filter: 'blur(14px)', y: '10vh' }, { opacity: 1, filter: 'blur(0px)', y: '8vh', duration: 1.6, ease: 'power2.out' })
    .to([word, tag], { y: 0, duration: 1.5, ease: 'power3.inOut' }, 1.1)
    .fromTo(tag, { opacity: 0 }, { opacity: 0.92, duration: 1.1, ease: 'power1.out' }, 1.5)
    .to(cue, { opacity: 0.8, duration: 0.8 }, 2.6);
}

/* ---------- boot ---------- */
function fallbackVoice() {
  // only if VoicePrompt failed to load: a plain typed answer so nobody is stuck
  if (voiceMount.childElementCount) return;
  voiceMount.innerHTML = '<form class="cine-fallback"><label class="cine-sr" for="cine-fb">What do you want to become?</label><input id="cine-fb" autocomplete="off" placeholder="Type what you want to become" /><button type="submit">Go</button></form>';
  voiceMount.querySelector('form').addEventListener('submit', e => {
    e.preventDefault(); const t = voiceMount.querySelector('input').value.trim(); if (!t) return;
    emit('answer', { text: t, source: 'typed' }); set('state', STATES.PROCESSING);
    import('./CareerClassifier.js').then(m => m.classify(t)).catch(() => null).then(r => {
      set('state', STATES.CAREER_IDENTIFIED);
      emit('career', r ? { career_goal: r.career_category, confidence: r.confidence, ...r, text: t, source: 'typed' } : { career_goal: 'unknown', confidence: 0, text: t, source: 'typed' });
    });
  });
}
async function loadModules() {
  try { const m = await import('./VoicePrompt.js'); m.mount?.(voiceMount); } catch (err) { console.warn('[cinematic] voice module unavailable', err); }
  setTimeout(fallbackVoice, 1500);
  try { const m = await import('./CareerTransition.js'); m.mount?.(careerMount); } catch (err) { console.warn('[cinematic] career module unavailable', err); }
}

async function boot() {
  history.scrollRestoration = 'manual';
  sizeScroller(); mountProgress($('cine-progress'), { onChapter: i => scrollTo({ top: yScroll(sceneRanges[Math.min(i, 3)].startVh), behavior: reducedMotion ? 'auto' : 'smooth' }) });
  mountReceptionist({ root: document, stage });
  addEventListener('resize', sizeCanvas);
  skip.addEventListener('click', () => scrollTo({ top: scrollMax, behavior: reducedMotion ? 'auto' : 'smooth' }));
  startDriver();
  requestAnimationFrame(renderLoop);
  loadModules();
  scrollTo(0, 0);
  const pr = sceneRanges.find(r => r.scene.id === 'entrance');
  plate = await createPlate({ stage, before: stage.querySelector('.cine-scrim'), quality }).catch(() => null);
  if (plate) {
    const r = sceneRanges.find(r => r.scene.id === plate.endScene) || pr;
    plateEndY = r.startVh + plate.endQ * (r.endVh - r.startVh);
    for (let i = 0; i < 40 && !plate.ready; i++) await new Promise(res => setTimeout(res, 50));
  }
  await Promise.race([loadWorld(), new Promise(r => setTimeout(r, 6000))]);
  if (plate) sizeCanvas();
  applyProgress(0);
  setTimeout(() => world?.upgradeReceptionist?.(), 2500);
  if (document.fonts?.ready) await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1200))]);
  playIntro();
}

document.addEventListener('visibilitychange', () => { needDraw = true; });
window.__cinematicDebug = { get y() { return curY; }, totalVh, set, get, get world() { return world; } };
boot();
