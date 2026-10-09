// Tower layout for the render spike (PRD section 10, "Tower render"). Pure functions, no DOM, no three.js.
// One room = one student. Your floor is your rank (PRD section 6): floor 0 is the bottom, the top floor holds the best climbers.

export const WINDOW = Object.freeze({ LIT: 0, GLOW: 1, DIM: 2 });          // studying now / on a streak / not active lately
export const SHIELD = Object.freeze({ NONE: 0, PROTECTED: 1, AT_RISK: 2, WAITING: 3 });
export const THEME_COUNT = 4;                                               // pilot, coder, doctor, studio
export const ACCENT_COUNT = 4;                                              // snapshot variants per theme

export const CELL = Object.freeze({ w: 3.0, h: 2.4, gap: 0.16 });

function rng(seed) {                                                         // mulberry32: same seed, same tower, on every device
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function makeTower({ rooms = 10000, cols = 25, seed = 7 } = {}) {
  const rows = Math.ceil(rooms / cols), r = rng(seed);
  const state = new Uint8Array(rooms), shield = new Uint8Array(rooms), tile = new Uint8Array(rooms);
  for (let i = 0; i < rooms; i++) {
    const row = Math.floor(i / cols), top = row / rows;                      // higher floors are a little more active: the climb shows
    const p = r(), live = 0.05 + 0.1 * top, streak = 0.2 + 0.15 * top;
    state[i] = p < live ? WINDOW.LIT : p < live + streak ? WINDOW.GLOW : WINDOW.DIM;
    const s = r();
    shield[i] = s < 0.5 ? SHIELD.NONE : s < 0.83 ? SHIELD.PROTECTED : s < 0.93 ? SHIELD.AT_RISK : SHIELD.WAITING;
    tile[i] = Math.floor(r() * THEME_COUNT) * ACCENT_COUNT + Math.floor(r() * ACCENT_COUNT);
  }
  return { rooms, cols, rows, state, shield, tile, width: cols * CELL.w, height: rows * CELL.h };
}

// Room index -> centre of its cell in tower space (x right, y up, origin at the bottom centre).
export function roomCentre(t, i) {
  const col = i % t.cols, row = Math.floor(i / t.cols);
  return { x: (col + 0.5) * CELL.w - t.width / 2, y: (row + 0.5) * CELL.h };
}

// Tower-space point -> room index, or -1 when it misses (gap, outside, or an empty cell in the last row).
export function roomAt(t, x, y) {
  const fx = (x + t.width / 2) / CELL.w, fy = y / CELL.h;
  if (fx < 0 || fy < 0 || fx >= t.cols || fy >= t.rows) return -1;
  const col = Math.floor(fx), row = Math.floor(fy);
  if (fx - col > 1 - CELL.gap / CELL.w || fy - row > 1 - CELL.gap / CELL.h) return -1;
  const i = row * t.cols + col;
  return i < t.rooms ? i : -1;
}

export const LABELS = {
  state: ['Studying now', 'On a streak', 'Not active lately'],
  shield: ['', 'Pass Guarantee: protected', 'Pass Guarantee: at risk', 'Pass Guarantee: waiting period'],
  theme: ['Pilot', 'Coder', 'Doctor', 'Studio'],
};

// ---------------------------------------------------------------------------------------------------------------------------------
// Campus skyline (PRD section 6: "each school gets its own tower, and all towers stand together as a skyline") and friend search.
// A global room id g runs across every tower in order: tower 0 is ids 0..n0-1, tower 1 follows, and so on. Tower 0 equals makeTower() exactly.
export const TOWER_GAP = 14;
const SHARES = [1, 0.8, 0.55, 0.35, 0.25, 0.18, 0.12, 0.08];

export function makeSkyline({ towers = 1, rooms = 10000, cols = 25, seed = 7 } = {}) {
  const n = Math.max(1, Math.min(8, Math.round(towers))), list = [];
  let base = 0, width = 0;
  for (let k = 0; k < n; k++) {
    const count = k === 0 ? rooms : Math.max(500, Math.round(rooms * SHARES[k]));
    const t = makeTower({ rooms: count, cols, seed: seed + k * 101 });
    list.push({ k, t, base, seed: seed + k * 101, name: `Campus ${k + 1}`, cx: 0 }); base += count; width += t.width + (k ? TOWER_GAP : 0);
  }
  let x = -width / 2;
  for (const c of list) { c.cx = x + c.t.width / 2; x += c.t.width + TOWER_GAP; }
  return { towers: list, total: base, width, height: Math.max(...list.map(c => c.t.height)), cols };
}
export function skylineLocate(sky, g) {
  for (const c of sky.towers) if (g >= c.base && g < c.base + c.t.rooms) return { c, k: c.k, i: g - c.base };
  return null;
}
export function skylineCentre(sky, g) { const l = skylineLocate(sky, g), p = roomCentre(l.c.t, l.i); return { x: p.x + l.c.cx, y: p.y }; }
export function skylineAt(sky, x, y) {
  for (const c of sky.towers) if (Math.abs(x - c.cx) <= c.t.width / 2) { const i = roomAt(c.t, x - c.cx, y); return i < 0 ? -1 : c.base + i; }
  return -1;
}
export function skylineValue(sky, arr, g) { const l = skylineLocate(sky, g); return l.c.t[arr][l.i]; }

// Display names: adjective + animal + number. No real names and no schools anywhere (PRD safety proposal).
const ADJ = ['Quiet', 'Bright', 'Calm', 'Brave', 'Swift', 'Gentle', 'Steady', 'Curious', 'Kind', 'Clever', 'Sunny', 'Patient', 'Bold', 'Warm', 'Keen', 'Lucky', 'Mellow', 'Nimble', 'Proud', 'Eager', 'Sharp', 'Humble', 'Lively', 'Noble'];
const ANI = ['Otter', 'Falcon', 'Heron', 'Fox', 'Lynx', 'Panda', 'Robin', 'Seal', 'Wren', 'Badger', 'Koala', 'Finch', 'Gecko', 'Ibis', 'Lemur', 'Moose', 'Newt', 'Owl', 'Quail', 'Raven', 'Stoat', 'Tapir', 'Vole', 'Yak'];
const mix = n => { let x = (n + 1) * 2654435761 >>> 0; x ^= x >>> 15; x = Math.imul(x, 2246822519) >>> 0; x ^= x >>> 13; x = Math.imul(x, 3266489917) >>> 0; return (x ^ (x >>> 16)) >>> 0; };
export function displayName(seed, i) { const h = mix(seed * 7919 + i); return `${ADJ[h % ADJ.length]} ${ANI[(h >>> 8) % ANI.length]} ${100 + ((h >>> 16) % 900)}`; }
export const skylineName = (sky, g) => { const l = skylineLocate(sky, g); return displayName(l.c.seed, l.i); };

// Search by what a person would type: prefix first, then anywhere in the name. Returns up to `limit` global ids.
export function searchNames(sky, query, limit = 6) {
  const q = String(query || '').trim().toLowerCase(); if (q.length < 2) return [];
  const pre = [], any = [];
  for (const c of sky.towers) for (let i = 0; i < c.t.rooms; i++) {
    const n = displayName(c.seed, i).toLowerCase();
    if (n.startsWith(q)) { pre.push(c.base + i); if (pre.length >= limit) return pre; } else if (any.length < limit && n.includes(q)) any.push(c.base + i);
  }
  return [...pre, ...any].slice(0, limit);
}

// Placeholder facts for the room card until the backend exists, derived from the room so they are stable. Marked synthetic on purpose.
const COURSES = ['Physics 121', 'Calculus II', 'Organic Chemistry', 'Intro to Law', 'Data Structures', 'Anatomy', 'Statistics', 'Macroeconomics'];
export function roomFacts(sky, g) {
  const l = skylineLocate(sky, g), t = l.c.t, i = l.i, h = mix(l.c.seed * 31 + i), state = t.state[i];
  return { name: displayName(l.c.seed, i), campus: l.c.name, floor: Math.floor(i / t.cols) + 1, floors: t.rows, theme: Math.floor(t.tile[i] / ACCENT_COUNT), state, shield: t.shield[i],
    streakDays: state === WINDOW.GLOW ? 3 + (h % 40) : state === WINDOW.LIT ? 1 + (h % 12) : h % 3, studying: state === WINDOW.LIT ? COURSES[(h >>> 4) % COURSES.length] : null, synthetic: true };
}
