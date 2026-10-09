// Instanced foliage for the campus: leafy oaks, bare ornamental trees, clipped hedges. Owner: Stanley (Opus).
// Each kind is one geometry drawn with one InstancedMesh, so a hillside of trees costs a couple of draw calls.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from '../vendor/BufferGeometryUtils.js';

let seed = 11;
export const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
export const reseed = s => { seed = s; };

// lumpy blob: icosahedron with its vertices pushed in/out, darker underneath (vertex colour = cheap AO)
function lump(r, detail, jit) {
  const g = new THREE.IcosahedronGeometry(r, detail), p = g.attributes.position, v = new THREE.Vector3();
  const key = new Map();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); const k = v.toArray().map(a => a.toFixed(3)).join();
    if (!key.has(k)) key.set(k, 1 + (rnd() - 0.5) * jit);
    v.multiplyScalar(key.get(k)); p.setXYZ(i, v.x, v.y, v.z);
  }
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  const m = mergeVertices(g); m.computeVertexNormals(); return m; // welded -> smooth, rounded crowns
}
function shade(g, y0, y1, lo = 0.45, hi = 1.05) {
  const p = g.attributes.position, c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const t = THREE.MathUtils.clamp((p.getY(i) - y0) / (y1 - y0), 0, 1), s = lo + (hi - lo) * t; c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = s; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g;
}

// Leafy canopy (unit tree ~6 m tall), crown only; trunk separate.
export function canopyGeometry(detail = 1, blobs = 6) {
  const parts = [];
  for (let i = 0; i < blobs; i++) {
    const a = (i / blobs) * Math.PI * 2 + rnd(), rr = i === 0 ? 0 : 0.9 + rnd() * 0.5;
    const g = lump(1.1 + rnd() * 0.6, detail, 0.35);
    g.translate(Math.cos(a) * rr, 3.8 + (i === 0 ? 1.0 : rnd() * 1.1), Math.sin(a) * rr);
    parts.push(g.toNonIndexed());
  }
  return shade(mergeGeometries(parts), 2.4, 6.2);
}
export function trunkGeometry() {
  const g = new THREE.CylinderGeometry(0.13, 0.24, 3.6, 6, 1); g.translate(0, 1.8, 0);
  return shade(g.toNonIndexed(), 0, 3.6, 0.6, 1);
}
// Bare ornamental tree (the rows of leafless trees along the terraces): recursive tapered branches.
export function bareTreeGeometry() {
  const parts = [], up = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion(), m = new THREE.Matrix4();
  const branch = (start, dir, len, rad, depth) => {
    const g = new THREE.CylinderGeometry(rad * 0.62, rad, len, depth > 2 ? 5 : 4, 1); g.translate(0, len / 2, 0);
    q.setFromUnitVectors(up, dir); m.compose(start, q, new THREE.Vector3(1, 1, 1)); g.applyMatrix4(m); parts.push(g.toNonIndexed());
    if (depth <= 0) return;
    const end = start.clone().addScaledVector(dir, len), kids = depth > 2 ? 2 : 3;
    for (let k = 0; k < kids; k++) {
      const a = rnd() * Math.PI * 2, spread = 0.35 + rnd() * 0.45;
      const nd = dir.clone().add(new THREE.Vector3(Math.cos(a) * spread, 0.25 + rnd() * 0.3, Math.sin(a) * spread)).normalize();
      branch(end, nd, len * (0.62 + rnd() * 0.18), rad * 0.62, depth - 1);
    }
  };
  branch(new THREE.Vector3(), up.clone(), 1.7, 0.11, 4);
  return shade(mergeGeometries(parts), 0, 5, 0.55, 1.15);
}
// Sparse warm leaf tufts that sit on the bare trees (late-autumn colour from the photos).
export function tuftGeometry() {
  const parts = [];
  for (let i = 0; i < 7; i++) { const g = lump(0.16 + rnd() * 0.14, 0, 0.5); const a = rnd() * 6.28, r = 0.5 + rnd() * 1.2; g.translate(Math.cos(a) * r, 2.9 + rnd() * 1.8, Math.sin(a) * r); parts.push(g.toNonIndexed()); }
  return shade(mergeGeometries(parts), 2.5, 5, 0.7, 1.1);
}
// Clipped hedge block, unit 1 x 1 x 1 (scaled per instance), slightly lumpy top.
export function hedgeGeometry() {
  const g = new THREE.BoxGeometry(1, 1, 1, 6, 2, 2), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y > 0.4) p.setY(i, y + (rnd() - 0.5) * 0.12); p.setX(i, p.getX(i) * (1 + (rnd() - 0.5) * 0.04)); }
  g.translate(0, 0.5, 0); g.computeVertexNormals(); return shade(g.toNonIndexed(), 0, 1, 0.55, 1.05);
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler(), _c = new THREE.Color();
// items: [{x,y,z, s (uniform) | sx,sy,sz, ry, tint}]
export function instanced(geom, material, items, { cast = false, receive = false, tints } = {}) {
  const im = new THREE.InstancedMesh(geom, material, items.length);
  items.forEach((it, i) => {
    _e.set(0, it.ry ?? rnd() * Math.PI * 2, 0); _q.setFromEuler(_e);
    _s.set(it.sx ?? it.s ?? 1, it.sy ?? it.s ?? 1, it.sz ?? it.s ?? 1); _p.set(it.x, it.y ?? 0, it.z);
    im.setMatrixAt(i, _m.compose(_p, _q, _s));
    if (tints) im.setColorAt(i, _c.set(tints[Math.floor(rnd() * tints.length)]).multiplyScalar(0.85 + rnd() * 0.3));
  });
  im.castShadow = cast; im.receiveShadow = receive; im.userData.keep = true; im.computeBoundingSphere();
  return im;
}
