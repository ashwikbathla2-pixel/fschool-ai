// Shared golden-hour lighting + post settings for the whole world. Owner: Stanley (Opus). Read-only for other zones; ask before changing.
// World.js applies OUTSIDE when the camera is outdoors and INSIDE once it passes the doors (z < 1.5).
export const LIGHTING = {
  toneMapping: 'ACES',            // ACESFilmic everywhere (renderer on low/mid, ToneMappingEffect on high)
  exposure: 1.25,
  outside: {
    hemi: { sky: 0xb4a6d6, ground: 0x5a4234, intensity: 1.5 },
    sun: { color: 0xff9a5a, intensity: 3.2, dir: [-0.86, 0.22, -0.46] }, // low, behind-left; matches Sky.js SUN_DIR azimuth
    environmentIntensity: 1.0,     // PMREM baked from the sky; affects MeshStandard/Physical only
    fog: { color: 0xa98f93, near: 150, far: 850 },
    windowGlow: 0xffc27a,          // warm interior light, emissive > 1 so it blooms
  },
  inside: {
    hemi: { sky: 0xfff1e0, ground: 0xe8d9c2, intensity: 1.5 },   // Jim's original interior values, unchanged
    sun: { intensity: 0.35 },
    environmentIntensity: 0.35,
    fog: null,
  },
  post: {                          // high tier only (Ryan: no post on low/mid); ?post=1 forces it, ?post=0 disables
    bloom: { threshold: 0.9, smoothing: 0.25, intensity: 0.9, radius: 0.72 },
    ao: { radius: 1.6, intensity: 2.2, distanceFalloff: 0.8 },
    dof: { bokehScale: 1.6, focusRange: 0.035 },
    grade: { saturation: 0.08, contrast: 0.06, fringe: 0.0006, grain: 0.12 },
    vignette: { offset: 0.32, darkness: 0.5 },
  },
};
