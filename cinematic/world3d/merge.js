// Merge static meshes by material so a whole zone costs a handful of draw calls. Owner: Jim.
// Mark anything that animates with userData.keep = true (on the mesh or any ancestor) to leave it alone.
import * as THREE from 'three';
import { mergeGeometries } from '../vendor/BufferGeometryUtils.js';

export function mergeStatic(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), m = new THREE.Matrix4();
  const buckets = new Map(), gone = [];
  root.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || Array.isArray(o.material)) return;
    for (let p = o; p && p !== root; p = p.parent) if (p.userData.keep) return;
    const key = [o.material.uuid, o.castShadow, o.receiveShadow, o.renderOrder].join('|');
    let b = buckets.get(key); if (!b) buckets.set(key, b = { mesh: o, geoms: [] });
    let g = o.geometry.clone(); g.applyMatrix4(m.multiplyMatrices(inv, o.matrixWorld));
    if (g.index) { const n = g.toNonIndexed(); g.dispose(); g = n; }
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    b.geoms.push(g); gone.push(o);
  });
  gone.forEach(o => { o.parent.remove(o); o.geometry.dispose(); });
  buckets.forEach(({ mesh, geoms }) => {
    const merged = new THREE.Mesh(mergeGeometries(geoms, false), mesh.material);
    merged.castShadow = mesh.castShadow; merged.receiveShadow = mesh.receiveShadow; merged.renderOrder = mesh.renderOrder;
    root.add(merged); geoms.forEach(g => g.dispose());
  });
}
