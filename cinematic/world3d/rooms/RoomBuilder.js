// Stylized low-poly room shell + prop helpers. Procedural only (no assets). Owner: Phyllis.
import * as THREE from 'three';
import { mergeGeometries } from '../../vendor/addons/utils/BufferGeometryUtils.js';

const matCache = new Map();
export function mat(color, opts = {}) {
  const k = color + JSON.stringify(opts);
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial({ color, roughness: .85, metalness: 0, flatShading: true, ...opts }));
  return matCache.get(k);
}
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 14);
const sphGeo = new THREE.SphereGeometry(1, 14, 10);

export const PAL = { cream: '#f6efe3', paper: '#fbf7ef', wood: '#b88a5b', woodDark: '#8e6a43', navy: '#1f3350', ink: '#26231f', slate: '#5d6b7e', sage: '#8fae8b', clay: '#d9826b', sky: '#9cc3dc', gold: '#e3b559', white: '#ffffff' };

export function box(w, h, d, color, x = 0, y = 0, z = 0, parent) {
  const m = new THREE.Mesh(boxGeo, mat(color)); m.scale.set(w, h, d); m.position.set(x, y + h / 2, z); m.castShadow = m.receiveShadow = true; parent?.add(m); return m;
}
export function cyl(r, h, color, x = 0, y = 0, z = 0, parent, rb) {
  const m = new THREE.Mesh(cylGeo, mat(color)); m.scale.set(r, h, rb ?? r); m.position.set(x, y + h / 2, z); m.castShadow = true; parent?.add(m); return m;
}
export function ball(r, color, x = 0, y = 0, z = 0, parent, opts) {
  const m = new THREE.Mesh(sphGeo, mat(color, opts)); m.scale.setScalar(r); m.position.set(x, y, z); m.castShadow = true; parent?.add(m); return m;
}

// Room shell: open at the front (+z) like a dollhouse cell. Size 4 x 3 x 4, origin at floor center.
export function shell({ wall = PAL.cream, floor = PAL.wood, trim = PAL.navy, w = 4, h = 3, d = 4 } = {}) {
  const g = new THREE.Group();
  box(w, .12, d, floor, 0, -.12, 0, g);
  box(w, h, .12, wall, 0, 0, -d / 2 + .06, g);
  box(.12, h, d, shade(wall, -.04), -w / 2 + .06, 0, 0, g);
  box(.12, h, d, shade(wall, -.04), w / 2 - .06, 0, 0, g);
  box(w, .1, d, shade(wall, .03), 0, h, 0, g);                 // ceiling slab
  box(w - .24, .08, .1, trim, 0, 0, -d / 2 + .16, g);          // skirting
  return g;
}
function shade(hex, a) { const c = new THREE.Color(hex); c.offsetHSL(0, 0, a); return '#' + c.getHexString(); }

/* ---------- props ---------- */
export function desk(g, x, z, { w = 1.5, color = PAL.wood } = {}) {
  box(w, .08, .75, color, x, .72, z, g);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => box(.07, .72, .07, PAL.woodDark, x + a * (w / 2 - .08), 0, z + b * .3, g));
}
export function monitor(g, x, y, z, { screen = PAL.navy, glow = PAL.sky, ry = 0 } = {}) {
  const m = new THREE.Group(); m.position.set(x, y, z); m.rotation.y = ry; g.add(m);
  box(.7, .45, .05, PAL.ink, 0, .12, 0, m);
  box(.62, .37, .02, screen, 0, .16, .03, m);
  box(.4, .04, .01, glow, -.05, .35, .05, m); box(.28, .04, .01, glow, -.11, .27, .05, m);
  cyl(.04, .1, PAL.ink, 0, 0, 0, m); box(.3, .02, .18, PAL.ink, 0, 0, 0, m);
  return m;
}
export function chair(g, x, z, color = PAL.clay, ry = 0) {
  const c = new THREE.Group(); c.position.set(x, 0, z); c.rotation.y = ry; g.add(c);
  box(.5, .08, .5, color, 0, .42, 0, c); box(.5, .5, .07, color, 0, .5, -.22, c); cyl(.04, .42, PAL.ink, 0, 0, 0, c);
  return c;
}
export function plant(g, x, z, s = 1) {
  cyl(.2 * s, .35 * s, PAL.clay, x, 0, z, g); ball(.32 * s, PAL.sage, x, .65 * s, z, g); ball(.22 * s, '#6f9a74', x + .12 * s, .85 * s, z, g);
}
export function easel(g, x, z, art = PAL.clay) {
  const e = new THREE.Group(); e.position.set(x, 0, z); g.add(e);
  [-.3, .3].forEach(a => { const l = box(.05, 1.5, .05, PAL.woodDark, a, 0, 0, e); l.rotation.z = -a * .12; });
  box(.05, 1.3, .05, PAL.woodDark, 0, 0, -.3, e).rotation.x = .25;
  box(.8, .6, .04, PAL.paper, 0, .8, .08, e); ball(.17, art, -.12, 1.1, .12, e).scale.z = .12; ball(.11, PAL.gold, .15, 1.0, .12, e).scale.z = .12;
}
export function shelf(g, x, y, z, w = 1.6, colors = [PAL.clay, PAL.sky, PAL.gold, PAL.sage]) {
  box(w, .06, .3, PAL.wood, x, y, z, g);
  let cx = x - w / 2 + .15, i = 0;
  while (cx < x + w / 2 - .12) { const bw = .1 + (i % 3) * .04, bh = .28 + (i % 2) * .1; box(bw, bh, .22, colors[i % colors.length], cx, y + .06, z, g); cx += bw + .03; i++; }
}
export function poster(g, x, y, z, w, h, draw, ry = 0) {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = Math.round(128 * h / w);
  const c = cv.getContext('2d'); c.fillStyle = PAL.paper; c.fillRect(0, 0, cv.width, cv.height); draw(c, cv.width, cv.height);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex })); m.position.set(x, y, z); m.rotation.y = ry; g.add(m);
  return m;
}
export function rug(g, x, z, rx, rz, color) { const m = cyl(1, .02, color, x, 0, z, g); m.scale.set(rx, .02, rz); m.castShadow = false; }
export function lamp(g, x, z, color = PAL.gold) { cyl(.03, 1.2, PAL.ink, x, 0, z, g); cyl(.2, .22, color, x, 1.15, z, g, .2).material = mat(color, { emissive: color, emissiveIntensity: .45 }); }

// Merge static, untextured meshes of a group into one mesh per material (cuts draw calls ~10x). Posters/textured meshes stay separate.
const vcMat = new THREE.MeshStandardMaterial({ roughness: .85, metalness: 0, flatShading: true, vertexColors: true });
export function mergeStatic(root, keep = () => false) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map(), dead = [];
  root.traverse(o => {
    if (!o.isMesh || o.material.map || o.material.transparent || keep(o)) return;
    const g = o.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    const plain = o.material.emissiveIntensity === 0 || !o.material.emissive || o.material.emissive.getHex() === 0;
    const key = plain ? vcMat : o.material;
    if (plain) { const c = o.material.color, n = g.attributes.position.count, col = new Float32Array(n * 3); for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(col, 3)); }
    else g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3));
    (buckets.get(key) || buckets.set(key, []).get(key)).push(g); dead.push(o);
  });
  dead.forEach(o => o.removeFromParent());
  for (const [material, geos] of buckets) {
    const m = new THREE.Mesh(mergeGeometries(geos, false), material); m.castShadow = m.receiveShadow = true; m.userData.merged = true; root.add(m);
    geos.forEach(g => g.dispose());
  }
}
