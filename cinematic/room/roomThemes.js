// Room model for PRD section 7 (the 3D Room) and the in-world part of section 9 (shield + strikes). Pure functions: no DOM, no three.js.
// Room.js (3D) and FlatRoom.js (SVG fallback) both draw from the same model, so the tap targets can never drift apart.
import { THEMES, themeFor } from '../studyworld/profile.js';
import { guaranteeState, strikes as strikesOf, RULES } from '../studyworld/engine.js';

// Proposal values. The PRD gives no numbers for these; Sachcit / design can change them in one place.
export const ROOM_CONFIG = Object.freeze({
  defaultFloorCount: 40,     // proposal: tower height is not decided (PRD section 6, "one tower or many?"); callers pass ctx.floorCount when known
  cornerFrom: 0.5,           // proposal: top half of the tower gets the corner room with the skyline
  sizeLow:  { w: 4.4, d: 3.8, h: 2.6 },   // metres, ground-floor "small room"
  sizeHigh: { w: 6.2, d: 5.2, h: 3.0 },   // top-floor corner room
  milestones: [1, 5, 10, 25],   // proposal: verified blocks that earn a trophy; the PRD says "milestones" without naming any
  sessionsShown: 6,
});

// What lives in every room. `kind` says what a tap does: 'nav' goes to another level, 'panel' opens a small sheet in place.
export const TARGETS = Object.freeze([
  { id: 'desk',       label: 'Desk and monitor', hint: 'Open your desk and start studying',    kind: 'nav', to: 'desk' },
  { id: 'whiteboard', label: 'Whiteboard',       hint: "See today's plan",                     kind: 'panel' },
  { id: 'bookshelf',  label: 'Bookshelf',        hint: 'Past sessions and notes',              kind: 'panel' },
  { id: 'future',     label: 'Your future self', hint: 'Talk to your future self',             kind: 'panel' },
  { id: 'trophy',     label: 'Trophy shelf',     hint: 'Milestones and Pass Guarantee status', kind: 'panel' },
  { id: 'window',     label: 'Window',           hint: 'Zoom out to the tower',                kind: 'nav', to: 'tower' },
  { id: 'door',       label: 'Door',             hint: 'Who visited, friends nearby',          kind: 'panel' },
]);
export const targetById = id => TARGETS.find(t => t.id === id);

// What each theme dresses the shared shell with. Both renderers read the prop names; the accent comes from THEMES (the student changes colours, not us).
export const DRESSING = Object.freeze({
  pilot:  { props: ['yoke', 'throttle', 'headset', 'chart'],          blurb: 'Cockpit corner' },
  coder:  { props: ['second-monitor', 'beanbag', 'rack', 'terminal'], blurb: 'Hack house' },
  doctor: { props: ['exam-bed', 'iv-stand', 'stethoscope', 'anatomy'], blurb: 'Clinic' },
  studio: { props: ['plant', 'lamp', 'easel', 'prints'],              blurb: 'Studio' },
});

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;

// Floor -> room. Low floors: small room, view of the next building. High floors: corner room, skyline (PRD "Your floor shapes your room").
export function roomShape(floor, floorCount = ROOM_CONFIG.defaultFloorCount, cfg = ROOM_CONFIG) {
  const f = Math.max(1, Math.round(Number(floor) || 1));
  const n = Math.max(1, Math.round(Number(floorCount) || cfg.defaultFloorCount));
  const t = n <= 1 ? 0 : clamp((f - 1) / (n - 1), 0, 1);
  const r = k => Math.round(lerp(cfg.sizeLow[k], cfg.sizeHigh[k], t) * 100) / 100;
  const corner = t >= cfg.cornerFrom;
  return { size: { w: r('w'), d: r('d'), h: r('h') }, view: corner ? 'skyline' : 'neighbour', corner, t };
}

// Deterministic buildings for the window (same floor, same view, every device). mulberry32, like tower/towerData.js.
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// Returns [{ x, w, h, depth }] with x in -1..1 across the window; depth 0 = nearest. `neighbour` = two or three close blocks, `skyline` = a far row.
export function viewBuildings(view, floor = 1) {
  const r = rng(1009 * (Math.round(floor) || 1) + (view === 'skyline' ? 7 : 3));
  if (view === 'neighbour') {
    const n = 2 + Math.floor(r() * 2);
    return Array.from({ length: n }, (_, i) => ({ x: -0.6 + i * (1.2 / Math.max(1, n - 1)) + (r() - 0.5) * 0.1, w: 0.5 + r() * 0.2, h: 2.4 + r() * 1.6, depth: 0 }));
  }
  const out = [];
  for (let i = 0; i < 16; i++) {
    const depth = i % 3;
    out.push({ x: -1 + (i / 15) * 2 + (r() - 0.5) * 0.1, w: 0.14 + r() * 0.12, h: 1.0 + r() * (depth === 0 ? 1.8 : 2.8) + depth * 0.5, depth });
  }
  return out;
}

// Rotation limits for drag-to-rotate, in radians around the room centre. Never lets the camera get behind the two walls.
export const ORBIT = Object.freeze({ yaw0: 0.7, yawRange: 0.5, pitch0: 0.4, pitchMin: 0.22, pitchMax: 0.6 });
export const clampYaw = y => clamp(y, ORBIT.yaw0 - ORBIT.yawRange, ORBIT.yaw0 + ORBIT.yawRange);
export const clampPitch = p => clamp(p, ORBIT.pitchMin, ORBIT.pitchMax);

// ---- Guarantee: the shield on the door and the trophy shelf (PRD section 9, "In the World") ----------------------------
export const SHIELD_COLORS = Object.freeze({ green: '#2f9e62', orange: '#ee8a1f', indigo: '#5b55d6' });
const fmtDate = (ts, timeZone) => new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', ...(timeZone ? { timeZone } : {}) });

// g: engine.guaranteeState(...). Maps green = protected, orange = at risk, indigo = waiting (with the begin date), none = off (with the reason).
export function shieldView(g, strikeCount = g?.strikes ?? 0, rules = RULES, timeZone) {
  strikeCount = Math.min(strikeCount, rules.strikeLimit);   // weeks missed past the limit still read "3 of 3"
  const base = { strikes: strikeCount, strikeLimit: rules.strikeLimit, strikeText: `${strikeCount} of ${rules.strikeLimit} strikes` };
  switch (g?.state) {
    case 'protected': return { ...base, kind: 'protected', color: SHIELD_COLORS.green, label: 'Protected', detail: g.reason };
    case 'at-risk':   return { ...base, kind: 'at-risk', color: SHIELD_COLORS.orange, label: 'At risk', detail: g.reason };
    case 'waiting':   return { ...base, kind: 'waiting', color: SHIELD_COLORS.indigo, label: 'Waiting period', beginsTs: g.beginsTs, detail: `Coverage begins ${fmtDate(g.beginsTs, timeZone)}` };
    case 'ended':     return { ...base, kind: 'none', color: null, label: 'Coverage ended', detail: g.reason };
    default:          return { ...base, kind: 'none', color: null, label: 'No guarantee', detail: g?.reason || 'Guarantee is off' };
  }
}

// Milestones from verified blocks. Thresholds are ROOM_CONFIG.milestones (a proposal).
export function milestones(events = [], studentId = 'me', cfg = ROOM_CONFIG) {
  const done = events.filter(e => e.verified && e.type === 'block' && e.studentId === studentId).length;
  const list = cfg.milestones.map(n => ({ blocks: n, reached: done >= n, label: n === 1 ? 'First verified block' : `${n} verified blocks` }));
  return { done, list, reachedCount: list.filter(m => m.reached).length };
}

// Past sessions for the bookshelf: newest verified blocks first.
export function pastSessions(events = [], studentId = 'me', cfg = ROOM_CONFIG) {
  return events.filter(e => e.verified && e.type === 'block' && e.studentId === studentId).sort((a, b) => b.ts - a.ts).slice(0, cfg.sessionsShown)
    .map(e => ({ id: e.id, ts: e.ts, course: e.course || 'Study block', minutes: e.minutes || RULES.blockMinutes }));
}

// Everything both renderers need, from the app ctx: { profile, student, events, floor, floorCount }.
export function buildRoomModel({ profile, student, events = [], floor, floorCount, now = Date.now(), timeZone } = {}) {
  const p = profile || {};
  const theme = THEMES[p.room?.theme] ? p.room.theme : themeFor(p.dream?.text);
  const T = THEMES[theme];
  const fl = Math.max(1, Math.round(Number(floor ?? p.room?.floor) || 1));
  const shape = roomShape(fl, floorCount);
  const sid = student?.id || 'me';
  const g = student ? guaranteeState(student, events, sid, now) : { state: 'off', shield: null, reason: 'No grade source verified yet' };
  // Strikes are shown even when the guarantee is off (N of limit), so compute them from the plan when the engine did not return them.
  const strikeCount = g.strikes ?? (student?.plan ? strikesOf(student.plan, events, sid, now).strikes : 0);
  const shield = shieldView(g, strikeCount, RULES, timeZone);
  return {
    theme, themeLabel: T.label, accent: p.room?.accent || T.accent, dressing: DRESSING[theme],
    floor: fl, floorCount: floorCount || ROOM_CONFIG.defaultFloorCount, shape, buildings: viewBuildings(shape.view, fl),
    role: T.role, firstBlock: p.firstBlock || { minutes: RULES.blockMinutes, course: 'your first course' },
    courses: p.courses || [], hoursPerWeek: p.hoursPerWeek || 0,
    shield, guarantee: g, milestones: milestones(events, sid), sessions: pastSessions(events, sid), targets: TARGETS,
    // Accessible one-line description of the whole room, used as the canvas / SVG label.
    summary: `${T.label} room on floor ${fl}: ${shape.corner ? 'corner room with a skyline view' : 'small room with a view of the next building'}. Pass Guarantee ${shield.label.toLowerCase()}, ${shield.strikeText}.`,
  };
}

// The sheet each 'panel' target opens. Plain data so it is testable; Room.js renders it. Actions are { label, go, opts }.
export function panelFor(id, m, extra = {}) {
  const t = targetById(id);
  if (!t) return null;
  const s = m.shield;
  const shieldLines = [`Pass Guarantee: ${s.label}`, s.detail, s.strikeText];
  switch (id) {
    case 'whiteboard': return { id, title: "Today's plan", lines: [
      `${m.firstBlock.minutes} minutes of ${m.firstBlock.course}`,
      m.hoursPerWeek ? `${m.hoursPerWeek} hours a week across ${m.courses.length || 'your'} course${m.courses.length === 1 ? '' : 's'}` : 'Set your weekly hours at your desk',
      ...(m.courses.length ? [`Courses: ${m.courses.join(', ')}`] : [])],
      actions: [{ label: 'Start this block at the desk', go: 'desk', opts: { course: m.firstBlock.course, minutes: m.firstBlock.minutes } }] };
    case 'bookshelf': return { id, title: 'Past sessions', lines: m.sessions.length
      ? m.sessions.map(x => `${x.course}, ${x.minutes} min`)
      : ['Nothing on the shelf yet. Your first verified block puts a book here.'], actions: [] };
    case 'future': return { id, title: 'Your future self', talk: true, lines: [`Your future ${m.role} is here to talk it through.`, ...(extra.talkReady ? [] : ['Voice and chat are not connected in this build yet.'])], actions: [] };
    case 'trophy': return { id, title: 'Trophy shelf', lines: [...m.milestones.list.map(x => `${x.reached ? 'Earned' : 'Next'}: ${x.label}`), ...shieldLines], actions: [] };
    case 'door': return { id, title: 'The door', lines: [
      ...(extra.visitors?.length ? extra.visitors.map(v => String(v.name || v)) : ['No visitors yet. Friends nearby will show up here.']), ...shieldLines], actions: [] };
    default: return { id, title: t.label, lines: [t.hint], actions: [] };
  }
}
