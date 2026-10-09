// The student's own study room: desk, one large monitor + two side screens, chair, shelf, plant, lamp. Config-driven themes. Owner: Phyllis.
import * as THREE from 'three';
import { PAL, shell, box, cyl, ball, mat, desk, chair, plant, easel, shelf, poster, rug, lamp, mergeStatic } from '../rooms/RoomBuilder.js';

// Themes come from the student's career. Add one by adding an entry; nothing else changes.
export const THEMES = {
  doctor:       { label: 'Biology study room',    wall: '#e8eee0', floor: '#b88a5b', rug: '#8fae8b', accent: '#5f9e78', props: ['microscope', 'books'],  art: 'body' },
  engineer:     { label: 'Engineering study room', wall: '#e7e5e0', floor: '#9a9a96', rug: '#d9826b', accent: '#d9826b', props: ['gear', 'books'],   art: 'gear' },
  software:     { label: 'Technology study room', wall: '#e3e8ef', floor: '#7a8696', rug: '#44546a', accent: '#6f9ccf', props: ['books'],            art: 'bars' },
  scientist:    { label: 'Science study room',    wall: '#eef0e6', floor: '#b88a5b', rug: '#9cc3dc', accent: '#e3b559', props: ['flask', 'globe'],  art: 'curve' },
  entrepreneur: { label: 'Business study room',   wall: '#eee8dc', floor: '#b88a5b', rug: '#44546a', accent: '#e3b559', props: ['books', 'globe'],  art: 'notes' },
  designer:     { label: 'Design study room',     wall: '#f6e9e0', floor: '#c9a37a', rug: '#d9826b', accent: '#d9826b', props: ['easel', 'books'],  art: 'curve' },
  artist:       { label: 'Art study room',        wall: '#f8efe2', floor: '#d6a76c', rug: '#e0524f', accent: '#e0524f', props: ['easel'],           art: 'dots' },
  architect:    { label: 'Architecture study room', wall: '#ece8e0', floor: '#b88a5b', rug: '#8e8e88', accent: '#1f3350', props: ['books', 'globe'], art: 'bars' },
  lawyer:       { label: 'Law study room',        wall: '#efe4d3', floor: '#8e6a43', rug: '#44546a', accent: '#8e6a43', props: ['books', 'globe'],  art: 'bars' },
  astronaut:    { label: 'Space study room',      wall: '#d9dfe9', floor: '#6d7688', rug: '#1f3350', accent: '#e3b559', props: ['globe'],           art: 'stars' },
  default:      { label: 'Study room',            wall: '#efe9de', floor: '#b88a5b', rug: '#8fae8b', accent: '#5f9e78', props: ['books', 'globe'],  art: 'curve' }
};
export const themeFor = career => THEMES[career] || ({ undecided: THEMES.default }[career]) || THEMES.default;

const drawArt = (kind, accent) => (c, w, h) => {
  c.strokeStyle = PAL.navy; c.fillStyle = accent; c.lineWidth = 3;
  if (kind === 'dots') { for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(20 + i * 22, h / 2 + (i % 2) * 14 - 7, 10, 0, 7); c.fill(); } }
  else if (kind === 'bars') { for (let i = 0; i < 5; i++) c.fillRect(14 + i * 22, h - 14 - (i % 3 + 2) * 12, 14, (i % 3 + 2) * 12); }
  else if (kind === 'stars') { c.fillStyle = '#16233a'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; for (let i = 0; i < 30; i++) c.fillRect((i * 37) % w, (i * 53) % h, 2, 2); c.fillStyle = accent; c.beginPath(); c.arc(w * .65, h * .45, 14, 0, 7); c.fill(); }
  else if (kind === 'notes') { [accent, '#9cc3dc', '#d9826b'].forEach((col, i) => { c.fillStyle = col; c.fillRect(12 + i * 38, 18 + (i % 2) * 24, 30, 28); }); }
  else if (kind === 'body') { c.beginPath(); c.arc(w / 2, 20, 11, 0, 7); c.stroke(); c.beginPath(); c.moveTo(w / 2, 31); c.lineTo(w / 2, 82); c.moveTo(w / 2, 44); c.lineTo(w / 2 - 24, 70); c.moveTo(w / 2, 44); c.lineTo(w / 2 + 24, 70); c.moveTo(w / 2, 82); c.lineTo(w / 2 - 14, 112); c.moveTo(w / 2, 82); c.lineTo(w / 2 + 14, 112); c.stroke(); c.beginPath(); c.arc(w / 2 + 3, 50, 6, 0, 7); c.fill(); }
  else if (kind === 'cell') { c.beginPath(); c.arc(w / 2, h / 2, 26, 0, 7); c.stroke(); c.beginPath(); c.arc(w / 2 + 6, h / 2 - 4, 9, 0, 7); c.fill(); }
  else if (kind === 'gear') { c.beginPath(); c.arc(w / 2, h / 2, 22, 0, 7); c.stroke(); c.beginPath(); c.arc(w / 2, h / 2, 8, 0, 7); c.fill(); }
  else { c.beginPath(); c.moveTo(10, h - 14); c.bezierCurveTo(40, 0, 70, h, w - 10, 12); c.stroke(); }
};

function screen(g, x, y, z, w, h, ry, color, screens) {
  const m = new THREE.MeshStandardMaterial({ color: '#10161f', emissive: color, emissiveIntensity: .55, roughness: .4 });
  const grp = new THREE.Group(); grp.position.set(x, y, z); grp.rotation.y = ry; g.add(grp);
  box(w + .08, h + .08, .05, PAL.ink, 0, 0, 0, grp); const s = new THREE.Mesh(new THREE.BoxGeometry(w, h, .02), m); s.position.set(0, h / 2 + .0, .035); grp.add(s);
  cyl(.035, .14, PAL.ink, 0, -.14, 0, grp); box(w * .4, .02, .16, PAL.ink, 0, -.14, 0, grp);
  screens.push(m); return grp;
}
const PROPS = {
  books: g => { box(.5, .1, .34, '#d9826b', 1.45, .72 + .08, -1.35, g); box(.46, .1, .3, '#44546a', 1.45, .72 + .18, -1.35, g); },
  globe: g => { cyl(.03, .2, PAL.ink, -1.45, .8, -1.35, g); ball(.2, PAL.sky, -1.45, 1.15, -1.35, g); },
  flask: g => { cyl(.05, .18, PAL.paper, 1.45, .8, -1.35, g); ball(.14, PAL.sage, 1.45, .88, -1.35, g, { transparent: true, opacity: .85 }); },
  microscope: g => { box(.4, .05, .3, PAL.ink, 1.4, .72, -1.3, g); cyl(.04, .5, PAL.ink, 1.4, .77, -1.38, g); const t = cyl(.06, .34, PAL.slate, 1.4, 1.0, -1.28, g); t.rotation.x = .5; box(.3, .03, .2, PAL.slate, 1.4, .95, -1.28, g); },
  gear: g => { const m = cyl(.22, .06, PAL.gold, 1.45, .8, -1.35, g); m.rotation.x = .3; },
  easel: g => easel(g, 1.4, .3, PAL.clay)
};

// -> { group, screens, lampLight, seat:{x,z}, petHome:{x,z}, desk:{x,y,z} }
export function createStudyRoom(theme = THEMES.default, { night = false } = {}) {
  const g = new THREE.Group(), screens = [];
  const wall = new THREE.Color(theme.wall); if (night) wall.multiplyScalar(.55);
  g.add(shell({ wall: '#' + wall.getHexString(), floor: theme.floor, trim: PAL.navy }));
  rug(g, 0, -.3, 1.3, .95, theme.rug);
  desk(g, 0, -1.45, { w: 2.3 });
  chair(g, 0, -.72, PAL.slate, Math.PI);
  shelf(g, -1.2, 2.0, -1.72, 1.3); shelf(g, -1.2, 1.45, -1.72, 1.3);
  plant(g, 1.6, -.2, 1); lamp(g, -1.65, -1.45, theme.accent);
  poster(g, 1.1, 1.75, -1.86, 1.0, 1.3, drawArt(theme.art, theme.accent));
  (theme.props || []).forEach(p => PROPS[p]?.(g));
  const sc = ['#6f9ccf', '#e3b559', '#7fd6a0'];
  screen(g, 0, 1.18, -1.58, .95, .58, 0, sc[0], screens);                  // large centre monitor
  screen(g, -.95, 1.12, -1.5, .6, .4, .45, sc[1], screens);                // side screens
  screen(g, .95, 1.12, -1.5, .6, .4, -.45, sc[2], screens);
  mergeStatic(g, o => o.material?.emissive && o.material.emissiveIntensity > 0);
  const lampLight = new THREE.PointLight(theme.accent === '#1f3350' ? '#ffd9a0' : '#ffe0b0', 0, 7, 1.6); lampLight.position.set(-1.4, 1.6, -1.2); g.add(lampLight);
  return { group: g, screens, lampLight, seat: { x: 0, z: -.92 }, petHome: { x: -1.2, z: -.62 }, desk: { x: 0, y: 1.0, z: -1.45 } };
}
