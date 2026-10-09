// Flat illustrated room (inline SVG): the fallback when WebGL fails to start or ?flat=1 (PRD section 7: "If 3D fails to load, show a
// flat illustrated room with the same tap targets"). Same model, same targets, same shield + strike count as the 3D room.
// No dependencies, no three.js. mountFlat(stage, model, { onPick }) -> { dispose, hover(id), focus(id), svg }.
// The art is aria-hidden: screen readers and keyboards use the text list Room.js renders next to it, which carries the same targets.
import { TARGETS } from './roomThemes.js';

const NS = 'http://www.w3.org/2000/svg';
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const mix = (a, b, t) => { const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); const x = p(a), y = p(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
const C = { wallL: '#efede8', wallB: '#f8f6f2', wallR: '#ebe8e2', floor: '#e6e2db', trim: '#ffffff', wood: '#e3d9c8', warm: '#efe8dc', grey: '#d6d3cc', dark: '#3a3c40', ink: '#33343a' };

// Wall mapping: u runs from the outer edge (0) to the corner (1), v from the ceiling (0) to the floor (1).
const wallPt = (side, u, v) => {
  const x = side === 'L' ? 40 + 130 * u : 760 - 130 * u, top = 40 + 40 * u, bot = 420 - 70 * u;
  return [x, top + (bot - top) * v];
};
const quad = (side, u0, u1, v0, v1, fill, extra = '') => `<polygon points="${[[u0, v0], [u1, v0], [u1, v1], [u0, v1]].map(([u, v]) => wallPt(side, u, v).map(n => n.toFixed(1)).join(',')).join(' ')}" fill="${fill}" ${extra}/>`;

// Shield glyph centred at (x,y); size = height. Colour is the guarantee state. Nothing is drawn when the guarantee is off.
function shield(x, y, s, color) {
  if (!color) return '';
  return `<path transform="translate(${x} ${y}) scale(${s})" d="M0 -0.5 L0.42 -0.34 V0.08 Q0.42 0.36 0 0.52 Q-0.42 0.36 -0.42 0.08 V-0.34 Z" fill="${color}" stroke="#fff" stroke-width="0.04"/>`;
}
const pips = (x, y, sh) => Array.from({ length: sh.strikeLimit }, (_, i) =>
  `<circle cx="${x + (i - (sh.strikeLimit - 1) / 2) * 13}" cy="${y}" r="4.5" fill="${i < sh.strikes ? '#4a4b52' : '#d6d3cc'}"/>`).join('');

// A target is a group with an always-large invisible hit rect (>= 100 x 100 viewBox units; the SVG scales to the stage).
function tgt(id, cx, cy, art, hw = 56, hh = 56) {
  return `<g class="tgt" data-id="${id}"><rect class="hit" x="${cx - hw}" y="${cy - hh}" width="${hw * 2}" height="${hh * 2}" rx="12" fill="transparent"/>${art}</g>`;
}

export function mountFlat(stage, model, { onPick } = {}) {
  const acc = model.accent, sh = model.shield, corner = model.shape.corner;
  const soft = mix(acc, '#ffffff', 0.6);

  // window view: same deterministic buildings as the 3D room, clipped to the glass
  const win = corner ? { x: 290, y: 100, w: 240, h: 235 } : { x: 335, y: 150, w: 150, h: 120 };
  const bld = model.buildings.map(b => {
    const near = model.shape.view === 'neighbour', bw = near ? win.w * (b.w * 0.55) : win.w * b.w * 0.6;
    const bh = near ? win.h * Math.min(0.95, b.h / 4) : win.h * Math.min(0.85, b.h / 5.2);
    const x = win.x + win.w / 2 + b.x * win.w * (near ? 0.38 : 0.48) - bw / 2, tone = near ? '#cdd5de' : mix('#cdd5de', '#ffffff', b.depth * 0.3);
    return `<rect x="${x.toFixed(1)}" y="${(win.y + win.h - bh).toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" fill="${tone}"/>`
      + (near ? `<rect x="${(x + bw * 0.2).toFixed(1)}" y="${(win.y + win.h - bh + 14).toFixed(1)}" width="${(bw * 0.6).toFixed(1)}" height="9" fill="#bac6d2"/><rect x="${(x + bw * 0.2).toFixed(1)}" y="${(win.y + win.h - bh + 34).toFixed(1)}" width="${(bw * 0.6).toFixed(1)}" height="9" fill="#bac6d2"/>` : '');
  }).join('');

  const books = Array.from({ length: 9 }, (_, i) => `<rect x="${196 + (i % 3) * 20}" y="${(i < 3 ? 160 : i < 6 ? 218 : 276) + (i % 2 ? 6 : 0)}" width="12" height="${i < 6 ? 44 : 50}" rx="2" fill="${[acc, C.grey, soft][i % 3]}"/>`).join('');
  const cups = model.milestones.list.slice(0, 4).map((m, i) => `<path d="M${553 + i * 17} ${i % 2 ? 300 : 262} h10 l-2 12 h-6 z" fill="${m.reached ? acc : '#e2dfd8'}"/>`).join('');

  // theme dressing: one floor prop, one wall piece (the 3D room has the full set)
  const dress = ({
    pilot:  `<g><rect x="545" y="392" width="56" height="36" rx="8" fill="${C.warm}"/><rect x="560" y="360" width="5" height="36" fill="${C.grey}"/><rect x="540" y="352" width="46" height="8" rx="4" fill="${acc}"/></g>`,
    coder:  `<g><ellipse cx="572" cy="425" rx="42" ry="22" fill="${acc}"/><ellipse cx="560" cy="408" rx="22" ry="14" fill="${acc}"/></g>`,
    doctor: `<g><rect x="520" y="395" width="78" height="22" rx="10" fill="${C.trim}"/><rect x="528" y="417" width="7" height="30" fill="${C.grey}"/><rect x="584" y="417" width="7" height="30" fill="${C.grey}"/><rect x="522" y="388" width="30" height="9" rx="4" fill="${acc}"/></g>`,
    studio: `<g><rect x="556" y="418" width="30" height="30" rx="6" fill="${C.warm}"/><ellipse cx="571" cy="400" rx="24" ry="30" fill="#a9bfae"/></g>`,
  })[model.theme] || '';

  const svg = `<svg class="flat-room" viewBox="0 0 800 520" xmlns="${NS}" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid meet">
  <defs><clipPath id="win-clip"><rect x="${win.x}" y="${win.y}" width="${win.w}" height="${win.h}"/></clipPath>
    <radialGradient id="soft-shadow"><stop offset="0" stop-color="#3c3a34" stop-opacity=".2"/><stop offset="1" stop-color="#3c3a34" stop-opacity="0"/></radialGradient></defs>
  <ellipse cx="400" cy="500" rx="330" ry="20" fill="url(#soft-shadow)"/>
  <polygon points="40,40 170,80 170,350 40,420" fill="${C.wallL}"/><rect x="170" y="80" width="460" height="270" fill="${C.wallB}"/><polygon points="760,40 630,80 630,350 760,420" fill="${C.wallR}"/>
  <polygon points="40,420 170,350 630,350 760,420 760,458 40,458" fill="${C.floor}"/><rect x="40" y="458" width="720" height="8" rx="4" fill="${C.trim}"/>
  ${tgt('window', win.x + win.w / 2, win.y + win.h / 2,
    `<rect x="${win.x}" y="${win.y}" width="${win.w}" height="${win.h}" fill="#fbfdff"/><g clip-path="url(#win-clip)">${bld}</g>
     <rect x="${win.x}" y="${win.y}" width="${win.w}" height="${win.h}" fill="none" stroke="${C.trim}" stroke-width="7"/><line x1="${win.x + win.w / 2}" y1="${win.y}" x2="${win.x + win.w / 2}" y2="${win.y + win.h}" stroke="${C.trim}" stroke-width="4"/>
     ${corner ? `<polygon points="${wallPt('L', 0.55, 0.3)} ${wallPt('L', 0.9, 0.3)} ${wallPt('L', 0.9, 0.75)} ${wallPt('L', 0.55, 0.75)}" fill="#e9f1f8" stroke="${C.trim}" stroke-width="4"/>` : ''}`, Math.max(60, win.w / 2 + 4), Math.max(60, win.h / 2 + 4))}
  ${tgt('bookshelf', 228, 240, `<rect x="186" y="140" width="84" height="206" rx="6" fill="${C.warm}"/>${[200, 258, 316].map(y => `<rect x="190" y="${y}" width="76" height="4" fill="${C.trim}"/>`).join('')}${books}`, 56, 110)}
  ${tgt('trophy', 584, 262, `<rect x="540" y="235" width="86" height="112" rx="6" fill="${C.warm}"/><rect x="544" y="284" width="78" height="4" fill="${C.trim}"/>${cups}${shield(583, 190, 52, sh.color)}${pips(583, 224, sh)}`, 56, 100)}
  ${tgt('whiteboard', 105, 215, `${quad('L', 0.12, 0.88, 0.22, 0.6, C.trim)}${quad('L', 0.2, 0.7, 0.3, 0.34, acc)}${quad('L', 0.2, 0.55, 0.4, 0.43, C.grey)}${quad('L', 0.2, 0.62, 0.5, 0.53, C.grey)}`, 62, 90)}
  ${tgt('door', 700, 275, `${quad('R', 0.14, 0.82, 0.24, 1, acc)}${shield(700, 262, 60, sh.color)}${pips(700, 305, sh)}<circle cx="672" cy="330" r="4" fill="${C.trim}"/>`, 62, 110)}
  ${tgt('desk', 410, 280, `<rect x="352" y="214" width="116" height="74" rx="6" fill="${C.dark}"/><rect x="359" y="221" width="102" height="60" rx="3" fill="${soft}"/><rect x="400" y="288" width="20" height="14" fill="${C.grey}"/>
     <polygon points="318,306 502,306 522,336 298,336" fill="${C.wood}"/><rect x="306" y="336" width="10" height="64" fill="${C.warm}"/><rect x="504" y="336" width="10" height="64" fill="${C.warm}"/><rect x="380" y="338" width="60" height="6" rx="3" fill="${C.grey}"/>
     <ellipse cx="410" cy="392" rx="30" ry="9" fill="${acc}"/>`, 118, 100)}
  ${tgt('future', 250, 400, `<ellipse cx="250" cy="450" rx="34" ry="8" fill="none" stroke="${acc}" stroke-width="3"/><rect x="232" y="396" width="36" height="52" rx="16" fill="${soft}"/><circle cx="250" cy="378" r="15" fill="${C.warm}"/><rect x="238" y="426" width="9" height="24" rx="4" fill="${C.grey}"/><rect x="253" y="426" width="9" height="24" rx="4" fill="${C.grey}"/>`, 56, 62)}
  ${dress}
</svg>`;

  const holder = document.createElement('div'); holder.className = 'flat-wrap'; holder.innerHTML = svg; stage.appendChild(holder);
  const el = holder.firstElementChild;
  const ids = new Set(TARGETS.map(t => t.id));
  const onClick = e => { const g = e.target.closest?.('.tgt'); if (g && ids.has(g.dataset.id)) onPick?.(g.dataset.id); };
  const onOver = e => { const g = e.target.closest?.('.tgt'); mark(g ? g.dataset.id : null); };
  const mark = id => el.querySelectorAll('.tgt').forEach(g => g.classList.toggle('on', g.dataset.id === id));
  el.addEventListener('click', onClick); el.addEventListener('pointerover', onOver); el.addEventListener('pointerleave', () => mark(null));
  return {
    svg: el, hover: mark, focus: mark,
    dispose() { el.removeEventListener('click', onClick); el.removeEventListener('pointerover', onOver); holder.remove(); },
  };
}
