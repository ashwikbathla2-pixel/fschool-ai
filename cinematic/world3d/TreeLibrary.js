// Reusable, deterministic tree geometry for the exterior. Trees are made from a visible branch skeleton
// and separated foliage sprays at branch tips: the silhouette is intentionally irregular, not a canopy blob.
import * as THREE from 'three';
import { mergeGeometries } from '../vendor/BufferGeometryUtils.js';

const cache = new Map();
const UP = new THREE.Vector3(0, 1, 0);
const nonIndexed = geometry => geometry.index ? geometry.toNonIndexed() : geometry;

const SPECIES = {
  rain:       { trunk: 4.9, radius: .25, roots: 6, spread: .94, lift: .36, foliage: [1.05, .72, 1.0], leaf: 1.0 },
  neem:       { trunk: 4.45, radius: .20, roots: 5, spread: .72, lift: .58, foliage: [.78, .88, .7], leaf: .80 },
  ashoka:     { trunk: 5.3, radius: .18, roots: 5, spread: .34, lift: .86, foliage: [.55, 1.18, .48], leaf: .72 },
  ornamental: { trunk: 3.25, radius: .13, roots: 4, spread: .62, lift: .62, foliage: [.52, .64, .5], leaf: .55 },
  dense:      { trunk: 3.9, radius: .16, roots: 5, spread: .74, lift: .55, foliage: [.66, .65, .64], leaf: .62 },
};

function prng(seed) {
  let state = seed >>> 0;
  return () => (((state = Math.imul(state ^ state >>> 15, 1 | state)) ^ (state + Math.imul(state ^ state >>> 7, 61 | state))) >>> 0) / 4294967296;
}

function cylinder(start, end, r0, r1, sides) {
  const delta = end.clone().sub(start);
  const geo = new THREE.CylinderGeometry(r1, r0, delta.length(), sides, 1, false);
  const q = new THREE.Quaternion().setFromUnitVectors(UP, delta.normalize());
  const mid = start.clone().add(end).multiplyScalar(.5);
  geo.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(q));
  geo.translate(mid.x, mid.y, mid.z);
  return nonIndexed(geo);
}

function structure(species, lod) {
  const p = SPECIES[species], random = prng(0x6d2b79f5 ^ species.length * 137 ^ lod * 991);
  const limbs = [], tips = [];
  const maxDepth = lod === 0 ? 2 : lod === 1 ? 1 : 0;
  const sideCount = lod === 0 ? 7 : lod === 1 ? 6 : 5;
  const rootLength = p.trunk * (lod === 0 ? .56 : lod === 1 ? .5 : .42);

  const grow = (start, dir, length, radius, depth, phase) => {
    const end = start.clone().addScaledVector(dir, length);
    limbs.push(cylinder(start, end, radius, radius * .56, sideCount));
    if (depth >= maxDepth) { tips.push({ pos: end, dir: dir.clone(), phase }); return; }
    const children = depth === 0 ? 3 : 2;
    for (let i = 0; i < children; i++) {
      const a = phase + (i / children) * Math.PI * 2 + (random() - .5) * .52;
      const radial = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      const branch = dir.clone().multiplyScalar(.42).add(radial.multiplyScalar(p.spread * (.7 + random() * .34))).addScaledVector(UP, p.lift * (.72 + random() * .3)).normalize();
      grow(end, branch, length * (.49 + random() * .12), radius * .56, depth + 1, a);
    }
  };

  const trunkEnd = new THREE.Vector3((random() - .5) * .14, p.trunk, (random() - .5) * .14);
  limbs.push(cylinder(new THREE.Vector3(), trunkEnd, p.radius, p.radius * .48, sideCount));
  for (let i = 0; i < p.roots; i++) {
    const a = (i / p.roots) * Math.PI * 2 + (random() - .5) * .42;
    const dir = new THREE.Vector3(Math.cos(a) * p.spread, p.lift, Math.sin(a) * p.spread).normalize();
    grow(trunkEnd.clone().addScaledVector(dir, .1), dir, rootLength * (.86 + random() * .24), p.radius * .5, 0, a);
  }
  return { limbs, tips, p, random };
}

function foliageGeometry(species, lod) {
  const { tips, p, random } = structure(species, lod);
  const parts = [], baseDetail = lod === 0 ? 1 : 0;
  const limit = lod === 0 ? tips.length : lod === 1 ? Math.ceil(tips.length * .82) : Math.ceil(tips.length * .7);
  for (let i = 0; i < limit; i++) {
    const tip = tips[i];
    // Two or three separated sprays at the end of a branch. Gaps deliberately reveal trunk and secondary branches.
    const count = lod === 0 && i % 3 === 0 ? 3 : 2;
    for (let j = 0; j < count; j++) {
      const leaf = new THREE.IcosahedronGeometry(p.leaf * (.55 + random() * .36), baseDetail);
      const side = new THREE.Vector3(-tip.dir.z, 0, tip.dir.x).multiplyScalar((j - (count - 1) * .5) * p.leaf * (.62 + random() * .22));
      const ahead = tip.dir.clone().multiplyScalar((random() - .18) * p.leaf * .62);
      leaf.scale(p.foliage[0] * (.78 + random() * .25), p.foliage[1] * (.7 + random() * .35), p.foliage[2] * (.78 + random() * .25));
      leaf.rotateY(random() * Math.PI); leaf.translate(tip.pos.x + side.x + ahead.x, tip.pos.y + side.y + ahead.y + (random() - .34) * p.leaf, tip.pos.z + side.z + ahead.z);
      parts.push(nonIndexed(leaf));
    }
  }
  return mergeGeometries(parts, false);
}

function distantTreeGeometry() {
  const trunk = new THREE.CylinderGeometry(.08, .16, 3.0, 5, 1); trunk.translate(0, 1.5, 0);
  const crownA = new THREE.ConeGeometry(1.2, 3.1, 6, 1); crownA.translate(0, 3.55, 0);
  const crownB = new THREE.ConeGeometry(.86, 2.55, 6, 1); crownB.translate(.12, 4.45, -.08);
  return { trunk: nonIndexed(trunk), foliage: mergeGeometries([nonIndexed(crownA), nonIndexed(crownB)], false) };
}

export function treeGeometry(species, lod) {
  const key = `${species}:${lod}`;
  if (cache.has(key)) return cache.get(key);
  const model = lod === 3 ? distantTreeGeometry() : (() => {
    const s = structure(species, lod);
    return { trunk: mergeGeometries(s.limbs, false), foliage: foliageGeometry(species, lod) };
  })();
  cache.set(key, model);
  return model;
}

export function shrubGeometry() {
  const key = 'shrub';
  if (cache.has(key)) return cache.get(key);
  const random = prng(0x13198a2e), parts = [];
  for (let i = 0; i < 10; i++) {
    const a = i * 2.4 + random(), r = random() * .44;
    const leaf = new THREE.IcosahedronGeometry(.28 + random() * .25, 0);
    leaf.scale(1.1 + random() * .35, .7 + random() * .4, .8 + random() * .35);
    leaf.translate(Math.cos(a) * r, .24 + random() * .5, Math.sin(a) * r); parts.push(nonIndexed(leaf));
  }
  const result = mergeGeometries(parts, false); cache.set(key, result); return result;
}

export const TREE_SPECIES = Object.freeze(['rain', 'neem', 'ashoka', 'ornamental', 'dense']);
