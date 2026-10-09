// Golden-hour hillside campus: terraced board-formed concrete, wide stair flights, bollards, oval pool,
// rows of bare + leafy trees, hedges, wooded hills and distant ridges. Owner: Stanley (Opus).
// Building, entrance doors and vestibule live in Entrance.js. Floor of the school is y = 0, its glass front z = 0; +z is downhill.
import * as THREE from 'three';
import { CAMPUS, applySet, tbox, paint, radial, scallop, glowMat, surface } from './pbr.js';
import { rnd, reseed, bareTreeGeometry, tuftGeometry, hedgeGeometry, instanced } from './Foliage.js';
import { createVegetationSystem } from './VegetationSystem.js';
import { Reflector } from '../vendor/addons/objects/Reflector.js';

// terrace levels (top surfaces) and wall lines
export const T = { L0: 0, L1: -2.6, L2: -5.2, W1: 14.4, W2: 26.4, deckEnd: 62, halfW: 37, stairW: 4 };
const POOL = { x: 0, z: 42, len: 26, wid: 10, y: T.L2 - 0.1 };

// smooth ground height outside the built terraces
function fbm(x, z) { let s = 0, a = 1, f = 0.012; for (let i = 0; i < 4; i++) { s += a * (Math.sin(x * f + i * 1.7) * Math.cos(z * f * 1.3 - i) + Math.sin((x + z) * f * 0.7 + i * 2.1)) * 0.5; a *= 0.5; f *= 2.1; } return s; }
const sstep = (a, b, v) => { const t = Math.min(Math.max((v - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };
export function groundY(x, z) {
  // terraces stepped down the hill, softened at the edges
  let y = T.L0 + (T.L1 - T.L0) * sstep(12, 17, z) + (T.L2 - T.L1) * sstep(24, 29, z);
  y += -Math.max(0, z - T.deckEnd) * 0.16 - Math.max(0, z - 120) * 0.05;   // falls away below the pool deck
  y += Math.min(Math.max(0, -z - 24) * 0.11, 16) + Math.max(0, -z - 120) * 0.04;  // wooded hill rises gently behind the school
  const ax = Math.abs(x);
  y += Math.max(0, ax - 60) * 0.12 * sstep(-40, 20, -z + 20);            // flanks rise a little
  const wild = sstep(38, 50, ax) + sstep(-24, -34, z) + sstep(64, 74, z);
  return y + fbm(x, z) * 3.2 * Math.min(1, wild);
}

export function buildExterior({ quality, renderer, reflect = true, textures = true }) {
  const g = new THREE.Group(); g.name = 'exterior';
  const low = quality.tier === 'low', high = quality.tier === 'high';
  const shadow = !!quality.shadows;
  reseed(7);

  /* ---------- materials ---------- */
  const concrete = surface(quality, CAMPUS.concrete, { roughness: 0.92 });
  const paver = surface(quality, CAMPUS.paver, { roughness: 0.8 });
  if (textures && !low) { applySet(renderer, concrete, 'concrete_layers_02', 1, { normalScale: 1.2 }); applySet(renderer, paver, 'concrete_pavers_02', 1, { normalScale: 0.8 }); }
  const cap = surface(quality, CAMPUS.coping, { roughness: 0.7 });
  const grass = surface(quality, CAMPUS.grass, { roughness: 1 });
  const bronze = surface(quality, CAMPUS.bronze, { roughness: 0.45, metalness: 0.6 });
  const white = surface(quality, 0xece6dc, { roughness: 0.6 });
  const leaf = surface(quality, 0xffffff, { vertexColors: true, roughness: 0.95 });
  const bark = surface(quality, CAMPUS.bark, { vertexColors: true, roughness: 1 });
  const hedgeM = surface(quality, CAMPUS.hedge, { vertexColors: true, roughness: 1 });
  const lampOn = new THREE.MeshBasicMaterial({ color: new THREE.Color(CAMPUS.warm).multiplyScalar(3.2) });
  const S = { cast: shadow, receive: shadow };
  const put = (m, cast, receive) => { m.castShadow = shadow && cast; m.receiveShadow = shadow && receive; return m; };

  /* ---------- terrain (hills, slopes, flanks) ---------- */
  const seg = low ? [50, 44] : high ? [180, 150] : [120, 100];
  const tg = new THREE.PlaneGeometry(560, 520, seg[0], seg[1]); tg.rotateX(-Math.PI / 2); tg.translate(0, 0, -60);
  const tp = tg.attributes.position, tc = new Float32Array(tp.count * 3), cA = new THREE.Color(0x2f4022), cB = new THREE.Color(0x1d2a16), cC = new THREE.Color(0x4f4630), tmp = new THREE.Color();
  for (let i = 0; i < tp.count; i++) {
    const x = tp.getX(i), z = tp.getZ(i);
    const inCampus = Math.abs(x) < T.halfW + 1 && z > -23 && z < T.deckEnd + 1;
    const y = inCampus ? groundY(x, z) - 0.6 : groundY(x, z); tp.setY(i, y);
    const n = 0.5 + 0.5 * Math.sin(x * 0.09 + Math.cos(z * 0.07) * 2);
    tmp.copy(cA).lerp(cB, n).lerp(cC, Math.max(0, 0.35 - Math.abs(fbm(x * 3, z * 3)) * 0.6)); tc.set([tmp.r, tmp.g, tmp.b], i * 3);
  }
  tg.setAttribute('color', new THREE.BufferAttribute(tc, 3)); tg.computeVertexNormals();
  const terrain = put(new THREE.Mesh(tg, surface(quality, 0xffffff, { vertexColors: true, roughness: 1 })), false, true);
  terrain.userData.keep = true; g.add(terrain);

  // distant ridges: two silhouettes that melt into the fog
  (low ? [] : [[-480, 0x5a5674, 34, 6], [-700, 0x6d6688, 60, 14]]).forEach(([z, col, hgt, base]) => {
    const n = 90, pos = [];
    for (let i = 0; i < n; i++) {
      const x0 = -1100 + (i / n) * 2200, x1 = -1100 + ((i + 1) / n) * 2200;
      const h0 = base + hgt * (0.5 + 0.5 * Math.sin(x0 * 0.004 + z) * Math.cos(x0 * 0.0023)) + Math.sin(x0 * 0.03) * 8, h1 = base + hgt * (0.5 + 0.5 * Math.sin(x1 * 0.004 + z) * Math.cos(x1 * 0.0023)) + Math.sin(x1 * 0.03) * 8;
      pos.push(x0, -40, z, x1, -40, z, x1, h1, z, x0, -40, z, x1, h1, z, x0, h0, z);
    }
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const r = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: col, fog: true })); r.userData.keep = true; r.renderOrder = -5; g.add(r);
  });

  /* ---------- terraces ---------- */
  const W = T.halfW, sw = T.stairW;
  // plaza L0 in front of the school
  put(tbox(2 * W + 4, 0.4, T.W1 - 0.4 + 2, paver, 0, T.L0 - 0.2, (T.W1 - 0.4 - 2) / 2, g, 3), false, true);
  // retaining walls with a cap, open where the stairs come through
  const wall = (zFace, top, bottom, gaps) => {
    const h = top - bottom, segs = [];
    let x0 = -W; [...gaps, [W, W]].forEach(([a, b]) => { if (a > x0) segs.push([x0, a]); x0 = b; });
    segs.forEach(([a, b]) => {
      put(tbox(b - a, h, 0.8, concrete, (a + b) / 2, bottom + h / 2, zFace - 0.4, g, 3.2), true, true);
      put(tbox(b - a, 0.12, 0.9, cap, (a + b) / 2, top + 0.06, zFace - 0.42, g, 2), true, true);
    });
  };
  const gaps = [[-33.4, -28.6], [-sw - 0.4, sw + 0.4], [28.6, 33.4]];
  wall(T.W1, T.L0, T.L1, gaps);
  // terrace L1: paved walk + lawn strip at the foot of the wall
  put(tbox(2 * W, 0.4, T.W2 - T.W1, paver, 0, T.L1 - 0.2, (T.W1 + T.W2) / 2 - 0.4, g, 3), false, true);
  [[-W + 1, -sw - 1.2], [sw + 1.2, W - 1]].forEach(([a, b]) => put(tbox(b - a, 0.06, 3.4, grass, (a + b) / 2, T.L1 + 0.03, T.W1 + 1.8, g), false, true));
  wall(T.W2, T.L1, T.L2, gaps);
  // stair flights: central (the camera climbs these) + two side flights per wall
  const stair = (cx, width, zTop, top, bottom) => {
    const n = 15, rise = (top - bottom) / n, run = 0.36;
    for (let i = 0; i < n - 1; i++) { const y = top - (i + 1) * rise, h = y - bottom + 0.4; put(tbox(width, h, run + 0.02, cap, cx, y - h / 2, zTop + i * run + run / 2, g, 1.5), false, true); }
    const len = Math.hypot(n * run, top - bottom), ang = Math.atan2(top - bottom, n * run);
    [-1, 1].forEach(s => { const c = tbox(0.45, 1.2, len + 0.4, concrete, cx + s * (width / 2 + 0.22), (top + bottom) / 2 + 0.25, zTop + n * run / 2, g, 3.2); c.rotation.x = ang; put(c, true, true); });
    return { zEnd: zTop + n * run };
  };
  [[0, 2 * sw], [-31, 4.2], [31, 4.2]].forEach(([cx, w]) => { stair(cx, w, T.W1, T.L0, T.L1); stair(cx, w, T.W2, T.L1, T.L2); });

  // pool deck L2 with an oval (stadium) pool cut out
  const stadium = (len, wid, s = new THREE.Shape()) => { const r = wid / 2, a = len / 2 - r; s.moveTo(-a, -r); s.lineTo(a, -r); s.absarc(a, 0, r, -Math.PI / 2, Math.PI / 2, false); s.lineTo(-a, r); s.absarc(-a, 0, r, Math.PI / 2, Math.PI * 1.5, false); return s; };
  const hole = (len, wid) => { const p = new THREE.Path(); stadium(len, wid, p); return p; };
  const deckShape = new THREE.Shape(); const y0 = T.W2 - 0.4 - POOL.z, y1 = T.deckEnd - POOL.z; deckShape.moveTo(-W, y0); deckShape.lineTo(W, y0); deckShape.lineTo(W, y1); deckShape.lineTo(-W, y1); deckShape.closePath();
  deckShape.holes.push(hole(POOL.len + 1.4, POOL.wid + 1.4));
  const slab = (shape, depth, m, y, tile) => {
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 20 });
    const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / tile, uv.getY(i) / tile);
    geo.rotateX(Math.PI / 2); const mesh = new THREE.Mesh(geo, m); mesh.position.set(POOL.x, y, POOL.z); g.add(mesh); return put(mesh, false, true);
  };
  slab(deckShape, 0.5, paver, T.L2, 3);
  const copeShape = stadium(POOL.len + 1.4, POOL.wid + 1.4); copeShape.holes.push(hole(POOL.len, POOL.wid));
  slab(copeShape, 0.3, cap, T.L2 + 0.04, 1.5);
  const basin = stadium(POOL.len, POOL.wid); if (!low) slab(basin, 0.2, surface(quality, 0x7fd6dc, { roughness: 0.3 }), POOL.y - 1.4, 3); // basin floor seen at grazing angles

  put(tbox(2 * W - 2, 0.06, 6, grass, 0, T.L2 + 0.03, T.deckEnd - 4.6, g), false, true);
  // water: mirror + pool colour (high), PMREM reflections (mid), flat lit colour (low)
  const wgeo = new THREE.ShapeGeometry(stadium(POOL.len, POOL.wid), 24); // XY plane; the mesh is rotated (Reflector reads its normal from the object)
  let water, waterU = null;
  if (high && reflect && renderer?.isWebGLRenderer) {
    water = new Reflector(wgeo, { textureWidth: 512, textureHeight: 512, clipBias: 0.003, shader: waterShader() });
    waterU = water.material.uniforms;
  } else {
    water = new THREE.Mesh(wgeo, low ? new THREE.MeshLambertMaterial({ color: 0x2aa9b5, emissive: 0x0d5c66 })
      : new THREE.MeshStandardMaterial({ color: 0x1f9fae, emissive: 0x14808c, roughness: 0.04, metalness: 0, envMapIntensity: 1.4 }));
  }
  water.position.set(POOL.x, POOL.y, POOL.z); water.rotation.x = -Math.PI / 2; water.userData.keep = true; g.add(water);
  // pool lights: glow under the water
  const pl = new THREE.Mesh(new THREE.PlaneGeometry(POOL.len * 1.1, POOL.wid * 1.6), glowMat(radial(), 0x2fd3e0, low ? 0.35 : 0.25)); pl.rotation.x = -Math.PI / 2; pl.position.set(POOL.x, POOL.y + 0.02, POOL.z); g.add(pl);

  // loungers along the far side of the pool
  for (let i = 0; i < (low ? 4 : 8); i++) {
    const x = -12.6 + i * 3.6, z = POOL.z + POOL.wid / 2 + 2.6;
    put(tbox(0.8, 0.12, 2.0, white, x, T.L2 + 0.38, z, g), true, false); put(tbox(0.8, 0.1, 0.8, white, x, T.L2 + 0.75, z - 1.05, g), true, false);
    put(tbox(0.06, 0.32, 1.8, bronze, x - 0.36, T.L2 + 0.16, z, g), true, false); put(tbox(0.06, 0.32, 1.8, bronze, x + 0.36, T.L2 + 0.16, z, g), true, false);
  }

  /* ---------- lights you can see: bollards, wall washers, step lights ---------- */
  const bollards = [], washes = [], pools = [];
  const rowB = (z, y, xs) => xs.forEach(x => { bollards.push({ x, y, z }); pools.push({ x, y: y + 0.02, z, s: 2.6 }); });
  const xsRow = (from, to, step, skip) => { const a = []; for (let x = from; x <= to + 1e-3; x += step) if (!skip(x)) a.push(x); return a; };
  const notStairs = x => Math.abs(x) < sw + 1.2 || Math.abs(Math.abs(x) - 31) < 3;
  rowB(T.W1 - 0.9, T.L0, xsRow(-W + 2, W - 2, 4.2, notStairs));
  rowB(T.W2 - 0.9, T.L1, xsRow(-W + 2, W - 2, 4.2, notStairs));
  rowB(POOL.z - POOL.wid / 2 - 3.2, T.L2, xsRow(-24, 24, 6, x => Math.abs(x) < 3));
  // uplights at the foot of each wall, throwing scallops up the board-formed concrete
  [[T.W1, T.L1, T.L0], [T.W2, T.L2, T.L1]].forEach(([zf, bottom, top]) => xsRow(-W + 3, W - 3, 4.2, notStairs).forEach(x => washes.push({ x, z: zf + 0.012, y: bottom, h: top - bottom })));
  if (!low) {
    const bGeo = new THREE.CylinderGeometry(0.07, 0.08, 0.75, 8); bGeo.translate(0, 0.375, 0);
    g.add(instanced(bGeo, bronze, bollards, { cast: false }));
    const hGeo = new THREE.CylinderGeometry(0.075, 0.075, 0.08, 8); hGeo.translate(0, 0.7, 0);
    g.add(instanced(hGeo, lampOn, bollards));
  } else {
    const hGeo = new THREE.BoxGeometry(0.16, 0.8, 0.16); hGeo.translate(0, 0.4, 0); g.add(instanced(hGeo, lampOn, bollards));
  }
  const poolGeo = new THREE.PlaneGeometry(1, 1); poolGeo.rotateX(-Math.PI / 2);
  g.add(instanced(poolGeo, glowMat(radial(), 0xffb36b, 0.55), pools.map(p => ({ ...p, ry: 0 }))));
  const washGeo = new THREE.PlaneGeometry(1, 1); washGeo.translate(0, 0.5, 0);
  if (!low) g.add(instanced(washGeo, glowMat(scallop(), 0xffb065, 0.9), washes.map(w => ({ x: w.x, y: w.y, z: w.z, sx: 2.4, sy: w.h, sz: 1, ry: 0 }))));
  // step lights in the central stair cheeks
  const steps = []; for (const [zTop, top] of [[T.W1, T.L0], [T.W2, T.L1]]) for (let i = 1; i < 14; i += 3) [-1, 1].forEach(s => steps.push({ x: s * (sw - 0.05), y: top - (i + 1) * 0.1733 + 0.12, z: zTop + i * 0.36 + 0.2, ry: 0 }));
  if (!low) g.add(instanced(new THREE.BoxGeometry(0.1, 0.06, 0.24), lampOn, steps));

  /* ---------- the FSCHOOLAI sign: halo-lit bronze letters on the lower wall, beside the main stair ---------- */
  const signTex = paint(2048, 256, (c, w, h) => {
    c.clearRect(0, 0, w, h); c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '300 150px Fraunces, Georgia, serif';
    c.shadowColor = 'rgba(255,190,120,0.95)'; c.shadowBlur = 38; c.fillStyle = 'rgba(255,214,160,1)';
    const txt = 'F S C H O O L A I'; c.fillText(txt, w / 2, h / 2 + 6); c.fillText(txt, w / 2, h / 2 + 6);
    c.shadowBlur = 0; c.fillStyle = '#3a2b20'; c.fillText(txt, w / 2, h / 2 + 2);
  });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(14, 1.75), new THREE.MeshBasicMaterial({ map: signTex, transparent: true, depthWrite: false, color: new THREE.Color(1.6, 1.45, 1.3) }));
  sign.position.set(-14.5, T.L2 + 1.45, T.W2 + 0.03); sign.renderOrder = 3; sign.userData.keep = true; g.add(sign);
  const logoTex = new THREE.TextureLoader().load(new URL('../poster/logo.jpeg', import.meta.url).href); logoTex.colorSpace = THREE.NoColorSpace;
  const logoMat = new THREE.MeshBasicMaterial({ color: 0xffffff, alphaMap: logoTex, transparent: true, depthWrite: false, toneMapped: false, fog: false });
  const signLogo = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.9), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.7, 1.35, 1.0), alphaMap: logoTex, transparent: true, depthWrite: false }));
  signLogo.position.set(-23.2, T.L2 + 1.45, T.W2 + 0.04); signLogo.userData.keep = true; if (!low) g.add(signLogo);

  /* ---------- foliage ---------- */
  // Dedicated vegetation system: deterministic zones use branch-and-spray trees near the school and simpler LOD silhouettes in the hills.
  const vegetation = createVegetationSystem({ quality, groundY, shadows: shadow });
  g.add(vegetation.group);
  // bare ornamental trees in planters along the plaza and the middle terrace (the rows in the photos)
  const bare = [];
  xsRow(-28, 28, 5.6, x => Math.abs(x) < sw + 1).forEach(x => bare.push({ x, y: T.L0, z: T.W1 - 2.2, s: 1.15 + rnd() * 0.2 }));
  if (!low) xsRow(-26, 26, 8.6, x => Math.abs(x) < sw + 2).forEach(x => bare.push({ x: x + 1.4, y: T.L1, z: T.W1 + 1.6, s: 0.95 + rnd() * 0.2 }));
  g.add(instanced(bareTreeGeometry(), bark, bare, { cast: shadow, tints: [0x8a6a55, 0x7a5c48] }));
  if (!low) g.add(instanced(tuftGeometry(), leaf, bare, { tints: [0xa8622e, 0x9a4f2a, 0xb98a3a, 0x7c6a2c] }));
  // uplight + planter at each bare tree
  bare.forEach(b => { put(tbox(1.4, 0.45, 1.4, cap, b.x, b.y + 0.22, b.z, g), true, true); });
  if (!low) g.add(instanced(poolGeo, glowMat(radial(), 0xffa257, 0.7), bare.map(b => ({ x: b.x, y: b.y + 0.46, z: b.z, s: 2.2, ry: 0 }))));
  // hedges: along the deck edge, the middle terrace wall foot, and the plaza flanks
  const hedges = [];
  for (let x = -W + 1; x < W; x += 3.1) hedges.push({ x, y: T.L2, z: T.deckEnd - 0.8, sx: 3.2, sy: 1.25 + rnd() * 0.1, sz: 1.4, ry: 0 });
  for (let x = -W + 1; x < W; x += 3.1) if (!notStairs(x)) hedges.push({ x, y: T.L1, z: T.W2 - 2.1, sx: 3.0, sy: 0.85, sz: 1.0, ry: 0 });
  [-1, 1].forEach(sd => { for (let z = 1; z < 12; z += 2.6) hedges.push({ x: sd * (W - 1.2), y: T.L0, z, sx: 2.2, sy: 1.1, sz: 2.7, ry: 0 }); });
  g.add(instanced(hedgeGeometry(), hedgeM, hedges, { cast: shadow, receive: false, tints: [0xffffff, 0xe6f0d8, 0xd8e4c8] }));

  /* ---------- low haze in the valley, strongest in the opening aerial ---------- */
  const mist = [];
  const mistMat = new THREE.MeshBasicMaterial({ map: radial(), color: 0xf3b9a0, transparent: true, opacity: 0, depthWrite: false, fog: false });
  for (let i = 0; i < (low ? 0 : 7); i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(120, 18), mistMat.clone());
    m.position.set((i - 3) * 30 + rnd() * 10, -10 + rnd() * 6, 80 + i * 9); m.userData = { keep: true, x: m.position.x, ph: i * 1.3 }; g.add(m); mist.push(m);
  }

  return {
    group: g, logoMat, water, groundY, vegetation: vegetation.stats,
    update(t, haze, cam) {
      if (waterU) waterU.uTime.value = t;
      vegetation.update(t);
      for (const m of mist) { m.material.opacity = 0.32 * haze * (0.7 + 0.3 * Math.sin(t * 0.2 + m.userData.ph)); m.visible = haze > 0.01; m.position.x = m.userData.x + Math.sin(t * 0.05 + m.userData.ph) * 6; m.lookAt(cam.x, m.position.y, cam.z); }
    },
  };
}

// Pool water for Reflector: turquoise pool colour lit from below + rippled mirror reflection weighted by fresnel.
function waterShader() {
  return {
    name: 'PoolWater',
    uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null }, uTime: { value: 0 } },
    vertexShader: /* glsl */`
      uniform mat4 textureMatrix; varying vec4 vUv; varying vec3 vWorld;
      #include <common>
      #include <logdepthbuf_pars_vertex>
      void main() { vUv = textureMatrix * vec4(position, 1.0); vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D tDiffuse; uniform float uTime; varying vec4 vUv; varying vec3 vWorld;
      #include <logdepthbuf_pars_fragment>
      float wv(vec2 p) { return sin(p.x * 1.7 + uTime * 0.9) * 0.5 + sin(p.y * 2.3 - uTime * 0.7) * 0.5 + sin((p.x + p.y) * 3.1 + uTime * 1.3) * 0.25; }
      void main() {
        #include <logdepthbuf_fragment>
        vec2 p = vWorld.xz; float e = 0.05;
        vec3 n = normalize(vec3(wv(p + vec2(e, 0.0)) - wv(p - vec2(e, 0.0)), 6.0, wv(p + vec2(0.0, e)) - wv(p - vec2(0.0, e))));
        vec3 v = normalize(cameraPosition - vWorld);
        float fres = 0.03 + 0.97 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
        vec4 uv = vUv; uv.xy += n.xz * 0.6 * uv.w * 0.05;
        vec3 refl = texture2DProj(tDiffuse, uv).rgb;
        float c = pow(0.5 + 0.5 * sin(p.x * 3.0 + wv(p * 1.3) * 2.0) * sin(p.y * 3.4 - uTime * 0.6), 6.0);
        vec3 pool = vec3(0.03, 0.42, 0.50) * (1.0 + 0.6 * c) + vec3(0.02, 0.10, 0.12);
        gl_FragColor = vec4(mix(pool, refl, clamp(fres * 1.1 + 0.1, 0.0, 0.85)), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  };
}
