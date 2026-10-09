// The real-time 3D world: builds the zones, owns the renderer + post pipeline, and maps (scene, q) to a camera pose.
// Pipeline (Stanley/Opus): three r186, PBR + sunset PMREM environment, static soft sun shadows, pool mirror,
// pmndrs post on the high tier, optional WebGPURenderer behind ?renderer=webgpu. Zones/hooks for the interior: Jim.
import * as THREE from 'three';
import { clamp, smooth, lerp } from './materials.js';
import { buildExterior } from './Exterior.js';
import { buildEntrance } from './Entrance.js';
import { buildHallway } from './Hallway.js';
import { buildReception, REC } from './Reception.js';
import { buildReceptionist } from './Receptionist.js';
import { sampleRig, ORDER } from './CameraRig.js';
import { mergeStatic } from './merge.js';
import { createSky, paintedSky, bakeEnvironment, HAZE } from './Sky.js';
import { LIGHTING } from './lighting.js';
import { watchRenderer } from './Safety.js';
import { watchBudget, budgetCheck } from '../quality.js';

const params = new URLSearchParams(location.search);
// Experimental: ?renderer=webgpu uses WebGPURenderer (it falls back to its own WebGL2 backend). Same scene, no pmndrs post.
let WebGPURenderer = null;
if (params.get('renderer') === 'webgpu') {
  try { ({ WebGPURenderer } = await import('../vendor/three.webgpu.js')); } catch (e) { console.warn('[world] WebGPU build unavailable, using WebGL', e); }
}

export function createWorld({ canvas, quality, reducedMotion }) {
  const gpu = !!WebGPURenderer;
  const renderer = gpu ? new WebGPURenderer({ canvas, antialias: quality.antialias, powerPreference: 'high-performance' })
    : new THREE.WebGLRenderer({ canvas, antialias: quality.antialias && quality.tier !== 'high', powerPreference: 'high-performance', stencil: false });
  let ready = !gpu;
  if (gpu) renderer.init().then(() => { ready = true; }, err => console.warn('[world] WebGPU init failed', err));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = LIGHTING.exposure;
  renderer.shadowMap.enabled = !!quality.shadows; renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;   // baked once outside, live inside
  if (renderer.info) renderer.info.autoReset = false;                              // count every pass of a frame

  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(42, 1, 0.1, 2000);
  const O = LIGHTING.outside, I = LIGHTING.inside;

  // sky: shader dome (mid/high, WebGL) or a painted panorama (low tier and WebGPU path)
  const shaderSky = !gpu && quality.tier !== 'low';
  const sky = shaderSky ? createSky({ quality }) : null;
  const painted = shaderSky ? null : paintedSky();
  if (sky) scene.add(sky.dome); else scene.background = painted;
  const fog = new THREE.Fog(O.fog.color, O.fog.near, O.fog.far); scene.fog = fog;

  // lights: hemisphere + low warm sun (+ Jim's lamp and reception key light inside)
  const hemi = new THREE.HemisphereLight(O.hemi.sky, O.hemi.ground, O.hemi.intensity); scene.add(hemi);
  const sun = new THREE.DirectionalLight(O.sun.color, O.sun.intensity);
  const sunDir = new THREE.Vector3(...O.sun.dir).normalize();
  sun.target.position.set(0, -3, 24); sun.position.copy(sun.target.position).addScaledVector(sunDir, 140); scene.add(sun, sun.target);
  if (quality.shadows) {
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.06; sun.shadow.radius = 4;
    Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 50, bottom: -50, near: 40, far: 260 }); sun.shadow.camera.updateProjectionMatrix();
  }
  const lamp = new THREE.PointLight(0xffe2c0, 0, 16, 1.6); scene.add(lamp);
  const key = new THREE.DirectionalLight(0xfff0dc, 0); key.position.set(-5, 14, -40); key.target.position.set(0, 0, REC.deskZ); scene.add(key, key.target);
  if (quality.shadows) {
    key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03;
    Object.assign(key.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
  }

  const ext = buildExterior({ quality, renderer, reflect: !gpu && params.get('reflect') !== '0', textures: !gpu });
  const ent = buildEntrance({ quality }), hall = buildHallway({ quality });
  const rec = buildReception({ quality, logoMat: ext.logoMat });
  const procedural = buildReceptionist({ quality, position: new THREE.Vector3(0, 0, REC.deskZ - 0.55) });
  let girl = procedural;
  rec.group.add(procedural.root); procedural.root.userData.keep = true;
  [ext.group, ent.group, ent.vestibule, hall.group, rec.group].forEach(mergeStatic);
  scene.add(ext.group, ent.group, ent.vestibule, hall.group, rec.group);

  // sunset environment for PBR reflections (glass, bronze, water)
  let envMap = null;
  if (quality.tier !== 'low') {
    try { envMap = sky ? bakeEnvironment(renderer, sky) : painted; } catch (e) { console.warn('[world] environment bake failed', e); }
    scene.environment = envMap; scene.environmentIntensity = O.environmentIntensity;
  }

  // post: high tier only (Ryan's budgets); ?post=1 forces it on mid, ?post=0 turns it off
  const wantPost = () => !gpu && (params.get('post') === '1' || (quality.tier === 'high' && params.get('post') !== '0'));
  let post = null, postLoading = null;
  const enablePost = on => {
    if (!on) { post?.dispose(); post = null; renderer.toneMapping = THREE.ACESFilmicToneMapping; return; }
    if (post || postLoading) return;
    postLoading = import('./Post.js').then(({ createPost }) => {
      post = createPost(renderer, scene, cam, { ao: params.get('ao') !== '0', dof: params.get('dof') !== '0' && !reducedMotion, grade: params.get('grade') !== '0', msaa: renderer.capabilities?.isWebGL2 ? 4 : 0 });
      renderer.toneMapping = THREE.NoToneMapping; post.setSize(size.w, size.h);
    }).catch(e => { console.warn('[world] post-processing unavailable, rendering direct', e); }).finally(() => { postLoading = null; });
  };
  const safety = gpu ? null : watchRenderer(renderer, scene, { onDowngrade: () => enablePost(false) });
  const stopBudget = watchBudget(renderer, scene);

  const rig = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
  const cur = { pos: new THREE.Vector3(0, 17, 116), look: new THREE.Vector3(0, 7.5, 0) };
  const target = { id: 'welcome', q: 0 };
  const st = { tg: 0, px: 0, py: 0, mx: 0, my: 0, t: 0, still: reducedMotion, inside: null };
  if (!reducedMotion) addEventListener('pointermove', e => { st.mx = e.clientX / innerWidth - 0.5; st.my = e.clientY / innerHeight - 0.5; }, { passive: true });

  let baseFov = 42; const size = { w: 1, h: 1 };
  function resize(w, h, dpr) {
    // post-processing renders several full-screen passes: cap its pixel ratio at 1.5
    renderer.setPixelRatio(wantPost() ? Math.min(dpr, 1.5) : dpr); renderer.setSize(w, h, false); size.w = w; size.h = h;
    cam.aspect = w / h; baseFov = cam.aspect < 0.8 ? 64 : cam.aspect < 1.2 ? 52 : 42; cam.fov = baseFov; cam.updateProjectionMatrix();
    post?.setSize(w, h);
  }
  enablePost(wantPost());

  function zones(z) {
    ext.group.visible = z > -1.5; ent.group.visible = z > -1.5; ent.vestibule.visible = z > -9; if (sky) sky.dome.visible = z > -9;
    hall.group.visible = z < 3 && z > -37; rec.group.visible = z < (quality.tier === 'low' ? -12 : -9);
    const inside = z < 1.5;
    if (inside !== st.inside) {
      st.inside = inside;
      scene.fog = inside ? null : fog;
      const L = inside ? I.hemi : O.hemi; hemi.color.set(L.sky); hemi.groundColor.set(L.ground); hemi.intensity = L.intensity;
      sun.intensity = inside ? I.sun.intensity : O.sun.intensity;
      scene.environmentIntensity = inside ? I.environmentIntensity : O.environmentIntensity;
      sun.castShadow = !!quality.shadows && !inside;
      renderer.shadowMap.autoUpdate = inside; renderer.shadowMap.needsUpdate = true;   // re-bake once when stepping back out
    }
    lamp.intensity = inside ? 14 : 0; key.intensity = z < -30 ? (quality.shadows ? 1.6 : 0.8) : 0;
  }

  return {
    get girl() { return girl; },
    // swap in the supplied rigged receptionist once it has loaded (?glb=0 keeps the procedural fallback)
    async upgradeReceptionist() {
      if (params.get('glb') === '0') return false;
      try {
        const { loadReceptionistGLB } = await import('./ReceptionistGLB.js');
        const g = await loadReceptionistGLB({ quality, position: new THREE.Vector3(0, 0, REC.deskZ - 0.55) });
        g.root.userData.keep = true; rec.group.add(g.root); procedural.root.visible = false; girl = g;
        const rim = new THREE.DirectionalLight(0xc9d8ff, 1.1); rim.position.set(3.5, 4.5, -58); rim.target.position.set(0, 1.4, REC.deskZ - 0.5); scene.add(rim, rim.target);
        return true;
      } catch (err) { console.warn('[cinematic] glTF receptionist unavailable, keeping the built one', err); return false; }
    },
    set(sceneId, q) { target.id = sceneId; target.q = q; st.tg = ORDER.indexOf(sceneId) + q; },
    update(t, dt) {
      st.t = t;
      const tg = st.tg;
      sampleRig(target.id, target.q, rig);
      // gentle follow so scroll feels physical; snaps in reduced motion
      const k = reducedMotion ? 1 : 1 - Math.exp(-6 * dt);
      cur.pos.lerp(rig.pos, k); cur.look.lerp(rig.look, k);
      st.px = lerp(st.px, st.mx, 0.05); st.py = lerp(st.py, st.my, 0.05);
      const bob = reducedMotion ? 0 : Math.sin(t * 1.7) * 0.012 * clamp((tg - 0.9) / 0.3) * (cur.pos.z < 0 ? 1 : 0.4);
      const zoom = lerp(1, 0.84, smooth(clamp((tg - 3.35) / 0.65)));
      if (Math.abs(cam.fov - baseFov * zoom) > 0.01) { cam.fov = baseFov * zoom; cam.updateProjectionMatrix(); }
      // pointer parallax: stronger in the wide exterior shots, where the terraces really separate in depth
      const par = cur.pos.z > 2 ? 1.6 : 0.5;
      cam.position.set(cur.pos.x + st.px * par, cur.pos.y + bob - st.py * 0.18 * par, cur.pos.z);
      cam.lookAt(cur.look.x + st.px * 0.3, cur.look.y - st.py * 0.1, cur.look.z);

      const haze = 1 - smooth(clamp(tg / 0.95));
      sky?.update(t);
      ext.update(t, haze, cam.position);
      fog.near = lerp(O.fog.near * 1.4, O.fog.near, haze); fog.far = lerp(O.fog.far * 1.3, O.fog.far, haze);
      ent.update(smooth(clamp((tg - 1.78) / 0.14)));
      zones(cam.position.z);
      lamp.position.set(cam.position.x, 3.4, cam.position.z - 2);
      girl.update(t, dt, cam.position, st.still);
      if (!ready) return;
      renderer.info?.reset?.();
      if (post) { post.focus(cam.position.distanceTo(cur.look)); post.render(dt); }
      else renderer.render(scene, cam);
    },
    get info() { return renderer.info.render; },
    debugInfo() { const b = budgetCheck(renderer, scene); return { ...b.stats, over: b.over, post: !!post, gpu, shadows: renderer.shadowMap.enabled }; },
    resize,
    get camZ() { return cam.position.z; },
    setQuality(q) {
      renderer.shadowMap.enabled = q.shadows; key.castShadow = q.shadows; sun.castShadow = q.shadows && !st.inside; renderer.shadowMap.needsUpdate = true;
      enablePost(wantPost() && q.tier === 'high');
    },
    dispose() { stopBudget(); post?.dispose(); envMap?.dispose?.(); renderer.dispose(); },
  };
}
