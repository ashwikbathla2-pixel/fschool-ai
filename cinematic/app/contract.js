// Shared contract for the Study World app layer (PRD sections 4, 8, 10). Every Tower / Room / Desk / Interview module imports ONLY from here
// for persistence and navigation types, so modules can be built independently and snapped together by app/shell.js.
// No DOM work at import time. Storage is localStorage behind try/catch; the real backend replaces `BACKEND` later (config slot, not decided in the PRD).
import { buildProfile } from '../studyworld/profile.js';
import { ingest, RULES } from '../studyworld/engine.js';

export const BACKEND = { eventsUrl: null };   // null = local only. PRD: "every finished block and keypoint sends one verified event to the backend".

export const LEVELS = Object.freeze(['tower', 'room', 'desk']);   // PRD section 4: back always goes up exactly one level
export const parentLevel = l => LEVELS[Math.max(0, LEVELS.indexOf(l) - 1)];

const K = { profile: 'fschool.profile.v1', events: 'fschool.events.v1', student: 'fschool.student.v1' };
const safe = fn => { try { return fn(); } catch { return null; } };
const read = k => safe(() => JSON.parse(localStorage.getItem(k) || 'null'));
const write = (k, v) => safe(() => localStorage.setItem(k, JSON.stringify(v)));

export const loadProfile = () => read(K.profile);
export const saveProfile = p => write(K.profile, p);
export const profileFromAnswers = buildProfile;

// Student record the guarantee needs (engine.guaranteeState): { joinedTs, tier, gradeSourceVerified, plan, planBlocksTotal, paidCourses }.
export function loadStudent(profile = loadProfile(), now = Date.now()) {
  const saved = read(K.student);
  if (saved) return saved;
  const p = profile || {};
  return {
    id: 'me', joinedTs: now, tier: 'basic', gradeSourceVerified: false,
    plan: { startTs: now, hoursPerWeek: p.hoursPerWeek || 5, course: p.worriedCourse || '' },
    planBlocksTotal: Object.fromEntries((p.courses || []).map(c => [c, 12])),   // proposal: placeholder until the plan generator exists
    paidCourses: [],
  };
}
export const saveStudent = s => write(K.student, s);

export const loadEvents = () => read(K.events) || [];
// One verified-study event in, through the engine, appended once (duplicates by id are dropped). Returns { event, duplicate }.
export function recordEvent(raw, now = Date.now()) {
  const res = ingest(loadEvents(), { studentId: 'me', ts: now, ...raw });
  if (!res.duplicate) {
    write(K.events, res.stream);
    if (BACKEND.eventsUrl) safe(() => navigator.sendBeacon(BACKEND.eventsUrl, JSON.stringify(res.event)));
  }
  return { event: res.event, duplicate: res.duplicate };
}

// Navigation: modules call nav.go(level, opts) / nav.back(). A module is { mount(host, ctx) -> { dispose() } } with
// ctx = { profile, student, events, nav, level }. The shell owns camera moves; modules only draw their own level.
export const makeNav = (onGo) => {
  let level = 'room';
  return {
    get level() { return level; },
    go(next, opts = {}) { if (!LEVELS.includes(next)) return; const prev = level; level = next; onGo?.(next, prev, opts); },
    back() { const up = parentLevel(level); if (up !== level) this.go(up, { via: 'back' }); },
  };
};

export { RULES };
