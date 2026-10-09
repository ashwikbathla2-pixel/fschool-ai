// Scroll-driven camera: one CatmullRom position path + one look-at path per scene, joined end to start. Owner: Jim (exterior paths: Stanley/Opus).
import * as THREE from 'three';
import { clamp } from './materials.js';

const v = (x, y, z) => new THREE.Vector3(x, y, z);
const curve = pts => new THREE.CatmullRomCurve3(pts, false, 'centripetal');

export const PATHS = {
  // golden-hour aerial over the valley, sweeping down to eye level across the pool (the two reference photos)
  welcome: {
    pos: curve([v(0, 17, 116), v(13, 9, 94), v(6, -1.2, 73), v(0, -3.35, 60)]),
    look: curve([v(0, 7.5, 0), v(0, 3.5, 4), v(0, 1.6, 6), v(0, 1.0, 4)]),
  },
  // glide over the pool, climb both stair flights, cross the plaza, through the doors
  entrance: {
    pos: curve([v(0, -3.35, 60), v(0, -3.2, 46), v(0, -3.35, 33.6), v(0, -0.95, 25.4), v(0, -0.9, 20.4), v(0, 1.72, 13.2), v(0, 1.7, 6), v(0, 1.68, 1.5), v(0, 1.68, -3)]),
    look: curve([v(0, 1.0, 4), v(0, 1.2, 2), v(0, 1.6, 0), v(0, 2.2, -1), v(0, 2.4, -4), v(0, 2.3, -9), v(0, 2.0, -16)]),
  },
  hallway: {
    pos: curve([v(0, 1.68, -3), v(0, 1.66, -13), v(0, 1.65, -24), v(0, 1.65, -34)]),
    look: curve([v(0, 2.0, -16), v(0, 2.1, -25), v(0, 2.2, -36), v(0, 2.0, -46)]),
  },
  reception: {
    pos: curve([v(0, 1.65, -34), v(0, 1.62, -39), v(0, 1.58, -44.2), v(0, 1.55, -47.0)]),
    look: curve([v(0, 2.0, -46), v(0, 2.1, -50), v(0, 1.8, -51), v(0, 1.62, -50.6)]),
  },
};
export const ORDER = ['welcome', 'entrance', 'hallway', 'reception'];

const pos = new THREE.Vector3(), look = new THREE.Vector3();
export function sampleRig(sceneId, q, out) {
  const p = PATHS[sceneId], u = clamp(q);
  p.pos.getPointAt(u, pos); p.look.getPointAt(u, look);
  out.pos.copy(pos); out.look.copy(look);
}
