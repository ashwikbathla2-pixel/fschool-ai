// The 3D half of the Room: one white-studio shell, matte clay props merged per colour, soft daylight. Look = PRD section 7
// ("closer to an Apple product shot than a game world"). three is imported lazily so a failed load falls back to FlatRoom.
// createScene(stage, model, opts) -> Promise<{ dispose, hover(id), focus(id), canvas }>; rejects if WebGL cannot start.
import { quality, pixelRatio, applyTier, disposeThree } from '../quality.js';
import { ORBIT, clampYaw, clampPitch, targetById } from './roomThemes.js';

const mix = (a, b, t) => { const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); const x = p(a), y = p(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
const CLAY = { wall: '#f6f4f0', floor: '#e9e5de', trim: '#ffffff', wood: '#e3d9c8', warm: '#efe8dc', grey: '#d9d6d0', dark: '#3a3c40', glass: '#cfe3f2', leaf: '#a9bfae' };

export async function createScene(stage, model, { onPick, onHover, reduced = false, onLost } = {}) {
  const THREE = await import('three');
  const { mergeGeometries } = await import('../vendor/BufferGeometryUtils.js');
  const { w: W, d: D, h: H } = model.shape.size, corner = model.shape.corner, acc = model.accent;
  const seg = quality.tier === 'low' ? 2 : 4;

  const renderer = new THREE.WebGLRenderer({ antialias: quality.antialias, powerPreference: 'high-performance', alpha: false });   // throws if WebGL is unavailable
  applyTier(renderer);
  renderer.setClearColor(0xffffff, 1);
  const canvas = renderer.domElement;
  canvas.className = 'room-canvas'; canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', `${model.summary} Drag to rotate. Use the list of room objects to open anything in it.`);
  stage.appendChild(canvas);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);

  // ---- clay materials: one per colour, shared. Matte, no metalness. ----
  const mats = new Map();
  const mat = c => { let m = mats.get(c); if (!m) mats.set(c, m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.92, metalness: 0 })); return m; };

  // Rounded box: BoxGeometry whose vertices are pushed onto a rounded shell, normals follow the shell, so edges read as soft clay.
  const rbox = (w, h, d, r) => {
    r = Math.min(r, Math.min(w, h, d) * 0.45);
    const g = new THREE.BoxGeometry(w, h, d, seg, seg, seg), p = g.attributes.position, n = g.attributes.normal;
    const hw = w / 2 - r, hh = h / 2 - r, hd = d / 2 - r, v = new THREE.Vector3(), c = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      c.set(Math.max(-hw, Math.min(hw, v.x)), Math.max(-hh, Math.min(hh, v.y)), Math.max(-hd, Math.min(hd, v.z)));
      v.sub(c).normalize(); n.setXYZ(i, v.x, v.y, v.z);
      p.setXYZ(i, c.x + v.x * r, c.y + v.y * r, c.z + v.z * r);
    }
    return g;
  };

  // Prop kit: a collector merges everything of one colour into one mesh, so a whole object costs a handful of draw calls.
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), S = new THREE.Vector3(1, 1, 1), T = new THREE.Vector3();
  function collector(id) {
    const by = new Map();
    const put = (geo, col, x, y, z, ry = 0, rx = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
      T.set(x, y, z); E.set(rx, ry, rz); Q.setFromEuler(E); S.set(sx, sy, sz);
      geo.applyMatrix4(M.compose(T, Q, S));
      (by.get(col) || by.set(col, []).get(col)).push(geo);
    };
    const api = {
      box: (w, h, d, x, y, z, col, r = 0.03, ry = 0) => put(rbox(w, h, d, r), col, x, y, z, ry),          // (x,y,z) = centre
      cyl: (rt, rb, h, x, y, z, col, ry = 0, rx = 0, rz = 0) => put(new THREE.CylinderGeometry(rt, rb, h, seg * 4), col, x, y, z, ry, rx, rz),
      sph: (r, x, y, z, col, sx = 1, sy = 1, sz = 1) => put(new THREE.SphereGeometry(r, seg * 4, seg * 2 + 2), col, x, y, z, 0, 0, 0, sx, sy, sz),
      tor: (r, t, x, y, z, col, rx = Math.PI / 2) => put(new THREE.TorusGeometry(r, t, 8, seg * 6), col, x, y, z, 0, rx, 0),
      build() {
        const g = new THREE.Group(); g.userData.target = id;
        for (const [col, list] of by) { const m = new THREE.Mesh(mergeGeometries(list, false), mat(col)); m.userData.target = id; m.castShadow = m.receiveShadow = !!quality.shadows; g.add(m); list.forEach(x => x.dispose()); }
        return g;
      },
    };
    return api;
  }
  const place = (g, x, y, z, ry = 0) => { g.position.set(x, y, z); g.rotation.y = ry; scene.add(g); return g; };

  // ---- room shell: floating slab, two walls with openings, daylight ----
  const t = 0.12, shell = collector(null);
  shell.box(W + 0.3, 0.2, D + 0.3, 0, -0.1, 0, CLAY.floor, 0.05);                      // floor slab, top face at y = 0
  shell.box(W + 0.3, 0.03, D + 0.3, 0, -0.215, 0, CLAY.trim, 0.012);
  const wx0 = -W / 2 + 0.65, wx1 = W / 2 - 0.65;                                          // bookshelf centre / trophy centre on the back wall
  const winW = Math.min(3, Math.max(1.1, (wx1 - wx0) - 2.0)), winC = (wx0 + wx1) / 2, wl = winC - winW / 2, wr = winC + winW / 2;
  const wb = corner ? 0.15 : 0.9, wt = corner ? H - 0.1 : 2.0;                           // opening bottom / top: corner rooms get a floor-to-ceiling window
  const wall = (x0, x1, y0, y1) => { if (x1 - x0 > 0.01 && y1 - y0 > 0.01) shell.box(x1 - x0, y1 - y0, t, (x0 + x1) / 2, (y0 + y1) / 2, -D / 2 - t / 2, CLAY.wall, 0.02); };
  wall(-W / 2 - t, wl, 0, H); wall(wr, W / 2 + 0.02, 0, H); wall(wl, wr, 0, wb); wall(wl, wr, wt, H);
  const lw = (z0, z1, y0, y1) => { if (z1 - z0 > 0.01 && y1 - y0 > 0.01) shell.box(t, y1 - y0, z1 - z0, -W / 2 - t / 2, (y0 + y1) / 2, (z0 + z1) / 2, CLAY.wall, 0.02); };
  const sz0 = -D / 2 + 0.35, sz1 = -D / 2 + 1.15;                                         // corner rooms get a second, side window on the left wall
  if (corner) { lw(-D / 2 - t, sz0, 0, H); lw(sz1, D / 2, 0, H); lw(sz0, sz1, 0, 0.5); lw(sz0, sz1, H - 0.5, H); } else lw(-D / 2 - t, D / 2, 0, H);
  shell.box(t, H, t, -W / 2 - t / 2, H / 2, -D / 2 - t / 2, CLAY.trim, 0.02);             // corner post
  shell.box(W + 0.3, 0.07, 0.07, 0, 0.035, -D / 2 + 0.035, CLAY.trim, 0.02);              // skirting
  scene.add(shell.build());

  // ---- window (target): frame, glass, and the view behind it ----
  {
    const g = collector('window'), cy = (wb + wt) / 2, wh = wt - wb;
    g.box(winW + 0.12, 0.07, 0.2, winC, wb - 0.02, -D / 2 + 0.02, CLAY.trim, 0.02);      // sill
    g.box(0.05, wh, 0.1, winC, cy, -D / 2 - 0.02, CLAY.trim, 0.015); g.box(winW, 0.05, 0.1, winC, cy, -D / 2 - 0.02, CLAY.trim, 0.015);   // mullions
    g.box(0.06, wh, 0.1, wl, cy, -D / 2 - 0.02, CLAY.trim, 0.015); g.box(0.06, wh, 0.1, wr, cy, -D / 2 - 0.02, CLAY.trim, 0.015);
    if (corner) { g.box(0.1, 0.07, 0.8, -W / 2 + 0.02, 0.5, (sz0 + sz1) / 2, CLAY.trim, 0.02); g.box(0.05, H - 1.1, 0.05, -W / 2 - t / 2, H / 2, (sz0 + sz1) / 2, CLAY.trim, 0.012); }
    // buildings behind the glass; farther rows fade toward the white background (aerial perspective in three flat tones)
    const tone = [mix(CLAY.grey, '#c9d3de', 0.5), mix(CLAY.grey, '#ffffff', 0.45), mix(CLAY.grey, '#ffffff', 0.72)];
    for (const b of model.buildings) {
      const dz = model.shape.view === 'neighbour' ? 2.3 : 5 + b.depth * 3.2, sc = model.shape.view === 'neighbour' ? 1 : 1 + b.depth * 0.5;
      const bw = b.w * (winW / 2) * (model.shape.view === 'neighbour' ? 1.4 : 2.2) * (1 + b.depth * 0.1), bh = b.h * (model.shape.view === 'neighbour' ? 1 : sc);
      const bx = winC + b.x * (winW / 2 + 0.3 * b.depth), by = (wb + 0.1) - (model.shape.view === 'neighbour' ? 0.2 : 2.2 - b.depth * 0.4) + bh / 2 - 0.6;
      g.box(bw, bh, bw * 0.9, bx, by + 0.6, -D / 2 - dz - b.depth * 0.2, tone[b.depth], 0.04);
      if (model.shape.view === 'neighbour') for (let k = 0; k < 3; k++) g.box(bw * 0.55, 0.28, 0.02, bx, by + 0.6 + bh * (0.15 - k * 0.22), -D / 2 - dz + bw * 0.45, '#cbd5df', 0.02);
    }
    const grp = g.build(); scene.add(grp);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(winW, wh), new THREE.MeshStandardMaterial({ color: CLAY.glass, transparent: true, opacity: 0.14, roughness: 0.2, depthWrite: false }));
    glass.position.set(winC, cy, -D / 2 - 0.02); glass.userData.target = 'window'; grp.add(glass);
    if (corner) { const gs = new THREE.Mesh(new THREE.PlaneGeometry(sz1 - sz0, H - 1.0), glass.material); gs.rotation.y = Math.PI / 2; gs.position.set(-W / 2 - t / 2, H / 2, (sz0 + sz1) / 2); gs.userData.target = 'window'; grp.add(gs); }
    grp.userData.anchor = [winC, wt + 0.15, -D / 2];
  }

  // ---- text / shield helpers ----
  const textures = [];
  const label = (text, w, h, ink = '#33343a', bg = null) => {
    const c = document.createElement('canvas'); c.width = 256; c.height = Math.round(256 * h / w);
    const x = c.getContext('2d'); if (bg) { x.fillStyle = bg; x.fillRect(0, 0, c.width, c.height); }
    x.fillStyle = ink; x.font = `600 ${Math.round(c.height * 0.5)}px system-ui, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, c.width / 2, c.height / 2 + 2);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; textures.push(tex);
    return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  };
  // Shield: rounded top, pointed bottom. Colour = guarantee state; 'none' draws nothing but the strike count stays.
  const shieldMesh = (size, color) => {
    const s = new THREE.Shape(), r = size / 2;
    s.moveTo(-r, r * 0.8); s.quadraticCurveTo(-r, r * 1.05, -r * 0.5, r * 1.05); s.lineTo(r * 0.5, r * 1.05); s.quadraticCurveTo(r, r * 1.05, r, r * 0.8);
    s.lineTo(r, r * 0.05); s.quadraticCurveTo(r, -r * 0.6, 0, -r * 1.1); s.quadraticCurveTo(-r, -r * 0.6, -r, r * 0.05); s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth: size * 0.12, bevelEnabled: true, bevelSize: size * 0.04, bevelThickness: size * 0.04, bevelSegments: 2, curveSegments: 8 });
    const m = new THREE.Mesh(geo, mat(color)); m.userData.shield = true; return m;
  };
  const addShield = (grp, x, y, z, size, ry = 0) => {
    const sh = model.shield;
    if (sh.color) { const m = shieldMesh(size, sh.color); m.position.set(x, y, z); m.rotation.y = ry; grp.add(m); m.userData.target = grp.userData.target; }
    const lab = label(sh.strikeText, size * 2.2, size * 0.55); lab.position.set(x, y - size * 1.35, z + (ry ? 0 : 0.005)); lab.rotation.y = ry; lab.userData.target = grp.userData.target; grp.add(lab);
    for (let i = 0; i < sh.strikeLimit; i++) {                                           // strike pips: filled = struck
      const pip = new THREE.Mesh(new THREE.SphereGeometry(size * 0.07, 10, 8), mat(i < sh.strikes ? '#4a4b52' : '#d6d3cc'));
      const off = (i - (sh.strikeLimit - 1) / 2) * size * 0.26; pip.position.set(x + (ry ? 0 : off), y - size * 1.75, z + (ry ? off : 0.01)); pip.userData.target = grp.userData.target; grp.add(pip);
    }
  };

  // ---- desk and monitor (target) ----
  const dx = 0.2, dz = 0.15;
  {
    const g = collector('desk');
    g.box(1.6, 0.05, 0.75, 0, 0.74, 0, CLAY.wood, 0.02); g.box(0.05, 0.72, 0.65, -0.72, 0.36, 0, CLAY.warm, 0.015); g.box(0.05, 0.72, 0.65, 0.72, 0.36, 0, CLAY.warm, 0.015); g.box(1.4, 0.4, 0.03, 0, 0.5, -0.3, CLAY.warm, 0.012);
    g.cyl(0.04, 0.06, 0.2, 0, 0.87, -0.15, CLAY.grey); g.box(0.2, 0.02, 0.14, 0, 0.77, -0.15, CLAY.grey, 0.01);
    g.box(0.78, 0.46, 0.04, 0, 1.15, -0.15, CLAY.dark, 0.02); g.box(0.7, 0.38, 0.02, 0, 1.15, -0.125, mix(acc, '#ffffff', 0.62), 0.01);   // screen glows with the theme accent
    g.box(0.4, 0.015, 0.14, 0, 0.775, 0.18, CLAY.grey, 0.008);
    g.cyl(0.24, 0.24, 0.05, 0, 0.46, -0.78, acc); g.cyl(0.03, 0.03, 0.4, 0, 0.23, -0.78, CLAY.grey); g.box(0.4, 0.4, 0.06, 0, 0.74, -1.0, acc, 0.03);   // chair behind the desk
    const grp = place(g.build(), dx, 0, dz); grp.userData.anchor = [dx, 1.5, dz];
  }

  // ---- whiteboard (target) on the left wall ----
  {
    const zc = -0.3, g = collector('whiteboard');
    g.box(1.5, 0.95, 0.04, 0, 1.5, 0.03, CLAY.trim, 0.015); g.box(1.4, 0.85, 0.01, 0, 1.5, 0.055, '#fbfbfa', 0.004); g.box(1.3, 0.04, 0.07, 0, 1.0, 0.07, CLAY.grey, 0.015);
    for (let i = 0; i < 4; i++) { g.box(0.8 - i * 0.12, 0.035, 0.012, -0.2 - i * 0.03 + (0.8 - i * 0.12) / 2 - 0.4, 1.78 - i * 0.18, 0.062, i === 0 ? acc : CLAY.grey, 0.01); }
    g.cyl(0.015, 0.015, 0.12, 0.45, 1.06, 0.1, acc, 0, 0, Math.PI / 2);
    const grp = place(g.build(), -W / 2, 0, zc, Math.PI / 2); grp.userData.anchor = [-W / 2, 2.15, zc];
  }

  // ---- bookshelf (target) on the back wall, left ----
  {
    const g = collector('bookshelf'), n = Math.max(model.sessions.length, 3), books = [acc, CLAY.grey, mix(acc, '#ffffff', 0.5), CLAY.warm, '#cfc9be'];
    g.box(1.1, 1.8, 0.34, 0, 0.9, 0, CLAY.warm, 0.025);
    for (let s = 0; s < 4; s++) g.box(1.0, 0.03, 0.32, 0, 0.35 + s * 0.45, 0.01, CLAY.trim, 0.008);
    for (let i = 0; i < n * 2 && i < 18; i++) { const row = Math.floor(i / 5), bh = 0.24 + ((i * 37) % 7) * 0.02; g.box(0.07, bh, 0.22, -0.4 + (i % 5) * 0.1 - 0.0, 0.365 + row * 0.45 + bh / 2, 0.02, books[i % books.length], 0.01); }
    const grp = place(g.build(), wx0, 0, -D / 2 + 0.17); grp.userData.anchor = [wx0, 1.95, -D / 2];
  }

  // ---- trophy shelf (target) on the back wall, right: shield + milestone cups ----
  {
    const g = collector('trophy');
    g.box(1.0, 1.3, 0.28, 0, 0.65 + 0.4, 0, CLAY.warm, 0.025); g.box(0.9, 0.03, 0.26, 0, 0.95, 0.01, CLAY.trim, 0.008); g.box(0.9, 0.03, 0.26, 0, 1.4, 0.01, CLAY.trim, 0.008);
    g.box(1.0, 0.8, 0.28, 0, 0.4, 0, CLAY.warm, 0.025);
    model.milestones.list.slice(0, 4).forEach((m, i) => {
      const col = m.reached ? acc : '#e2dfd8', x = -0.33 + i * 0.22, y = i % 2 ? 0.98 : 1.43;
      g.cyl(0.07, 0.04, 0.12, x, y + 0.12, 0.02, col); g.cyl(0.03, 0.03, 0.06, x, y + 0.03, 0.02, col); g.cyl(0.07, 0.07, 0.02, x, y, 0.02, col);
    });
    const grp = place(g.build(), wx1, 0, -D / 2 + 0.15); addShield(grp, 0, 2.05, 0.1, 0.36); grp.userData.anchor = [wx1, 2.55, -D / 2];
  }

  // ---- door (target) on the left wall, front ----
  {
    const zc = D / 2 - 0.7, g = collector('door');
    g.box(1.05, 2.15, 0.05, 0, 1.075, 0.02, CLAY.trim, 0.02); g.box(0.9, 2.05, 0.06, 0, 1.025, 0.05, acc, 0.025); g.sph(0.04, 0.34, 1.0, 0.1, CLAY.trim);
    const grp = place(g.build(), -W / 2, 0, zc, Math.PI / 2); addShield(grp, 0, 1.6, 0.095, 0.34); grp.userData.anchor = [-W / 2, 2.35, zc];
  }

  // ---- future self (target): neutral clay figure, no face, no photo (PRD guardrails) ----
  {
    const g = collector('future');
    g.cyl(0.3, 0.3, 0.03, 0, 0.015, 0, CLAY.trim); g.tor(0.34, 0.012, 0, 0.04, 0, acc);
    g.cyl(0.17, 0.2, 0.7, 0, 0.55, 0, mix(acc, '#ffffff', 0.35)); g.sph(0.17, 0, 0.9, 0, mix(acc, '#ffffff', 0.35), 1.15, 0.6, 0.9);
    g.cyl(0.07, 0.09, 0.2, 0, 1.0, 0, CLAY.warm); g.sph(0.14, 0, 1.22, 0, CLAY.warm); g.cyl(0.07, 0.1, 0.22, -0.07, 0.11, 0, CLAY.grey); g.cyl(0.07, 0.1, 0.22, 0.07, 0.11, 0, CLAY.grey);
    const fx = W / 2 - 1.0, fz = D / 2 - 1.0, grp = place(g.build(), fx, 0, fz, -0.7); grp.userData.anchor = [fx, 1.65, fz];
  }

  // ---- theme dressing (not a target): the props that make Pilot / Coder / Doctor / Studio feel different ----
  {
    const g = collector(null), px = -W / 2 + 1.35, pz = D / 2 - 1.05;
    for (const p of model.dressing.props) {
      if (p === 'yoke') { g.box(0.5, 0.5, 0.45, px, 0.25, pz, CLAY.warm, 0.04); g.cyl(0.03, 0.03, 0.4, px, 0.7, pz - 0.05, CLAY.grey); g.box(0.36, 0.05, 0.05, px, 0.92, pz - 0.05, acc, 0.02); g.box(0.05, 0.16, 0.05, px - 0.18, 0.86, pz - 0.05, acc, 0.02); g.box(0.05, 0.16, 0.05, px + 0.18, 0.86, pz - 0.05, acc, 0.02); }
      else if (p === 'throttle') g.box(0.14, 0.14, 0.4, dx + 1.0, 0.82, dz + 0.1, CLAY.grey, 0.03), g.cyl(0.02, 0.02, 0.14, dx + 1.0, 0.95, dz, acc);
      else if (p === 'headset') g.tor(0.07, 0.012, dx - 0.55, 0.84, dz + 0.2, acc, 0), g.sph(0.04, dx - 0.62, 0.8, dz + 0.2, CLAY.grey), g.sph(0.04, dx - 0.48, 0.8, dz + 0.2, CLAY.grey);
      else if (p === 'chart') { g.box(0.55, 0.36, 0.02, wx0, 2.2, -D / 2 + 0.03, CLAY.trim, 0.01); g.box(0.3, 0.02, 0.01, wx0 - 0.05, 2.2, -D / 2 + 0.05, acc, 0.005); g.box(0.02, 0.2, 0.01, wx0 + 0.1, 2.2, -D / 2 + 0.05, CLAY.grey, 0.005); }
      else if (p === 'second-monitor') { g.box(0.5, 0.34, 0.03, dx + 0.62, 1.1, dz - 0.1, CLAY.dark, 0.015, -0.35); g.box(0.44, 0.28, 0.01, dx + 0.62, 1.1, dz - 0.085, mix(acc, '#ffffff', 0.7), 0.005, -0.35); g.cyl(0.02, 0.03, 0.2, dx + 0.62, 0.86, dz - 0.1, CLAY.grey); }
      else if (p === 'beanbag') { g.sph(0.4, px, 0.27, pz, acc, 1, 0.65, 1); g.sph(0.22, px - 0.05, 0.5, pz - 0.18, acc, 1, 0.8, 1); }
      else if (p === 'rack') { g.box(0.42, 0.9, 0.36, px + 0.75, 0.45, pz - 0.55, CLAY.warm, 0.03); for (let i = 0; i < 4; i++) { g.box(0.34, 0.012, 0.01, px + 0.75, 0.2 + i * 0.18, pz - 0.36, CLAY.grey, 0.004); g.sph(0.012, px + 0.88, 0.2 + i * 0.18 + 0.05, pz - 0.36, acc); } }
      else if (p === 'terminal') { g.box(0.6, 0.38, 0.02, wx0, 2.2, -D / 2 + 0.03, CLAY.dark, 0.01); g.box(0.2, 0.03, 0.01, wx0 - 0.15, 2.28, -D / 2 + 0.045, acc, 0.005); g.box(0.32, 0.02, 0.01, wx0 - 0.09, 2.2, -D / 2 + 0.045, CLAY.grey, 0.005); }
      else if (p === 'exam-bed') { g.box(0.7, 0.14, 1.5, px, 0.5, pz, CLAY.trim, 0.06); g.box(0.1, 0.5, 0.1, px - 0.25, 0.25, pz - 0.6, CLAY.grey, 0.02); g.box(0.1, 0.5, 0.1, px + 0.25, 0.25, pz + 0.6, CLAY.grey, 0.02); g.box(0.4, 0.07, 0.25, px, 0.6, pz - 0.55, acc, 0.03); }
      else if (p === 'iv-stand') { g.cyl(0.015, 0.015, 1.7, px + 0.6, 0.85, pz - 0.7, CLAY.grey); g.cyl(0.14, 0.14, 0.02, px + 0.6, 0.01, pz - 0.7, CLAY.grey); g.box(0.1, 0.16, 0.05, px + 0.6, 1.55, pz - 0.7, mix(acc, '#ffffff', 0.5), 0.03); }
      else if (p === 'stethoscope') g.tor(0.09, 0.01, dx - 0.5, 0.78, dz + 0.22, acc, 0), g.sph(0.03, dx - 0.5, 0.79, dz + 0.31, CLAY.grey);
      else if (p === 'anatomy') { g.box(0.5, 0.36, 0.02, wx0, 2.2, -D / 2 + 0.03, CLAY.trim, 0.01); g.box(0.08, 0.24, 0.01, wx0, 2.2, -D / 2 + 0.045, acc, 0.004); g.box(0.24, 0.08, 0.01, wx0, 2.2, -D / 2 + 0.045, acc, 0.004); }
      else if (p === 'plant') { g.cyl(0.13, 0.1, 0.22, px, 0.11, pz, CLAY.warm); g.sph(0.2, px, 0.45, pz, CLAY.leaf, 1, 1.2, 1); g.sph(0.14, px + 0.12, 0.6, pz + 0.03, CLAY.leaf); }
      else if (p === 'lamp') { g.cyl(0.1, 0.12, 0.03, px + 0.7, 0.015, pz - 0.5, CLAY.grey); g.cyl(0.015, 0.015, 1.3, px + 0.7, 0.68, pz - 0.5, CLAY.grey); g.cyl(0.05, 0.14, 0.2, px + 0.7, 1.4, pz - 0.5, acc); }
      else if (p === 'easel') { g.box(0.04, 1.3, 0.04, px - 0.1, 0.65, pz - 0.2, CLAY.wood, 0.01, 0); g.box(0.04, 1.3, 0.04, px + 0.3, 0.65, pz - 0.2, CLAY.wood, 0.01); g.box(0.5, 0.4, 0.02, px + 0.1, 0.95, pz - 0.15, CLAY.trim, 0.01); g.sph(0.08, px + 0.05, 0.97, pz - 0.13, acc, 1, 1, 0.2); }
      else if (p === 'prints') { g.box(0.4, 0.5, 0.02, wx0, 2.2, -D / 2 + 0.03, CLAY.trim, 0.01); g.sph(0.1, wx0 - 0.03, 2.2, -D / 2 + 0.045, acc, 1, 1, 0.15); }
    }
    scene.add(g.build());
  }

  // ---- soft contact shadow under the floating room (cheap radial gradient plane) ----
  {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), gr = x.createRadialGradient(64, 64, 8, 64, 64, 62);
    gr.addColorStop(0, 'rgba(60,58,52,0.22)'); gr.addColorStop(1, 'rgba(60,58,52,0)'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c); textures.push(tex);
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.6, D * 1.6), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sh.position.y = -1.1; scene.add(sh);
  }

  // ---- light: soft daylight from the window side ----
  scene.add(new THREE.HemisphereLight(0xffffff, 0xe6e2da, 1.55));
  const sun = new THREE.DirectionalLight(0xfff6ea, 1.5); sun.position.set(-1.5, 5, 4); scene.add(sun);
  if (quality.shadows) {
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); const sc = sun.shadow.camera; sc.left = -5; sc.right = 5; sc.top = 5; sc.bottom = -3; sc.far = 20; sun.shadow.radius = 4; sun.shadow.bias = -0.0005;
  }

  // ---- camera: orbit around the room centre, clamped so the two walls always stay behind the view ----
  const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 60), centre = new THREE.Vector3(0, H * 0.42, 0);
  let yaw = ORBIT.yaw0, pitch = ORBIT.pitch0, tYaw = yaw, tPitch = pitch, R = 10;
  const fit = () => {
    const w = stage.clientWidth || 800, h = stage.clientHeight || 600, a = w / h;
    renderer.setSize(w, h, false); cam.aspect = a; cam.updateProjectionMatrix();
    const need = Math.hypot(W, D) * 0.62 + 0.4, vh = Math.max(H + 0.9, 3);
    R = Math.max(need / (Math.tan(cam.fov * Math.PI / 360) * Math.min(a, 1.9)), (vh * 0.62) / Math.tan(cam.fov * Math.PI / 360));
    draw();
  };
  const frame = () => {
    cam.position.set(centre.x + R * Math.sin(yaw) * Math.cos(pitch), centre.y + R * Math.sin(pitch), centre.z + R * Math.cos(yaw) * Math.cos(pitch));
    cam.lookAt(centre.x, centre.y - 0.15, centre.z);
  };

  // ---- on-demand rendering: draws only while something is moving ----
  let raf = 0, dead = false, hoverId = null;
  const hit = [];   // target meshes for picking
  scene.traverse(o => { if (o.userData.target && o.isMesh) hit.push(o); });
  const groups = {}; scene.children.forEach(o => { if (o.userData.target) groups[o.userData.target] = o; });
  const tag = document.createElement('div'); tag.className = 'room-tag'; tag.hidden = true; stage.appendChild(tag);
  const v3 = new THREE.Vector3();
  function placeTag() {
    const g = hoverId && groups[hoverId]; if (!g) { tag.hidden = true; return; }
    const a = g.userData.anchor; v3.set(a[0], a[1], a[2]).project(cam);
    const w = stage.clientWidth, h = stage.clientHeight; tag.textContent = targetById(hoverId).label; tag.hidden = false;
    tag.style.transform = `translate(${Math.round((v3.x * 0.5 + 0.5) * w)}px, ${Math.round((-v3.y * 0.5 + 0.5) * h)}px) translate(-50%, -100%)`;
  }
  function draw() {
    raf = 0; if (dead) return;
    const k = reduced ? 1 : 0.18; yaw += (tYaw - yaw) * k; pitch += (tPitch - pitch) * k;
    const moving = Math.abs(tYaw - yaw) > 0.0004 || Math.abs(tPitch - pitch) > 0.0004; if (!moving) { yaw = tYaw; pitch = tPitch; }
    frame(); renderer.render(scene, cam); placeTag();
    if (moving) raf = requestAnimationFrame(draw);
  }
  const invalidate = () => { if (!raf && !dead) raf = requestAnimationFrame(draw); };

  // ---- input: drag rotates (clamped), a tap without movement picks ----
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const pick = e => {
    const r = canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, cam); const h = ray.intersectObjects(hit, false)[0]; return h ? h.object.userData.target : null;
  };
  const setHover = id => { if (id === hoverId) return; if (groups[hoverId]) groups[hoverId].scale.setScalar(1); hoverId = id; if (groups[id] && id !== 'window') groups[id].scale.setScalar(1.03);  /* window group is built in world space: scaling it would shift the view */ canvas.style.cursor = id ? 'pointer' : ''; onHover?.(id); invalidate(); };
  let down = null;
  const onDown = e => { down = { x: e.clientX, y: e.clientY, yaw: tYaw, pitch: tPitch, moved: false, id: e.pointerId }; canvas.setPointerCapture?.(e.pointerId); };
  const onMove = e => {
    if (!down) { if (e.pointerType === 'mouse') setHover(pick(e)); return; }
    const dxp = e.clientX - down.x, dyp = e.clientY - down.y;
    if (Math.abs(dxp) + Math.abs(dyp) > 6) down.moved = true;
    if (down.moved) { tYaw = clampYaw(down.yaw - dxp * 0.006); tPitch = clampPitch(down.pitch + dyp * 0.004); invalidate(); }
  };
  const onUp = e => { const d = down; down = null; canvas.releasePointerCapture?.(e.pointerId); if (d && !d.moved) { const id = pick(e); if (id) onPick?.(id); } };
  const onKey = e => {
    const step = 0.12, m = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -0.05], ArrowDown: [0, 0.05] }[e.key];
    if (!m) return; e.preventDefault(); tYaw = clampYaw(tYaw + m[0]); tPitch = clampPitch(tPitch + m[1]); invalidate();
  };
  const lost = e => { e.preventDefault(); onLost?.(); };
  canvas.addEventListener('pointerdown', onDown); canvas.addEventListener('pointermove', onMove); canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', () => { down = null; }); canvas.addEventListener('pointerleave', () => { if (!down) setHover(null); });
  canvas.addEventListener('keydown', onKey); canvas.addEventListener('webglcontextlost', lost);
  const ro = new ResizeObserver(fit); ro.observe(stage);
  fit();

  return {
    canvas, info: renderer.info, scene, camera: cam,
    hover: id => setHover(id || null),
    focus: id => setHover(id || null),
    dispose() {
      dead = true; cancelAnimationFrame(raf); ro.disconnect();
      canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointermove', onMove); canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('keydown', onKey); canvas.removeEventListener('webglcontextlost', lost);
      disposeThree(scene); mats.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
      renderer.dispose(); renderer.forceContextLoss?.(); canvas.remove(); tag.remove();
    },
  };
}
