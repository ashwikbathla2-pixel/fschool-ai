// Tower level for the shell (PRD section 6): mount(host, ctx) -> { dispose, pause, resume }. A lightweight cutaway built on tower/towerData.js:
// one instanced mesh in three (a single draw call for every room), or a 2D canvas when WebGL is missing or ?tower=2d. Rendering is on demand,
// so pause() has nothing to stop but a pending frame. Pure helpers are exported and tested in shell.test.mjs; DOM only happens inside mount().
// Rooms are synthetic until the real backend exists (display names, dreams and streaks of other students are placeholders derived from the index).
import { makeTower, roomAt, roomCentre, CELL, WINDOW, SHIELD, LABELS } from '../tower/towerData.js';
import { climbScore } from '../studyworld/engine.js';

// ---- config (proposals, not PRD decisions) -----------------------------------------------------------------------------------
export const CONFIG = {
  rooms: 10000, cols: 25, seed: 7,
  climbForTopFloor: 100,       // proposal: PRD says floor = rank by climb score but floors are assigned [daily / hourly] by Sachcit; this maps score to a floor until then
  maxZoomPx: 70,               // largest px per world unit
  tapSlopPx: 6,
  // Safety proposal (PRD section 6): no real names or schools, view-only visits, under-18 rooms hidden from strangers. Only the data flag exists here:
  // a room with hidden: true shows a private card. Nothing in the synthetic tower sets it yet.
  hiddenRooms: new Set(),
};

// ---- pure helpers ------------------------------------------------------------------------------------------------------------
const DAY = 864e5;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const hash = n => { let x = (n + 1) * 2654435761 >>> 0; x ^= x >>> 15; x = Math.imul(x, 2246822519) >>> 0; x ^= x >>> 13; return x >>> 0; };

// Consecutive study days ending today (or yesterday: today is not over yet). Days are UTC buckets; verified events only.
export function streakDays(events, studentId = 'me', now = Date.now()) {
  const days = new Set((events || []).filter(e => e.verified && e.studentId === studentId && e.ts <= now).map(e => Math.floor(e.ts / DAY)));
  let d = Math.floor(now / DAY); if (!days.has(d)) d--;
  let n = 0; while (days.has(d)) { n++; d--; }
  return n;
}

// Your room: floor from your climb score, middle column. Returns the room index.
export function myPlacement(tower, climb, cfg = CONFIG) {
  const row = Math.round((tower.rows - 1) * clamp(climb / cfg.climbForTopFloor, 0, 1));
  return Math.min(tower.rooms - 1, row * tower.cols + Math.floor(tower.cols / 2));
}

const ADJ = ['Calm', 'Bright', 'Steady', 'Quiet', 'Swift', 'Keen', 'Gentle', 'Bold'];
const ANIMAL = ['Otter', 'Heron', 'Fox', 'Lynx', 'Finch', 'Seal', 'Crane', 'Newt'];
const DREAMS = [['Commercial pilot', 'Astronaut', 'Aerospace engineer'], ['Software engineer', 'Game developer', 'Roboticist'], ['Doctor', 'Nurse', 'Marine biologist'], ['Architect', 'Designer', 'Writer']];
const COURSES = ['Physics', 'Calculus', 'Chemistry', 'Biology', 'History', 'Statistics', 'English', 'Economics'];

// Everything a room card shows. View-only: no real name, no school (PRD safety proposal). `me` is the index of the viewer's own room.
export function roomInfo(tower, i, { me = -1, mine = null, hidden = CONFIG.hiddenRooms } = {}) {
  if (i < 0 || i >= tower.rooms) return null;
  const floor = Math.floor(i / tower.cols) + 1, isMe = i === me;
  const base = { index: i, floor, floors: tower.rows, isMe, state: tower.state[i], stateLabel: LABELS.state[tower.state[i]], shield: LABELS.shield[tower.shield[i]] };
  if (isMe && mine) return { ...base, hidden: false, name: mine.name || 'You', dream: mine.dream || 'Your dream', streak: mine.streak, studying: mine.studying };
  if (hidden.has(i)) return { ...base, hidden: true };
  const h = hash(i), theme = Math.floor(tower.tile[i] / 4) % 4;
  const st = tower.state[i];
  return { ...base, hidden: false,
    name: `${ADJ[h % 8]} ${ANIMAL[(h >>> 3) % 8]} ${100 + (h >>> 6) % 900}`,
    dream: DREAMS[theme][(h >>> 9) % 3],
    streak: st === WINDOW.DIM ? 0 : st === WINDOW.GLOW ? 3 + (h >>> 12) % 28 : 1 + (h >>> 12) % 10,
    studying: st === WINDOW.DIM ? 'Not studying right now' : COURSES[(h >>> 15) % 8] };
}

// View = what part of the tower is on screen: centre (cx, cy) in tower space and s pixels per unit.
export const fitScale = (t, w, h) => Math.min(w / t.width, h / t.height) * 0.94;
export function clampView(v, t, w, h, cfg = CONFIG) {
  const min = fitScale(t, w, h) * 0.85, s = clamp(v.s, min, cfg.maxZoomPx);
  const hw = w / 2 / s, hh = h / 2 / s;
  const cx = t.width <= 2 * hw ? 0 : clamp(v.cx, -t.width / 2 + hw, t.width / 2 - hw);
  const cy = t.height <= 2 * hh ? t.height / 2 : clamp(v.cy, hh, t.height - hh);
  return { cx, cy, s };
}
export const toWorld = (v, w, h, px, py) => ({ x: v.cx + (px - w / 2) / v.s, y: v.cy - (py - h / 2) / v.s });
export const toScreen = (v, w, h, x, y) => ({ x: w / 2 + (x - v.cx) * v.s, y: h / 2 - (y - v.cy) * v.s });
export const zoomAt = (v, factor, px, py, w, h) => { const a = toWorld(v, w, h, px, py), s = v.s * factor; return { s, cx: a.x - (px - w / 2) / s, cy: a.y + (py - h / 2) / s }; };

const COLORS = { [WINDOW.LIT]: [0xf5, 0xc4, 0x4f], [WINDOW.GLOW]: [0xf2, 0xdc, 0xb0], [WINDOW.DIM]: [0xdd, 0xe2, 0xea] };
const rgb = st => COLORS[st];

// ---- mount -------------------------------------------------------------------------------------------------------------------
export async function mount(host, ctx = {}) {
  const tower = makeTower({ rooms: CONFIG.rooms, cols: CONFIG.cols, seed: CONFIG.seed });
  const events = ctx.events || [];
  const climb = climbScore(events, 'me');
  const me = myPlacement(tower, climb);
  const streak = streakDays(events);
  tower.state[me] = streak >= 3 ? WINDOW.GLOW : WINDOW.DIM;
  tower.shield[me] = SHIELD.NONE;   // the guarantee stays off until a grade source is verified (PRD section 9)
  const profile = ctx.profile;
  const mine = { name: 'You', dream: profile?.dream?.text || 'Your dream', streak, studying: profile?.worriedCourse || profile?.courses?.[0] || 'Your plan' };
  const reduce = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches || new URLSearchParams(location.search).get('motion') === 'reduce'; } catch { return false; } })();

  host.innerHTML = `
    <div class="tw" style="position:relative;width:100%;height:100vh;background:linear-gradient(#fbfbfd,#eceef2);overflow:hidden;color:#1d1d1f;font:inherit">
      <canvas role="img" tabindex="0" aria-label="Cutaway of a tower with ten thousand study rooms. Lit windows are studying now. Drag to move, scroll or pinch to zoom, tap a room for its card. Press F to find your room." style="position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;outline-offset:-3px"></canvas>
      <div class="tw-mark" hidden style="position:absolute;width:44px;height:44px;margin:-22px 0 0 -22px;border:2px solid #1d1d1f;border-radius:12px;pointer-events:none;box-shadow:0 0 0 4px #ffffffaa"></div>
      <div class="tw-card" hidden role="dialog" aria-label="Room card" style="position:absolute;left:16px;right:16px;bottom:max(76px,calc(env(safe-area-inset-bottom) + 76px));max-width:320px;padding:14px 16px;border-radius:16px;background:#fffffff2;border:1px solid #0000001a;box-shadow:0 8px 28px #0000001a;display:flex;flex-direction:column;gap:4px"></div>
      <div class="tw-bar" style="position:absolute;left:16px;right:16px;bottom:max(16px,env(safe-area-inset-bottom));display:flex;gap:8px;flex-wrap:wrap"></div>
      <p class="tw-hud" style="position:absolute;left:16px;top:68px;margin:0;font-size:12px;color:#6e6e73">Your floor is your rank. Floor 1 is the bottom.</p>
    </div>`;
  const root = host.firstElementChild, canvas = root.querySelector('canvas'), mark = root.querySelector('.tw-mark'), card = root.querySelector('.tw-card'), bar = root.querySelector('.tw-bar');
  const btn = (label, fn, primary) => {
    const b = Object.assign(document.createElement('button'), { type: 'button', textContent: label });
    b.style.cssText = `min-height:44px;min-width:44px;padding:0 16px;border:1px solid ${primary ? '#1d1d1f' : '#0000001a'};border-radius:22px;background:${primary ? '#1d1d1f' : '#fffffff2'};color:${primary ? '#fff' : '#1d1d1f'};font:inherit;font-weight:600;cursor:pointer`;
    b.addEventListener('click', fn); return b;
  };

  // renderer: three instanced mesh if WebGL works, else 2D canvas
  let W = 1, H = 1, view = { cx: 0, cy: tower.height / 2, s: 1 }, paused = false, raf = 0, disposed = false, selected = -1, mode = '2d';
  let gl = null, ctx2d = null;
  const want2d = new URLSearchParams(location.search).get('tower') === '2d';
  if (!want2d) {
    try {
      const THREE = await import('three');
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'low-power' });
      const geo = new THREE.PlaneGeometry(CELL.w - CELL.gap, CELL.h - CELL.gap), mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const mesh = new THREE.InstancedMesh(geo, mat, tower.rooms);
      const m = new THREE.Matrix4(), c = new THREE.Color();
      for (let i = 0; i < tower.rooms; i++) {
        const p = roomCentre(tower, i); m.makeTranslation(p.x, p.y, 0); mesh.setMatrixAt(i, m);
        const [r, g, b] = rgb(tower.state[i]); mesh.setColorAt(i, c.setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace));
      }
      mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true;
      const scene = new THREE.Scene(); scene.add(mesh);
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);
      gl = { THREE, renderer, geo, mat, mesh, scene, camera }; mode = 'webgl';
    } catch (e) { console.warn('[tower] WebGL unavailable, using the 2D canvas', e); gl = null; }
  }
  if (!gl) ctx2d = canvas.getContext('2d');
  root.dataset.renderer = mode;

  function draw() {
    raf = 0; if (paused || disposed) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    if (gl) {
      const { renderer, camera, scene } = gl;
      camera.left = -W / 2 / view.s; camera.right = W / 2 / view.s; camera.top = H / 2 / view.s; camera.bottom = -H / 2 / view.s;
      camera.position.set(view.cx, view.cy, 5); camera.updateProjectionMatrix(); renderer.render(scene, camera);
    } else {
      const g = ctx2d; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
      const a = toWorld(view, W, H, 0, H), b = toWorld(view, W, H, W, 0);   // visible world rectangle
      const r0 = Math.max(0, Math.floor(a.y / CELL.h)), r1 = Math.min(tower.rows - 1, Math.floor(b.y / CELL.h));
      const c0 = Math.max(0, Math.floor((a.x + tower.width / 2) / CELL.w)), c1 = Math.min(tower.cols - 1, Math.floor((b.x + tower.width / 2) / CELL.w));
      const w = (CELL.w - CELL.gap) * view.s, h = (CELL.h - CELL.gap) * view.s;
      for (let r = r0; r <= r1; r++) for (let col = c0; col <= c1; col++) {
        const i = r * tower.cols + col; if (i >= tower.rooms) continue;
        const p = roomCentre(tower, i), s = toScreen(view, W, H, p.x, p.y), [R, G, B] = rgb(tower.state[i]);
        g.fillStyle = `rgb(${R},${G},${B})`; g.fillRect(s.x - w / 2, s.y - h / 2, w, h);
      }
    }
    placeMark();
  }
  const schedule = () => { if (!raf && !paused && !disposed) raf = requestAnimationFrame(draw); };
  function resize() {
    const r = root.getBoundingClientRect(); W = Math.max(1, r.width); H = Math.max(1, r.height);
    const dpr = Math.min(devicePixelRatio || 1, 2);
    if (gl) gl.renderer.setPixelRatio(dpr), gl.renderer.setSize(W, H, false); else { canvas.width = W * dpr; canvas.height = H * dpr; }
    view = clampView(view, tower, W, H); schedule();
  }
  const setView = v => { view = clampView(v, tower, W, H); schedule(); };
  function placeMark() {
    if (selected < 0) { mark.hidden = true; return; }
    const p = roomCentre(tower, selected), s = toScreen(view, W, H, p.x, p.y);
    const side = Math.max(44, (CELL.w - CELL.gap) * view.s);
    mark.style.cssText += `;width:${side}px;height:${side * 0.8}px;margin:${-side * 0.4}px 0 0 ${-side / 2}px;left:${s.x}px;top:${s.y}px`; mark.hidden = false;
  }

  // animated camera move (instant when reduced motion is on)
  let anim = 0;
  function flyTo(target) {
    cancelAnimationFrame(anim);
    target = clampView(target, tower, W, H);
    if (reduce || paused) { setView(target); return; }
    const from = view, t0 = performance.now(), D = 600;
    const step = now => {
      const k = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - k, 3);
      view = { cx: from.cx + (target.cx - from.cx) * e, cy: from.cy + (target.cy - from.cy) * e, s: from.s * Math.pow(target.s / from.s, e) };
      schedule(); if (k < 1 && !disposed) anim = requestAnimationFrame(step);
    };
    anim = requestAnimationFrame(step);
  }

  // card
  function select(i) {
    selected = i;
    if (i < 0) { card.hidden = true; schedule(); return; }
    const info = roomInfo(tower, i, { me, mine });
    card.innerHTML = '';
    const line = (txt, css = '') => { const p = document.createElement('p'); p.textContent = txt; p.style.cssText = `margin:0;${css}`; card.appendChild(p); };
    if (info.hidden) { line('Private room', 'font-weight:650'); line(`Floor ${info.floor}`, 'color:#6e6e73'); line('This student keeps their room private.', 'color:#6e6e73'); }
    else {
      line(info.isMe ? 'Your room' : info.name, 'font-weight:650;font-size:16px');
      line(`Dream: ${info.dream}`); line(`Floor ${info.floor} of ${info.floors}`); line(`Streak: ${info.streak} ${info.streak === 1 ? 'day' : 'days'}`);
      line(`Studying: ${info.studying}`); line(info.stateLabel, 'color:#6e6e73');
      if (info.shield) line(info.shield, 'color:#6e6e73');
    }
    const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-top:8px';
    if (!info.hidden) row.appendChild(btn(info.isMe ? 'Enter my room' : 'Visit room (view only)', () => ctx.nav?.go('room', info.isMe ? {} : { extra: { visit: { index: i, viewOnly: true } } }), true));
    row.appendChild(btn('Close', () => select(-1)));
    card.appendChild(row); card.hidden = false;
    card.setAttribute('aria-label', info.hidden ? 'Private room card' : `Room card, ${info.isMe ? 'your room' : info.name}`);
    schedule();
  }
  const findMe = () => { const p = roomCentre(tower, me); select(me); flyTo({ cx: p.x, cy: p.y, s: Math.min(CONFIG.maxZoomPx, fitScale(tower, W, H) * 9) }); };
  const whole = () => flyTo({ cx: 0, cy: tower.height / 2, s: fitScale(tower, W, H) });
  bar.append(btn('Find me', findMe, true), btn('Whole tower', whole), btn('Top floors', () => flyTo({ cx: 0, cy: tower.height - (H / 2) / (fitScale(tower, W, H) * 4), s: fitScale(tower, W, H) * 4 })));

  // pointer: drag to pan, two fingers to pinch, wheel to zoom, tap to select
  const ptrs = new Map(); let down = null, pinch = 0;
  const local = e => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const on = (t, ev, fn, o) => { t.addEventListener(ev, fn, o); offs.push(() => t.removeEventListener(ev, fn, o)); }; const offs = [];
  on(canvas, 'pointerdown', e => { canvas.setPointerCapture?.(e.pointerId); ptrs.set(e.pointerId, local(e)); cancelAnimationFrame(anim); down = { ...local(e), moved: false, view }; if (ptrs.size === 2) pinch = 0; });
  on(canvas, 'pointermove', e => {
    if (!ptrs.has(e.pointerId)) return;
    const p = local(e); const prev = ptrs.get(e.pointerId); ptrs.set(e.pointerId, p);
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      if (pinch) setView(zoomAt(view, d / pinch, mx, my, W, H)); pinch = d; if (down) down.moved = true; return;
    }
    if (!down) return;
    if (Math.hypot(p.x - down.x, p.y - down.y) > CONFIG.tapSlopPx) down.moved = true;
    if (down.moved) setView({ ...view, cx: view.cx - (p.x - prev.x) / view.s, cy: view.cy + (p.y - prev.y) / view.s });
  });
  const up = e => {
    const was = down; ptrs.delete(e.pointerId); pinch = 0;
    if (ptrs.size === 0 && was && !was.moved && e.type === 'pointerup') { const w = toWorld(view, W, H, was.x, was.y); select(roomAt(tower, w.x, w.y)); }
    if (ptrs.size === 0) down = null;
  };
  on(canvas, 'pointerup', up); on(canvas, 'pointercancel', up);
  on(canvas, 'wheel', e => { e.preventDefault(); const p = local(e); setView(zoomAt(view, Math.exp(-e.deltaY * 0.0015), p.x, p.y, W, H)); }, { passive: false });
  on(canvas, 'keydown', e => {
    const k = e.key, step = 80 / view.s;
    if (k === 'f' || k === 'F') findMe();
    else if (k === 'ArrowLeft') setView({ ...view, cx: view.cx - step }); else if (k === 'ArrowRight') setView({ ...view, cx: view.cx + step });
    else if (k === 'ArrowUp') setView({ ...view, cy: view.cy + step }); else if (k === 'ArrowDown') setView({ ...view, cy: view.cy - step });
    else if (k === '+' || k === '=') setView(zoomAt(view, 1.3, W / 2, H / 2, W, H)); else if (k === '-') setView(zoomAt(view, 1 / 1.3, W / 2, H / 2, W, H));
    else return; e.preventDefault();
  });
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null; ro?.observe(root);
  if (!ro) on(window, 'resize', resize);

  resize(); view = { cx: 0, cy: tower.height / 2, s: fitScale(tower, W, H) }; view = clampView(view, tower, W, H); schedule();
  // PRD: open on your own place in the tower
  const p0 = roomCentre(tower, me); setTimeout(() => { if (!disposed) flyTo({ cx: p0.x, cy: p0.y, s: Math.min(CONFIG.maxZoomPx, fitScale(tower, W, H) * 3) }); }, reduce ? 0 : 250);

  return {
    renderer: mode,
    pause() { paused = true; cancelAnimationFrame(raf); raf = 0; cancelAnimationFrame(anim); },
    resume() { paused = false; resize(); schedule(); },
    dispose() {
      disposed = true; cancelAnimationFrame(raf); cancelAnimationFrame(anim); ro?.disconnect(); offs.forEach(f => f());
      if (gl) { gl.mesh.dispose(); gl.geo.dispose(); gl.mat.dispose(); gl.renderer.dispose(); gl.renderer.forceContextLoss?.(); }
      host.innerHTML = '';
    },
  };
}
