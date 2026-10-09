// Reggie: the FSchool AI pet, a friendly purple brain. Same interface as Pet.js (drop-in), plus group/setMood aliases.
// Procedural only: two lobed hemispheres + feet in ONE mesh, face (eyes, smile) in a second. ~1.5k triangles, 2 draw calls, no textures.
// Gyri are drawn in the fragment shader (meandering groove lines), so no extra geometry is needed.
import * as THREE from 'three';

export const REGGIE = { name: 'Reggie', color: '#9a7be6', groove: '#6a4fc0', foot: '#7d5fd0', scale: 1 };
export const MOODS = { idle: 'Content', focus: 'Focused', happy: 'Delighted', sleepy: 'Sleepy' };
const ALIAS = { idle: 'idle', content: 'idle', focus: 'focus', focused: 'focus', happy: 'happy', delighted: 'happy', sleepy: 'sleepy' };

const col = c => new THREE.Color(c);
const hash = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };

// Merge parts into one indexed BufferGeometry with position/normal/color/brain attributes.
function merge(parts) {
  const P = [], N = [], C = [], B = [], I = []; let off = 0;
  for (const { geo, color, brain = 0 } of parts) {
    const p = geo.attributes.position, n = geo.attributes.normal, c = color && col(color);
    for (let i = 0; i < p.count; i++) {
      P.push(p.getX(i), p.getY(i), p.getZ(i)); N.push(n.getX(i), n.getY(i), n.getZ(i)); B.push(brain);
      if (geo.attributes.color) C.push(geo.attributes.color.getX(i), geo.attributes.color.getY(i), geo.attributes.color.getZ(i)); else C.push(c.r, c.g, c.b);
    }
    const idx = geo.index; for (let i = 0; i < idx.count; i++) I.push(idx.getX(i) + off); off += p.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setAttribute('brain', new THREE.Float32BufferAttribute(B, 1)); g.setIndex(I);
  return g;
}

// One brain hemisphere: sphere with lumpy lobes, flattened toward the centre fissure, slightly pinched at the bottom (two "feet" lobes).
function hemisphere(side, cfg) {
  const g = new THREE.SphereGeometry(1, 22, 15), p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const ax = Math.abs(v.x), lump = 1 + .05 * Math.sin(ax * 4.2 + .4) * Math.sin(v.y * 4.6 + .6) + .035 * Math.sin(v.y * 3.2 + v.z * 3.8) + .02 * Math.sin(v.z * 5.2 - ax * 3.4);
    v.multiplyScalar(lump);
    v.x *= .56; v.y *= .78; v.z *= .66;
    if (side * v.x < 0) v.x *= .12;                                  // flat inner wall -> fissure
    v.x += side * .035;
    if (v.y < -.18) { v.y += (v.y + .18) * .12; v.x *= 1 + (v.y + .18) * .25; }   // bottom pinch
    p.setXYZ(i, v.x * cfg.sx, v.y * cfg.sy, v.z * cfg.sz);
  }
  g.computeVertexNormals(); return g;
}

function shade(m, cfg) {
  const groove = col(cfg.groove);
  m.onBeforeCompile = s => {
    s.uniforms.uGroove = { value: new THREE.Vector3(groove.r, groove.g, groove.b) };
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nattribute float brain; varying float vBr; varying vec3 vObj;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBr = brain; vObj = position;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vBr; varying vec3 vObj; uniform vec3 uGroove;')
      .replace('#include <color_fragment>', `#include <color_fragment>
      if (vBr > .5) {
        vec3 q = vec3(abs(vObj.x) * 1.15, vObj.y, vObj.z) * 15.;
        float f = sin(q.x + sin(q.y * .8 + q.z * .6) * 1.7) * sin(q.y + sin(q.z * .8 + q.x * .6) * 1.7) + .35 * sin(q.z * 1.3 + q.x * .7);
        float gr = 1. - smoothstep(.0, .2, abs(f));                    // groove line
        float fis = 1. - smoothstep(.0, .045, abs(vObj.x));            // central fissure
        float ridge = smoothstep(.2, .7, abs(f));
        vec3 base = diffuseColor.rgb * mix(.94, 1.12, ridge);
        diffuseColor.rgb = mix(base, uGroove, clamp(gr * .85 + fis, 0., 1.));
      }`);
  };
  return m;
}

export function createReggie(opts = {}) {
  const cfg = { ...REGGIE, ...opts }, name = cfg.name, S = cfg.scale;
  const dim = { sx: .5, sy: .36, sz: .4 };                          // brain ~1.0 wide x .56 tall x .8 deep (in unit space), scaled below
  const root = new THREE.Group(), body = new THREE.Group(), brainPivot = new THREE.Group(); root.add(body); body.add(brainPivot);
  root.scale.setScalar(S); root.userData.pet = true; root.userData.reggie = true;

  // --- body mesh: hemispheres + feet (vertex colours; brain=1 drives the groove shader) ---
  const foot = (x, z) => { const g = new THREE.SphereGeometry(1, 8, 5); g.scale(.085, .045, .11); g.translate(x, -.265, z); return g; };
  const bodyGeo = merge([
    { geo: hemisphere(-1, dim), color: cfg.color, brain: 1 }, { geo: hemisphere(1, dim), color: cfg.color, brain: 1 },
    { geo: foot(-.13, .08), color: cfg.foot }, { geo: foot(.13, .08), color: cfg.foot }]);
  bodyGeo.translate(0, 0, 0);
  const bodyMat = shade(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .55, metalness: 0 }), cfg);
  const brain = new THREE.Mesh(bodyGeo, bodyMat); brain.castShadow = true; brain.position.y = .3;
  // feet sit at root level: shift so the feet touch y=0 (feet centre y=.045 in geometry space, brain centre at .3)
  brain.position.y = .3 - 0;
  brainPivot.add(brain);

  // --- face mesh: eyes, highlights, cheeks, smile (one draw call). Each feature is dropped onto the brain's front surface by raycast. ---
  const FY = -.065; brain.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(), surf = (x, y) => { ray.set(new THREE.Vector3(x, y + FY + brain.position.y, 1), new THREE.Vector3(0, 0, -1)); const h = ray.intersectObject(brain)[0]; return h ? 1 - h.distance : .2; };
  const put = (g, x, y, lift, sx = x) => { g.translate(x, y, surf(sx, y) + lift); return g; };
  const eye = x => { const g = new THREE.SphereGeometry(1, 10, 6); g.scale(.046, .062, .02); return put(g, x, 0, .004); };
  const shine = x => { const g = new THREE.SphereGeometry(1, 6, 4); g.scale(.017, .02, .008); return put(g, x + .014, .026, .024); };
  const cheek = x => { const g = new THREE.SphereGeometry(1, 8, 4); g.scale(.04, .024, .008); return put(g, x, -.058, .0); };
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-.05, 0, 0), new THREE.Vector3(0, -.05, 0), new THREE.Vector3(.05, 0, 0));
  const mouthGeo = new THREE.TubeGeometry(curve, 8, .011, 4, false); put(mouthGeo, 0, -.07, .012, .05);
  const faceGeo = merge([
    { geo: eye(-.105), color: '#241c4a' }, { geo: eye(.105), color: '#241c4a' },
    { geo: shine(-.105), color: '#ffffff' }, { geo: shine(.105), color: '#ffffff' },
    { geo: cheek(-.18), color: '#ff9fc4' }, { geo: cheek(.18), color: '#ff9fc4' },
    { geo: mouthGeo, color: '#3a2468' }]);
  const faceMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .35, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const face = new THREE.Mesh(faceGeo, faceMat); face.position.set(0, FY, 0); brain.add(face);

  brainPivot.position.y = 0;

  const st = { name, state: 'idle', t: 0, nextBlink: 2.2, blink: 0, happyT: 0, idleFor: 0, home: new THREE.Vector3(), face: 0, tiltT: 0, tilt: 0 };
  const api = {
    object: root, group: root, name,
    get state() { return st.state; },
    get mood() { return MOODS[st.state]; },
    setHome(x, z, faceY = 0) { st.home.set(x, 0, z); st.face = faceY; },
    setState(s) { s = ALIAS[String(s).toLowerCase()] || 'idle'; if (s === 'happy') st.happyT = 1.5; st.state = s; st.idleFor = 0; api.onMood?.(api.mood); },
    setMood(s) { api.setState(s); },
    nudge() { st.idleFor = 0; if (st.state === 'sleepy') api.setState('idle'); },
    update(dt) {
      dt = Math.min(dt, .1); st.t += dt; st.idleFor += dt;
      if (st.state === 'idle' && st.idleFor > 45) api.setState('sleepy');
      // follow to home
      const d = st.home.clone().sub(root.position); d.y = 0; const dist = d.length(); let moving = false;
      if (dist > .03) { moving = true; root.position.addScaledVector(d.normalize(), Math.min(dist, dt * .9)); root.rotation.y += (Math.atan2(d.x, d.z) - root.rotation.y) * Math.min(1, dt * 8); }
      else root.rotation.y += (st.face - root.rotation.y) * Math.min(1, dt * 5);
      // body motion: hover bob / hop / squash
      const sleepy = st.state === 'sleepy', focus = st.state === 'focus', happy = st.state === 'happy';
      const speed = sleepy ? .8 : 2.2, amp = sleepy ? .01 : focus ? .006 : .02;
      let y = Math.abs(Math.sin(st.t * (moving ? 9 : speed))) * (moving ? .05 : amp) + (moving ? 0 : .012 + Math.sin(st.t * speed) * amp * .5), sq = 1;
      if (happy) { st.happyT -= dt; y = Math.abs(Math.sin(st.t * 9)) * .26; sq = 1 + (y < .03 ? -.12 : .06); if (st.happyT <= 0) api.setState('idle'); }
      body.position.y = y; body.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
      // tilt: curious head-tilts at idle, droopy lean when sleepy, tiny forward lean when focused
      st.tiltT -= dt; if (st.tiltT <= 0) { st.tiltT = 3 + hash(st.t, 1, 2) * 4; st.tilt = (hash(st.t, 3, 4) - .5) * .22; }
      const tz = sleepy ? Math.sin(st.t * .8) * .06 + .16 : focus ? Math.sin(st.t * 1.1) * .01 : happy ? Math.sin(st.t * 18) * .08 : st.tilt + Math.sin(st.t * 1.3) * .025;
      brainPivot.rotation.z += (tz - brainPivot.rotation.z) * Math.min(1, dt * 4);
      const tx = focus ? .12 : sleepy ? .1 + Math.sin(st.t * .8) * .03 : 0;
      brainPivot.rotation.x += (tx - brainPivot.rotation.x) * Math.min(1, dt * 4);
      // face: blink + mood eye height, smile size
      st.nextBlink -= dt; if (st.nextBlink <= 0) { st.blink = .13; st.nextBlink = 2.2 + hash(st.t, 5, 6) * 3.2; }
      st.blink = Math.max(0, st.blink - dt);
      const open = sleepy ? .3 : focus ? .78 : happy ? 1.12 : 1;
      face.scale.set(happy ? 1.06 : 1, st.blink > 0 ? Math.max(.1, open * .12) : open, 1);
      face.position.y += ((sleepy ? FY - .03 : focus ? FY : FY) - face.position.y) * Math.min(1, dt * 6);
    },
    dispose() { root.removeFromParent(); bodyGeo.dispose(); faceGeo.dispose(); bodyMat.dispose(); faceMat.dispose(); }
  };
  return api;
}
