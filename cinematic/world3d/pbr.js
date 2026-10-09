// PBR helpers for the golden-hour campus: KTX2 texture sets, world-scaled UV boxes, shared campus materials. Owner: Stanley (Opus).
import * as THREE from 'three';
import { KTX2Loader } from '../vendor/addons/loaders/KTX2Loader.js';

const TEX = new URL('./textures/', import.meta.url).href;
let ktx2 = null;
export function ktx2Loader(renderer) {
  if (!ktx2) {
    ktx2 = new KTX2Loader().setTranscoderPath(new URL('../vendor/addons/libs/basis/', import.meta.url).href);
    if (renderer?.isWebGLRenderer || renderer?.isWebGPURenderer) ktx2.detectSupport(renderer);
  }
  return ktx2;
}

// Poly Haven set (diff/nor_gl/arm) -> filled into the given standard material when it arrives; the flat colour shows until then.
export function applySet(renderer, m, name, repeat = 1, { normalScale = 1, aniso = 8 } = {}) {
  const loader = ktx2Loader(renderer);
  const set = (key, file, after) => loader.load(TEX + file, t => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); t.anisotropy = aniso;
    after?.(t); m[key] = t; m.needsUpdate = true;
  }, undefined, err => console.warn('[world] texture unavailable', file, err?.message || err));
  set('map', `${name}_diff.ktx2`, t => { t.colorSpace = THREE.SRGBColorSpace; });
  set('normalMap', `${name}_nor_gl.ktx2`, () => m.normalScale.set(normalScale, normalScale));
  set('roughnessMap', `${name}_arm.ktx2`, t => { m.aoMap = t; m.aoMapIntensity = 0.7; });
  return m;
}

// Box whose UVs are in metres / tile, so one texture reads at real scale on any size of wall once merged.
export function tbox(w, h, d, m, x, y, z, parent, tile = 3) {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]; // px nx py ny pz nz
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * dims[f][0] / tile, uv.getY(k) * dims[f][1] / tile); }
  const b = new THREE.Mesh(g, m); b.position.set(x, y, z); parent?.add(b); return b;
}

// Canvas texture painted once.
export function paint(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
let _radial = null;
export const radial = () => _radial || (_radial = paint(128, 128, (g, w, h) => {
  const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,.45)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, w, h);
}));
// The light scallop an uplight throws on a wall (bright at the base, fading up and out).
let _scallop = null;
export const scallop = () => _scallop || (_scallop = paint(128, 256, (g, w, h) => {
  const img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = (x / w - 0.5) * 2, v = 1 - y / h; // v: 0 bottom .. 1 top
    const cone = Math.max(0, 1 - Math.abs(u) / (0.25 + v * 0.75));
    const a = Math.pow(cone, 1.6) * Math.pow(1 - v, 1.3) * (0.55 + 0.45 * Math.exp(-v * 9));
    const i = (y * w + x) * 4; img.data[i] = 255; img.data[i + 1] = 255; img.data[i + 2] = 255; img.data[i + 3] = Math.min(255, a * 255);
  }
  g.putImageData(img, 0, 0);
}));

// Additive light decal (no real light cost). color in linear-ish 0..n, opacity scales it.
const decals = new Map();
export function glowMat(tex, color, opacity = 1) {
  const k = tex.uuid + color + opacity;
  if (!decals.has(k)) decals.set(k, new THREE.MeshBasicMaterial({ map: tex, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: true, polygonOffset: true, polygonOffsetFactor: -2 }));
  return decals.get(k);
}

// Campus palette (golden hour, warm concrete, bronze, deep greens).
export const CAMPUS = {
  concrete: 0xcdc3b6, concreteDark: 0x9c9388, paver: 0xd8cbb8, coping: 0xe6dccd, bronze: 0x2b241f, fascia: 0x221d1a,
  soffit: 0x8a5f3c, plaster: 0xb9ad9f, stone: 0x8f8072, grass: 0x4f6b35, hedge: 0x2f4a24, leaf: 0x3e5a2c, leafWarm: 0x6f7a34,
  bark: 0x4a3a2e, water: 0x2bb3c0, warm: 0xffc27a, glow: 0xffd6a0,
};

// Standard (or Lambert on the low tier) material.
export function surface(quality, color, o = {}) {
  if (quality.tier === 'low' || quality.lite) {
    const { roughness, metalness, envMapIntensity, ...rest } = o; return new THREE.MeshLambertMaterial({ color, ...rest });
  }
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...o });
}
