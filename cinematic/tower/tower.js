// Tower render spike (PRD section 10: "Show 10,000 rooms in a cutaway on a mid-range iPhone, smoothly, using instanced blocks and room snapshots").
// Three draw calls carry the whole tower: one back wall, one instanced slab per floor, one instanced pane per room.
// Each pane samples a pre-rendered room snapshot from a single atlas (PRD: "pre-rendered room snapshots on instanced blocks"),
// so a room costs 64 bytes of matrix plus 3 floats, and nothing is created per room on the CPU after startup.
//
// Query flags: ?rooms=10000  ?cols=25  ?towers=1..8 (campus skyline)  ?mycampus=1..8  ?dpr=1  ?always=1 (render every frame)  ?bench=1 (run the benchmark on load)  ?focus=me (open on your room)
import * as THREE from 'three';
import { makeSkyline, skylineLocate, skylineCentre, skylineAt, skylineName, searchNames, roomFacts, CELL, WINDOW, LABELS, THEME_COUNT, ACCENT_COUNT } from './towerData.js';

const q = new URLSearchParams(location.search);
const ROOMS = Math.max(1, Math.min(200000, +q.get('rooms') || 10000));
const COLS = Math.max(1, +q.get('cols') || 25);
const FOV = 35, TAN = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = id => document.getElementById(id);

const TOWERS = Math.max(1, Math.min(8, Math.round(+q.get('towers') || 1)));
const sky = makeSkyline({ towers: TOWERS, rooms: ROOMS, cols: COLS, seed: 7 });
const home = sky.towers[Math.min(sky.towers.length - 1, Math.max(0, (+q.get('mycampus') || 1) - 1))], tower = home.t;   // your campus
const FLOORQ = +q.get('floor') || 0;                                         // ?floor=N (1-based) comes from the room you just left
const ME_LOCAL = Math.min(tower.rooms - 1, (FLOORQ ? Math.min(tower.rows, FLOORQ) - 1 : Math.floor(tower.rows * 0.3)) * tower.cols + Math.floor(tower.cols / 2));
const ME = home.base + ME_LOCAL;                                               // global room id

const MYTHEME = ['pilot', 'coder', 'doctor', 'studio'].indexOf(q.get('theme'));
if (MYTHEME >= 0) tower.tile[ME_LOCAL] = MYTHEME * ACCENT_COUNT + (tower.tile[ME_LOCAL] % ACCENT_COUNT);   // your room keeps the theme you just left

// ------------------------------------------------------------------ renderer and camera
const canvas = $('tower-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
const dprCap = +q.get('dpr') || Math.min(devicePixelRatio || 1, 2);
renderer.setPixelRatio(dprCap);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(FOV, 1, 1, 6000);
const cam = { x: 0, y: sky.height / 2, dist: 1 };                          // what the camera looks at, and how far back it is
const FIT = () => Math.max((sky.height * 0.54) / TAN, (sky.width * 0.56) / (TAN * camera.aspect));   // the whole skyline in view
const MIN_DIST = 5;
let dirty = true;

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); dirty = true;
}
addEventListener('resize', resize);

function applyCamera() {
  cam.dist = THREE.MathUtils.clamp(cam.dist, MIN_DIST, FIT() * 1.15);
  const half = sky.width / 2 + 30;
  cam.x = THREE.MathUtils.clamp(cam.x, -half, half); cam.y = THREE.MathUtils.clamp(cam.y, -20, sky.height + 20);
  camera.position.set(cam.x, cam.y, cam.dist); camera.lookAt(cam.x, cam.y, 0); camera.updateMatrixWorld();
  dirty = true;
}
const unitsPerPx = () => (2 * cam.dist * TAN) / innerHeight;
const screenToWorld = (px, py) => ({ x: cam.x + (px - innerWidth / 2) * unitsPerPx(), y: cam.y - (py - innerHeight / 2) * unitsPerPx() });

// ------------------------------------------------------------------ room snapshots: one atlas, THEME_COUNT rows by ACCENT_COUNT columns
const SNAP = { w: 128, h: 104 };
const PAL = [   // per theme: wall, floor, prop accents (one per variant). sRGB.
  { wall: '#dfe7f2', floor: '#b9c3d3', acc: ['#4f8df7', '#2f6fd6', '#7aa8f5', '#264f9a'] },   // pilot
  { wall: '#e6e3f4', floor: '#c4bfdc', acc: ['#7a6cf0', '#5a4bd0', '#9d90f7', '#3f3490'] },   // coder
  { wall: '#dff1ee', floor: '#b4d3ce', acc: ['#2fb7a4', '#1f9684', '#6ed3c3', '#177064'] },   // doctor
  { wall: '#f3ead8', floor: '#d6c6a4', acc: ['#e0a24a', '#c4852b', '#efbf78', '#94601a'] },   // studio
];
function drawSnapshot(g, ox, oy, theme, v) {
  const p = PAL[theme], a = p.acc[v], { w, h } = SNAP;
  g.fillStyle = p.wall; g.fillRect(ox, oy, w, h);
  g.fillStyle = p.floor; g.fillRect(ox, oy + h * 0.72, w, h * 0.28);
  g.fillStyle = '#cfe3f7'; g.fillRect(ox + w * (0.58 + v * 0.02), oy + h * 0.14, w * 0.3, h * 0.34);          // window view
  g.fillStyle = '#fff8'; g.fillRect(ox + w * 0.58, oy + h * 0.14, w * 0.3, h * 0.05);
  g.fillStyle = '#6b4a2e'; g.fillRect(ox + w * 0.12, oy + h * 0.6, w * 0.4, h * 0.07); g.fillRect(ox + w * 0.14, oy + h * 0.67, w * 0.04, h * 0.2); g.fillRect(ox + w * 0.46, oy + h * 0.67, w * 0.04, h * 0.2);   // desk
  g.fillStyle = a;
  if (theme === 0) { g.fillRect(ox + w * 0.16, oy + h * 0.42, w * 0.32, h * 0.16); g.fillStyle = '#1d2733'; g.fillRect(ox + w * 0.19, oy + h * 0.45, w * 0.26, h * 0.1); }   // cockpit panel
  else if (theme === 1) { g.fillRect(ox + w * 0.14, oy + h * 0.38, w * 0.16, h * 0.2); g.fillRect(ox + w * 0.33, oy + h * 0.38, w * 0.16, h * 0.2); }                       // two monitors
  else if (theme === 2) { g.fillRect(ox + w * 0.2, oy + h * 0.36, w * 0.06, h * 0.22); g.fillRect(ox + w * 0.13, oy + h * 0.44, w * 0.2, h * 0.07); }                       // cross
  else { g.fillRect(ox + w * 0.3, oy + h * 0.38, w * 0.2, h * 0.2); g.beginPath(); g.arc(ox + w * 0.2, oy + h * 0.46, h * 0.07, 0, 7); g.fill(); }                          // lamp + board
  g.fillStyle = a; g.fillRect(ox + w * 0.06, oy + h * 0.5, w * 0.03, h * 0.4);                                                                                                  // plant stem
  g.fillStyle = '#0001'; g.fillRect(ox, oy, w, h * 0.05);
}
function makeAtlas() {
  const c = document.createElement('canvas'); c.width = SNAP.w * ACCENT_COUNT; c.height = SNAP.h * THEME_COUNT;
  const g = c.getContext('2d');
  for (let t = 0; t < THEME_COUNT; t++) for (let v = 0; v < ACCENT_COUNT; v++) drawSnapshot(g, v * SNAP.w, t * SNAP.h, t, v);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace; tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.anisotropy = 2;   // raw sRGB values: the shader writes them straight out
  return tex;
}

// ------------------------------------------------------------------ the skyline: back walls, slabs, room panes (all towers share one slab mesh and one pane mesh)
const { width, height } = sky;
const wallMat = new THREE.MeshBasicMaterial({ color: 0xcfc9bf });
function labelSprite(text) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128; const g = c.getContext('2d');
  g.font = '600 64px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#1c1b19'; g.fillText(text, 256, 68);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false })); sp.scale.set(72, 18, 1); sp.renderOrder = 6; return sp;
}
for (const c of sky.towers) {
  const w = new THREE.Mesh(new THREE.PlaneGeometry(c.t.width + 2.4, c.t.height + 0.4), wallMat); w.position.set(c.cx, c.t.height / 2, -0.4); scene.add(w);
  if (sky.towers.length > 1) { const sp = labelSprite(c.name); sp.position.set(c.cx, c.t.height + 16, 1); scene.add(sp); }
}
const slabs = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.34, 1.2), new THREE.MeshBasicMaterial({ color: 0xf1ede6 }), sky.towers.reduce((n, c) => n + c.t.rows + 1, 0));
{ const m = new THREE.Matrix4(), pos = new THREE.Vector3(), sc = new THREE.Vector3(), id = new THREE.Quaternion(); let n = 0;
  for (const c of sky.towers) for (let r = 0; r <= c.t.rows; r++) { m.compose(pos.set(c.cx, r * CELL.h, 0.1), id, sc.set(c.t.width + 2.4, 1, 1)); slabs.setMatrixAt(n++, m); }
  slabs.instanceMatrix.needsUpdate = true; slabs.frustumCulled = false; scene.add(slabs); }

const paneGeo = new THREE.PlaneGeometry(CELL.w - CELL.gap, CELL.h - CELL.gap);
{
  const tile = new Float32Array(sky.total), info = new Float32Array(sky.total * 2);
  for (const c of sky.towers) for (let i = 0; i < c.t.rooms; i++) { const g = c.base + i; tile[g] = c.t.tile[i]; info[g * 2] = c.t.state[i]; info[g * 2 + 1] = c.t.shield[i]; }
  paneGeo.setAttribute('aTile', new THREE.InstancedBufferAttribute(tile, 1)); paneGeo.setAttribute('aInfo', new THREE.InstancedBufferAttribute(info, 2));
}
const paneMat = new THREE.ShaderMaterial({
  uniforms: { uAtlas: { value: makeAtlas() }, uCols: { value: ACCENT_COUNT }, uRows: { value: THEME_COUNT } },
  vertexShader: `
    attribute float aTile; attribute vec2 aInfo;
    varying vec2 vUv; varying float vTile; varying vec2 vInfo;
    void main() { vUv = uv; vTile = aTile; vInfo = aInfo; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D uAtlas; uniform float uCols; uniform float uRows;
    varying vec2 vUv; varying float vTile; varying vec2 vInfo;
    void main() {
      float theme = floor(vTile / uCols), acc = vTile - theme * uCols;
      vec2 uv = (vec2(acc, uRows - 1.0 - theme) + clamp(vUv, 0.01, 0.99)) / vec2(uCols, uRows);
      vec3 snap = texture2D(uAtlas, uv).rgb;
      float s = vInfo.x, sh = vInfo.y;
      vec3 c = s < 0.5 ? snap * vec3(1.06, 1.02, 0.9) + vec3(0.06, 0.04, 0.0)         // light on: studying right now
             : s < 1.5 ? snap * vec3(1.0, 0.8, 0.58) * 0.9                            // warm glow: on a streak
             : mix(vec3(0.5, 0.52, 0.56), snap * 0.4, 0.3);                           // dim: not active lately
      if (sh > 0.5) {                                                                  // shield on the door
        vec2 d = vUv - vec2(0.9, 0.16);
        if (dot(d, d) < 0.006) c = sh < 1.5 ? vec3(0.18, 0.68, 0.42) : sh < 2.5 ? vec3(0.96, 0.55, 0.14) : vec3(0.36, 0.34, 0.86);
      }
      gl_FragColor = vec4(c, 1.0);
    }`,
});
const panes = new THREE.InstancedMesh(paneGeo, paneMat, sky.total);
{ const m = new THREE.Matrix4(); for (let g = 0; g < sky.total; g++) { const c = skylineCentre(sky, g); m.setPosition(c.x, c.y, 0); panes.setMatrixAt(g, m); } panes.instanceMatrix.needsUpdate = true; panes.frustumCulled = false; scene.add(panes); }

const ground = new THREE.Mesh(new THREE.PlaneGeometry(sky.width + 900, 60), new THREE.MeshBasicMaterial({ color: 0xe4dfd5 }));
ground.position.set(0, -30.2, 0); scene.add(ground);

// markers: a frame around the selected room, and one around yours
function marker(color) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(CELL.w + 0.6, CELL.h + 0.6), new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) } }, transparent: true, depthTest: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 uColor; varying vec2 vUv; void main(){ float e = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y)); if (e > 0.07) discard; gl_FragColor = vec4(uColor, 1.0); }',
  }));
  m.renderOrder = 5; m.visible = false; scene.add(m); return m;
}
const meMark = marker('#4f46e5'), selMark = marker('#1c1b19');
function placeMarker(m, i) { const c = skylineCentre(sky, i); m.position.set(c.x, c.y, 0.3); m.visible = true; }
placeMarker(meMark, ME);
const scaleMarkers = () => { const k = THREE.MathUtils.clamp(cam.dist / 90, 1, 7); meMark.scale.setScalar(k); selMark.scale.setScalar(k * 1.22); };

// ------------------------------------------------------------------ camera moves: every move is a camera move (PRD section 4)
let tween = null;
const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
function flyTo(x, y, dist, ms = 1600) {
  if (REDUCED || !ms) { cam.x = x; cam.y = y; cam.dist = dist; applyCamera(); return; }
  const from = { ...cam }, travel = Math.hypot(x - from.x, y - from.y);
  const arc = travel > from.dist * 0.8 ? Math.log(Math.min(2.4, 1 + travel / (from.dist * 2))) : 0;      // pull back a little on long hops, like the Silo dive
  tween = { from, to: { x, y, dist }, t0: performance.now(), ms, arc };
}
function stepTween(now) {
  if (!tween) return false;
  const k = Math.min(1, (now - tween.t0) / tween.ms), e = ease(k), { from, to } = tween;
  cam.x = from.x + (to.x - from.x) * e; cam.y = from.y + (to.y - from.y) * e;
  cam.dist = Math.exp(Math.log(from.dist) + (Math.log(to.dist) - Math.log(from.dist)) * e + tween.arc * Math.sin(Math.PI * k));
  applyCamera(); if (k >= 1) tween = null; return true;
}
const roomView = i => { const c = skylineCentre(sky, i); return [c.x, c.y, 16]; };
const flyOverview = () => flyTo(0, height / 2, FIT());
const flyMe = () => { select(ME); flyTo(...roomView(ME)); };

// ------------------------------------------------------------------ friends: stored on this device only, found by display name (PRD section 6, "find a friend fast")
const FKEY = 'fschool.friends.v1';
const loadFriends = () => { try { return JSON.parse(localStorage.getItem(FKEY) || '[]'); } catch { return []; } };
const saveFriends = a => { try { localStorage.setItem(FKEY, JSON.stringify(a)); } catch { /* private mode: friends last until the page closes */ } };
const keyOf = g => { const l = skylineLocate(sky, g); return `${l.k}:${l.i}`; };
const gOf = key => { const [k, i] = String(key).split(':').map(Number), c = sky.towers[k]; return c && i >= 0 && i < c.t.rooms ? c.base + i : -1; };
let friends = loadFriends().filter(k => gOf(k) >= 0);
const isFriend = g => friends.includes(keyOf(g));
const el = (tag, text, attrs = {}) => { const e = document.createElement(tag); if (text != null) e.textContent = text; Object.assign(e, attrs); return e; };
function renderFriends() {
  const box = $('friends'); box.replaceChildren();
  for (const k of friends) { const g = gOf(k); box.append(el('button', skylineName(sky, g), { type: 'button', onclick: () => goTo(g) })); }
  box.hidden = !friends.length;
}
function toggleFriend(g) { const k = keyOf(g); friends = isFriend(g) ? friends.filter(x => x !== k) : [...friends, k]; saveFriends(friends); renderFriends(); select(g); }
function goTo(g) { select(g); flyTo(...roomView(g)); }
$('find').addEventListener('input', e => {
  const box = $('results'); box.replaceChildren(); const hits = searchNames(sky, e.target.value);
  for (const g of hits) { const f = roomFacts(sky, g); box.append(el('button', `${f.name} · ${f.campus} · floor ${f.floor}`, { type: 'button', role: 'option', onclick: () => { box.replaceChildren(); e.target.value = ''; goTo(g); } })); }
  if (e.target.value.trim().length >= 2 && !hits.length) box.append(el('span', 'No one by that name'));
});

// ------------------------------------------------------------------ selection card (view only: you can look, not touch; no messaging, no real names or schools)
const card = $('card'), live = $('live');
function select(g) {
  if (g < 0) { selMark.visible = false; card.hidden = true; dirty = true; return; }
  placeMarker(selMark, g); scaleMarkers();
  const f = roomFacts(sky, g), mine = g === ME, multi = sky.towers.length > 1;
  const lines = [`${f.name}${mine ? ' (you)' : ''}`, `Floor ${f.floor} of ${f.floors}${multi ? ' · ' + f.campus : ''}`, `Dreams of being a ${LABELS.theme[f.theme].toLowerCase()}`,
    f.studying ? `Studying ${f.studying} now` : LABELS.state[f.state] + (f.streakDays > 1 ? ` · ${f.streakDays}-day streak` : ''), LABELS.shield[f.shield]].filter(Boolean);
  card.replaceChildren(...lines.map((l, k) => el(k ? 'span' : 'b', l)));
  if (!mine) { card.append(el('span', 'View only: you can look, not touch.')); card.append(el('button', isFriend(g) ? 'Remove friend' : 'Add friend', { type: 'button', onclick: () => toggleFriend(g) })); }
  if (mine && q.get('back')) card.append(el('button', 'Enter your room', { type: 'button', onclick: () => { location.href = q.get('back'); } }));
  card.hidden = false; live.textContent = lines.join('. '); dirty = true;
}
renderFriends();

// ------------------------------------------------------------------ input: drag to pan, wheel and pinch to zoom, tap a room
const pts = new Map(); let tap = null, pinch0 = 0;
canvas.addEventListener('pointerdown', e => {
  canvas.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); tween = null;
  tap = pts.size === 1 ? { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 } : null;
  if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); }
});
canvas.addEventListener('pointermove', e => {
  const p = pts.get(e.pointerId); if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
  if (pts.size === 1) { cam.x -= dx * unitsPerPx(); cam.y += dy * unitsPerPx(); if (tap) tap.moved += Math.abs(dx) + Math.abs(dy); applyCamera(); }
  else if (pts.size === 2) {
    const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinch0 > 0 && d > 0) zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, pinch0 / d); pinch0 = d;
  }
});
const endPtr = e => {
  const had = pts.delete(e.pointerId);
  if (had && tap && pts.size === 0 && tap.moved < 8 && performance.now() - tap.t < 450) { const w = screenToWorld(e.clientX, e.clientY); select(skylineAt(sky, w.x, w.y)); }
  if (pts.size < 2) pinch0 = 0; if (pts.size === 0) tap = null;
};
canvas.addEventListener('pointerup', endPtr); canvas.addEventListener('pointercancel', endPtr);
function zoomAt(px, py, factor) {
  const before = screenToWorld(px, py); cam.dist *= factor; cam.dist = THREE.MathUtils.clamp(cam.dist, MIN_DIST, FIT() * 1.15);
  const after = screenToWorld(px, py); cam.x += before.x - after.x; cam.y += before.y - after.y; applyCamera();
}
canvas.addEventListener('wheel', e => { e.preventDefault(); tween = null; zoomAt(e.clientX, e.clientY, Math.exp(e.deltaY * 0.0015)); }, { passive: false });
$('btn-me').onclick = flyMe; $('btn-all').onclick = flyOverview; $('btn-top').onclick = () => flyTo(home.cx, home.t.height - 30, 60);
addEventListener('keydown', e => { if (e.key === 'Backspace' && q.get('back')) { location.href = q.get('back'); return; }
   if (e.key === '+' || e.key === '=') zoomAt(innerWidth / 2, innerHeight / 2, 0.7); else if (e.key === '-') zoomAt(innerWidth / 2, innerHeight / 2, 1.4); else if (e.key === 'f') flyMe(); else if (e.key === 'Escape') select(-1); });

// ------------------------------------------------------------------ frame timing and the benchmark
const ring = new Float32Array(300); let ringN = 0, last = 0, lastRendered = false;
function frameStats() {
  const n = Math.min(ringN, ring.length); if (!n) return null;
  const a = Array.from(ring.subarray(0, n)).sort((x, y) => x - y), avg = a.reduce((s, v) => s + v, 0) / n;
  return { fps: 1000 / avg, avgMs: avg, p95Ms: a[Math.min(n - 1, Math.floor(n * 0.95))], worstMs: a[n - 1], frames: n };
}
let bench = null;
function startBench() {
  ring.fill(0); ringN = 0; bench = { t0: performance.now(), dts: [], slow: [], ms: 13000 }; select(-1); $('bench-out').textContent = 'Running 13 s…';
}
const lerp = (a, b, t) => a + (b - a) * t, sm = t => t * t * (3 - 2 * t);
function benchPose(t) {   // scripted: overview, dive to you, fast pan through ~60 floors, back out
  const me = skylineCentre(sky, ME), over = { x: 0, y: height / 2, d: FIT() };
  if (t < 2) return over;
  if (t < 5) { const k = sm((t - 2) / 3); return { x: lerp(over.x, me.x, k), y: lerp(over.y, me.y, k), d: Math.exp(lerp(Math.log(over.d), Math.log(30), k)) }; }
  if (t < 10) { const k = (t - 5) / 5; return { x: me.x + Math.sin(k * 6) * 20, y: me.y + k * CELL.h * 60, d: 30 + 40 * Math.sin(k * Math.PI) }; }
  const k = sm((t - 10) / 3), from = { x: me.x, y: me.y + CELL.h * 60, d: 30 }; return { x: lerp(from.x, 0, k), y: lerp(from.y, over.y, k), d: Math.exp(lerp(Math.log(from.d), Math.log(over.d), k)) };
}
function finishBench() {
  const a = bench.dts.slice().sort((x, y) => x - y), n = a.length, avg = a.reduce((s, v) => s + v, 0) / n;
  const r = { rooms: sky.total, towers: sky.towers.length, dpr: dprCap, frames: n, avgFps: +(1000 / avg).toFixed(1), p95Ms: +a[Math.floor(n * 0.95)].toFixed(1), worstMs: +a[n - 1].toFixed(1), dropped: a.filter(v => v > 33.4).length, drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles, gpu: gpuName(), screen: `${innerWidth}x${innerHeight}` };
  r.slow = bench.slow;      // [seconds into the run, frame ms] of the first long frames: shows which phase hitches
  r.pass = r.avgFps >= 55 && r.p95Ms <= 24;      // smooth = ~60 fps with no long hitches
  window.__towerBench = r; console.log('tower bench', r);
  $('bench-out').textContent = `${r.pass ? 'PASS' : 'FAIL'} · ${r.avgFps} fps avg · p95 ${r.p95Ms} ms · worst ${r.worstMs} ms · ${r.dropped} frames over 33 ms · ${r.drawCalls} draw calls`;
  bench = null; flyOverview();
}
function gpuName() { const gl = renderer.getContext(), x = gl.getExtension('WEBGL_debug_renderer_info'); return x ? gl.getParameter(x.UNMASKED_RENDERER_WEBGL) : 'unknown'; }
$('btn-bench').onclick = startBench;

// ------------------------------------------------------------------ loop
const hud = $('hud'); let hudAt = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let moving = stepTween(now);
  if (bench) {
    const t = (now - bench.t0) / 1000, p = benchPose(t); cam.x = p.x; cam.y = p.y; cam.dist = p.d; applyCamera(); moving = true;
    if (last && lastRendered) { bench.dts.push(now - last); if (now - last > 100 && bench.slow.length < 8) bench.slow.push([+t.toFixed(1), Math.round(now - last)]); }
    if (now - bench.t0 > bench.ms) finishBench();
  }
  if (moving || dirty || q.has('always')) {
    scaleMarkers(); renderer.render(scene, camera); dirty = false;
    if (last && lastRendered && now - last < 120) { ring[ringN++ % ring.length] = now - last; }
    lastRendered = true;
  } else lastRendered = false;
  last = now;
  if (now - hudAt > 250) {
    hudAt = now; const s = frameStats(), floor = Math.max(1, Math.min(home.t.rows, Math.round(cam.y / CELL.h + 0.5)));
    hud.textContent = `${sky.total.toLocaleString()} rooms${sky.towers.length > 1 ? ' · ' + sky.towers.length + ' campuses' : ''} · ${renderer.info.render.calls} draw calls · ${(renderer.info.render.triangles / 1000).toFixed(0)}k tris · floor ${floor}` + (s ? ` · ${s.fps.toFixed(0)} fps · p95 ${s.p95Ms.toFixed(1)} ms` : '');
  }
}

resize(); cam.dist = FIT(); applyCamera(); scaleMarkers();
$('loading')?.remove();
requestAnimationFrame(frame);
if (q.get('focus') === 'me') { select(ME); const [x, y, d] = roomView(ME); cam.x = x; cam.y = y; cam.dist = d * 1.6; applyCamera(); }
if (q.has('bench')) setTimeout(startBench, 500);
window.__tower = { tower, sky, cam, ME, flyTo, select, startBench, renderer };      // for the console and for tests
