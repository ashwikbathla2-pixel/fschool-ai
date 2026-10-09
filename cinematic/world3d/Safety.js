// Debug panel (?debug), renderer watchdog and automatic material downgrade. Dependency-light; owner: Phyllis.
// Usage: import { debugPanel, watchRenderer, downgradeMaterials } from './Safety.js'
import * as THREE from 'three';

const isDebug = () => typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug');
const lines = []; let panel = null;
function paint() { if (panel) { panel.textContent = lines.slice(-40).join('\n'); panel.scrollTop = 1e9; } }
export function report(msg) { lines.push(`[${(performance.now() / 1000).toFixed(1)}s] ${msg}`); paint(); }

let installed = false;
export function debugPanel() {
  if (installed) return; installed = true;
  addEventListener('error', e => report(`error: ${e.message} @ ${(e.filename || '').split('/').slice(-2).join('/')}:${e.lineno}`));
  addEventListener('unhandledrejection', e => report(`rejection: ${e.reason?.message || e.reason}`));
  const ce = console.error; console.error = (...a) => { report('console.error: ' + a.map(x => x?.message || x).join(' ')); ce.apply(console, a); };
  if (!isDebug()) return;
  panel = document.createElement('pre');
  panel.style.cssText = 'position:fixed;left:8px;bottom:8px;max-width:min(92vw,640px);max-height:38vh;overflow:auto;margin:0;padding:10px 12px;background:rgba(20,24,32,.92);color:#e9e4da;font:11px/1.45 ui-monospace,Menlo,Consolas,monospace;border-radius:8px;z-index:99999;white-space:pre-wrap;pointer-events:auto';
  document.body.appendChild(panel);
  report(`url: ${location.href}`); report(`ua: ${navigator.userAgent}`);
  report(`three r${THREE.REVISION}, dpr ${devicePixelRatio}, screen ${innerWidth}x${innerHeight}`);
}

export function describeRenderer(renderer) {
  try {
    const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
    report(`WebGL${renderer.capabilities.isWebGL2 ? 2 : 1}, ${ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)}, maxTex ${renderer.capabilities.maxTextureSize}, precision ${renderer.capabilities.precision}`);
  } catch (e) { report('renderer info unavailable: ' + e.message); }
}

// Replace PBR-class materials with Lambert (cheaper, fewer shader features). Safe to call more than once.
export function downgradeMaterials(root) {
  const cache = new Map();
  root.traverse(o => {
    const m = o.material; if (!o.isMesh || !m || Array.isArray(m) || m.isMeshLambertMaterial || m.isMeshBasicMaterial) return;
    if (!cache.has(m)) {
      const l = new THREE.MeshLambertMaterial({ color: m.color, map: m.map || null, vertexColors: !!m.vertexColors, transparent: m.transparent, opacity: m.opacity, side: m.side, alphaTest: m.alphaTest });
      if (m.emissive) { l.emissive = m.emissive.clone(); l.emissiveIntensity = m.emissiveIntensity; }
      cache.set(m, l);
    }
    o.material = cache.get(m); o.castShadow = false; o.receiveShadow = false;
  });
}

// Watch a renderer: log shader errors, survive context loss, and downgrade once (Lambert, no shadows, pixelRatio 1).
export function watchRenderer(renderer, scene, { onDowngrade } = {}) {
  let downgraded = false;
  const downgrade = why => {
    if (downgraded) return; downgraded = true; report('downgrading: ' + why);
    try { renderer.shadowMap.enabled = false; renderer.setPixelRatio(1); renderer.toneMapping = THREE.NoToneMapping; downgradeMaterials(scene); scene.traverse(o => { if (o.isLight && o.castShadow) o.castShadow = false; }); onDowngrade?.(why); } catch (e) { report('downgrade failed: ' + e.message); }
  };
  renderer.debug.checkShaderErrors = true;
  renderer.debug.onShaderError = (gl, program, vs, fs) => {
    report('shader error: ' + (gl.getProgramInfoLog(program) || '').slice(0, 300) + ' | ' + (gl.getShaderInfoLog(fs) || gl.getShaderInfoLog(vs) || '').slice(0, 300));
    downgrade('shader error');
  };
  const cv = renderer.domElement;
  cv.addEventListener('webglcontextlost', e => { e.preventDefault(); report('webgl context lost'); downgrade('context lost'); });
  cv.addEventListener('webglcontextrestored', () => report('webgl context restored'));
  describeRenderer(renderer);
  return { downgrade, get downgraded() { return downgraded; } };
}
