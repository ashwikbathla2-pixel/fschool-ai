// Receptionist built from the user supplied CC3 FBX. Existing receptionist behaviors are retargeted to its rig.
// Lazy: nothing loads until loadReceptionistGLB() is called.
import * as THREE from 'three';
import { FBXLoader } from '../vendor/addons/loaders/FBXLoader.js';
import { clamp } from './materials.js';

const base = new URL('./characters/', import.meta.url);
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const now = () => performance.now() / 1000;
const AX = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };

export async function loadReceptionistGLB({ quality, position }) {
  const source = new URL('girl12_op/girl12_op.Fbx', base).href;
  const textures = new URL('girl12_op/girl12_op.fbm/', base).href;
  const model = await new FBXLoader().setResourcePath(textures).loadAsync(source);
  const root = new THREE.Group(); root.position.copy(position); root.position.z += 0.4; root.scale.setScalar(0.0093); root.add(model);
  const bones = {}, boneNodes = {}, boneGroups = {}, morphMeshes = [];
  const targets = {
    Hips: 'CC_Base_Hip', Spine: 'CC_Base_Waist', Spine1: 'CC_Base_Spine01', Spine2: 'CC_Base_Spine02',
    Neck: 'CC_Base_NeckTwist02', Head: 'CC_Base_Head', LeftEye: 'CC_Base_L_Eye', RightEye: 'CC_Base_R_Eye',
    LeftShoulder: 'CC_Base_L_Clavicle', LeftArm: 'CC_Base_L_Upperarm', LeftForeArm: 'CC_Base_L_Forearm', LeftHand: 'CC_Base_L_Hand',
    RightShoulder: 'CC_Base_R_Clavicle', RightArm: 'CC_Base_R_Upperarm', RightForeArm: 'CC_Base_R_Forearm', RightHand: 'CC_Base_R_Hand',
    LeftUpLeg: 'CC_Base_L_Thigh', LeftLeg: 'CC_Base_L_Calf', LeftFoot: 'CC_Base_L_Foot', LeftToeBase: 'CC_Base_L_ToeBase',
    RightUpLeg: 'CC_Base_R_Thigh', RightLeg: 'CC_Base_R_Calf', RightFoot: 'CC_Base_R_Foot', RightToeBase: 'CC_Base_R_ToeBase',
  };
  model.traverse(o => {
    if (!o.isBone) return;
    (boneGroups[o.name] ||= []).push(o);
    if (!boneNodes[o.name]) boneNodes[o.name] = o;
  });
  for (const [alias, target] of Object.entries(targets)) if (boneNodes[target]) bones[alias] = boneNodes[target];

  const pbr = m => {
    const name = (m.name || '').toLowerCase();
    const transparent = !!m.transparent || (m.opacity ?? 1) < 0.98;
    const hair = /hair|eyelash|tearline|occlusion|glass/.test(name);
    const metal = /frames|metal|glasses/.test(name);
    const mat = new THREE.MeshPhysicalMaterial({
      color: m.color || 0xffffff, map: m.map || null, normalMap: m.normalMap || null,
      alphaMap: m.alphaMap || null, roughness: /skin|cornea|eye/.test(name) ? 0.42 : hair ? 0.58 : 0.76,
      metalness: metal ? 0.45 : 0, opacity: m.opacity ?? 1, transparent,
      side: m.side, emissive: m.emissive || 0x000000, emissiveMap: m.emissiveMap || null,
      clearcoat: /cornea/.test(name) ? 0.28 : 0, clearcoatRoughness: 0.12,
    });
    if (transparent && hair) { mat.alphaTest = 0.2; mat.depthWrite = true; }
    return mat;
  };
  model.traverse(o => {
    if (o.isMesh) {
      o.frustumCulled = false; o.castShadow = !!quality.shadows;
      if (o.morphTargetDictionary) morphMeshes.push(o);
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      o.material = Array.isArray(o.material) ? mats.map(pbr) : pbr(mats[0]);
      for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
        if (m.map) m.map.anisotropy = 4;
        if (m.normalMap) m.normalScale.set(0.8, 0.8);
      }
    }
  });

  // bind-pose snapshot of every bone, and a sync that keeps the per-mesh skeleton copies identical
  model.updateMatrixWorld(true);
  const boneRest = new Map();
  for (const group of Object.values(boneGroups)) for (const b of group) {
    boneRest.set(b, { quaternion: b.quaternion.clone(), position: b.position.clone() });
  }
  const syncSkeletonCopies = () => {
    for (const group of Object.values(boneGroups)) {
      if (group.length < 2) continue;
      const ref = group[0], refRest = boneRest.get(ref);
      const qDelta = refRest.quaternion.clone().invert().multiply(ref.quaternion);
      const pDelta = ref.position.clone().sub(refRest.position);
      for (let i = 1; i < group.length; i++) {
        const b = group[i], rest = boneRest.get(b);
        b.quaternion.copy(rest.quaternion).multiply(qDelta);
        b.position.copy(rest.position).add(pDelta);
      }
    }
  };
  // The shared Mixamo clips were authored for a T-pose rig; on this A-pose Character Creator rig they drop the head and pin the arms behind
  // the back. So no clip plays here: every frame starts from the bind pose and gets small procedural motion on top.
  const restAll = () => { for (const [b, r] of boneRest) { b.quaternion.copy(r.quaternion); b.position.copy(r.position); } };

  // helpers: world-space additive rotation on a bone (applied on top of the bind pose each frame)
  const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), qc = new THREE.Quaternion();
  const rot = (name, axis, angle) => {
    const b = bones[name]; if (!b || !angle) return;
    b.getWorldQuaternion(qa); qb.setFromAxisAngle(axis, angle); qa.premultiply(qb);
    if (b.parent) { b.parent.getWorldQuaternion(qc).invert(); qa.premultiply(qc); }
    b.quaternion.copy(qa);
  };
  const morphTargets = {
    viseme_aa: 'V_Open', viseme_E: 'V_Dental_Lip', viseme_O: 'V_Tight_O', viseme_I: 'V_Tight', viseme_U: 'V_Tight_O',
    mouthSmileLeft: 'Mouth_Smile_L', mouthSmileRight: 'Mouth_Smile_R',
    browInnerUp: ['Brow_Raise_Inner_L', 'Brow_Raise_Inner_R'], browOuterUpLeft: 'Brow_Raise_Outer_L', browOuterUpRight: 'Brow_Raise_Outer_R',
    eyeWideLeft: 'Eye_Wide_L', eyeWideRight: 'Eye_Wide_R', eyeSquintLeft: 'Eye_Squint_L', eyeSquintRight: 'Eye_Squint_R',
    eyeBlinkLeft: 'Eye_Blink_L', eyeBlinkRight: 'Eye_Blink_R', cheekSquintLeft: 'Cheek_Raise_L', cheekSquintRight: 'Cheek_Raise_R',
  };
  const morph = (name, v) => {
    const names = Array.isArray(morphTargets[name]) ? morphTargets[name] : [morphTargets[name] || name];
    for (const m of morphMeshes) for (const target of names) {
      const i = m.morphTargetDictionary[target]; if (i !== undefined) m.morphTargetInfluences[i] = v;
    }
  };

  const S = { gx: 0, gy: 0, gtx: 0, gty: 0, gazeAt: 0, awayUntil: 0, blinkV: 0, dbl: 0, yaw: 0, pitch: 0, tilt: 0, lean: 0, mic: 0, micT: 0, nodT: -9, waveT: -9, wave: 0, happy: 0, happyT: -9, speakEnd: 0, speakSeed: 0, mouth: 0, vis: 0, blinkAt: now() + 2.5, blinkStart: -9, listening: false, thinking: false, ex: { brow: 0, eye: 0, smile: 0.3 }, exName: '', exUntil: 0, agreeW: 0 };
  const VIS = ['viseme_aa', 'viseme_E', 'viseme_O', 'viseme_I', 'viseme_U', 'viseme_aa'];
  const api = {
    root, glb: true, source: 'girl12_op.Fbx', bones,   // rig handles, for debugging poses
    // numeric check: angle (degrees) between the two eyes' forward directions, and each eye's yaw/pitch from the head forward
    eyeInfo() {
      const f = b => new THREE.Vector3(0, 0, 1).applyQuaternion(b.getWorldQuaternion(new THREE.Quaternion()));
      const l = f(bones.LeftEye), r = f(bones.RightEye);
      return { betweenDeg: +(l.angleTo(r) * 57.2958).toFixed(2), gx: +S.gx.toFixed(3), gy: +S.gy.toFixed(3) };
    },
    wave() { S.waveT = now(); S.happyT = now(); },
    greet() { api.wave(); },
    nod() { S.nodT = now(); S.happyT = now(); S.agreeOn = now(); },
    setMic(l) { S.micT = clamp(l); },
    setListening(v) { S.listening = v; },
    setThinking(v) { S.thinking = v; },
    speak(text = '') { S.speakEnd = now() + clamp(String(text).length * 0.062, 0.6, 7); S.speakSeed = Math.random() * 10; },
    express(name, sec = 1.6) { S.exName = name; S.exUntil = now() + sec; },
    update(t, dt, camPos, still) {
      const tn = now();
      restAll();
      // nod: two soft dips of the head over about 1.8 s
      const at = tn - (S.agreeOn || -9), aw = at > 0 && at < 1.83 ? Math.sin(clamp(at / 1.83) * Math.PI) : 0;
      S.agreeW = damp(S.agreeW, aw * Math.abs(Math.sin(at * 3.5)), 12, dt);

      const dx = camPos.x - root.position.x, dz = camPos.z - root.position.z;
      const yawT = clamp(Math.atan2(dx, dz), -0.5, 0.5) * 0.4 + (still ? 0 : Math.sin(t * 0.2) * 0.025) + (S.thinking ? 0.14 : 0);
      S.yaw = damp(S.yaw, yawT, 1.1, dt);
      S.pitch = damp(S.pitch, (S.thinking ? 0.05 : -0.01), 1.2, dt);
      S.mic = damp(S.mic, S.micT, 9, dt);
      S.lean = damp(S.lean, (S.listening ? 0.07 : 0) + S.mic * 0.08, 3, dt);
      S.tilt = damp(S.tilt, (S.listening ? 0.07 : 0) + S.mic * 0.06 * Math.sin(t * 1.3), 3, dt);
      const wt = tn - S.waveT; S.wave = damp(S.wave, wt > 0 && wt < 2.8 ? Math.sin(clamp(wt / 2.8) * Math.PI) : 0, 7, dt);
      const ht = tn - S.happyT; S.happy = damp(S.happy, ht > 0 && ht < 3 ? Math.sin(clamp(ht / 3) * Math.PI) : 0, 5, dt);

      // posture and gaze on top of the bind pose (positive pitch = look down)
      // the bind pose is a T-pose: let the arms hang, elbows soft, hands a touch forward
      rot('LeftArm', AX.z, -1.0); rot('RightArm', AX.z, 1.0);
      // idle life: slow breathing, a little weight shift, shoulders settle with the breath
      const br = Math.sin(t * 1.5);
      rot('Hips', AX.z, Math.sin(t * 0.37) * 0.012); rot('Spine', AX.z, Math.sin(t * 0.37 + 1) * -0.01);
      rot('Spine2', AX.x, S.lean - 0.014 + br * 0.008); rot('LeftShoulder', AX.z, br * 0.012); rot('RightShoulder', AX.z, -br * 0.012);
      rot('Head', AX.x, S.agreeW * 0.2);
      rot('Neck', AX.y, S.yaw * 0.35); rot('Neck', AX.x, S.pitch * 0.4); rot('Neck', AX.z, S.tilt * 0.4);
      rot('Head', AX.y, S.yaw * 0.65); rot('Head', AX.x, S.pitch * 0.6); rot('Head', AX.z, S.tilt * 0.6);
      // greeting wave: her right arm (world -x) lifts and the forearm sways
      if (S.wave > 0.01) {
        rot('RightArm', AX.z, -1.55 * S.wave); rot('RightForeArm', AX.z, (-0.55 + Math.sin(tn * 8) * 0.38) * S.wave);
      }

      // face
      if (tn > S.blinkAt) { S.blinkStart = tn; S.blinkAt = tn + 3 + Math.random() * 2; S.dbl = Math.random() < 0.2 ? tn + 0.28 : 0; }
      if (S.dbl && tn > S.dbl) { S.blinkStart = tn; S.dbl = 0; }
      const bt = tn - S.blinkStart; S.blinkV = bt < 0.07 ? bt / 0.07 : bt < 0.2 ? 1 - (bt - 0.07) / 0.13 : 0; const bl = clamp(S.blinkV);
      const exOn = tn < S.exUntil ? S.exName : '';
      const tgt = { brow: S.listening ? 0.2 : 0, eye: 0, smile: 0.25 + S.happy * 0.4 };
      if (S.thinking) { tgt.brow = 0.2; tgt.smile = 0.1; }
      if (exOn === 'happy') { tgt.smile = 0.7; tgt.brow = 0.15; }
      if (exOn === 'surprised') { tgt.brow = 0.5; tgt.eye = 0.3; tgt.smile = 0.15; }
      if (exOn === 'curious') { tgt.brow = 0.3; tgt.eye = 0.1; tgt.smile = 0.3; }
      S.ex.brow = damp(S.ex.brow, tgt.brow, 8, dt); S.ex.eye = damp(S.ex.eye, tgt.eye, 8, dt); S.ex.smile = damp(S.ex.smile, tgt.smile, 6, dt);
      let talk = 0, v = 0;
      if (tn < S.speakEnd) { const k = tn + S.speakSeed; talk = clamp(Math.abs(Math.sin(k * 12.5)) * 0.75 + Math.abs(Math.sin(k * 7.3 + 1.2)) * 0.45 - 0.15); v = Math.floor(k * 9) % VIS.length; }
      S.mouth = damp(S.mouth, talk, 26, dt);
      VIS.forEach(n => morph(n, 0)); if (talk > 0.02 || S.mouth > 0.02) morph(VIS[v], S.mouth * 0.38);
      morph('mouthSmileLeft', S.ex.smile * (1 - S.mouth * 0.3)); morph('mouthSmileRight', S.ex.smile * (1 - S.mouth * 0.3));
      morph('browInnerUp', S.ex.brow * 0.3); morph('browOuterUpLeft', S.ex.brow * 0.18); morph('browOuterUpRight', S.ex.brow * 0.18);
      morph('eyeWideLeft', S.ex.eye * 0.3); morph('eyeWideRight', S.ex.eye * 0.3);
      morph('eyeSquintLeft', 0.12 + S.ex.smile * 0.2); morph('eyeSquintRight', 0.12 + S.ex.smile * 0.2);
      morph('eyeBlinkLeft', bl); morph('eyeBlinkRight', bl);
      morph('cheekSquintLeft', S.ex.smile * 0.25); morph('cheekSquintRight', S.ex.smile * 0.25);
      // gaze: small, slow, with micro-drift; looks at the visitor about 70% of the time, drifts away briefly otherwise
      if (tn > S.gazeAt) {
        S.gazeAt = tn + 1.2 + Math.random() * 2.2;
        const away = !S.listening && Math.random() < 0.3;
        if (away) S.awayUntil = tn + 0.6 + Math.random() * 0.8;
        const amp = away ? 0.08 : 0.02;
        S.gtx = (Math.random() - 0.5) * 2 * amp; S.gty = away ? -0.04 - Math.random() * 0.06 : (Math.random() - 0.5) * 0.03;
      }
      if (S.thinking) { S.gtx = 0.07; S.gty = 0.07; }
      const maxG = 0.14; // about 8 degrees
      S.gx = damp(S.gx, clamp(S.gtx - S.yaw * 0.6, -maxG, maxG), 5, dt); S.gy = damp(S.gy, clamp(S.gty, -maxG, maxG), 5, dt);
      rot('LeftEye', AX.y, S.gx); rot('RightEye', AX.y, S.gx); rot('LeftEye', AX.x, -S.gy); rot('RightEye', AX.x, -S.gy);
      syncSkeletonCopies();
    },
  };
  return api;
}
