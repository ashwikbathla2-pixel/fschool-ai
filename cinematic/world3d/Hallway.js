// School hallway z -6 .. -34: lockers, classroom doors, notice boards, ceiling lights. Owner: Jim.
import * as THREE from 'three';
import { PAL, mat, basic, box, plane, canvasTex, blob, pool, plant } from './materials.js';

export const HALL = { z0: -6, z1: -34, w: 4.5, h: 4.8 };

export function buildHallway({ quality }) {
  const g = new THREE.Group(); g.name = 'hallway';
  const { z0, z1, w, h } = HALL, len = z0 - z1, zc = (z0 + z1) / 2;
  const wall = mat(PAL.cream2), wood = mat(PAL.wood), navy = mat(PAL.navy), char = mat(PAL.charcoal);

  const floorTex = canvasTex(256, 256, (c, W, H) => { c.fillStyle = '#efe5d6'; c.fillRect(0, 0, W, H); c.strokeStyle = 'rgba(120,100,80,.2)'; c.lineWidth = 3; c.strokeRect(0, 0, W, H); }, { repeat: [5, len / 1.8] });
  plane(w * 2, len, mat(0xffffff, { map: floorTex }), 0, 0.005, zc, g, 0, -Math.PI / 2);
  plane(w * 2, len, mat(PAL.cream), 0, h, zc, g, 0, Math.PI / 2);
  [-1, 1].forEach(s => {
    box(0.3, h, len, wall, s * (w + 0.15), h / 2, zc, g);
    box(0.34, 1.0, len, wood, s * (w + 0.1), 0.5, zc, g);            // wainscot
    if (quality.tier !== 'low') box(0.36, 0.08, len, mat(PAL.woodLight), s * (w + 0.1), 1.04, zc, g);
  });

  // lockers (instanced, navy/sage/wood) along both walls in blocks between doors
  const lockerCount = 2 * 5 * 6;
  const lk = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 2.1, 0.46), mat(0xffffff), lockerCount);
  const m4 = new THREE.Matrix4(), col = new THREE.Color(); let n = 0;
  const cols = [PAL.navy2, PAL.sageDark, PAL.navy, PAL.wood];
  [-1, 1].forEach(s => { for (let b = 0; b < 5; b++) for (let k = 0; k < 6; k++) {
    const z = z0 - 2.0 - b * 5.6 - k * 0.52; if (n >= lockerCount) return;
    m4.makeTranslation(s * (w - 0.26), 1.05, z); lk.setMatrixAt(n, m4); lk.setColorAt(n, col.set(cols[(b + (s > 0 ? 1 : 0)) % 4])); n++;
  } });
  g.add(lk);

  // classroom doors + signs between locker blocks
  const doorGlass = basic(0xbfd0d8);
  const plateMat = basic(0xffffff, { map: canvasTex(1280, 64, (c, W, H) => { for (let i = 0; i < 10; i++) { c.fillStyle = '#1f2d4a'; c.fillRect(i * 128, 0, 128, H); c.fillStyle = '#f4ecdf'; c.font = '600 34px Inter, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(101 + i), i * 128 + 64, H / 2); } }) });
  [-1, 1].forEach((s, si) => { for (let b = 0; b < 5; b++) {
    const z = z0 - 5.4 - b * 5.6 + (si ? 0.9 : 0);
    box(0.1, 2.5, 1.3, wood, s * (w - 0.02), 1.25, z, g); if (quality.tier !== 'low') box(0.06, 0.9, 0.5, doorGlass, s * (w - 0.08), 1.7, z, g);
    const pl = plane(0.5, 0.25, plateMat, s * (w - 0.1), 2.7, z, g, -s * Math.PI / 2);
    const uv = pl.geometry.attributes.uv, idx = b + si * 5; for (let i = 0; i < uv.count; i++) uv.setX(i, (uv.getX(i) + idx) / 10);
    pool(g, s * (w - 1.5), 0.03, z, 3.4, 3.4, 0.16);
  } });

  // notice boards
  const lowT = quality.tier === 'low';
  const paper = lowT ? [0xf4ecdf, 0xf4ecdf, 0xf4ecdf, 0xf4ecdf, 0xf4ecdf] : [0xf4ecdf, 0xf0d27a, 0xd98e84, 0xbcd3de, 0xf4ecdf];
  [-1, 1].forEach((s, si) => { for (let b = 0; b < 4; b++) {
    const z = z0 - 8.2 - b * 5.6 + (si ? -0.4 : 0.4);
    box(0.06, 1.3, 1.9, wood, s * (w - 0.02), 2.35, z, g, null); box(0.05, 1.12, 1.72, mat(0xc4a27a), s * (w - 0.06), 2.35, z, g);
    for (let k = 0; k < 5; k++) box(0.03, 0.34, 0.26, mat(paper[(k + b) % 5]), s * (w - 0.1), 2.3 + ((k * 37) % 5) * 0.08, z - 0.7 + k * 0.34, g);
  } });

  // ceiling light strips + light pools
  for (let z = z0 - 2; z > z1 + 1; z -= 4.2) { box(2.4, 0.06, 0.45, basic(PAL.glow), 0, h - 0.05, z, g); pool(g, 0, 0.03, z, 5.6, 5.6, 0.18); }
  // windows on the far end of each side (daylight)
  if (quality.tier !== 'low') [-1, 1].forEach(s => box(0.05, 2.0, 2.2, basic(0xffe3bf), s * (w - 0.0), 2.6, z1 + 4, g));
  // benches + plants
  if (!lowT) [-1, 1].forEach((s, si) => { box(0.5, 0.1, 1.8, wood, s * (w - 0.5), 0.5, z0 - 3.4 - si * 9.6, g); box(0.5, 0.5, 0.1, char, s * (w - 0.5), 0.25, z0 - 3.4 - si * 9.6, g); });
  [[-3.6, z0 - 1], [3.6, z0 - 1], [-3.6, z1 + 1.2], [3.6, z1 + 1.2], [3.7, z0 - 14]].forEach(([x, z]) => plant(g, x, z, 1.05));

  // end wall with archway into reception, and a hanging sign
  const open = 3.4;
  box(w - open + 0.4, h, 0.5, wall, -(open + (w - open + 0.4) / 2), h / 2, z1, g); box(w - open + 0.4, h, 0.5, wall, open + (w - open + 0.4) / 2, h / 2, z1, g);
  box(open * 2, h - 3.6, 0.5, wall, 0, 3.6 + (h - 3.6) / 2, z1, g);
  box(0.25, 3.6, 0.6, wood, -open, 1.8, z1, g); box(0.25, 3.6, 0.6, wood, open, 1.8, z1, g); box(open * 2 + 0.25, 0.25, 0.6, wood, 0, 3.6, z1, g);
  const sign = canvasTex(512, 128, (c, W, H) => { c.fillStyle = '#1f2d4a'; c.fillRect(0, 0, W, H); c.strokeStyle = 'rgba(244,236,223,.5)'; c.lineWidth = 3; c.strokeRect(10, 10, W - 20, H - 20); c.fillStyle = '#f4ecdf'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '300 56px Fraunces, Georgia, serif'; c.fillText('R E C E P T I O N', W / 2, H / 2 + 3); });
  const sg = plane(3.4, 0.85, basic(0xffffff, { map: sign }), 0, 4.15, z1 + 0.32, g);
  return { group: g };
}
