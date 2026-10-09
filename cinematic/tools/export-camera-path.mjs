// Samples the live camera rig (world3d/CameraRig.js) once per plate frame, so an Unreal camera can follow the exact same path.
// Run:  node --no-warnings --experimental-loader ./tools/three-loader.mjs tools/export-camera-path.mjs [frames=240] [fov=42]
// three's fov is vertical; the CSV carries the equivalent horizontal fov for a 16:9 Unreal camera.
// Writes plates/mansion/camera-path.json (three.js coordinates, metres) and camera-path-unreal.csv (Unreal cm, Z-up).
import { writeFileSync, readFileSync } from 'node:fs';
import { sampleRig } from '../world3d/CameraRig.js';
import * as THREE from 'three';
import Welcome from '../scenes/Welcome.js';
import Entrance from '../scenes/SchoolEntrance.js';

const frames = +process.argv[2] || 240, fov = +process.argv[3] || 42;
const man = JSON.parse(readFileSync(new URL('../plates/mansion/manifest.json', import.meta.url)));
const scenes = [Welcome, Entrance];                                  // plate only ever covers these two
const total = scenes.reduce((a, s) => a + s.weight, 0);
const ends = []; scenes.reduce((a, s) => (ends.push(a + s.weight), a + s.weight), 0);
const endScene = scenes.findIndex(s => s.id === man.end.scene);
const endY = (endScene ? scenes[0].weight : 0) + man.end.q * scenes[endScene].weight;

const rig = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
const out = [], csv = ['frame,x_cm,y_cm,z_cm,pitch,yaw,roll,hfov_16x9'], hfov = 2 * Math.atan(Math.tan(fov * Math.PI / 360) * 16 / 9) * 180 / Math.PI;
for (let f = 0; f < frames; f++) {
  const y = (f / (frames - 1)) * endY;
  const si = y < scenes[0].weight ? 0 : 1, s = scenes[si], q = (y - (si ? scenes[0].weight : 0)) / s.weight;
  sampleRig(s.id, q, rig);
  const p = rig.pos, l = rig.look;
  out.push({ frame: f, scene: s.id, q: +q.toFixed(5), pos: [p.x, p.y, p.z].map(n => +n.toFixed(4)), look: [l.x, l.y, l.z].map(n => +n.toFixed(4)), fov });
  // three (x right, y up, z back, RH, m) -> Unreal (X forward, Y right, Z up, LH, cm): X=-z, Y=x, Z=y
  const U = v => [-v.z * 100, v.x * 100, v.y * 100], [px, py, pz] = U(p), [lx, ly, lz] = U(l);
  const dx = lx - px, dy = ly - py, dz = lz - pz, yaw = Math.atan2(dy, dx) * 180 / Math.PI, pitch = Math.atan2(dz, Math.hypot(dx, dy)) * 180 / Math.PI;
  csv.push([f, px, py, pz, pitch, yaw, 0, hfov].map(n => typeof n === 'number' ? +n.toFixed(3) : n).join(','));
}
const dir = new URL('../plates/mansion/', import.meta.url);
writeFileSync(new URL('camera-path.json', dir), JSON.stringify({ frames, fov, end: man.end, path: out }, null, 1));
writeFileSync(new URL('camera-path-unreal.csv', dir), csv.join('\n') + '\n');
console.log(`wrote ${frames} frames, plate ends at scroll ${endY.toFixed(1)}vh of ${total}vh`);
