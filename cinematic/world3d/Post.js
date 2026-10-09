// Post-processing for the high tier: N8AO ambient occlusion, mipmap bloom on the windows and lamps, subtle depth of field,
// vignette and ACES tone mapping, merged into as few full-screen passes as pmndrs/postprocessing allows. Owner: Stanley (Opus).
import * as THREE from 'three';
import { EffectComposer, RenderPass, EffectPass, BloomEffect, DepthOfFieldEffect, VignetteEffect, ToneMappingEffect, ToneMappingMode, HueSaturationEffect, BrightnessContrastEffect, NoiseEffect, ChromaticAberrationEffect, BlendFunction } from '../vendor/postprocessing.js';
import { N8AOPostPass } from '../vendor/N8AO.js';
import { LIGHTING } from './lighting.js';

export function createPost(renderer, scene, camera, { ao = true, dof = true, msaa = 4, grade = true } = {}) {
  const P = LIGHTING.post;
  const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType, multisampling: msaa });
  composer.addPass(new RenderPass(scene, camera));
  let n8 = null;
  if (ao) {
    n8 = new N8AOPostPass(scene, camera, 1, 1);
    Object.assign(n8.configuration, { aoRadius: P.ao.radius, distanceFalloff: P.ao.distanceFalloff, intensity: P.ao.intensity, halfRes: true, depthAwareUpsampling: true, gammaCorrection: false, color: new THREE.Color(0x1a1010) });
    n8.setQualityMode('Low');
    composer.addPass(n8);
  }
  const bloom = new BloomEffect({ mipmapBlur: true, luminanceThreshold: P.bloom.threshold, luminanceSmoothing: P.bloom.smoothing, intensity: P.bloom.intensity, radius: P.bloom.radius });
  const effects = [bloom];
  let depth = null;
  if (dof) {
    depth = new DepthOfFieldEffect(camera, { worldFocusDistance: 30, worldFocusRange: 40, bokehScale: P.dof.bokehScale, resolutionScale: 0.5 });
    effects.push(depth);
  }
  effects.push(new VignetteEffect({ offset: P.vignette.offset, darkness: P.vignette.darkness }), new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC }));
  // film look after tone mapping: a touch of colour and contrast, lens fringing at the edges, fine grain
  if (grade) {
    const G = P.grade;
    effects.push(
      new HueSaturationEffect({ saturation: G.saturation }),
      new BrightnessContrastEffect({ contrast: G.contrast }),
      new ChromaticAberrationEffect({ offset: new THREE.Vector2(G.fringe, G.fringe), radialModulation: true, modulationOffset: 0.35 }),
      new NoiseEffect({ blendFunction: BlendFunction.OVERLAY, premultiply: true }),
    );
    effects[effects.length - 1].blendMode.opacity.value = G.grain;
  }
  // DOF has its own convolution pass; keep it separate so bloom/vignette/tone mapping still merge into one
  if (depth) { composer.addPass(new EffectPass(camera, depth)); effects.splice(effects.indexOf(depth), 1); }
  composer.addPass(new EffectPass(camera, ...effects));

  return {
    composer,
    setSize(w, h) { composer.setSize(w, h, false); },
    // focus on what the camera is looking at; range widens with distance so near shots stay mostly sharp
    focus(dist) { if (depth) { depth.cocMaterial.worldFocusDistance = dist; depth.cocMaterial.worldFocusRange = Math.max(6, dist * 1.2); } },
    render(dt) { composer.render(dt); },
    dispose() { composer.dispose(); },
  };
}
