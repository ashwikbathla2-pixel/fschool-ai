// Rigged human characters (Ready Player Me avatar + Mixamo-style clips), shared skeleton, cheap variants.
// Owner: Phyllis. Lazy: nothing loads until loadKit() is called.
//   const kit = await loadKit();                      // ~1.5 MB total, cached
//   const s = createStudent(kit, { variant: 2, pose: 'sit' });  // pose: idle | walk | sit | type | agree
//   scene.add(s.object); world.addUpdater(dt => s.update(dt));
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from '../vendor/addons/utils/SkeletonUtils.js';

const base = new URL('./characters/', import.meta.url);
let kitP;
export function loadKit() {
  return kitP ||= (async () => {
    // characters/manifest.json {"model":"student.glb"}: drop a new rigged .glb here and point "model" at it (or pass ?avatar=file.glb).
    const manifest = await fetch(new URL('manifest.json', base)).then(r => r.json()).catch(() => ({ model: 'student.glb' }));
    const model = (typeof location !== 'undefined' && new URLSearchParams(location.search).get('avatar')) || manifest.model || 'student.glb';
    const loader = new GLTFLoader();
    const [gltf, clipsJson] = await Promise.all([
      loader.loadAsync(new URL(model, base).href).catch(() => loader.loadAsync(new URL('student.glb', base).href)),   // fall back to the bundled avatar
      fetch(new URL('clips.json', base)).then(r => r.json())
    ]);
    const norm = n => n.replace(/^mixamorig:?/, '');
    const actual = {}; gltf.scene.traverse(o => { if (o.isBone) actual[norm(o.name)] = o.name; });
    // Retarget: the source clips are authored in a T-pose frame where every bone rest is identity.
    // For this rig: local = inv(restWorld(parent)) * q * restWorld(bone).
    gltf.scene.updateMatrixWorld(true);
    const R = {}, RP = {};
    gltf.scene.traverse(o => { if (o.isBone) { const k = norm(o.name); R[k] = o.getWorldQuaternion(new THREE.Quaternion()); RP[k] = o.parent ? o.parent.getWorldQuaternion(new THREE.Quaternion()).invert() : new THREE.Quaternion(); } });
    const conv = (name, q) => q.premultiply(RP[name]).multiply(R[name]);
    const clips = {}, tmp = new THREE.Quaternion();
    for (const [name, c] of Object.entries(clipsJson))
      clips[name] = new THREE.AnimationClip(name, c.duration, c.tracks.filter(t => R[t.b]).map(t => {
        const v = new Float32Array(t.v);
        for (let i = 0; i < v.length; i += 4) { tmp.fromArray(v, i); conv(t.b, tmp).toArray(v, i); }
        return new THREE.QuaternionKeyframeTrack(`${actual[t.b]}.quaternion`, t.t, v);
      }));
    const frame = { R, RP };
    gltf.scene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; if (o.material?.map) o.material.map.anisotropy = 4; } });
    return { scene: gltf.scene, clips, frame };
  })();
}

// Professional wardrobe palettes: [top, bottom, shoes]
const WARDROBE = [
  ['#c9bfae', '#2b3447', '#3a2f28'], ['#1f3350', '#d7cdbb', '#2a2622'], ['#b7c4b0', '#3b3f4a', '#4a3b30'], ['#d9a89a', '#2f3a52', '#2a2622'],
  ['#3c4a63', '#d7cdbb', '#3a2f28'], ['#44546a', '#c9bfae', '#2a2622'], ['#c97f66', '#2b2f3a', '#3a2f28'], ['#8fa3b8', '#3a3a3a', '#2a2622']
];
const SKIN = ['#ffffff', '#f7ebe2', '#ffe9d9', '#e9c9b0', '#cfa88f'];

export function createStudent(kit, { variant = 0, pose = 'idle', scale } = {}) {
  const root = SkeletonUtils.clone(kit.scene);
  let nativeHair = false; root.traverse(o => { if (o.isMesh && /Hair/.test(o.name)) nativeHair = true; });
  const [top, bottom, shoes] = WARDROBE[variant % WARDROBE.length];
  const tint = (o, hex) => { o.material = o.material.clone(); o.material.color.set(hex); };
  root.traverse(o => {
    if (!o.isMesh) return;
    if (/Headwear/.test(o.name) && !nativeHair) o.visible = false;
    else if (/Outfit_Top/.test(o.name)) { tint(o, top); if (!nativeHair) { o.material.map = null; o.material.roughness = .75; } }   // solid-colour blazer
    else if (/Outfit_Bottom/.test(o.name)) tint(o, bottom);
    else if (/Footwear/.test(o.name)) tint(o, shoes);
    else if (/Head$|Head_|Wolf3D_Head$/.test(o.name) && !nativeHair) { o.material = o.material.clone(); o.material.color.set(SKIN[(variant * 2 + 1) % SKIN.length]); }
    else if (/Body/.test(o.name) && !nativeHair) { o.material = o.material.clone(); o.material.color.set(SKIN[(variant * 2 + 1) % SKIN.length]); }
    else if (/Beard/.test(o.name)) o.visible = variant % 3 === 0;
  });
  root.scale.setScalar(scale ?? (.96 + (variant % 4) * .025));
  const bones = {}; root.traverse(o => { if (o.isBone) bones[o.name.replace(/^mixamorig:?/, '')] = o; });
  if (!nativeHair) addHair(root, bones, variant);
  const mixer = new THREE.AnimationMixer(root);
  let action = null, seated = false, t = 0;
  const q = (x, y, z) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));
  const rest = {}; for (const n in bones) rest[n] = bones[n].quaternion.clone();
  const { R, RP } = kit.frame, qa = new THREE.Quaternion();
  // set(bone, x, y, z): rotation in the common T-pose frame (x = character's left/right axis, y up, z forward)
  const set = (n, x, y, z) => { if (bones[n]) bones[n].quaternion.copy(qa.setFromEuler(new THREE.Euler(x, y, z)).premultiply(RP[n]).multiply(R[n])); };
  const hipsY = bones.Hips ? bones.Hips.position.y : 0;

  function play(name, fade = .3) {
    seated = name === 'sit' || name === 'type';
    for (const n in rest) bones[n].quaternion.copy(rest[n]);
    if (bones.Hips && !seated) bones.Hips.position.y = hipsY;
    if (seated) { action?.fadeOut(fade); action = null; return; }
    const clip = kit.clips[name] || kit.clips.idle; const next = mixer.clipAction(clip);
    next.reset().fadeIn(fade).play(); if (action && action !== next) action.fadeOut(fade); action = next;
  }
  function update(dt) {
    t += dt;
    if (!seated) { mixer.update(dt); return; }
    // procedural seated pose: thighs forward, knees bent, torso slightly leaning in; typing = small wrist/arm motion
    bones.Hips.position.y = hipsY - .40;
    set('Hips', 0, 0, 0);
    set('LeftUpLeg', -1.45, .06, 0); set('RightUpLeg', -1.45, -.06, 0);
    set('LeftLeg', 1.5, 0, 0); set('RightLeg', 1.5, 0, 0);
    set('LeftFoot', -.05, 0, 0); set('RightFoot', -.05, 0, 0);
    const breathe = Math.sin(t * 1.6) * .012;
    set('Spine', .1 + breathe, 0, 0); set('Spine1', .05, 0, 0); set('Spine2', .03 + breathe, 0, 0);
    set('Neck', -.06, Math.sin(t * .5) * .05, 0); set('Head', -.02, Math.sin(t * .5) * .08, 0);
    const typing = pose === 'type' ? 1 : 0;
    set('LeftArm', -.85, 0, -1.2); set('RightArm', -.85, 0, 1.2);
    set('LeftForeArm', 0, -1.25 + typing * Math.sin(t * 9) * .05, 0); set('RightForeArm', 0, 1.25 - typing * Math.sin(t * 8 + 1) * .05, 0);
    set('LeftHand', typing * Math.sin(t * 11) * .1, 0, 0); set('RightHand', typing * Math.sin(t * 10 + 2) * .1, 0, 0);
  }
  play(pose);
  const api = { object: root, mixer, play, update, bones, dispose() { mixer.stopAllAction(); root.traverse(o => { if (o.isMesh) o.material?.dispose?.(); }); root.removeFromParent(); } };
  return api;
}

// A crowd that shares the same skeleton data/geometry. area = {x0,x1,z0,z1}; returns a Group + update(dt).
export function createCrowd(kit, n, { area = { x0: -3, x1: 3, z0: -2, z1: 2 }, y = 0, walk = .4, seed = 7 } = {}) {
  const g = new THREE.Group(); const list = []; let s = seed; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < n; i++) {
    const walking = rnd() < walk, c = createStudent(kit, { variant: i + 1, pose: walking ? 'walk' : 'idle' });
    c.object.position.set(area.x0 + rnd() * (area.x1 - area.x0), y, area.z0 + rnd() * (area.z1 - area.z0));
    c.object.rotation.y = (rnd() - .5) * 1.2 + (walking ? Math.PI / 2 * (rnd() < .5 ? 1 : -1) : 0);
    c.mixer.setTime?.(rnd() * 2); c.walking = walking; g.add(c.object); list.push(c);
  }
  return { group: g, characters: list, update(dt) { for (const c of list) { c.update(dt); if (c.walking) { const o = c.object; o.position.x += Math.sin(o.rotation.y) * dt * .45; if (o.position.x > area.x1 + .5 || o.position.x < area.x0 - .5) o.rotation.y += Math.PI; } } } };
}

const HAIR = ['#2a1f1a', '#14110f', '#6b4a32', '#b58b52', '#3a2a22', '#1c1816'];
const hairGeo = new THREE.SphereGeometry(1, 20, 14, 0, Math.PI * 2, 0, 2.15);
const blobGeo = new THREE.SphereGeometry(1, 14, 10);
// Stylized hair (the source avatar's own hair is fused with a hat, so it is hidden): tilted cap + bob / ponytail / bun by variant.
function addHair(root, bones, variant) {
  const head = bones.Head, top = bones.HeadTop_End; if (!head || !top) return;
  root.updateMatrixWorld(true);
  const hp = head.getWorldPosition(new THREE.Vector3()), tp = top.getWorldPosition(new THREE.Vector3());
  const center = hp.clone().lerp(tp, .5), r = hp.distanceTo(tp) * .5;
  const ws = head.getWorldScale(new THREE.Vector3()).x || 1;
  const g = new THREE.Group(); g.position.copy(head.worldToLocal(center.clone()));
  g.quaternion.copy(head.getWorldQuaternion(new THREE.Quaternion()).invert());
  const mat = new THREE.MeshStandardMaterial({ color: HAIR[variant % HAIR.length], roughness: .55 });
  const k = r / ws, add = (geo, sx, sy, sz, x, y, z, rx = 0) => { const m = new THREE.Mesh(geo, mat); m.scale.set(sx * k, sy * k, sz * k); m.position.set(x * k, y * k, z * k); m.rotation.x = rx; m.castShadow = true; g.add(m); return m; };
  add(hairGeo, 1.0, 1.04, 1.08, 0, .1, -.12, -.5);                       // cap, tilted back so the hairline rises at the front
  const style = variant % 4;
  if (style === 1) add(blobGeo, .98, 1.0, .72, 0, -.55, -.62);          // bob / longer back
  else if (style === 2) { add(blobGeo, .3, .3, .3, 0, -.05, -1.1); add(blobGeo, .2, .55, .2, 0, -.62, -1.15); }  // ponytail
  else if (style === 3) add(blobGeo, .42, .4, .42, 0, 1.0, -.35);       // bun
  head.add(g);
}

// Body texture = skin + plain tee. Tint dark texels (skin) and bright texels (tee) separately.
function skinShirt(o, skin, shirt) {
  const m = o.material = o.material.clone();
  const sk = new THREE.Color(skin), sh = new THREE.Color(shirt);
  m.onBeforeCompile = sd => {
    sd.uniforms.skinTint = { value: sk }; sd.uniforms.shirtTint = { value: sh };
    sd.fragmentShader = 'uniform vec3 skinTint; uniform vec3 shirtTint;\n' + sd.fragmentShader.replace('#include <map_fragment>',
      '#include <map_fragment>\n{ float w = smoothstep(.55, .75, dot(diffuseColor.rgb, vec3(.333))); diffuseColor.rgb *= mix(skinTint, shirtTint, w); }');
  };
  m.customProgramCacheKey = () => 'skinShirt' + shirt + skin;
}
