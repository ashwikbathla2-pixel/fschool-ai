// Pre-rendered "plate": an Unreal-rendered flythrough of the exterior (welcome + start of entrance), scrubbed by scroll.
// Drop frames into plates/mansion/ and set "enabled": true in manifest.json (see plates/README.md). Disabled or missing = live three.js only.
// Keeps a small window of decoded frames (never the whole sequence) so phones do not run out of memory.
const clamp = (v, a = 0, b = 1) => Math.min(Math.max(v, a), b);

export async function createPlate({ stage, before, quality, params = new URLSearchParams(location.search) }) {
  if (params.get('plate') === '0') return null;
  let m;
  try { const res = await fetch('plates/mansion/manifest.json', { cache: 'no-cache' }); if (!res.ok) return null; m = await res.json(); } catch { return null; }
  if (!m.enabled || !(m.frames > 1)) return null;

  const step = Math.max(1, quality.frameStep || 1);           // low tier loads every 2nd frame
  const count = Math.ceil(m.frames / step);
  const url = i => `plates/mansion/${m.pattern.replace('{n}', String(m.start + Math.min(i * step, m.frames - 1)).padStart(m.pad || 4, '0'))}`;

  const canvas = document.createElement('canvas');
  canvas.id = 'cine-plate'; canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;will-change:opacity';
  stage.insertBefore(canvas, before);                          // above the live canvas, below scrim and UI
  const g = canvas.getContext('2d', { alpha: false });

  const cache = new Map(), pending = new Set();                // index -> ImageBitmap
  const BACK = 4, AHEAD = quality.tier === 'low' ? 8 : 16;
  let cw = 1, ch = 1, shown = -1, want = 0;

  function load(i) {
    if (i < 0 || i >= count || cache.has(i) || pending.has(i)) return;
    pending.add(i);
    fetch(url(i)).then(r => r.ok ? r.blob() : Promise.reject(r.status)).then(createImageBitmap).then(bmp => {
      pending.delete(i);
      if (i < want - BACK - 1 || i > want + AHEAD + 1) { bmp.close(); return; }
      cache.set(i, bmp); if (Math.abs(i - want) <= 1 || shown < 0) paint(true);
    }).catch(() => pending.delete(i));
  }
  function nearest(i) {
    for (let d = 0; d < count; d++) { if (cache.has(i - d)) return i - d; if (cache.has(i + d)) return i + d; }
    return -1;
  }
  function paint(force) {
    const i = nearest(want);
    if (i < 0 || (i === shown && !force)) return;
    const bmp = cache.get(i); shown = i;
    const s = Math.max(cw / bmp.width, ch / bmp.height), w = bmp.width * s, h = bmp.height * s;   // object-fit: cover
    g.drawImage(bmp, (cw - w) / 2, (ch - h) / 2, w, h);
  }
  function prune() {
    for (const [i, bmp] of cache) if (i < want - BACK || i > want + AHEAD + 2) { bmp.close(); cache.delete(i); }
  }

  // warm the first frames; the loader stays up until at least the first few are ready
  const first = Math.min(count, 8);
  for (let i = 0; i < first; i++) load(i);

  return {
    canvas, endScene: m.end.scene, endQ: m.end.q,
    resize(w, h, dpr) { cw = canvas.width = Math.round(w * Math.min(dpr, 1.5)); ch = canvas.height = Math.round(h * Math.min(dpr, 1.5)); shown = -1; paint(true); },
    // p: 0..1 across the plate's scroll range. Returns { covering, needWorld } so the caller can skip 3D rendering while the plate hides it.
    update(p) {
      p = clamp(p); want = Math.round(p * (count - 1));
      for (let i = want; i <= want + AHEAD; i++) load(i);
      for (let i = want - 1; i >= want - BACK; i--) load(i);
      prune(); paint(false);
      const f = m.fade || 0.05, o = p >= 1 ? 0 : clamp((1 - p) / f);
      canvas.style.opacity = String(o);
      return { covering: o >= 1, needWorld: o < 1 || p > 1 - f * 3 };
    },
    hide() { canvas.style.opacity = '0'; },
    dispose() { cache.forEach(b => b.close()); cache.clear(); canvas.remove(); },
    get ready() { return cache.size >= Math.min(first, 3); },
  };
}
