// Cutaway school ("dollhouse"): a grid of themed rooms, camera glides, rooms light up in order.
// Owner: Phyllis. Works on a shared world {THREE, scene, camera, renderer, canvas, addUpdater} (see getWorld),
// or on its own canvas via createStage(host).
import * as THREE from 'three';
import { createRoom, ROOM_LABELS } from './rooms/careerRooms.js';
import { PAL, box, mergeStatic } from './rooms/RoomBuilder.js';
import { quality, pixelRatio, reducedMotion } from '../quality.js';
import { debugPanel, watchRenderer, downgradeMaterials, report } from './Safety.js';

const CELL = 4.7, FILL = ['#e8b8a6', '#b9a6d8', '#9fbfe0', '#f0c987', '#a9cfa6', '#d9a1c0', '#8fc3c0', '#e7a58a'];

/* Shared-world lookup (optional). */
export async function getSharedWorld() {
  // Opt-in: a host may set window.__world3d = {THREE, scene, camera, renderer, canvas, addUpdater}. No network request is made.
  return (typeof window !== 'undefined' && window.__world3d) || null;
}

/* Standalone stage: own canvas + render loop. */
export function createStage(host) {
  debugPanel();
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
  canvas.setAttribute('aria-hidden', 'true');
  host.prepend(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality.antialias, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(pixelRatio());
  renderer.shadowMap.enabled = !!quality.shadows; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.18;
  window.__cmRenderer = renderer;
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#ece3d2');
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 200);
  const guard = watchRenderer(renderer, scene); window.__cmGuard = guard;
  const updaters = new Set(); let raf = 0, last = performance.now(), dead = false;
  const size = () => { const w = host.clientWidth || innerWidth, h = host.clientHeight || innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  size(); addEventListener('resize', size);
  let failed = 0;
  const loop = now => { if (dead) return; const dt = Math.min((now - last) / 1000, .1); last = now; try { updaters.forEach(f => f(dt, now / 1000)); renderer.render(scene, camera); failed = 0; } catch (e) { report('render error: ' + e.message); guard.downgrade('render error'); if (++failed > 30) return; } raf = requestAnimationFrame(loop); };
  raf = requestAnimationFrame(loop);
  return {
    THREE, scene, camera, renderer, canvas, own: true, guard,
    addUpdater(fn) { updaters.add(fn); return () => updaters.delete(fn); },
    dispose() { dead = true; cancelAnimationFrame(raf); removeEventListener('resize', size); renderer.dispose(); canvas.remove(); }
  };
}

const ease = t => t * t * t * (t * (t * 6 - 15) + 10);

export function createDollhouse(world, { rooms, labels = [], cols, overlay, reduced = reducedMotion } = {}) {
  const n = rooms.length;
  cols = cols || (n <= 4 ? Math.max(2, n) : n <= 6 ? 3 : 4);
  const rows = Math.ceil(n / cols) + 1;                 // one filler row on top, like the reference
  const group = new THREE.Group(); world.scene.add(group);
  const hemi = new THREE.HemisphereLight('#fff6e6', '#b79a78', 1.05); group.add(hemi);
  const sun = new THREE.DirectionalLight('#fff1d6', 1.35); sun.position.set(6, 14, 18); group.add(sun);
  const rim = new THREE.DirectionalLight('#cfe0ff', .55); rim.position.set(-7, 9, -9); group.add(rim);
  if (quality.shadows) { sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); const c = sun.shadow.camera; c.left = -20; c.right = 20; c.top = 14; c.bottom = -14; c.far = 60; }

  // building shell behind the cells
  const W = cols * CELL, H = rows * CELL * .8;
  const cx0 = -(cols - 1) * CELL / 2, cyBase = 0;
  const frame = new THREE.Group(); group.add(frame);
  box(W + .8, H + .6, .4, PAL.cream, 0, -.3, -2.25, frame);
  const cells = [], fillers = [];
  const place = (c, r) => ({ x: cx0 + c * CELL, y: cyBase + r * CELL * .8 });
  const cellOrder = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cellOrder.push([c, r]);
  // real rooms occupy the lower rows left-to-right; the top row (and spare cells) are filler
  const real = cellOrder.filter(([c, r]) => r < rows - 1).sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, n); // first room = top-left of the real block
  const realSet = new Set(real.map(a => a.join()));
  rooms.forEach((type, i) => {
    const [c, r] = real[i], p = place(c, r), room = typeof type === 'string' ? createRoom(type) : type;   // a ready-made THREE.Group is accepted too
    room.position.set(p.x, p.y, 0); room.scale.setScalar(1);
    const dim = new THREE.Mesh(new THREE.PlaneGeometry(4.1, 3.2), new THREE.MeshBasicMaterial({ color: '#2a2622', transparent: true, opacity: 0, depthWrite: false }));
    dim.position.set(0, 1.5, 2.05); room.add(dim);
    group.add(room);
    cells.push({ room, dim, x: p.x, y: p.y, lit: 0, target: 0, label: labels[i] || room.userData.label });
  });
  cellOrder.forEach(([c, r], i) => {
    if (realSet.has([c, r].join())) return;
    const p = place(c, r), f = box(4, 3, .3, FILL[(i * 3 + r) % FILL.length], p.x, p.y, -1.8, frame);
    f.castShadow = false; fillers.push(f);
  });
  box(W + .8, .2, .6, PAL.woodDark, 0, -.32, 2.0, frame); // ground lip
  mergeStatic(frame);

  if (world.guard?.downgraded) downgradeMaterials(group);
  // labels (HTML, projected each frame)
  const labelEls = cells.map(c => { if (!overlay) return null; const e = document.createElement('div'); e.className = 'cm3-label'; e.textContent = c.label; overlay.appendChild(e); return e; });
  const v = new THREE.Vector3(), chars = []; let disposed = false;
  const stopUpd = world.addUpdater((dt) => {
    chars.forEach(s => s.update(dt));
    cells.forEach((c, i) => {
      c.lit += (c.target - c.lit) * Math.min(1, dt * 5);
      c.dim.material.opacity = .46 * (1 - c.lit) * (c.dimmed ? 1 : 0);
      const s = 1 + .025 * c.lit; c.room.scale.setScalar(s);
      const e = labelEls[i]; if (e) {
        v.set(c.x, c.y + 3.0, 0).project(world.camera);
        const onScreen = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
        e.style.transform = `translate(-50%,-100%) translate(${(v.x * .5 + .5) * overlay.clientWidth}px,${(-v.y * .5 + .5) * overlay.clientHeight}px)`;
        e.classList.toggle('on', c.show && onScreen);
      }
    });
  });

  /* camera */
  const fov = () => world.camera.fov * Math.PI / 180;
  const fit = (w, h) => Math.max(h / 2 / Math.tan(fov() / 2), w / 2 / (Math.tan(fov() / 2) * world.camera.aspect)) * 1.12;
  let cancelMove = null;
  function moveTo(pos, look, dur, from) {
    cancelMove?.();
    const cam = world.camera, p0 = from?.pos ? from.pos.clone() : cam.position.clone(), l0 = from?.look ? from.look.clone() : (cam.userData.look ||= new THREE.Vector3(0, 1.5, 0)).clone();
    if (!cam.userData.look) cam.userData.look = l0.clone();
    if (reduced || dur <= 0) { cam.position.copy(pos); cam.userData.look.copy(look); cam.lookAt(look); return Promise.resolve(); }
    return new Promise(res => {
      let t = 0; const l = new THREE.Vector3(), t0 = performance.now();
      const off = world.addUpdater(dt => {
        t = Math.min(1, (performance.now() - t0) / 1000 / dur); const e = ease(t);
        cam.position.lerpVectors(p0, pos, e); l.lerpVectors(l0, look, e); cam.userData.look.copy(l); cam.lookAt(l);
        if (t >= 1) { off(); cancelMove = null; res(); }
      });
      cancelMove = () => { off(); res(); };
    });
  }
  const focusPose = i => { const c = cells[i], d = fit(4.6, 3.6) * 1.12; return { pos: new THREE.Vector3(c.x, c.y + 1.6, d + .5), look: new THREE.Vector3(c.x, c.y + .75, 0) }; };
  const overviewPose = () => { const cy = cyBase + (rows - 1) * CELL * .8 / 2 + 1.4, d = fit(W + 1, H + 1.2); return { pos: new THREE.Vector3(0, cy + .4, d), look: new THREE.Vector3(0, cy, 0) }; };
  const api = {
    group, cells, lights: { hemi, sun, rim },
    // Which cell is under a screen point (normalised device coords)? -1 if none. Ray vs the z=0 plane.
    pick(nx, ny) {
      const o = new THREE.Raycaster(); o.setFromCamera({ x: nx, y: ny }, world.camera);
      const t = -o.ray.origin.z / o.ray.direction.z; if (!(t > 0)) return -1;
      const px = o.ray.origin.x + o.ray.direction.x * t, py = o.ray.origin.y + o.ray.direction.y * t;
      return cells.findIndex(c => Math.abs(px - c.x) < 2.05 && py > c.y - .15 && py < c.y + 3.1);
    },
    // Set the camera at the "reception" side, off to the left and low, then glide into the room.
    async enter(i, dur = 3.2) {
      const t = focusPose(i), s = { pos: t.pos.clone().add(new THREE.Vector3(-7, -.6, 11)), look: t.look.clone().add(new THREE.Vector3(-3, 0, 0)) };
      world.camera.position.copy(s.pos); world.camera.userData.look = s.look.clone(); world.camera.lookAt(s.look);
      cells.forEach(c => { c.dimmed = true; c.target = 0; }); cells[i].target = 1; cells[i].show = true;
      await moveTo(t.pos, t.look, dur);
    },
    focus(i, dur = 1.8) { const t = focusPose(i); return moveTo(t.pos, t.look, dur); },
    overview(dur = 2.2) { const t = overviewPose(); return moveTo(t.pos, t.look, dur); },
    startOverview() { const t = overviewPose(); world.camera.position.copy(t.pos); world.camera.userData.look = t.look.clone(); world.camera.lookAt(t.look); },
    setLit(i, on = true) { const c = cells[i]; if (!c) return; c.dimmed = true; c.target = on ? 1 : 0; c.show = on; },
    dimAll() { cells.forEach(c => { c.dimmed = true; c.target = 0; c.show = false; }); },
    // Light rooms in order while the camera visits each (or just lights them in overview when visit=false).
    async lightPath(order = cells.map((_, i) => i), { visit = false, gap = 520 } = {}) {
      for (const i of order) { api.setLit(i, true); if (visit) await api.focus(i, 1.1); else await new Promise(r => setTimeout(r, reduced ? 80 : gap)); }
    },
    async rise(dur = 2.4) { const t = overviewPose(); await moveTo(new THREE.Vector3(0, t.pos.y + H * .55, t.pos.z * .72), new THREE.Vector3(0, t.look.y - .5, 0), dur); },
    // Lazy: loads the character kit (~1.5 MB) after the first frame; low tier gets only the hero room's student.
    async addCharacters(hero = 0) {
      let C; try { C = await import('./Characters.js'); } catch { return; }
      let kit; try { kit = await C.loadKit(); } catch { return; }
      if (disposed) return;
      const SIT = { computer: [0, -.86, 'type'], design: [-.6, -.8, 'type'], research: [-.9, -.8, 'type'], art: [.8, -.9, 'type'] };
      const STAND = { biology: [1.45, .7, -.5], chemistry: [-1.0, .9, .3], physics: [.9, .5, -.3], engineering: [-1.2, .7, .3], robotics: [-1.2, .7, .3], math: [0, .6, 0], medical: [.7, .5, -.4], business: [1.2, .6, -.3], humanities: [-1.3, .7, .4], sports: [-.5, .5, .3], astronomy: [-1.0, .6, .3], blank: [0, .6, 0] };
      const order = cells.map((_, i) => i).sort((a, b) => (a === hero ? -1 : b === hero ? 1 : a - b));
      const max = quality.tier === 'low' ? 1 : quality.tier === 'mid' ? 4 : 99;
      order.slice(0, max).forEach((i, n) => {
        const c = cells[i], type = c.room.userData.type, sit = SIT[type];
        const s = C.createStudent(kit, { variant: i * 3 + 1, pose: sit ? sit[2] : (n % 3 === 2 ? 'agree' : 'idle') });
        const [x, z, ry] = sit ? [sit[0], sit[1], Math.PI] : STAND[type] || STAND.blank;
        s.object.position.set(x, 0, z); s.object.rotation.y = sit ? Math.PI : ry;
        c.room.add(s.object); chars.push(s);
        if (world.guard?.downgraded) downgradeMaterials(s.object);
      });
    },
    dispose() { disposed = true; chars.forEach(s => s.dispose()); cancelMove?.(); stopUpd(); labelEls.forEach(e => e?.remove()); world.scene.remove(group); group.traverse(o => { o.geometry?.dispose?.(); }); }
  };
  return api;
}
export { ROOM_LABELS };
