// Adaptive quality, reduced motion, lazy loading. Owner: Ryan (QA/perf/a11y).
// Dependency-free. Import what you need:
//   import { quality, reducedMotion, onVisible, lazy, motion } from './quality.js';

const mq = q => (typeof matchMedia === 'function' ? matchMedia(q) : { matches: false, addEventListener() {} });
const rmQuery = mq('(prefers-reduced-motion: reduce)');
const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();

/* ---------- reduced motion ---------- */
// ?motion=reduce forces it on (for testing).
export let reducedMotion = rmQuery.matches || params.get('motion') === 'reduce';
const rmListeners = new Set();
rmQuery.addEventListener?.('change', e => { reducedMotion = e.matches; rmListeners.forEach(fn => fn(reducedMotion)); });
export function onReducedMotionChange(fn) { rmListeners.add(fn); return () => rmListeners.delete(fn); }

/* ---------- device tier ---------- */
// low | mid | high. Override with ?quality=low|mid|high.
function detectTier() {
  const forced = params.get('quality');
  if (['low', 'mid', 'high'].includes(forced)) return forced;
  const nav = typeof navigator !== 'undefined' ? navigator : {};
  const mem = nav.deviceMemory || 4;          // GB, Chrome only
  const cores = nav.hardwareConcurrency || 4;
  const coarse = mq('(pointer: coarse)').matches;
  const small = typeof innerWidth === 'number' && Math.min(innerWidth, innerHeight) < 500;
  const saveData = nav.connection?.saveData || /(^|-)2g$/.test(nav.connection?.effectiveType || '');
  let gpuWeak = false;
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    if (!gl) return 'low';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const r = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
    gpuWeak = /swiftshader|llvmpipe|software|mali-4|adreno \(tm\) [23]\d\d|powervr sgx/i.test(r);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  } catch { /* ignore */ }
  if (gpuWeak || saveData || mem <= 2 || cores <= 2) return 'low';
  if (coarse || small || mem <= 4 || cores <= 4) return 'mid';
  return 'high';
}
export let tier = detectTier();

// Settings scenes should read instead of hard-coding.
const PRESETS = {
  low:  { pixelRatio: 1,   antialias: false, shadows: false, particles: 0,   textureMax: 1024, frameStep: 2, video: false },
  mid:  { pixelRatio: 1.5, antialias: false, shadows: false, particles: 0.4, textureMax: 2048, frameStep: 1, video: true },
  high: { pixelRatio: 2,   antialias: true,  shadows: true,  particles: 1,   textureMax: 4096, frameStep: 1, video: true },
};
export const quality = { ...PRESETS[tier], tier };
export const pixelRatio = () => Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, quality.pixelRatio);

/* ---------- FPS governor ---------- */
// Call fpsGovernor.tick(now) inside your RAF; if FPS stays under 40 for ~3 s,
// the tier steps down once and 'quality:downgrade' fires on window.
export const fpsGovernor = (() => {
  let last = 0, frames = 0, windowStart = 0, slowWindows = 0, fps = 60;
  return {
    get fps() { return fps; },
    tick(now = performance.now()) {
      if (!last) { last = windowStart = now; return; }
      frames++; last = now;
      if (now - windowStart >= 1000) {
        fps = frames * 1000 / (now - windowStart); frames = 0; windowStart = now;
        if (document.hidden) return;
        slowWindows = fps < 40 ? slowWindows + 1 : 0;
        if (slowWindows >= 3 && tier !== 'low' && !params.get('quality')) { // a forced ?quality= is never auto-downgraded (testing)
          tier = tier === 'high' ? 'mid' : 'low'; slowWindows = 0;
          Object.assign(quality, PRESETS[tier], { tier });
          dispatchEvent(new CustomEvent('quality:downgrade', { detail: { ...quality } }));
        }
      }
    },
  };
})();


/* ---------- 3D budgets (real-time three.js scenes) ---------- */
// Frame budget 16.6 ms (60 fps). Per-scene limits per tier; check with budgetCheck(renderer).
export const BUDGETS = {
  low:  { frameMs: 33.3, drawCalls: 60,  triangles: 80_000,  textureMB: 48,  lights: 2, shadows: false, maxBones: 70 },
  mid:  { frameMs: 20,   drawCalls: 120, triangles: 200_000, textureMB: 96,  lights: 4, shadows: false, maxBones: 100 },
  high: { frameMs: 16.6, drawCalls: 250, triangles: 500_000, textureMB: 192, lights: 6, shadows: true,  maxBones: 150 },
};
export const budget = () => BUDGETS[tier];

// Apply tier to a THREE.WebGLRenderer: renderer.setPixelRatio(pixelRatio()); renderer.shadowMap.enabled = quality.shadows.
// Create it with { antialias: quality.antialias, powerPreference: 'high-performance' }.
export function applyTier(renderer) {
  renderer.setPixelRatio(pixelRatio());
  if (renderer.shadowMap) renderer.shadowMap.enabled = !!quality.shadows;
  return renderer;
}

// Measure a scene's real cost. Call after a render: budgetCheck(renderer) -> { ok, over:[...], stats }.
// Texture memory is estimated as w*h*4*1.33 (mipmaps) per texture in renderer.info.
export function budgetCheck(renderer, scene) {
  const info = renderer.info, b = budget();
  let texBytes = 0;
  scene?.traverse?.(o => {
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    mats.forEach(m => Object.values(m).forEach(t => { const im = t?.isTexture && t.image; if (im?.width) texBytes += im.width * im.height * 4 * 1.33; }));
  });
  const stats = { drawCalls: info.render.calls, triangles: info.render.triangles, geometries: info.memory.geometries, textures: info.memory.textures, textureMB: Math.round(texBytes / 1048576), fps: Math.round(fpsGovernor.fps) };
  const over = ['drawCalls', 'triangles', 'textureMB'].filter(k => stats[k] > b[k]).map(k => `${k} ${stats[k]} > ${b[k]}`);
  if (stats.fps && 1000 / stats.fps > b.frameMs * 1.1) over.push(`frame ${(1000 / stats.fps).toFixed(1)}ms > ${b.frameMs}ms`);
  return { ok: !over.length, over, stats };
}
// Dev overlay: add ?stats to the URL to log budgetCheck every 2 s: watchBudget(renderer, scene).
export function watchBudget(renderer, scene) {
  if (!params.has('stats')) return () => {};
  const id = setInterval(() => { const r = budgetCheck(renderer, scene); (r.ok ? console.info : console.warn)('[budget]', r.stats, r.over.join('; ')); }, 2000);
  return () => clearInterval(id);
}

/* ---------- visibility / lazy helpers ---------- */
// onVisible(el, (visible, entry) => {...}, {rootMargin}) -> stop(). Use it to pause RAF loops offscreen.
export function onVisible(el, fn, opts = {}) {
  if (!el) return () => {};
  if (typeof IntersectionObserver === 'undefined') { fn(true); return () => {}; }
  const io = new IntersectionObserver(es => es.forEach(e => fn(e.isIntersecting, e)), { rootMargin: '0px', threshold: 0, ...opts });
  io.observe(el);
  return () => io.disconnect();
}

// lazy(el, loader, {rootMargin}) -> Promise. Runs loader() once when el comes near the viewport.
// Example: lazy(section, () => import('./scenes/hallway.js')).then(m => m.mount(section));
export function lazy(el, loader, { rootMargin = '600px 0px' } = {}) {
  return new Promise((resolve, reject) => {
    const stop = onVisible(el, v => { if (!v) return; stop(); Promise.resolve().then(loader).then(resolve, reject); }, { rootMargin });
  });
}

// Prefetch during idle time (next scene's module or assets).
export function idle(fn, timeout = 2000) {
  return typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, { timeout }) : setTimeout(fn, 200);
}

// RAF loop that pauses when the element is offscreen or the tab is hidden.
// loop(el, (t, dt) => {...}) -> { stop }
export function loop(el, step) {
  let raf = 0, visible = true, prev = 0, stopped = false;
  const run = t => { if (stopped) return; const dt = prev ? Math.min((t - prev) / 1000, 0.1) : 0; prev = t; fpsGovernor.tick(t); step(t, dt); raf = requestAnimationFrame(run); };
  const sync = () => { cancelAnimationFrame(raf); prev = 0; if (!stopped && visible && !document.hidden) raf = requestAnimationFrame(run); };
  const unobserve = onVisible(el, v => { visible = v; sync(); });
  document.addEventListener('visibilitychange', sync);
  sync();
  return { stop() { stopped = true; cancelAnimationFrame(raf); unobserve(); document.removeEventListener('visibilitychange', sync); } };
}

/* ---------- motion helpers (reduced-motion aware) ---------- */
// motion.enter(el, {from:'up'|'left'|'none', duration}) -> Promise. Full motion = slide + fade; reduced = fade only.
export const motion = {
  enter(el, { from = 'up', duration = 600, delay = 0 } = {}) {
    if (!el?.animate) { if (el) el.style.opacity = 1; return Promise.resolve(); }
    const off = { up: 'translateY(24px)', down: 'translateY(-24px)', left: 'translateX(-24px)', right: 'translateX(24px)', none: 'none' }[from];
    const kf = reducedMotion
      ? [{ opacity: 0 }, { opacity: 1 }]
      : [{ opacity: 0, transform: off }, { opacity: 1, transform: 'none' }];
    return el.animate(kf, { duration: reducedMotion ? Math.min(duration, 250) : duration, delay, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'both' }).finished.catch(() => {});
  },
  exit(el, { duration = 400 } = {}) {
    if (!el?.animate) return Promise.resolve();
    return el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: reducedMotion ? 200 : duration, fill: 'forwards' }).finished.catch(() => {});
  },
  // Scroll-driven value: in reduced motion, snap to 0 or 1 so cameras cut instead of glide.
  scrub(p) { return reducedMotion ? (p < 0.5 ? 0 : 1) : p; },
};

/* ---------- media helpers ---------- */
// Video that never autoplays with sound and only loads when near the viewport.
export function lazyVideo(video, src, { poster } = {}) {
  video.muted = true; video.playsInline = true; video.setAttribute('playsinline', ''); video.preload = 'none';
  if (poster) video.poster = poster;
  if (!quality.video || reducedMotion) return Promise.resolve(video); // show poster only
  return lazy(video, () => { video.src = src; video.preload = 'auto'; return video; });
}

// Dispose a three.js object tree (geometries, materials, textures).
export function disposeThree(root) {
  root?.traverse?.(o => {
    o.geometry?.dispose?.();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    mats.forEach(m => { Object.values(m).forEach(v => v?.isTexture && v.dispose()); m.dispose?.(); });
  });
}

// Promise with timeout + fallback. Use for every AI call: withTimeout(fetch(...), 8000, fallbackValue)
export function withTimeout(promise, ms, fallback) {
  let t;
  return Promise.race([
    Promise.resolve(promise).catch(() => fallback),
    new Promise(res => { t = setTimeout(() => res(fallback), ms); }),
  ]).finally(() => clearTimeout(t));
}

if (typeof document !== 'undefined') {
  document.documentElement.dataset.tier = tier;
  document.documentElement.toggleAttribute('data-reduced-motion', reducedMotion);
  onReducedMotionChange(v => document.documentElement.toggleAttribute('data-reduced-motion', v));
  addEventListener('quality:downgrade', () => { document.documentElement.dataset.tier = tier; });
}
if (typeof window !== 'undefined') window.__quality = { get tier() { return tier; }, quality, get reducedMotion() { return reducedMotion; }, fpsGovernor };
