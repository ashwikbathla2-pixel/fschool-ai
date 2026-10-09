// The school: long low pavilion with cantilevered roofs, warm glowing glass walls with life inside, a raised glass
// studio on top, the sliding entrance doors and the vestibule behind them. Owner: Stanley (Opus) (vestibule layout from Jim).
// Floor y = 0, glass line z = 0, doors centred on x = 0 (the hallway continues at z -6).
import * as THREE from 'three';
import { PAL, mat, basic, box, plane, canvasTex, plant, pool, clamp } from './materials.js';
import { CAMPUS, tbox, paint, radial, glowMat, surface } from './pbr.js';
import { rnd, reseed, instanced } from './Foliage.js';

const DOOR_W = 4.6, DOOR_H = 3.6, GF = 4.3; // ground-floor glass height
const ROOF = { y: 4.6, t: 0.42, front: 3.4, back: -22, x0: -37, x1: 37 };
const UP = { x0: -8, x1: 14, z: -3, y0: ROOF.y + ROOF.t, h: 3.8 };

// painted interior: warm ceiling glow, shelves, boards, plants; people are real silhouettes in front of it
function interiorTexture(seed, big) {
  return paint(big ? 2048 : 1024, big ? 512 : 256, (c, w0, h0) => {
    reseed(seed); const k = big ? 1 : 0.5; c.scale(k, k); const w = w0 / k, h = h0 / k;
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#fff0cf'); g.addColorStop(0.18, '#ffd59a'); g.addColorStop(0.62, '#e8a565'); g.addColorStop(1, '#6e4426');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    for (let x = 30; x < w; x += 150 + rnd() * 120) {                // pendant pools of light along the ceiling
      const r = c.createRadialGradient(x, 40, 0, x, 40, 120); r.addColorStop(0, 'rgba(255,250,235,.95)'); r.addColorStop(1, 'rgba(255,240,210,0)'); c.fillStyle = r; c.fillRect(x - 120, 0, 240, 200);
    }
    for (let x = 20; x < w - 160; x += 260 + rnd() * 200) {           // bookshelves
      const sw = 120 + rnd() * 90, top = h * (0.28 + rnd() * 0.1);
      c.fillStyle = 'rgba(70,40,22,.85)'; c.fillRect(x, top, sw, h - top);
      for (let y = top + 12; y < h - 30; y += 46) for (let bx = x + 6; bx < x + sw - 8; bx += 7 + rnd() * 6) { c.fillStyle = `hsla(${20 + rnd() * 30},${40 + rnd() * 30}%,${35 + rnd() * 30}%,.9)`; c.fillRect(bx, y + rnd() * 8, 5 + rnd() * 3, 34 - rnd() * 8); }
    }
    for (let x = 200; x < w; x += 520 + rnd() * 200) { c.fillStyle = 'rgba(40,52,64,.85)'; c.fillRect(x, h * 0.3, 170, 92); c.fillStyle = 'rgba(255,255,255,.35)'; for (let k = 0; k < 4; k++) c.fillRect(x + 16, h * 0.3 + 16 + k * 18, 60 + rnd() * 80, 5); }
    for (let x = 100; x < w; x += 330 + rnd() * 300) {                // potted plants
      c.fillStyle = 'rgba(38,52,30,.9)'; for (let k = 0; k < 7; k++) { c.beginPath(); c.ellipse(x + (rnd() - 0.5) * 60, h * 0.62 + (rnd() - 0.5) * 50, 26, 40, rnd(), 0, 7); c.fill(); }
      c.fillStyle = 'rgba(60,40,28,.95)'; c.fillRect(x - 22, h * 0.78, 44, 70);
    }
    c.fillStyle = 'rgba(80,48,26,.6)'; c.fillRect(0, h * 0.86, w, h * 0.14); // floor line
  });
}

export function buildEntrance({ quality }) {
  const g = new THREE.Group(); g.name = 'entrance';
  const low = quality.tier === 'low', shadow = !!quality.shadows;
  const put = (m, cast = true, receive = true) => { m.castShadow = shadow && cast; m.receiveShadow = shadow && receive; return m; };
  reseed(3);

  const plaster = surface(quality, CAMPUS.plaster, { roughness: 0.9 });
  const stone = surface(quality, CAMPUS.stone, { roughness: 0.95 });
  const fascia = surface(quality, CAMPUS.fascia, { roughness: 0.5, metalness: 0.5 });
  const bronze = surface(quality, CAMPUS.bronze, { roughness: 0.4, metalness: 0.7 });
  const soffit = surface(quality, CAMPUS.soffit, { roughness: 0.7, emissive: 0x4a2a12, emissiveIntensity: 1 });
  const glass = low ? null : new THREE.MeshStandardMaterial({ color: 0x0f1418, roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.32, envMapIntensity: 2.2, depthWrite: false });
  const warm = new THREE.Color(CAMPUS.glow).multiplyScalar(low ? 1.15 : 2.1);
  // one interior texture for every glass bay; each card gets its own slice through its UVs, so all cards merge into one draw call
  const cardTex = interiorTexture(5, quality.tier === 'high'); cardTex.wrapS = THREE.RepeatWrapping;
  const card = new THREE.MeshBasicMaterial({ map: cardTex, color: warm });
  const cardPlane = (w, h, x, y, z, su, sv = 1, ou = 0, ov = 0) => {
    const m = plane(w, h, card, x, y, z, g), uv = m.geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su + ou, uv.getY(i) * sv + ov); return m;
  };
  const floorIn = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xd99a5c).multiplyScalar(low ? 0.9 : 1.3) });
  const ceilIn = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd8a0).multiplyScalar(low ? 1.1 : 1.8) });

  /* ---------- ground floor ---------- */
  // glowing interior bays either side of the vestibule (vestibule walls at x = +-4.65)
  const bays = [[-14, -4.85, 4], [4.85, 24, 4], [24, 36.6, 5.4]];
  bays.forEach(([a, b, d], i) => {
    const w = b - a, cx = (a + b) / 2, zf = i === 2 ? -1.5 : 0;
    cardPlane(w, GF, cx, GF / 2, zf - d, w / 18, 1, i * 0.37);
    plane(w, d, floorIn, cx, 0.01, zf - d / 2, g, 0, -Math.PI / 2); plane(w, d, ceilIn, cx, GF, zf - d / 2, g, 0, Math.PI / 2);
    box(0.2, GF, d, plaster, a + 0.1, GF / 2, zf - d / 2, g); box(0.2, GF, d, plaster, b - 0.1, GF / 2, zf - d / 2, g);
    // mullions + transom
    for (let x = a; x <= b + 1e-3; x += w / Math.round(w / 1.9)) box(0.09, GF, 0.16, bronze, x, GF / 2, zf + 0.05, g);
    box(w, 0.1, 0.16, bronze, cx, 0.05, zf + 0.05, g);
    if (glass) plane(w, GF, glass, cx, GF / 2, zf + 0.02, g).userData.keep = true;
  });
  // solid stone wing on the left, stepped forward, with three deep glowing windows
  put(tbox(22.6, GF + 0.3, 1.4, stone, -25.7, (GF + 0.3) / 2, 0.5, g, 3));
  [-31.5, -25.7, -19.9].forEach((x, i) => {
    cardPlane(2.6, 2.3, x, 2.0, 1.22, 0.15, 0.6, 0.11 + i * 0.3, 0.2);
    box(2.9, 0.12, 0.3, bronze, x, 0.8, 1.3, g); box(2.9, 0.12, 0.3, bronze, x, 3.2, 1.3, g);
  });
  // the logo plaque on the stone wing
  const logoTex = new THREE.TextureLoader().load(new URL('../poster/logo.jpeg', import.meta.url).href); logoTex.colorSpace = THREE.NoColorSpace;
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 1.4, 1.0), alphaMap: logoTex, transparent: true, depthWrite: false }));
  plaque.position.set(-35.2, 2.4, 1.23); plaque.userData.keep = true; g.add(plaque);
  // back + side walls so the pavilion reads as a solid volume from the hills
  put(tbox(74, GF, 0.4, plaster, 0, GF / 2, ROOF.back + 0.4, g, 3)); [-1, 1].forEach(s => put(tbox(0.4, GF, -ROOF.back, plaster, s * 36.8, GF / 2, ROOF.back / 2, g, 3)));

  /* ---------- cantilevered main roof ---------- */
  const rl = ROOF.x1 - ROOF.x0, rd = ROOF.front - ROOF.back, rz = (ROOF.front + ROOF.back) / 2;
  put(box(rl, ROOF.t, rd, fascia, 0, ROOF.y + ROOF.t / 2, rz, g));
  put(box(rl - 0.2, 0.05, rd - 0.2, soffit, 0, ROOF.y - 0.02, rz, g), false, true);
  // slim metal edge catches the low sunset and gives the large roof a readable game-scale profile
  put(tbox(rl + 0.08, 0.055, 0.09, bronze, 0, ROOF.y + ROOF.t - 0.012, ROOF.front + 0.025, g, 5), false, false);
  // recessed downlights in the soffit + their pools on the plaza
  const dl = [], spill = [];
  for (let x = ROOF.x0 + 1.6; x < ROOF.x1 - 1; x += 3.2) { dl.push({ x, y: ROOF.y - 0.05, z: 1.7, ry: 0 }); spill.push({ x, y: 0.03, z: 1.9, s: 3.4, ry: 0 }); }
  const dGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.04, 10); g.add(instanced(dGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(CAMPUS.warm).multiplyScalar(4) }), dl));
  const pGeo = new THREE.PlaneGeometry(1, 1); pGeo.rotateX(-Math.PI / 2); g.add(instanced(pGeo, glowMat(radial(), 0xffb878, 0.55), spill));
  // window spill: a warm wash on the paving in front of the glass
  const spillTex = paint(16, 128, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, h); });
  const wash = new THREE.Mesh(new THREE.PlaneGeometry(50, 7), glowMat(spillTex, 0xff9c55, 0.4)); wash.rotation.x = -Math.PI / 2; wash.position.set(5, 0.025, 3.5); if (!low) g.add(wash);

  /* ---------- raised glass studio with its own floating roof ---------- */
  const uw = UP.x1 - UP.x0, ucx = (UP.x0 + UP.x1) / 2, ud = 12;
  cardPlane(uw, UP.h, ucx, UP.y0 + UP.h / 2, UP.z - 3.2, uw / 18, 1, 0.53);
  plane(uw, 3.2, floorIn, ucx, UP.y0 + 0.01, UP.z - 1.6, g, 0, -Math.PI / 2); plane(uw, 3.2, ceilIn, ucx, UP.y0 + UP.h, UP.z - 1.6, g, 0, Math.PI / 2);
  for (let x = UP.x0; x <= UP.x1 + 1e-3; x += uw / 11) box(0.08, UP.h, 0.14, bronze, x, UP.y0 + UP.h / 2, UP.z + 0.05, g);
  if (glass) plane(uw, UP.h, glass, ucx, UP.y0 + UP.h / 2, UP.z + 0.02, g).userData.keep = true;
  put(tbox(0.4, UP.h, ud, plaster, UP.x0 + 0.2, UP.y0 + UP.h / 2, UP.z - ud / 2, g, 3)); put(tbox(0.4, UP.h, ud, plaster, UP.x1 - 0.2, UP.y0 + UP.h / 2, UP.z - ud / 2, g, 3));
  put(tbox(uw, UP.h, 0.4, plaster, ucx, UP.y0 + UP.h / 2, UP.z - ud, g, 3));
  put(box(uw + 3.4, 0.34, ud + 3.6, fascia, ucx + 0.4, UP.y0 + UP.h + 0.17, UP.z - ud / 2 + 1.6, g));
  put(box(uw + 3.2, 0.04, ud + 3.4, soffit, ucx + 0.4, UP.y0 + UP.h - 0.01, UP.z - ud / 2 + 1.6, g), false, true);
  // a slim balcony rail on the main roof in front of the studio
  box(uw, 0.05, 0.05, bronze, ucx, UP.y0 + 1.05, UP.z + 2.4, g); for (let x = UP.x0; x <= UP.x1; x += 1.1) box(0.03, 1.05, 0.03, bronze, x, UP.y0 + 0.52, UP.z + 2.4, g);
  // chimney-like service block (from the photos) on the left roof
  put(tbox(1.4, 1.6, 1.4, stone, -24, ROOF.y + ROOF.t + 0.8, -6, g, 2));

  /* ---------- people inside: dark silhouettes against the glow ---------- */
  if (!low) {
    const person = (() => {
      const body = new THREE.CapsuleGeometry(0.2, 0.85, 3, 8); body.translate(0, 0.73, 0);
      const head = new THREE.SphereGeometry(0.13, 10, 8); head.translate(0, 1.5, 0);
      const parts = [body, head].map(x => x.toNonIndexed()); const m = new THREE.BufferGeometry();
      const pos = [], nor = []; parts.forEach(p => { pos.push(...p.attributes.position.array); nor.push(...p.attributes.normal.array); });
      m.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); m.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); return m;
    })();
    const folk = [];
    [[-13, -5.5], [5.5, 23], [25, 35.5]].forEach(([a, b], bi) => { const n = Math.round((b - a) / 3); for (let i = 0; i < n; i++) folk.push({ x: a + (i + rnd() * 0.8) * (b - a) / n, y: 0, z: (bi === 2 ? -1.5 : 0) - 1.2 - rnd() * 2, s: 0.9 + rnd() * 0.25 }); });
    for (let i = 0; i < 5; i++) folk.push({ x: UP.x0 + 2 + i * 4 + rnd(), y: UP.y0, z: UP.z - 1.2 - rnd() * 1.4, s: 0.95 + rnd() * 0.15 });
    const sil = new THREE.MeshBasicMaterial({ color: 0x2a1a10 });
    g.add(instanced(person, sil, folk));
    // tables in the reading room
    const tables = []; for (let x = 7; x < 22; x += 4.6) tables.push({ x, y: 0, z: -2.6, ry: 0 });
    const tGeo = new THREE.BoxGeometry(2.2, 0.06, 0.9); tGeo.translate(0, 0.76, 0); g.add(instanced(tGeo, sil, tables));
    const lampGeo = new THREE.SphereGeometry(0.22, 12, 8); const lamps = []; for (let x = -12; x < 35; x += 3.4) if (Math.abs(x) > 5) lamps.push({ x, y: GF - 0.7, z: x > 24 ? -3 : -1.8, ry: 0 });
    g.add(instanced(lampGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(CAMPUS.warm).multiplyScalar(5) }), lamps));
  }

  /* ---------- the entrance: canopy, sliding doors, door frame ---------- */
  const doorGlass = low ? new THREE.MeshLambertMaterial({ color: PAL.glass, transparent: true, opacity: 0.3, emissive: 0x3a2a18 })
    : new THREE.MeshStandardMaterial({ color: 0x20262b, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.3, envMapIntensity: 2 });
  const leaf = side => {
    const l = new THREE.Group(); const w = DOOR_W / 2 + 0.02;
    box(w, DOOR_H, 0.05, doorGlass, 0, DOOR_H / 2, 0, l);
    box(0.08, DOOR_H, 0.1, bronze, -w / 2, DOOR_H / 2, 0, l); box(0.08, DOOR_H, 0.1, bronze, w / 2, DOOR_H / 2, 0, l);
    box(w, 0.08, 0.1, bronze, 0, DOOR_H - 0.04, 0, l); box(w, 0.2, 0.1, bronze, 0, 0.1, 0, l);
    box(0.04, 1.4, 0.12, mat(PAL.woodLight), side * -(w / 2 - 0.25), 1.3, 0.06, l);
    l.position.set(side * w / 2, 0, -0.3); l.userData.keep = true; g.add(l); return l;
  };
  const leaves = [leaf(-1), leaf(1)];
  box(DOOR_W + 0.5, GF - DOOR_H, 0.18, bronze, 0, DOOR_H + (GF - DOOR_H) / 2, -0.25, g);   // header
  [-1, 1].forEach(s => box(0.25, GF, 0.3, bronze, s * (DOOR_W / 2 + 0.15), GF / 2, -0.25, g));
  // deeper stone-and-bronze portal makes the existing sliding entry read as a solid, walk-up game landmark
  const portalX = DOOR_W / 2 + 0.42, portalZ = 0.18;
  [-1, 1].forEach(side => {
    const x = side * portalX;
    put(tbox(0.42, GF + 0.08, 0.48, stone, x, (GF + 0.08) / 2, portalZ, g, 1.8), true, true);
    put(tbox(0.62, 0.16, 0.62, bronze, x, GF + 0.02, portalZ, g, 1.8), true, false);
    put(tbox(0.62, 0.18, 0.62, bronze, x, 0.09, portalZ, g, 1.8), true, false);
    // shallow vertical inlay catches the sunset without changing the pavilion facade
    box(0.035, GF - 0.42, 0.025, fascia, x - side * 0.1, GF / 2, portalZ + 0.25, g);

    const fixture = new THREE.Group(); fixture.position.set(side * (DOOR_W / 2 + 1.0), 3.05, 0.48); g.add(fixture);
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.42, 0.16), bronze); housing.castShadow = shadow; fixture.add(housing);
    const lens = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.25, 0.035), new THREE.MeshStandardMaterial({ color: 0xffd39a, emissive: 0xff9c48, emissiveIntensity: low ? 1.6 : 2.6, roughness: 0.32 }));
    lens.position.z = 0.095; fixture.add(lens);
    if (!low) {
      const glow = new THREE.PointLight(0xffbd7b, 3.2, 6.5, 2); glow.position.set(0, -0.08, 0.35); fixture.add(glow);
    }
  });
  put(tbox(DOOR_W + 1.36, 0.13, 0.66, bronze, 0, GF + 0.12, portalZ, g, 1.8), true, false);
  put(tbox(DOOR_W + 0.94, 0.1, 0.56, stone, 0, 0.05, portalZ, g, 1.8), false, true);
  // entry mat of light on the paving + a deeper canopy over the doors
  put(box(8.4, 0.3, 2.4, fascia, 0, ROOF.y - 0.15, ROOF.front + 1.1, g));
  pool(g, 0, 0.04, 2.6, 9, 6, 0.3);

  // vestibule (z 0 .. -6, x +-4.5, height 4.4) — layout kept from Jim's original so the hallway joins cleanly
  const V = new THREE.Group(); V.name = 'vestibule'; // own group: stays drawn after the building is hidden
  const wood = mat(PAL.wood), char = mat(PAL.charcoal);
  const floorTex = canvasTex(256, 256, (ctx, w, h) => { ctx.fillStyle = '#efe5d6'; ctx.fillRect(0, 0, w, h); ctx.strokeStyle = 'rgba(120,100,80,.22)'; ctx.lineWidth = 3; ctx.strokeRect(0, 0, w, h); }, { repeat: [5, 3] });
  plane(9, 6.2, mat(0xffffff, { map: floorTex }), 0, 0.005, -3, V, 0, -Math.PI / 2);
  plane(9, 6.2, mat(PAL.cream), 0, 4.4, -3, V, 0, Math.PI / 2);
  box(0.3, 4.4, 6.2, mat(PAL.cream2), -4.65, 2.2, -3, V); box(0.3, 4.4, 6.2, mat(PAL.cream2), 4.65, 2.2, -3, V);
  box(0.32, 1.0, 6.2, wood, -4.6, 0.5, -3, V); box(0.32, 1.0, 6.2, wood, 4.6, 0.5, -3, V);
  box(3.6, 0.03, 2.2, char, 0, 0.03, -1.4, V);
  plant(V, -4.0, -0.9, 1.1); plant(V, 4.0, -0.9, 1.1);
  [-1, 1].forEach(s => { for (let k = 0; k < 2; k++) box(0.1, 0.6, 1.4, basic(PAL.glow), s * 4.45, 3.0, -1.6 - k * 2.6, V); });
  pool(V, 0, 0.03, -2.5, 8, 6, 0.25);

  return {
    group: g, vestibule: V,
    update(open) {
      const o = clamp(open); const e = o * o * (3 - 2 * o);
      leaves[0].position.x = -DOOR_W / 4 - e * (DOOR_W / 2 - 0.1); leaves[1].position.x = DOOR_W / 4 + e * (DOOR_W / 2 - 0.1);
    },
  };
}
