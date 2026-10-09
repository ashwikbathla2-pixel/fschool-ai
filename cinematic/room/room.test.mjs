import assert from 'node:assert/strict';
import { roomShape, viewBuildings, shieldView, milestones, pastSessions, buildRoomModel, panelFor, clampYaw, clampPitch, ORBIT, TARGETS, DRESSING, ROOM_CONFIG, SHIELD_COLORS } from './roomThemes.js';
import { THEMES, buildProfile } from '../studyworld/profile.js';
import { guaranteeState, RULES } from '../studyworld/engine.js';

const DAY = 864e5, now = Date.UTC(2026, 9, 8, 12);

// floor shapes the room
const low = roomShape(1, 40), high = roomShape(40, 40), mid = roomShape(20, 40);
assert.equal(low.view, 'neighbour'); assert.equal(low.corner, false);
assert.equal(high.view, 'skyline'); assert.equal(high.corner, true);
assert.ok(high.size.w > low.size.w && high.size.d > low.size.d && high.size.h > low.size.h, 'higher floors are bigger');
assert.ok(mid.size.w > low.size.w && mid.size.w < high.size.w, 'sizes interpolate');
assert.deepEqual(roomShape(1, 1).size, ROOM_CONFIG.sizeLow, 'one-floor tower is the small room');
assert.deepEqual(roomShape(999, 40), roomShape(40, 40), 'floor beyond the top clamps');
assert.equal(roomShape(NaN, 40).view, 'neighbour');

// view is deterministic per floor
assert.deepEqual(viewBuildings('skyline', 33), viewBuildings('skyline', 33));
assert.notDeepEqual(viewBuildings('skyline', 33), viewBuildings('skyline', 34));
assert.ok(viewBuildings('neighbour', 2).length >= 2 && viewBuildings('skyline', 30).length > 8);

// targets: PRD table, 7 of them, desk always navigates
assert.deepEqual(TARGETS.map(t => t.id), ['desk', 'whiteboard', 'bookshelf', 'future', 'trophy', 'window', 'door']);
assert.ok(TARGETS.every(t => t.label.length > 2 && t.hint));
assert.equal(TARGETS.find(t => t.id === 'desk').to, 'desk'); assert.equal(TARGETS.find(t => t.id === 'window').to, 'tower');

// every theme has dressing; accent comes from THEMES
for (const k of Object.keys(THEMES)) assert.ok(DRESSING[k]?.props.length >= 3, k);

// drag limits keep the camera in front of the walls
assert.equal(clampYaw(-9), ORBIT.yaw0 - ORBIT.yawRange); assert.equal(clampYaw(9), ORBIT.yaw0 + ORBIT.yawRange); assert.equal(clampYaw(0.7), 0.7);
assert.equal(clampPitch(0), ORBIT.pitchMin); assert.equal(clampPitch(5), ORBIT.pitchMax);

// shield mapping: green / orange / indigo / none, with strike count "N of limit"
const base = { id: 'me', joinedTs: now - 40 * DAY, tier: 'pro', gradeSourceVerified: true, plan: { startTs: now - 28.5 * DAY, hoursPerWeek: 5, course: 'X' }, planBlocksTotal: { X: 12 }, paidCourses: [] };
const blk = (i, ts) => ({ id: 'b' + i, studentId: 'me', type: 'block', course: 'X', ts, minutes: 25, verified: true });
const full = [0, 1, 2, 3].flatMap(w => Array.from({ length: 7 }, (_, k) => blk(w * 10 + k, now - (28 - w * 7) * DAY + (k + 1) * DAY * 0.9)));
const sv = (student, events) => shieldView(guaranteeState(student, events, 'me', now), undefined, RULES, 'UTC');
let s = sv(base, full);
assert.equal(s.kind, 'protected'); assert.equal(s.color, SHIELD_COLORS.green); assert.equal(s.strikeText, '0 of 3 strikes');
s = sv(base, full.slice(0, 14));   // weeks 3 and 4 empty -> 2 strikes, the last one at the limit's edge
assert.equal(s.kind, 'at-risk'); assert.equal(s.color, SHIELD_COLORS.orange); assert.equal(s.strikes, 2); assert.equal(s.strikeText, '2 of 3 strikes');
s = sv({ ...base, joinedTs: now - 3 * DAY, plan: { ...base.plan, startTs: now - 3 * DAY } }, []);
assert.equal(s.kind, 'waiting'); assert.equal(s.color, SHIELD_COLORS.indigo); assert.match(s.detail, /Oct 19, 2026/, 'shows the date coverage begins: ' + s.detail);
s = sv({ ...base, tier: 'basic' }, []);
assert.equal(s.kind, 'none'); assert.equal(s.color, null); assert.match(s.detail, /Basic plan/);
s = sv({ ...base, gradeSourceVerified: false }, []);
assert.equal(s.kind, 'none'); assert.match(s.detail, /grade source/);
s = sv(base, []);   // four missed weeks: past the limit, coverage ended -> no shield, reason shown
assert.equal(s.kind, 'none'); assert.match(s.detail, /Three strikes/); assert.equal(s.strikeLimit, RULES.strikeLimit);

// milestones + sessions only count verified blocks of this student
const evs = [...full.slice(0, 6), { ...blk(99, now), verified: false }, { ...blk(98, now), studentId: 'x' }];
const ms = milestones(evs); assert.equal(ms.done, 6); assert.equal(ms.reachedCount, 2);
assert.equal(pastSessions(evs).length, 6); assert.ok(pastSessions(evs)[0].ts >= pastSessions(evs)[1].ts);
assert.equal(pastSessions([]).length, 0);

// full model from a profile
const profile = buildProfile({ dream: 'a pilot', why: 'x', courses: ['Physics 121'], hours: 5, worried: 'Physics 121' });
let m = buildRoomModel({ profile, student: base, events: full, floor: 40, now, timeZone: 'UTC' });
assert.equal(m.theme, 'pilot'); assert.equal(m.accent, THEMES.pilot.accent); assert.equal(m.shape.view, 'skyline');
assert.match(m.summary, /Pilot room on floor 40.*protected, 0 of 3 strikes/);
assert.equal(buildRoomModel({ profile: buildProfile({ dream: 'a marine biologist' }), floor: 1 }).theme, 'doctor', 'biology maps to the Doctor theme');
m = buildRoomModel({ profile: buildProfile({ dream: 'a clown' }) }); assert.equal(m.theme, 'studio'); assert.equal(m.floor, 1);
m = buildRoomModel({}); assert.equal(m.theme, 'studio'); assert.equal(m.shield.kind, 'none'); assert.equal(m.shield.strikeText, '0 of 3 strikes', 'works with no data at all');
// strike count shows even with the guarantee off
m = buildRoomModel({ profile, student: { ...base, tier: 'basic' }, events: [], now });
assert.equal(m.shield.strikes, 3, 'plan misses are still counted when the guarantee is off, capped at the limit'); assert.match(m.shield.strikeText, /3 of 3 strikes/);

// panels
m = buildRoomModel({ profile, student: base, events: full, now, timeZone: 'UTC' });
for (const t of TARGETS) assert.ok(panelFor(t.id, m)?.title, t.id);
assert.equal(panelFor('nope', m), null);
assert.equal(panelFor('whiteboard', m).actions[0].go, 'desk');
assert.ok(panelFor('trophy', m).lines.some(l => /Pass Guarantee: Protected/.test(l)) && panelFor('door', m).lines.some(l => /0 of 3 strikes/.test(l)));
assert.match(panelFor('bookshelf', buildRoomModel({ profile })).lines[0], /Nothing on the shelf/);
assert.ok(panelFor('future', m).talk); assert.equal(panelFor('door', m, { visitors: [{ name: 'Ava' }] }).lines[0], 'Ava');
console.log('room.test.mjs ok');
