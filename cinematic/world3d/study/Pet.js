// Small round companion: idle bob, blinking, follows to a spot beside the desk, bounces when a session completes, gets sleepy when idle.
// Procedural geometry only. Owner: Phyllis.
import * as THREE from 'three';

const M = {};
const mat = (c, o = {}) => (M[c + JSON.stringify(o)] ||= new THREE.MeshStandardMaterial({ color: c, roughness: .7, flatShading: false, ...o }));
const sph = new THREE.SphereGeometry(1, 20, 14);

// Swap the companion here, no other code changes. `model`: glb path relative to world3d/characters/ (or ?pet=file.glb, or "pet" in characters/manifest.json).
export const PET = { name: 'Pip', model: null, scale: 1, color: '#7fd6a0', belly: '#c9f0d6', foot: '#5fbf86', cheek: '#f5a3a3' };

export const MOODS = { idle: 'Content', focus: 'Focused', happy: 'Delighted', sleepy: 'Sleepy' };

export function createPet(opts = {}) {
  const cfg = { ...PET, ...opts }, name = cfg.name, color = cfg.color;
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const add = (geo, m, sx, sy, sz, x, y, z, parent = body) => { const o = new THREE.Mesh(geo, m); o.scale.set(sx, sy, sz); o.position.set(x, y, z); o.castShadow = true; parent.add(o); return o; };
  add(sph, mat(color), .3, .26, .28, 0, .3, 0);                          // body
  add(sph, mat(cfg.belly), .2, .16, .12, 0, .24, .18);                     // belly
  const eyes = new THREE.Group(); eyes.position.set(0, .36, .24); body.add(eyes);
  [-.1, .1].forEach(x => { add(sph, mat('#1d2430', { roughness: .3 }), .045, .06, .03, x, 0, 0, eyes); add(sph, mat('#ffffff'), .014, .014, .01, x + .012, .02, .028, eyes); });
  [-.17, .17].forEach(x => add(sph, mat(cfg.cheek), .04, .025, .01, x, -.05, -.02, eyes));   // cheeks
  const leaf = new THREE.Group(); leaf.position.set(0, .54, 0); body.add(leaf);
  add(new THREE.CylinderGeometry(1, 1, 1, 8), mat(cfg.foot), .012, .1, .012, 0, .05, 0, leaf); add(sph, mat(cfg.foot), .05, .03, .025, .04, .11, 0, leaf);
  const feet = [-.12, .12].map(x => add(sph, mat(cfg.foot), .07, .04, .09, x, .04, .06, root));
  root.userData.pet = true;
  // Optional real model: replaces the procedural body, keeps the same idle/bounce/sleepy motion.
  (async () => {
    try {
      const base = new URL('../characters/', import.meta.url);
      const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('pet') : null;
      let file = (q && /\.glb$/i.test(q) ? q : null) || cfg.model;
      if (!file) file = (await fetch(new URL('manifest.json', base)).then(r => r.json()).catch(() => ({}))).pet;
      if (!file) return;
      const { GLTFLoader } = await import('../../vendor/addons/loaders/GLTFLoader.js');
      const g = await new GLTFLoader().loadAsync(new URL(file, base).href);
      while (body.children.length) body.remove(body.children[0]); feet.forEach(f => f.removeFromParent());
      g.scene.scale.setScalar(cfg.scale); g.scene.traverse(o => { if (o.isMesh) o.castShadow = true; }); body.add(g.scene);
      if (g.animations?.length) { const mx = new THREE.AnimationMixer(g.scene); mx.clipAction(g.animations[0]).play(); mixers.push(mx); }
    } catch (e) { console.warn('[study] pet model unavailable, using the built-in companion', e); }
  })();

  const mixers = [];
  const st = { name, state: 'idle', t: 0, nextBlink: 2.5, blink: 0, happyT: 0, idleFor: 0, home: new THREE.Vector3(), face: 0 };
  root.position.set(0, 0, 0);
  const api = {
    object: root, name,
    get state() { return st.state; },
    get mood() { return MOODS[st.state]; },
    setHome(x, z, faceY = 0) { st.home.set(x, 0, z); st.face = faceY; },
    setState(s) { if (s === 'happy') st.happyT = 1.5; st.state = s; st.idleFor = 0; api.onMood?.(api.mood); },
    nudge() { st.idleFor = 0; if (st.state === 'sleepy') api.setState('idle'); },
    update(dt) {
      st.t += dt; st.idleFor += dt; mixers.forEach(m => m.update(dt));
      if (st.state === 'idle' && st.idleFor > 45) api.setState('sleepy');
      // walk to home
      const d = st.home.clone().sub(root.position); d.y = 0; const dist = d.length();
      let moving = false;
      if (dist > .03) { moving = true; root.position.addScaledVector(d.normalize(), Math.min(dist, dt * .9)); root.rotation.y += (Math.atan2(d.x, d.z) - root.rotation.y) * Math.min(1, dt * 8); }
      else root.rotation.y += (st.face - root.rotation.y) * Math.min(1, dt * 5);
      // body motion
      const speed = st.state === 'sleepy' ? .8 : 2.2, amp = st.state === 'sleepy' ? .012 : st.state === 'focus' ? .008 : .02;
      let y = Math.abs(Math.sin(st.t * (moving ? 9 : speed))) * (moving ? .05 : amp), sq = 1;
      if (st.state === 'happy') { st.happyT -= dt; y = Math.abs(Math.sin(st.t * 9)) * .26; sq = 1 + (y < .03 ? -.12 : .06); if (st.happyT <= 0) api.setState('idle'); }
      body.position.y = y; body.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
      body.rotation.z = st.state === 'sleepy' ? Math.sin(st.t * .8) * .08 + .12 : Math.sin(st.t * 1.3) * .03;
      // eyes
      st.nextBlink -= dt; if (st.nextBlink <= 0) { st.blink = .14; st.nextBlink = 2.5 + (Math.sin(st.t * 12.9) + 1) * 1.8; }
      st.blink = Math.max(0, st.blink - dt);
      eyes.scale.y = st.state === 'sleepy' ? .25 : st.blink > 0 ? .12 : 1;
      leaf.rotation.z = Math.sin(st.t * 2.1) * .12 + (st.state === 'sleepy' ? .5 : 0);
      feet.forEach((f, i) => { f.position.y = .04 + (moving ? Math.max(0, Math.sin(st.t * 9 + i * Math.PI)) * .04 : 0); });
    },
    dispose() { root.removeFromParent(); }
  };
  return api;
}
