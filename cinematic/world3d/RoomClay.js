// PRD section 7: the clay Room. One shared shell (built in cinematic/blender/build_room.py) dressed per theme, floating in white space.
// Flags: ?theme=pilot|coder|doctor|studio   ?dream=free text (mapped with studyworld/profile.js themeFor)   ?floor=1..400 (your rank: low = next building, high = skyline)
//        ?flat=1 (force the flat fallback room)   ?accent=%23rrggbb (the student changes the colours, not us)
// Every tap target is a 3D object AND a 44 px labelled button, and both fire a `room:action` event: { id }. The desk is the main entry.
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/addons/loaders/GLTFLoader.js';
import { themeFor } from '../studyworld/profile.js';

const q = new URLSearchParams(location.search);
const THEME = ['pilot', 'coder', 'doctor', 'studio'].includes(q.get('theme')) ? q.get('theme') : themeFor(q.get('dream') || '');
const FLOOR = Math.max(1, Math.min(400, +q.get('floor') || 120));
const $ = id => document.getElementById(id);
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

export const TARGETS = {   // id -> label, what it does (PRD table), where it sits for the flat fallback (% of the picture)
  desk:        { label: 'Desk', does: 'Opens the Desk, your whiteboard tutor', main: true, at: [70, 56] },
  whiteboard:  { label: 'Whiteboard', does: "Today's plan", at: [40, 30] },
  bookshelf:   { label: 'Bookshelf', does: 'Past sessions and notes', at: [14, 38] },
  futureself:  { label: 'Your future self', does: 'Talk to your future self by voice or text', at: [31, 62] },
  trophy:      { label: 'Trophy shelf', does: 'Milestones and Pass Guarantee status', at: [6, 52] },
  window:      { label: 'Window', does: 'Zoom out to the tower', at: [64, 28] },
  door:        { label: 'Door', does: 'Who visited, friends nearby', at: [10, 74] },
};

function act(id) {
  const t = TARGETS[id]; if (!t) return;
  $('toast').textContent = `${t.label}: ${t.does}`; $('toast').hidden = false;
  clearTimeout(act.t); act.t = setTimeout(() => ($('toast').hidden = true), 2600);
  const ev = new CustomEvent('room:action', { detail: { id }, cancelable: true });
  const handled = !document.dispatchEvent(ev);                    // a host app that keeps the 3D scene in memory calls preventDefault() and runs the move itself
  pulse(id);
  if (!handled && NAV[id]) NAV[id]();
}
// Moves between levels (PRD section 4): the camera pushes in, then the next level opens. Back always goes up one level.
const here = () => location.pathname + location.search;
const withQuery = (path, extra) => { const u = new URL(path, location.href); for (const [k, v] of Object.entries(extra)) u.searchParams.set(k, v); return u.href; };
const DESK_URL = q.get('desk') || window.FSCHOOL_DESK_URL || new URL('study/study-demo.html', import.meta.url).href;   // the 2D whiteboard Desk once it has a route
const NAV = {
  desk: () => dive('desk', withQuery(DESK_URL, { from: 'room', back: new URL(here(), location.href).href })),
  window: () => dive('window', withQuery(new URL('../tower/index.html', import.meta.url).href, { focus: 'me', floor: FLOOR, theme: THEME, back: new URL(here(), location.href).href })),
};
let dive = (id, url) => { location.href = url; };
let pulse = () => {};

// ---- the 44 px labelled buttons: the accessible path, and the only path in the flat fallback
const nav = $('targets');
for (const [id, t] of Object.entries(TARGETS)) {
  const b = document.createElement('button'); b.type = 'button'; b.textContent = t.label; b.dataset.id = id; b.title = t.does;
  b.setAttribute('aria-label', `${t.label}. ${t.does}`); if (t.main) b.classList.add('main'); b.onclick = () => act(id); nav.append(b);
}
$('theme-name').textContent = `${THEME[0].toUpperCase() + THEME.slice(1)} room · floor ${FLOOR}`;

function showSummary() {
  const n = k => (q.has(k) ? +q.get(k) : null), rows = [];
  if (n('minutes') !== null) rows.push(`${n('minutes')} min at the desk`);
  if (n('blocks') !== null) rows.push(`${n('blocks')} block${n('blocks') === 1 ? '' : 's'} finished`);
  if (n('keypoints') !== null) rows.push(`${n('keypoints')} keypoint${n('keypoints') === 1 ? '' : 's'} mastered`);
  if (n('climb') !== null) rows.push(`climb +${n('climb')}`);
  const c = $('summary'); c.innerHTML = `<b>Nice work</b>${rows.map(r => `<span>${r}</span>`).join('') || '<span>Session saved</span>'}<button type="button">Continue</button>`;
  c.hidden = false; c.querySelector('button').onclick = () => (c.hidden = true);
}
function flat(reason) {   // PRD: if 3D fails to load, show a flat illustrated room with the same tap targets
  $('stage').hidden = true; const f = $('flat'); f.hidden = false; $('status').textContent = reason;
  const accent = { pilot: '#4f8df7', coder: '#7a6cf0', doctor: '#2fb7a4', studio: '#e0a24a' }[THEME];
  f.innerHTML = `<svg viewBox="0 0 100 80" role="img" aria-label="Illustration of your ${THEME} room"><rect width="100" height="80" fill="#faf8f4"/><path d="M8 18 L62 12 L62 58 L8 66Z" fill="#f4f0ea"/><path d="M62 12 L96 20 L96 62 L62 58Z" fill="#ece7df"/><path d="M8 66 L62 58 L96 62 L40 74Z" fill="#e5dfd4"/><rect x="62" y="20" width="22" height="16" rx="1" fill="#cfe6fb"/><rect x="26" y="20" width="20" height="14" rx="1" fill="#fff" stroke="#ddd"/><rect x="66" y="44" width="22" height="3" rx="1" fill="#d9c3a3"/><rect x="72" y="36" width="10" height="7" rx="1" fill="${accent}"/><path d="M14 36 h4 v18 h-4z" fill="#d9c3a3"/><circle cx="31" cy="50" r="4" fill="#f4f0ea" stroke="${accent}" stroke-width="2"/><rect x="26" y="54" width="10" height="10" rx="4" fill="${accent}"/></svg>`;
  for (const [id, t] of Object.entries(TARGETS)) { const b = document.createElement('button'); b.className = 'hot'; b.style.left = t.at[0] + '%'; b.style.top = t.at[1] + '%'; b.textContent = t.label; b.onclick = () => act(id); f.append(b); }
}

async function start() {
  if (q.has('flat')) { if (q.has('summary')) showSummary(); return flat('Flat room (forced)'); }
  const t0 = performance.now();
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: $('stage'), antialias: true, alpha: false }); } catch { return flat('3D is not available on this device, showing the flat room'); }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.15;
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#fbfaf8');
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  scene.add(new THREE.HemisphereLight('#ffffff', '#ddd6ca', 1.5));
  const sun = new THREE.DirectionalLight('#fff4e4', 2.3); sun.position.set(-4, 7, 5); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.radius = 6; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
  Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 20 }); scene.add(sun);
  const floorShadow = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.16 })); floorShadow.rotation.x = -Math.PI / 2; floorShadow.position.y = -1.0; floorShadow.receiveShadow = true; scene.add(floorShadow);

  let gltf;
  try { gltf = await new GLTFLoader().loadAsync(new URL(`models/room/room-${THEME}.glb`, import.meta.url).href); } catch (e) { console.warn(e); return flat('The room model could not load, showing the flat room'); }
  const room = gltf.scene; scene.add(room);
  const targets = {}, mats = new Map();
  room.traverse(o => {
    if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
    if (o.name.startsWith('tap_')) targets[o.name.slice(4)] = o;
  });
  const accent = q.get('accent'); if (accent) room.traverse(o => { if (o.isMesh && o.material.name === 'accent') { o.material = o.material.clone(); o.material.color.set(accent); } });
  room.traverse(o => { if (o.isMesh && o.material.name === 'glass') { o.material.transparent = true; o.material.opacity = 0.18; o.material.emissiveIntensity = 0; o.castShadow = false; } });

  // ---- your floor shapes your room (PRD): low = a close neighbouring building, high = the skyline
  const view = new THREE.Group(); scene.add(view);
  const clay = new THREE.MeshStandardMaterial({ color: '#efeae2', roughness: 1 }), far = new THREE.MeshStandardMaterial({ color: '#e3ddd3', roughness: 1 });
  const add = (w, h, d, x, y, z, m = clay) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = true; view.add(b); return b; };
  if (FLOOR < 100) { add(3.2, 3.6, 1.5, 1.4, 0.4, -5.2); add(1.4, 2.2, 1.2, -1.4, 0.2, -7); }                                      // next building, close
  else if (FLOOR < 300) { add(2.4, 4, 1.4, 1.2, 1.2, -8, far); add(1.6, 6, 1.4, 3.4, 2.6, -10, far); add(2, 3, 1.4, -1.5, 0.8, -9, far); }
  else for (let i = 0; i < 14; i++) add(0.9 + (i % 3) * 0.5, 3 + ((i * 37) % 9), 1.2, -9 + i * 1.5, 0.5 + ((i * 37) % 9) / 2 - 1, -14 - (i % 4) * 2.2, far);   // skyline
  const dist0 = FLOOR < 100 ? 10.8 : 11.8; /* also the pull-back target */

  // ---- orbit: drag to rotate within a limited arc (a product shot, not a free camera)
  const o = { az: 0.42, pol: 1.2, r: dist0, taz: 0.42, tpol: 1.2 }; const centre = new THREE.Vector3(0, 0.95, 0), tc = centre.clone(); let tr = dist0, speed = 0.12;
  const FOCUS = { desk: [new THREE.Vector3(1.4, 1.0, -1.85), 3.4, 0.2], window: [new THREE.Vector3(1.4, 1.5, -2.4), 3.0, 0.1] };   // where the camera pushes in to
  dive = (id, url) => {
    const f = FOCUS[id]; if (!f || REDUCED) { location.href = url; return; }
    tc.copy(f[0]); tr = f[1]; o.taz = f[2]; speed = 0.07; $('veil').classList.add('on'); setTimeout(() => { location.href = url; }, 750);
  };
  if (q.has('summary')) { centre.copy(FOCUS.desk[0]); tc.set(0, 0.95, 0); o.r = FOCUS.desk[1]; o.az = FOCUS.desk[2]; speed = 0.05; showSummary(); }   // arriving back: the camera pulls out of the desk
  const place = () => { camera.position.set(centre.x + o.r * Math.sin(o.pol) * Math.sin(o.az), centre.y + o.r * Math.cos(o.pol), centre.z + o.r * Math.sin(o.pol) * Math.cos(o.az)); camera.lookAt(centre); };
  const resize = () => { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w < h ? 40 : 30; camera.updateProjectionMatrix(); };
  addEventListener('resize', resize); resize();
  const ptr = new Map(); let down = null, pinch = 0;
  const cv = $('stage');
  cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); ptr.set(e.pointerId, [e.clientX, e.clientY]); down = ptr.size === 1 ? { x: e.clientX, y: e.clientY, m: 0, t: performance.now() } : null; if (ptr.size === 2) { const [a, b] = [...ptr.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); } });
  cv.addEventListener('pointermove', e => {
    const p = ptr.get(e.pointerId); if (!p) return; const dx = e.clientX - p[0], dy = e.clientY - p[1]; p[0] = e.clientX; p[1] = e.clientY;
    if (ptr.size === 1) { o.taz = THREE.MathUtils.clamp(o.taz - dx * 0.006, -0.75, 1.5); o.tpol = THREE.MathUtils.clamp(o.tpol - dy * 0.004, 0.95, 1.38); if (down) down.m += Math.abs(dx) + Math.abs(dy); }
    else if (ptr.size === 2) { const [a, b] = [...ptr.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch) tr = o.r = THREE.MathUtils.clamp(o.r * pinch / d, 6, 15); pinch = d; }
  });
  const ray = new THREE.Raycaster(), v2 = new THREE.Vector2();
  const end = e => {
    const had = ptr.delete(e.pointerId);
    if (had && down && ptr.size === 0 && down.m < 8 && performance.now() - down.t < 450) {
      v2.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(v2, camera);
      const hit = ray.intersectObject(room, true)[0]; let n = hit && hit.object; while (n && !n.name.startsWith('tap_')) n = n.parent; if (n) act(n.name.slice(4));
    }
    if (ptr.size < 2) pinch = 0; if (!ptr.size) down = null;
  };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  cv.addEventListener('wheel', e => { e.preventDefault(); tr = o.r = THREE.MathUtils.clamp(o.r * Math.exp(e.deltaY * 0.001), 6, 15); }, { passive: false });

  // ---- tap feedback: a soft glow on the target
  let glow = null;
  pulse = id => { const t = targets[id]; if (!t) return; glow = { t, t0: performance.now() }; t.traverse(m => { if (m.isMesh && !mats.has(m)) { m.material = m.material.clone(); mats.set(m, m.material); } }); };
  const frame = now => {
    requestAnimationFrame(frame);
    o.az += (o.taz - o.az) * speed; o.pol += (o.tpol - o.pol) * speed; o.r += (tr - o.r) * speed * 0.8; centre.lerp(tc, speed);
    if (!REDUCED && !down && !ptr.size) o.taz += Math.sin(now / 4200) * 0.0004;   // the room breathes a little
    place();
    if (glow) { const k = (now - glow.t0) / 1100; glow.t.traverse(m => { if (m.isMesh && m.material.emissive) { m.material.emissive.set('#ffffff'); m.material.emissiveIntensity = k < 1 ? 0.5 * Math.sin(k * Math.PI) : 0; } }); if (k >= 1) glow = null; }
    renderer.render(scene, camera);
  };
  place(); requestAnimationFrame(frame);
  const ms = Math.round(performance.now() - t0); $('status').textContent = `Room ready in ${ms} ms (PRD target: under 2000 ms)`; window.__room = { THEME, FLOOR, ms, targets: Object.keys(targets) };
}
start();
