// Career / subject rooms. createRoom(type) -> THREE.Group (4 x 3 x 4, origin floor center, open front +z).
// Owner: Phyllis. Procedural, ~0 asset bytes.
import * as THREE from 'three';
import { PAL, mergeStatic, shell, box, cyl, ball, mat, desk, monitor, chair, plant, easel, shelf, poster, rug, lamp } from './RoomBuilder.js';

const B = {
  biology(g) {
    desk(g, -.8, -1.5, { w: 1.6 }); microscope(g, -1.1, .8, -1.5);
    poster(g, 1.2, 1.6, -1.86, 1.0, 1.5, (c, w, h) => { c.strokeStyle = PAL.navy; c.lineWidth = 3; c.beginPath(); c.arc(w / 2, 22, 12, 0, 7); c.moveTo(w / 2, 34); c.lineTo(w / 2, 100); c.moveTo(w / 2, 50); c.lineTo(w / 2 - 28, 84); c.moveTo(w / 2, 50); c.lineTo(w / 2 + 28, 84); c.stroke(); c.fillStyle = PAL.clay; c.beginPath(); c.arc(w / 2 + 4, 58, 7, 0, 7); c.fill(); });
    bench(g, 0, .6, PAL.sage); plant(g, 1.6, -1.5, .9); shelf(g, -1.3, 1.9, -1.72, 1.2);
  },
  chemistry(g) {
    bench(g, 0, -.2, PAL.sky);
    flask(g, -.6, .98, -.2, PAL.clay); flask(g, 0, .98, -.2, PAL.sage, .8); flask(g, .6, .98, -.2, PAL.gold);
    shelf(g, 0, 1.9, -1.72, 3.2, [PAL.sky, PAL.clay, PAL.gold, PAL.sage]); shelf(g, 0, 1.3, -1.72, 3.2, [PAL.sage, PAL.gold, PAL.sky]);
    poster(g, 1.86, 1.6, 0, 1.0, 1.2, (c, w, h) => { c.fillStyle = PAL.navy; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) c.fillRect(14 + i * 24, 14 + j * 22, 18, 16); }, -Math.PI / 2);
  },
  physics(g) {
    desk(g, 0, -1.4, { w: 2 });
    // pendulum
    box(1.2, .06, .06, PAL.ink, .8, 2.4, -.4, g); box(.02, .9, .02, PAL.ink, .5, 1.5, -.4, g); ball(.14, PAL.clay, .5, 1.42, -.4, g);
    box(.02, .9, .02, PAL.ink, 1.0, 1.5, -.4, g); ball(.14, PAL.gold, 1.0, 1.42, -.4, g);
    board(g, -.8, 1.5, -1.84, 1.8, 1.1, c => { c.strokeStyle = PAL.navy; c.lineWidth = 2; c.beginPath(); c.moveTo(10, 90); c.quadraticCurveTo(60, -10, 110, 90); c.stroke(); });
    ball(.25, PAL.sky, -1.3, .25, .6, g);
  },
  research(g) {
    desk(g, -.9, -1.4, { w: 1.6 }); monitor(g, -.9, .8, -1.5, { glow: PAL.sage });
    board(g, .6, 1.5, -1.84, 2.2, 1.2, (c, w, h) => { c.strokeStyle = PAL.navy; c.lineWidth = 2; c.beginPath(); c.moveTo(10, 10); c.lineTo(10, h - 10); c.lineTo(w - 10, h - 10); c.stroke(); c.strokeStyle = PAL.clay; c.beginPath(); c.moveTo(14, h - 20); c.lineTo(50, 50); c.lineTo(80, 60); c.lineTo(w - 14, 16); c.stroke(); });
    box(.9, .5, .6, PAL.paper, 1.2, 0, .2, g); box(.9, .08, .6, PAL.woodDark, 1.2, .5, .2, g); chair(g, -.9, -.7, PAL.slate);
  },
  engineering(g) {
    bench(g, -.2, -1.2, PAL.wood, 2.6); armBot(g, .9, .8, -1.2);
    // gear wall
    gear(g, -1.3, 1.9, -1.8, .45); gear(g, -.6, 1.55, -1.8, .3, PAL.clay);
    box(.7, .5, .5, PAL.slate, -1.0, .8, -1.2, g); box(.2, .2, .5, PAL.gold, -.6, .85, -1.2, g);
    shelf(g, 1.2, 1.9, -1.72, 1.2); box(.8, .9, .6, PAL.navy, 1.5, 0, .8, g);
  },
  robotics(g) { B.engineering(g); robot(g, -.4, .5); },
  computer(g) {
    [-1.1, 0, 1.1].forEach((x, i) => { desk(g, x, -1.4, { w: 1.0 }); monitor(g, x, .8, -1.45, { glow: [PAL.sky, PAL.gold, PAL.sage][i], screen: '#243a5a' }); chair(g, x, -.7, PAL.slate, Math.PI); });
    box(.5, 1.7, .5, PAL.ink, 1.65, 0, -1.5, g); [.3, .7, 1.1, 1.5].forEach(y => box(.4, .06, .02, y % .8 < .2 ? PAL.sage : PAL.sky, 1.65, y, -1.24, g));
    poster(g, 0, 2.15, -1.86, 2.2, .5, (c, w, h) => { c.fillStyle = PAL.navy; c.fillRect(0, 0, w, h); c.fillStyle = PAL.gold; c.fillRect(8, h / 2 - 3, 50, 6); });
    plant(g, -1.7, .4, .8);
  },
  design(g) {
    desk(g, -.6, -1.4, { w: 1.8 }); monitor(g, -.9, .8, -1.5, { glow: PAL.clay }); chair(g, -.6, -.7, PAL.clay, Math.PI);
    ['#d9826b', '#9cc3dc', '#e3b559', '#8fae8b'].forEach((c, i) => box(.3, .3, .02, c, 1.0 + (i % 2) * .38, 1.1 + Math.floor(i / 2) * .38, -1.92, g));
    box(.9, .02, .6, PAL.paper, .5, .8, -1.4, g); plant(g, 1.6, .6, 1); lamp(g, 1.6, -1.5);
  },
  art(g) {
    easel(g, -1.0, -.6); desk(g, .8, -1.5, { w: 1.6 }); monitor(g, .8, .8, -1.6, { glow: PAL.sky }); chair(g, .8, -.8, PAL.clay, Math.PI);
    plant(g, 1.6, 0, 1); rug(g, .2, .5, 1.1, .7, PAL.clay); shelf(g, -1.2, 1.7, -1.72, 1.2);
  },
  business(g) {
    box(2.2, .08, 1.1, PAL.wood, 0, .75, -.2, g); [-.9, .9].forEach(x => [-.5, .1].forEach(z => box(.07, .75, .07, PAL.woodDark, x, 0, z, g)));
    [-1, 0, 1].forEach(x => chair(g, x, .7, PAL.slate, Math.PI)); chair(g, 0, -1.1, PAL.clay);
    board(g, 0, 1.55, -1.84, 3, 1.3, (c, w, h) => { [PAL.gold, PAL.sky, PAL.clay, PAL.sage].forEach((col, i) => { c.fillStyle = col; c.fillRect(12 + i * 52, 20 + (i % 2) * 36, 40, 34); }); c.strokeStyle = PAL.navy; c.beginPath(); c.moveTo(52, 40); c.lineTo(64, 56); c.stroke(); });
    plant(g, -1.7, -1.5, .9);
  },
  humanities(g) {
    shelf(g, -1, 2.0, -1.72, 1.7); shelf(g, -1, 1.4, -1.72, 1.7); shelf(g, -1, .8, -1.72, 1.7); box(1.7, 2, .06, PAL.wood, -1, 0, -1.84, g);
    globe(g, 1.2, .2, -1.2); desk(g, .3, .2, { w: 1.4 }); chair(g, .3, .9, PAL.sage, Math.PI);
    rug(g, 0, .3, 1.4, .9, PAL.slate); lamp(g, 1.7, .6);
  },
  sports(g) {
    box(4, .02, 4, '#c98e5a', 0, 0, 0, g); box(3.4, .01, .04, PAL.white, 0, .02, 0, g);
    cyl(.03, 2.1, PAL.ink, -1.5, 0, -1.6, g); box(.9, .55, .05, PAL.white, -1.5, 2.0, -1.6, g); box(.25, .02, .22, PAL.clay, -1.5, 2.0, -1.55, g);
    ball(.2, PAL.clay, .5, .2, .4, g); ball(.16, PAL.gold, -.3, .16, 1.0, g);
    box(1.4, .45, .5, PAL.slate, 1.2, 0, -1.6, g); box(1.2, .06, .5, PAL.sky, 1.2, .45, -1.6, g);
  },
  astronomy(g) {
    telescope(g, .2, 0, -.2); desk(g, -1.2, -1.5, { w: 1.2 });
    poster(g, 0, 1.6, -1.86, 3.2, 1.6, (c, w, h) => { c.fillStyle = '#16233a'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; for (let i = 0; i < 40; i++) c.fillRect((i * 37) % w, (i * 53) % h, 1.5, 1.5); c.fillStyle = PAL.gold; c.beginPath(); c.arc(w * .7, h * .4, 14, 0, 7); c.fill(); c.strokeStyle = PAL.sky; c.beginPath(); c.ellipse(w * .7, h * .4, 26, 7, -.4, 0, 7); c.stroke(); });
    ball(.35, PAL.sky, 1.4, 1.0, -1.3, g); ball(.18, PAL.clay, 1.8, .6, -.8, g);
  },
  math(g) {
    board(g, 0, 1.5, -1.84, 3.4, 1.4, (c, w, h) => { c.fillStyle = PAL.navy; c.font = '22px serif'; c.fillText('∑  x²  ∫  π', 14, 36); c.strokeStyle = PAL.clay; c.beginPath(); c.moveTo(20, 100); c.lineTo(40, 60); c.lineTo(70, 100); c.closePath(); c.stroke(); });
    desk(g, -.9, -.2, { w: 1.2 }); desk(g, .9, -.2, { w: 1.2 }); chair(g, -.9, .5, PAL.sage, Math.PI); chair(g, .9, .5, PAL.sage, Math.PI);
    box(.3, .3, .3, PAL.gold, 0, 0, .9, g); ball(.2, PAL.sky, .5, .2, 1.2, g);
  },
  medical(g) {
    box(2, .45, .9, PAL.white, 0, 0, -.7, g); box(2, .08, .9, PAL.sky, 0, .45, -.7, g); box(.5, .12, .85, PAL.paper, -.75, .53, -.7, g);
    cyl(.04, 1.6, PAL.ink, 1.5, 0, -1.2, g); box(.5, .3, .05, PAL.sage, 1.5, 1.5, -1.2, g);
    poster(g, -1.2, 1.7, -1.86, 1.1, 1.5, (c, w, h) => { c.fillStyle = PAL.clay; c.beginPath(); c.arc(w / 2, h / 2, 20, 0, 7); c.fill(); c.fillStyle = PAL.paper; c.fillRect(w / 2 - 3, h / 2 - 12, 6, 24); c.fillRect(w / 2 - 12, h / 2 - 3, 24, 6); });
    shelf(g, 1.2, 1.9, -1.72, 1.2, [PAL.white, PAL.sky]);
  },
  blank(g) { plant(g, 1.3, -1.3, 1); }
};
// aliases for module labels
B.law = B.humanities; B.space = B.astronomy; B.problem = B.math; B.science = B.research; B.technology = B.computer; B.arts = B.art;

const STYLE = {
  biology: { wall: '#eaf0e2' }, chemistry: { wall: '#e3eef2' }, physics: { wall: '#ece9f1' }, research: { wall: '#f1ece2' },
  engineering: { wall: '#e9e6e0', floor: '#9a9a96' }, robotics: { wall: '#e9e6e0', floor: '#9a9a96' }, computer: { wall: '#e4e9f0', floor: '#7a8696' },
  design: { wall: '#f6e9e0' }, art: { wall: '#f8efe2' }, business: { wall: '#eee8dc' }, humanities: { wall: '#efe4d3' },
  sports: { wall: '#e3ecdf', floor: '#c98e5a' }, astronomy: { wall: '#d9dfe9', floor: '#6d7688' }, math: { wall: '#eef0e6' }, medical: { wall: '#e7f0f0', floor: '#cfd9d9' }, blank: { wall: '#efe9de' }
};

export const ROOM_LABELS = { biology: 'Biology Lab', chemistry: 'Chemistry Lab', physics: 'Physics Lab', research: 'Research Lab', engineering: 'Engineering Workshop', robotics: 'Robotics Lab', computer: 'Technology Lab', design: 'Design Studio', art: 'Art Studio', business: 'Business Studio', humanities: 'Humanities Room', sports: 'Sports Hall', astronomy: 'Observatory', math: 'Mathematics Room', medical: 'Medical Foundations', blank: 'Open Room' };

export function createRoom(type) {
  const key = B[type] ? (STYLE[type] ? type : ({ law: 'humanities', space: 'astronomy', problem: 'math', science: 'research', technology: 'computer', arts: 'art' }[type] || 'blank')) : 'blank';
  const g = new THREE.Group();
  g.add(shell({ ...(STYLE[key] || STYLE.blank), trim: PAL.navy }));
  (B[type] || B.blank)(g);
  mergeStatic(g);
  g.userData = { type: key, label: ROOM_LABELS[key] || 'Room' };
  return g;
}

// Map a module label ("Human Biology", "Problem Solving", "CAD") to a room type.
const MAP = [[/medical|anatomy|human (bio|health|body)/i, 'medical'], [/bio/i, 'biology'], [/chem/i, 'chemistry'], [/physic/i, 'physics'], [/research|scientific method|data|analysis|experiment/i, 'research'],
  [/robot/i, 'robotics'], [/electron/i, 'computer'], [/cad/i, 'design'], [/material/i, 'chemistry'], [/prototyp|structur|engineer/i, 'engineering'], [/program|algorithm|system|^ai$|project|technolog|computer|software/i, 'computer'],
  [/design|sketch|visual|digital/i, 'design'], [/^art|draw|colour|color|form|portfolio|technique/i, 'art'], [/business|econom|strategy|leader|product|communicat|building|venture/i, 'business'],
  [/human|reason|reading|civic|moot|law|history|art history/i, 'humanities'], [/sport|fitness/i, 'sports'], [/astro|space/i, 'astronomy'], [/math|problem/i, 'math'], [/science/i, 'research'], [/art/i, 'art']];
export function roomForModule(label) { for (const [re, t] of MAP) if (re.test(label)) return t; return 'blank'; }

/* ---------- local props ---------- */
function bench(g, x, z, top = PAL.sage, w = 2) { box(w, .08, .8, top, x, .85, z, g); box(w - .1, .85, .7, PAL.wood, x, 0, z, g); }
function board(g, x, y, z, w, h, draw) { box(w + .12, h + .12, .05, PAL.woodDark, x, y - h / 2 - .06, z, g); poster(g, x, y, z + .04, w, h, (c, cw, ch) => { c.fillStyle = '#f4f7f2'; c.fillRect(0, 0, cw, ch); draw(c, cw, ch); }); }
function flask(g, x, y, z, color, s = 1) { cyl(.05 * s, .2 * s, PAL.paper, x, y + .12, z, g); const c = ball(.15 * s, color, x, y + .05, z, g); c.material = mat(color, { transparent: true, opacity: .85 }); }
function microscope(g, x, y, z) { const m = new THREE.Group(); m.position.set(x, y, z); g.add(m); box(.4, .05, .3, PAL.ink, 0, 0, 0, m); cyl(.04, .5, PAL.ink, 0, .05, -.08, m); const t = cyl(.06, .35, PAL.slate, 0, .3, .02, m); t.rotation.x = .5; box(.3, .03, .2, PAL.slate, 0, .2, .05, m); }
function gear(g, x, y, z, r, color = PAL.gold) { const m = cyl(r, .08, color, x, y, z, g); m.rotation.x = Math.PI / 2; for (let i = 0; i < 8; i++) { const t = box(r * .35, r * .35, .08, color, x + Math.cos(i * .785) * r, y + Math.sin(i * .785) * r - r * .175, z, g); t.rotation.z = i * .785; } }
function armBot(g, x, y, z) { box(.5, .1, .5, PAL.ink, x, y, z, g); const a = box(.12, .8, .12, PAL.clay, x, y + .1, z, g); a.rotation.z = .15; const b = box(.12, .6, .12, PAL.clay, x + .12, y + .85, z, g); b.rotation.z = -1.0; box(.18, .08, .18, PAL.ink, x + .5, y + 1.2, z, g); }
function robot(g, x, z) { box(.5, .6, .4, PAL.paper, x, .35, z, g); box(.4, .3, .35, PAL.slate, x, .95, z, g); ball(.05, PAL.sky, x - .09, 1.08, z + .18, g); ball(.05, PAL.sky, x + .09, 1.08, z + .18, g); [-1, 1].forEach(s => box(.1, .4, .1, PAL.ink, x + s * .15, 0, z, g)); }
function globe(g, x, y, z) { cyl(.04, .6, PAL.ink, x, y, z, g); ball(.4, PAL.sky, x, y + .95, z, g); ball(.12, PAL.sage, x - .12, y + 1.05, z + .36, g).scale.set(.12, .12, .05); }
function telescope(g, x, y, z) { const t = new THREE.Group(); t.position.set(x, y, z); g.add(t); [[-.3, .3], [.3, .3], [0, -.35]].forEach(([a, b]) => { const l = box(.05, 1.3, .05, PAL.woodDark, a * .8, 0, b * .8, t); }); const tube = cyl(.12, 1.5, PAL.paper, 0, 1.2, 0, t); tube.rotation.z = Math.PI / 2 - .9; tube.rotation.x = .2; }
