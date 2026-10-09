// Shared palette, cached materials and small mesh helpers for the 3D world. Owner: Jim.
import * as THREE from 'three';

export const PAL = {
  cream: 0xf4ecdf, cream2: 0xe9dccb, stone: 0xe4d9c8, charcoal: 0x1f1d1b, navy: 0x1f2d4a, navy2: 0x34476b,
  wood: 0x9a6b3f, woodLight: 0xc9a064, woodDark: 0x6e4a2b, sage: 0x7d9a6a, sageDark: 0x5c7a52, pot: 0xf0ebe3,
  peach: 0xf3cfa8, glass: 0x9fb4c4, glow: 0xffe6bf, skin: 0xe9bb9d, hair: 0x3a2822, blazer: 0x2a3042, rose: 0xd98e84,
};

const cache = new Map();
export const mat = (color, o) => {
  if (o) return new THREE.MeshLambertMaterial({ color, ...o });
  if (!cache.has(color)) cache.set(color, new THREE.MeshLambertMaterial({ color }));
  return cache.get(color);
};
const bcache = new Map();
export const basic = (color, o) => {
  if (o) return new THREE.MeshBasicMaterial({ color, ...o });
  if (!bcache.has(color)) bcache.set(color, new THREE.MeshBasicMaterial({ color }));
  return bcache.get(color);
};
const dcache = new Map();
const decal = (key, mk) => { if (!dcache.has(key)) dcache.set(key, mk()); return dcache.get(key); };

export function box(w, h, d, m, x, y, z, parent, shadow) {
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  b.position.set(x, y, z);
  if (shadow) { b.castShadow = shadow.cast !== false; b.receiveShadow = shadow.receive !== false; }
  parent?.add(b); return b;
}
export function plane(w, h, m, x, y, z, parent, ry = 0, rx = 0) {
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
  p.position.set(x, y, z); p.rotation.set(rx, ry, 0); parent?.add(p); return p;
}
export function canvasTex(w, h, draw, { repeat, anisotropy = 4 } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = anisotropy;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
const radialCache = {};
export function radialTex(inner = 'rgba(0,0,0,.5)', outer = 'rgba(0,0,0,0)') {
  const k = inner + outer; if (radialCache[k]) return radialCache[k];
  return radialCache[k] = canvasTex(128, 128, (g, w, h) => {
    const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    r.addColorStop(0, inner); r.addColorStop(1, outer); g.fillStyle = r; g.fillRect(0, 0, w, h);
  });
}
// soft contact shadow on the ground
export function blob(parent, x, z, rx, rz, opacity = 0.35, y = 0.02) {
  opacity = Math.round(opacity * 10) / 10;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(rx * 2, rz * 2), decal('b' + opacity, () => new THREE.MeshBasicMaterial({ map: radialTex(), transparent: true, opacity, depthWrite: false })));
  m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.renderOrder = 1; parent.add(m); return m;
}
// warm pool of light painted on a surface (additive, no real light cost)
export function pool(parent, x, y, z, w, d, opacity = 0.3, rx = -Math.PI / 2, color = 'rgba(255,224,180,') {
  opacity = Math.round(opacity * 10) / 10;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), decal('p' + opacity + color, () => new THREE.MeshBasicMaterial({ map: radialTex(color + '1)', color + '0)'), transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending })));
  m.rotation.x = rx; m.position.set(x, y, z); m.renderOrder = 2; parent.add(m); return m;
}
// low-poly plant: pot + a few faceted leaf blobs
export function plant(parent, x, z, s = 1, shadow) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s);
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.25, 0.55, 10), mat(PAL.pot)); pot.position.y = 0.275; g.add(pot);
  const leaf = mat(PAL.sage), dark = mat(PAL.sageDark);
  [[0, 1.0, 0, 0.42], [0.18, 1.35, 0.05, 0.3], [-0.2, 1.25, -0.08, 0.32], [0.05, 1.65, -0.05, 0.24]].forEach(([px, py, pz, r], i) => {
    const l = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), i % 2 ? dark : leaf); l.position.set(px, py, pz); if (shadow) l.castShadow = true; g.add(l);
  });
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.8, 5), mat(PAL.woodDark)); stem.position.y = 0.8; g.add(stem);
  if (shadow) pot.castShadow = true;
  parent.add(g); blob(parent, x, z, 0.55 * s, 0.55 * s, 0.28); return g;
}
export const clamp = (v, a = 0, b = 1) => Math.min(Math.max(v, a), b);
export const smooth = t => t * t * (3 - 2 * t);
export const lerp = (a, b, t) => a + (b - a) * t;
