// Reception hall z -34 .. -62: feature wall, desk, skylight, plants, seating. Owner: Jim.
import * as THREE from 'three';
import { PAL, mat, basic, box, plane, canvasTex, radialTex, blob, pool, plant } from './materials.js';

export const REC = { z0: -34, z1: -62, w: 12, h: 7.6, deskZ: -50, deskW: 3.4, deskD: 1.45 };

export function buildReception({ quality, logoMat }) {
  const g = new THREE.Group(); g.name = 'reception';
  const { z0, z1, w, h, deskZ } = REC, len = z0 - z1, zc = (z0 + z1) / 2;
  const wall = mat(PAL.cream), wood = mat(PAL.wood), woodL = mat(PAL.woodLight);
  const shadow = quality.shadows ? {} : null;

  // floor: warm planks
  const planks = canvasTex(512, 512, (c, W, H) => {
    c.fillStyle = '#d9b98c'; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 8; i++) { c.fillStyle = `rgba(${150 + (i * 13) % 30},${110 + (i * 7) % 20},70,.18)`; c.fillRect(i * 64, 0, 64, H); c.fillStyle = 'rgba(90,60,30,.25)'; c.fillRect(i * 64, 0, 2, H); }
    for (let j = 0; j < 6; j++) { c.fillStyle = 'rgba(90,60,30,.18)'; c.fillRect(((j * 211) % 512), (j * 97) % 512, 2, 120); }
  }, { repeat: [w / 2.2, len / 3] });
  const floor = plane(w * 2, len, mat(0xffffff, { map: planks }), 0, 0.005, zc, g, 0, -Math.PI / 2); floor.receiveShadow = !!shadow;
  const rug = plane(10, 8, mat(PAL.cream2), 0, 0.012, deskZ + 7.5, g, 0, -Math.PI / 2);
  if (quality.tier !== 'low') plane(10.8, 8.8, mat(PAL.navy), 0, 0.009, deskZ + 7.5, g, 0, -Math.PI / 2);
  plane(w * 2, len, mat(PAL.cream), 0, h, zc, g, 0, Math.PI / 2);

  // side walls with tall windows and wood base
  [-1, 1].forEach(s => {
    const sw = box(0.4, h, len, wall, s * (w + 0.2), h / 2, zc, g, shadow);
    box(0.44, 1.2, len, wood, s * (w + 0.18), 0.6, zc, g);
    for (let k = 0; k < 4; k++) {
      const z = z0 - 5 - k * 6.4;
      box(0.2, 4.4, 3.0, mat(PAL.navy), s * (w - 0.02), 3.5, z, g); box(0.1, 4.1, 2.7, basic(k % 2 ? 0xf3d4a6 : 0xf6dcb4), s * (w - 0.12), 3.5, z, g);
      pool(g, s * (w - 3.2), 0.03, z, 6.5, 6.5, 0.22);
    }
  });
  // entry wall (z0): archway handled by hallway end wall; wall sections beyond hallway width
  [-1, 1].forEach(s => box(w - 4.9, h, 0.5, wall, s * (4.9 + (w - 4.9) / 2), h / 2, z0 + 0.0, g));
  box(10, h - 5.0, 0.5, wall, 0, 5.0 + (h - 5.0) / 2, z0 + 0.0, g);

  // feature wall: vertical wood slats + glowing logo
  const back = z1;
  box(w * 2, h, 0.4, wall, 0, h / 2, back - 0.2, g);
  for (let x = -7; x <= 7; x += 0.34) box(0.2, 5.4, 0.12, (Math.round(x * 10) % 2) ? wood : woodL, x, 2.9, back + 0.1, g);
  box(w * 2, 0.5, 0.2, mat(PAL.charcoal), 0, 0.25, back + 0.1, g);
  const panel = box(5.0, 4.3, 0.1, mat(PAL.cream), 0, 5.35, back + 0.24, g);
  const lg = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 4.2), logoMat); lg.position.set(0, 5.35, back + 0.32); lg.renderOrder = 4;
  // navy tone behind the white logo so it reads
  panel.material = mat(PAL.navy); g.add(lg);
  pool(g, 0, 5.35, back + 0.6, 9, 8, 0.2, 0);

  // skylight
  const sky = basic(0xfff6e6); const sl = new THREE.Mesh(new THREE.PlaneGeometry(9, 12), sky); sl.rotation.x = Math.PI / 2; sl.position.set(0, h - 0.02, deskZ + 3); g.add(sl);
  for (let k = -1; k <= 1; k++) box(0.14, 0.14, 12.4, mat(PAL.charcoal), k * 3, h - 0.08, deskZ + 3, g);
  pool(g, 0, 0.03, deskZ + 3, 12, 14, 0.28);
  // pendant discs
  if (quality.tier !== 'low') [-6, 6].forEach(x => [-42, -53].forEach(z => { box(0.04, 1.6, 0.04, mat(PAL.charcoal), x, h - 0.8, z, g); const d = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.1, 20), basic(PAL.glow)); d.position.set(x, h - 1.6, z); g.add(d); }));

  // reception desk: half-ellipse extruded, curved side facing the visitor (+z)
  const dw = REC.deskW, dd = REC.deskD;
  const shape = new THREE.Shape(); shape.moveTo(-dw, 0); shape.absellipse(0, 0, dw, dd, Math.PI, Math.PI * 2, true); shape.lineTo(-dw, 0);
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 1.05, bevelEnabled: false, curveSegments: 40 }), mat(0xf4ecdf));
  body.rotation.x = -Math.PI / 2; body.position.set(0, 0, deskZ); if (shadow) { body.castShadow = true; body.receiveShadow = true; } g.add(body);
  const top = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.07, bevelEnabled: false, curveSegments: 40 }), mat(PAL.woodLight));
  top.rotation.x = -Math.PI / 2; top.position.set(0, 1.05, deskZ); top.scale.set(1.04, 1.06, 1); if (shadow) top.castShadow = true; g.add(top);
  box(6.6, 0.04, 0.02, basic(PAL.glow), 0, 0.12, deskZ + dd + 0.01, g).visible = false;
  // monitor, notebook, small lamp on the desk
  box(0.62, 0.4, 0.04, mat(PAL.charcoal), 1.5, 1.36, deskZ - 0.55, g); box(0.06, 0.2, 0.06, mat(PAL.charcoal), 1.5, 1.18, deskZ - 0.55, g);
  box(0.5, 0.02, 0.36, mat(PAL.cream2), -1.2, 1.09, deskZ + 0.15, g); box(0.22, 0.02, 0.3, mat(PAL.navy), -1.5, 1.095, deskZ + 0.3, g);
  const lampM = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), basic(PAL.glow)); lampM.position.set(2.2, 1.5, deskZ - 0.3); g.add(lampM); box(0.02, 0.4, 0.02, mat(PAL.charcoal), 2.2, 1.3, deskZ - 0.3, g);
  // brand sign on the desk front
  const dn = canvasTex(512, 96, (c, W, H) => { c.fillStyle = 'rgba(0,0,0,0)'; c.clearRect(0, 0, W, H); c.fillStyle = '#f4ecdf'; c.font = '300 40px Fraunces, Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('F S C H O O L A I', W / 2, H / 2); });
  plane(1.5, 0.28, basic(0xffffff, { map: dn, transparent: true }), 0, 0.55, deskZ + dd + 0.075, g);
  blob(g, 0, deskZ, dw + 0.6, dd + 0.8, 0.28);

  // seating, plants, side tables
  const sofa = (x, z, ry) => { const s = new THREE.Group(); s.position.set(x, 0, z); s.rotation.y = ry;
    box(2.7, 0.46, 1.0, mat(PAL.navy2), 0, 0.3, 0, s, shadow); box(2.7, 0.7, 0.26, mat(PAL.navy2), 0, 0.78, -0.42, s, shadow); box(0.22, 0.6, 1.0, mat(PAL.navy), -1.4, 0.45, 0, s); box(0.22, 0.6, 1.0, mat(PAL.navy), 1.4, 0.45, 0, s);
    box(0.06, 0.3, 0.06, wood, -1.2, 0.07, 0.3, s); g.add(s); blob(g, x, z, 1.8, 1.0, 0.25); };
  sofa(-9, -43, Math.PI / 2); sofa(9, -43, -Math.PI / 2); sofa(-9, -53, Math.PI / 2); sofa(9, -53, -Math.PI / 2);
  if (quality.tier !== 'low') [[-9.4, -48], [9.4, -48]].forEach(([x, z]) => { box(0.9, 0.06, 0.9, woodL, x, 0.55, z, g); box(0.1, 0.5, 0.1, mat(PAL.charcoal), x, 0.27, z, g); });
  [[-10.8, z0 - 1.5, 1.5], [10.8, z0 - 1.5, 1.5], [-10.8, back + 1.5, 1.5], [10.8, back + 1.5, 1.5], [-6.5, back + 1.4, 1.3], [6.5, back + 1.4, 1.3], [-5.2, -40, 1.1], [5.2, -40, 1.1]].forEach(([x, z, s]) => plant(g, x, z, s, shadow));
  return { group: g, deskZ };
}
