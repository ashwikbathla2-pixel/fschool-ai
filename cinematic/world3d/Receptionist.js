// Stylized doll-like receptionist: an elegant adult woman in a tailored blazer. Procedural, smooth shapes,
// soft physical shading. Idle breath, blink, head + eyes follow the visitor, greet wave, nod, thinking pose,
// lip-flap on speech, brow/eye expressions, lean with mic level. Low tier gets a simplified variant. Owner: Jim.
import * as THREE from 'three';
import { PAL, clamp, lerp, radialTex } from './materials.js';

const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const now = () => performance.now() / 1000;

export function buildReceptionist({ quality, position }) {
  const full = quality.tier !== 'low';
  const root = new THREE.Group(); root.position.copy(position); root.scale.setScalar(1.1);
  const cast = !!quality.shadows;
  const seg = full ? 1 : 0.5;

  // materials: soft skin, glossy hair, matte tailoring
  const std = (color, o = {}) => full ? new THREE.MeshPhysicalMaterial({ color, roughness: 0.6, ...o }) : new THREE.MeshLambertMaterial({ color });
  const skin = std(0xf1c7a8, { roughness: 0.55, sheen: 0.7, sheenColor: new THREE.Color(0xf7a99a), sheenRoughness: 0.5, emissive: 0x4a2418, emissiveIntensity: 0.12 });
  const hairM = std(0x4b2a22, { roughness: 0.34, clearcoat: 0.7, clearcoatRoughness: 0.28 });
  const blazer = std(0x2a3042, { roughness: 0.7, sheen: 0.4, sheenColor: new THREE.Color(0x5a6a8c) });
  const blazerLight = std(0x384060, { roughness: 0.65 });
  const cream = std(0xf7f0e4, { roughness: 0.75 });
  const gold = std(0xd9b36a, { roughness: 0.3, metalness: 0.6 });
  const lip = std(0xb4384a, { roughness: 0.35 });
  const dark = new THREE.MeshBasicMaterial({ color: 0x2a1a18 });
  const flat = (geo, m, p, parent, s, r) => { const o = new THREE.Mesh(geo, m); o.position.set(...p); if (s) o.scale.set(...s); if (r) o.rotation.set(...r); parent.add(o); return o; };
  const sph = (r, w = 24, h = 18) => new THREE.SphereGeometry(r, Math.round(w * seg), Math.round(h * seg));

  // ---- torso: lathe profile gives a tailored waist and soft shoulders
  const torso = new THREE.Group(); torso.position.set(0, 1.0, 0); root.add(torso);
  flat(new THREE.CapsuleGeometry(0.2, 0.65, 4, 10), std(0x23252f), [0, -0.45, 0], root, [1.15, 1, 0.8]).position.y = 0.55; // hidden lower body
  const prof = [[0.2, 0], [0.17, 0.1], [0.152, 0.2], [0.178, 0.32], [0.2, 0.43], [0.19, 0.5], [0.12, 0.54], [0.06, 0.57], [0.05, 0.6]].map(([r, y]) => new THREE.Vector2(r, y));
  const body = flat(new THREE.LatheGeometry(prof, Math.round(32 * seg)), blazer, [0, 0, 0], torso, [1.2, 1, 0.76]); body.castShadow = cast;
  if (full) {
    flat(new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-0.062, 0.5), new THREE.Vector2(0.062, 0.5), new THREE.Vector2(0, 0.27)])), cream, [0, 0, 0.158], torso);      // blouse V
    [-1, 1].forEach(s => flat(new THREE.BoxGeometry(0.04, 0.2, 0.012), blazerLight, [s * 0.062, 0.4, 0.162], torso, null, [0, 0, -s * 0.3]));   // lapels
    flat(sph(0.0095, 10, 8), gold, [0, 0.17, 0.139], torso); flat(sph(0.0095, 10, 8), gold, [0, 0.08, 0.131], torso);                                // buttons
    flat(sph(0.011, 10, 8), gold, [0.075, 0.37, 0.168], torso);                                                                                          // brooch
    flat(new THREE.TorusGeometry(0.058, 0.007, 8, 24, Math.PI), gold, [0, 0.505, 0.04], torso, [1, 1.1, 1], [Math.PI / 2.4, 0, Math.PI]);              // fine necklace
  }
  flat(new THREE.CylinderGeometry(0.048, 0.056, 0.14, Math.round(16 * seg)), skin, [0, 0.6, 0], torso);                                              // neck

  // ---- head
  const head = new THREE.Group(); head.position.set(0, 0.78, 0.01); head.scale.setScalar(1.14); torso.add(head);
  const face = flat(sph(0.125, 36, 28), skin, [0, 0, 0], head, [0.93, 1.06, 0.96]); face.castShadow = cast;
  // hair: crown, side-swept fringe, long glossy back + front locks, soft highlight
  flat(sph(0.138, 32, 24), hairM, [0, 0.015, -0.05], head, [1.0, 1.0, 0.98]).castShadow = cast;
  flat(sph(0.1, 24, 16), hairM, [0.03, 0.09, 0.055], head, [1.12, 0.3, 0.9], [0.22, 0, -0.2]);
  const back = flat(sph(0.165, 28, 22), hairM, [0, -0.15, -0.085], head, [1.12, 1.75, 0.72]); back.castShadow = cast;
  [-1, 1].forEach(s => flat(new THREE.CapsuleGeometry(0.036, 0.17, 6, 12), hairM, [s * 0.122, -0.09, -0.005], head, [0.7, 1.05, 0.85], [0, 0, s * 0.08]));
  if (full) flat(sph(0.09, 16, 10), new THREE.MeshBasicMaterial({ color: 0xffe9d4, transparent: true, opacity: 0.2, depthWrite: false }), [-0.03, 0.128, 0.035], head, [0.9, 0.1, 0.5], [0.25, 0, 0.25]);

  // eyes: large, with iris, pupil, two catchlights, lashes. eyeGroup scale.y squashes to blink.
  const eyes = [];
  const irisCol = std(0x5a3a2a, { roughness: 0.3 });
  const white = new THREE.MeshBasicMaterial({ color: 0xfdf8f2 });
  [-1, 1].forEach(s => {
    const eg = new THREE.Group(); eg.position.set(s * 0.05, 0.012, 0.1075); head.add(eg);
    const ball = flat(sph(0.031, 18, 14), white, [0, 0, 0], eg, [1, 1.12, 0.45]);
    const look = new THREE.Group(); eg.add(look);
    flat(sph(0.0215, 16, 12), irisCol, [0, 0, 0.009], look, [1, 1.05, 0.4]);
    flat(sph(0.0105, 12, 10), dark, [0, 0, 0.0145], look, [1, 1, 0.3]);
    if (full) {
      flat(sph(0.0058, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), [s * -0.0065, 0.0075, 0.0185], look);
      flat(sph(0.0028, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), [s * 0.0085, -0.0075, 0.0185], look);
    }
    // lash line (does not squash with the blink so closed eyes read as lashes)
    const lash = flat(new THREE.TorusGeometry(0.032, 0.0042, 6, Math.round(18 * seg), 3.5), dark, [s * 0.05, 0.016, 0.1195], head, [1, 0.82, 1], [0, 0, -0.18]);
    if (full) { const wing = flat(new THREE.BoxGeometry(0.02, 0.0038, 0.004), dark, [s * 0.087, 0.026, 0.1], head, null, [0, s * -0.7, s * 0.5]); void wing; }
    eyes.push({ eg, look, ball, lash, s });
  });
  // brows
  const brows = full ? [-1, 1].map(s => {
    const b = flat(new THREE.TorusGeometry(0.04, 0.0042, 6, 14, 1.15), hairM, [s * 0.052, 0.068, 0.094], head, null, [0, 0, 0]);
    b.userData = { s, y0: 0.068 }; return b;
  }) : [];
  // nose, blush, ears, earrings
  flat(sph(0.0105, 10, 8), std(0xe0aa8c), [0, -0.023, 0.1165], head, [1, 0.9, 0.85]);
  if (full) {
    const blushM = new THREE.MeshBasicMaterial({ map: radialTex('rgba(232,120,120,.55)', 'rgba(232,120,120,0)'), transparent: true, depthWrite: false });
    [-1, 1].forEach(s => { const m = flat(new THREE.PlaneGeometry(0.06, 0.04), blushM, [s * 0.072, -0.03, 0.0935], head); m.rotation.y = s * 0.7; });
    [-1, 1].forEach(s => { flat(sph(0.017, 10, 8), skin, [s * 0.1185, -0.005, 0.0], head, [0.5, 1, 0.8]); flat(sph(0.0095, 10, 8), new THREE.MeshPhysicalMaterial({ color: 0xfff6ea, roughness: 0.15, clearcoat: 1 }), [s * 0.119, -0.036, 0.004], head); });
  }
  // mouth: lipstick smile + open-mouth sphere driven by speech
  const mouth = new THREE.Group(); mouth.position.set(0, -0.056, 0.108); head.add(mouth);
  const smile = flat(new THREE.TorusGeometry(0.027, 0.0065, 8, Math.round(18 * seg), Math.PI * 0.92), lip, [0, 0.012, 0], mouth, null, [0, 0, Math.PI * 1.04]);
  const inner = flat(sph(0.019, 12, 10), new THREE.MeshBasicMaterial({ color: 0x5d1a26 }), [0, 0.002, 0.0], mouth, [1, 0.01, 0.3]);

  // ---- arms
  const arm = side => {
    const sh = new THREE.Group(); sh.position.set(side * 0.262, 0.43, 0); torso.add(sh);
    flat(new THREE.CapsuleGeometry(0.052, 0.21, 4, 10), blazer, [0, -0.15, 0], sh);
    const el = new THREE.Group(); el.position.set(0, -0.3, 0); sh.add(el);
    flat(new THREE.CapsuleGeometry(0.044, 0.19, 4, 10), blazer, [0, -0.13, 0], el);
    const hand = new THREE.Group(); hand.position.set(0, -0.28, 0); el.add(hand);
    if (full) flat(new THREE.CylinderGeometry(0.041, 0.041, 0.02, 14), cream, [0, 0.02, 0], hand);
    flat(sph(0.048, 14, 10), skin, [0, -0.03, 0], hand, [0.85, 1.25, 0.55]);
    if (full) flat(new THREE.CapsuleGeometry(0.013, 0.03, 3, 6), skin, [side * -0.036, -0.02, 0.012], hand, null, [0, 0, side * 0.5]);
    return { sh, el, hand };
  };
  const L = arm(-1), R = arm(1);
  if (cast) root.traverse(o => { if (o.isMesh && o.geometry.attributes.position.count > 400) o.castShadow = true; });

  // ---- animation state
  const S = { blinkAt: now() + 2.5, blink: 0, yaw: 0, pitch: 0, tilt: 0, lean: 0, nodT: -9, waveT: -9, mic: 0, micT: 0, happyT: -9, happy: 0, speakEnd: 0, speakSeed: 0, mouth: 0, listening: false, thinking: false, brow: 0, wide: 0, ex: { brow: 0, eye: 0, smile: 0 } };
  const api = {
    root,
    wave() { S.waveT = now(); S.happyT = now(); },
    greet() { api.wave(); },
    nod() { S.nodT = now(); S.happyT = now(); },
    setMic(l) { S.micT = clamp(l); },
    setListening(v) { S.listening = v; },
    setThinking(v) { S.thinking = v; },
    // lip-flap for roughly as long as the line takes to say
    speak(text = '') { S.speakEnd = now() + clamp(String(text).length * 0.062, 0.6, 7); S.speakSeed = Math.random() * 10; },
    // express('happy' | 'surprised' | 'curious', seconds)
    express(name, sec = 1.6) { S.exName = name; S.exUntil = now() + sec; },
    update(t, dt, camPos, still) {
      const tn = now();
      // head and eyes follow the visitor, limited and slow
      const dx = camPos.x - root.position.x, dz = camPos.z - root.position.z;
      const yawT = clamp(Math.atan2(dx, dz), -0.6, 0.6) * 0.8 + (still ? 0 : Math.sin(t * 0.27) * 0.05) + (S.thinking ? 0.22 : 0);
      S.yaw = damp(S.yaw, yawT, 2.2, dt);
      S.pitch = damp(S.pitch, (S.thinking ? -0.1 : 0.02) + (still ? 0 : Math.sin(t * 0.4) * 0.015), 2, dt);
      S.mic = damp(S.mic, S.micT, 9, dt);
      S.lean = damp(S.lean, (S.listening ? 0.08 : 0) + S.mic * 0.09, 3, dt);
      S.tilt = damp(S.tilt, (S.listening ? 0.08 : 0) + S.mic * 0.08 * Math.sin(t * 1.3) + (S.thinking ? -0.05 : 0), 3, dt);

      // nod: two soft dips
      const nt = tn - S.nodT; const nod = nt > 0 && nt < 1.5 ? Math.sin(nt * Math.PI * 2.6) * Math.exp(-nt * 1.6) * 0.16 : 0;
      // wave: right hand raised, sways
      const wt = tn - S.waveT; const wv = wt > 0 && wt < 2.8 ? Math.sin(clamp(wt / 2.8) * Math.PI) : 0;
      S.wave = damp(S.wave || 0, wv, 7, dt);
      const ht = tn - S.happyT; S.happy = damp(S.happy, ht > 0 && ht < 3 ? Math.sin(clamp(ht / 3) * Math.PI) : 0, 5, dt);
      const exOn = S.exUntil && tn < S.exUntil ? S.exName : '';
      const tgt = { brow: S.listening ? 0.5 : 0, eye: S.listening ? 0.1 : 0, smile: 0.3 + S.happy * 0.7 };
      if (S.thinking) { tgt.brow = 0.35; tgt.eye = -0.05; tgt.smile = 0.1; }
      if (exOn === 'happy') { tgt.smile = 1; tgt.brow = 0.4; tgt.eye = 0.1; }
      if (exOn === 'surprised') { tgt.brow = 1; tgt.eye = 0.35; tgt.smile = 0.2; }
      if (exOn === 'curious') { tgt.brow = 0.7; tgt.eye = 0.1; tgt.smile = 0.4; }
      S.ex.brow = damp(S.ex.brow, tgt.brow, 8, dt); S.ex.eye = damp(S.ex.eye, tgt.eye, 8, dt); S.ex.smile = damp(S.ex.smile, tgt.smile, 6, dt);

      const breathe = Math.sin(t * 1.55) * 0.5 + 0.5;
      torso.scale.set(1, 1 + breathe * 0.012, 1 + breathe * 0.01);
      torso.rotation.x = S.lean; torso.rotation.z = Math.sin(t * 0.5) * 0.008;
      head.rotation.set(S.pitch + nod, S.yaw, S.tilt);

      // arms
      const rest = 0.9;
      L.sh.rotation.set(-rest - 0.05, 0, 0.12); L.el.rotation.set(-0.85, 0, 0);
      R.sh.rotation.set(-rest + S.wave * 0.9, 0, -0.12 - S.wave * 0.75); R.el.rotation.set(-0.85 - S.wave * 0.75, 0, 0);
      R.hand.rotation.z = S.wave * Math.sin(tn * 9) * 0.38;

      // blink (lashes stay, eye squashes)
      if (tn > S.blinkAt) { S.blinkStart = tn; S.blinkAt = tn + 2.4 + Math.random() * 3; }
      const open = (tn - (S.blinkStart || -9) < 0.14 ? 0.06 : 1) * (1 + S.ex.eye * 0.25);
      // eyes follow camera within a small range, with a sideways glance when thinking
      const lx = clamp((camPos.x - root.position.x) * 0.004, -0.0065, 0.0065) + (S.thinking ? 0.005 : 0), ly = S.thinking ? 0.0065 : 0;
      eyes.forEach(e => { e.eg.scale.y = damp(e.eg.scale.y, open, 45, dt); e.look.position.x = damp(e.look.position.x, lx, 10, dt); e.look.position.y = damp(e.look.position.y, ly, 10, dt); e.lash.scale.y = 0.82 * (1 + S.ex.eye * 0.1); });
      brows.forEach(b => { const { s, y0 } = b.userData; b.position.y = y0 + S.ex.brow * 0.012; b.rotation.z = Math.PI / 2 - 0.575 + s * 0.0 - (s > 0 ? -1 : 1) * 0 + (S.thinking ? s * 0.08 : 0); });

      // mouth: speech flap on top of the resting smile
      let talk = 0;
      if (tn < S.speakEnd) { const k = tn + S.speakSeed; talk = clamp((Math.abs(Math.sin(k * 12.5)) * 0.7 + Math.abs(Math.sin(k * 7.3 + 1.2)) * 0.5) - 0.15) * 0.9; }
      S.mouth = damp(S.mouth, talk, 28, dt);
      inner.scale.y = 0.01 + S.mouth * 1.05; inner.position.y = -0.002 - S.mouth * 0.008;
      smile.position.y = 0.012 - S.mouth * 0.012; smile.scale.set(1 + S.ex.smile * 0.2 - S.mouth * 0.12, 0.6 + S.ex.smile * 0.55, 1);
    },
  };
  return api;
}
