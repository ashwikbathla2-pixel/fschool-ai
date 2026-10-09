// Golden-hour sky: gradient + drifting fbm stratocumulus lit orange/pink from a sun just under the horizon. Owner: Stanley (Opus).
// High/mid: shader dome (also baked once into the PMREM environment). Low / WebGPU: a painted equirect canvas, same colours.
import * as THREE from 'three';
import { paint } from './pbr.js';

export const SUN_DIR = new THREE.Vector3(-0.86, 0.06, -0.5).normalize(); // low, behind-left of the school
export const HAZE = 0xc99a8c;

const vert = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = normalize((modelMatrix * vec4(position, 0.0)).xyz);
  vec4 p = projectionMatrix * viewMatrix * vec4((modelMatrix * vec4(position, 1.0)).xyz, 1.0);
  gl_Position = p.xyww; // always on the far plane
}`;
const frag = /* glsl */`
uniform float uTime; uniform vec3 uSun; uniform float uClouds; uniform float uExposure;
varying vec3 vDir;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { float a = 0.5, s = 0.0; mat2 r = mat2(1.6, 1.2, -1.2, 1.6); for (int i = 0; i < 5; i++) { s += a * n(p); p = r * p; a *= 0.5; } return s; }
void main() {
  vec3 d = normalize(vDir);
  float e = clamp(d.y, -1.0, 1.0);
  float sunAz = max(dot(normalize(d.xz), normalize(uSun.xz)), 0.0);
  // gradient: pale gold horizon -> coral -> lavender -> dusk blue
  vec3 hor = vec3(1.0, 0.70, 0.42), cor = vec3(0.93, 0.52, 0.44), lav = vec3(0.52, 0.48, 0.66), zen = vec3(0.20, 0.25, 0.45);
  float t = max(e, 0.0);
  vec3 c = mix(hor, cor, smoothstep(0.0, 0.10, t));
  c = mix(c, lav, smoothstep(0.08, 0.32, t));
  c = mix(c, zen, smoothstep(0.30, 0.95, t));
  c += vec3(1.0, 0.55, 0.25) * pow(sunAz, 6.0) * exp(-t * 9.0) * 0.9;   // sunset glow on its side
  c = mix(c, vec3(0.42, 0.33, 0.36), smoothstep(0.0, -0.08, e));          // below horizon: haze
  // clouds on a plane above the camera, stretched into streaks
  if (e > 0.005 && uClouds > 0.0) {
    vec2 uv = d.xz / (e + 0.06) * 0.42;
    uv = vec2(uv.x * 0.55 + uv.y * 0.25, uv.y * 1.6);
    uv += vec2(uTime * 0.006, uTime * 0.002);
    float base = fbm(uv * 1.3);
    float detail = fbm(uv * 4.7 + base * 1.6);
    float cov = smoothstep(0.40, 0.70, base * 0.75 + detail * 0.42);
    float dens = smoothstep(0.55, 0.95, base * 0.7 + detail * 0.5);
    vec3 lit = mix(vec3(1.0, 0.52, 0.20), vec3(0.98, 0.40, 0.40), smoothstep(0.15, 0.6, t)) * 1.15;  // orange low, pink higher
    vec3 shade = mix(vec3(0.47, 0.36, 0.46), vec3(0.30, 0.28, 0.40), smoothstep(0.1, 0.6, t));
    float sunLit = 0.35 + 0.65 * pow(sunAz, 1.5);
    vec3 cc = mix(lit * (0.75 + 0.6 * sunLit), shade, dens * 0.7);
    float fade = smoothstep(0.005, 0.08, e) * (1.0 - smoothstep(0.75, 1.0, t) * 0.6);
    c = mix(c, cc, min(1.0, cov * 1.15) * fade * uClouds);
  }
  c = pow(c, vec3(2.2)) * uExposure; // authored in sRGB, rendered linear
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function createSky({ quality }) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uSun: { value: SUN_DIR.clone() }, uClouds: { value: 1 }, uExposure: { value: 1.6 } },
    vertexShader: vert, fragmentShader: frag, side: THREE.BackSide, depthWrite: false, fog: false,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), mat);
  dome.frustumCulled = false; dome.renderOrder = -10; dome.name = 'sky';
  return { dome, mat, update(t) { mat.uniforms.uTime.value = t; } };
}

// Low tier / WebGPU path: the same palette painted once into an equirect canvas.
export function paintedSky() {
  const t = paint(1024, 512, (g, w, h) => {
    const r = g.createLinearGradient(0, 0, 0, h / 2);
    r.addColorStop(0, '#333f73'); r.addColorStop(0.45, '#857aa6'); r.addColorStop(0.75, '#ec8f7a'); r.addColorStop(0.93, '#ffb86c'); r.addColorStop(1, '#ffd08e');
    g.fillStyle = r; g.fillRect(0, 0, w, h / 2);
    g.fillStyle = '#6b5559'; g.fillRect(0, h / 2, w, h / 2);
    // sun glow at the sun azimuth
    const az = Math.atan2(SUN_DIR.x, -SUN_DIR.z), sx = ((az / (2 * Math.PI)) + 0.5) * w;
    const sg = g.createRadialGradient(sx, h / 2, 0, sx, h / 2, w * 0.18); sg.addColorStop(0, 'rgba(255,190,110,.85)'); sg.addColorStop(1, 'rgba(255,190,110,0)');
    g.fillStyle = sg; g.fillRect(0, 0, w, h / 2);
    // streaky clouds
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 90; i++) {
      const y = h * (0.12 + rnd() * 0.32), x = rnd() * w, len = 60 + rnd() * 220, th = 4 + rnd() * 12;
      const low = y / (h / 2);
      g.fillStyle = `rgba(${255},${Math.round(120 + low * 60)},${Math.round(90 + low * 20)},${0.10 + rnd() * 0.22})`;
      g.beginPath(); g.ellipse(x, y, len, th, (rnd() - 0.5) * 0.1, 0, Math.PI * 2); g.fill();
    }
  });
  t.mapping = THREE.EquirectangularReflectionMapping; return t;
}

// Bake the sky into a prefiltered environment (once) so PBR glass, water and bronze reflect the sunset.
export function bakeEnvironment(renderer, sky) {
  const pm = new THREE.PMREMGenerator(renderer);
  const s = new THREE.Scene(); const dome = sky.dome.clone(); dome.material = sky.mat.clone(); dome.material.uniforms.uClouds.value = 0.6;
  dome.geometry = new THREE.SphereGeometry(50, 32, 16); s.add(dome);
  // warm ground bounce so reflections are not black below the horizon
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshBasicMaterial({ color: 0x3a2d28 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -2; s.add(ground);
  const rt = pm.fromScene(s, 0.02, 0.1, 100);
  pm.dispose(); dome.material.dispose(); dome.geometry.dispose(); ground.geometry.dispose(); ground.material.dispose();
  return rt.texture;
}
