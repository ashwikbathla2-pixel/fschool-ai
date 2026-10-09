import assert from 'node:assert/strict';
import { verify, ingest, climbScore, assignFloors, floorMove, strikes, guaranteeState, evaluateClaim, RULES } from './engine.js';

const DAY = 864e5, now = Date.UTC(2026, 9, 8);
const blk = (o = {}) => ({ id: Math.random() + '', studentId: 's1', type: 'block', course: 'PHY121', ts: now - DAY, minutes: 25, activeMs: 25 * 60000, checkScore: 0.9, ...o });

// verification
assert.equal(verify(blk()).verified, true);
assert.equal(verify(blk({ activeMs: 60000 })).verified, false, 'walked away');
assert.equal(verify(blk({ checkScore: 0.1, canvasActions: 0 })).verified, false, 'no proof');
assert.equal(verify(blk({ checkScore: 0, canvasActions: 9 })).verified, true, 'canvas writing counts');
assert.equal(verify(blk({ pastedAi: true })).verified, false);
assert.equal(verify({ type: 'keypoint', mastery: 0.5 }).verified, false);
assert.equal(verify({ type: 'keypoint', mastery: 0.9, secondsPerCheck: 2 }).verified, false, 'speed-click');
assert.equal(verify({ type: 'grade', source: 'upload' }).verified, false);

// duplicates cannot farm the climb
let r = ingest([], blk({ id: 'a' })); r = ingest(r.stream, blk({ id: 'a' }));
assert.equal(r.duplicate, true); assert.equal(r.stream.length, 1);

// climb: only verified, only in window, fades
const evs = [blk({ id: '1' }), blk({ id: '2', ts: now - 40 * DAY }), blk({ id: '3', activeMs: 0 }), blk({ id: '4', studentId: 's2' })].map(e => verify(e));
const sc = climbScore(evs, 's1', now);
assert.ok(sc > 9 && sc < 10, 'one fresh verified block only: ' + sc);
assert.ok(climbScore([], 's1', now) === 0);

// floors: rank is floor; ties share
assert.deepEqual(assignFloors({ a: 50, b: 10, c: 50, d: 0 }), { a: 3, b: 2, c: 3, d: 1 });
assert.equal(floorMove(3, 1).tone, 'gentle'); assert.equal(floorMove(1, 3).kind, 'up');

// strikes: 3 empty weeks = 3 strikes
const plan = { startTs: now - 21 * DAY, hoursPerWeek: 5, course: 'PHY121' };
assert.equal(strikes(plan, [], 's1', now).strikes, 3);
const weekly = i => Array.from({ length: 6 }, (_, k) => verify(blk({ id: `w${i}${k}`, ts: plan.startTs + i * 7 * DAY + (k + 1) * 3600e3 })));
assert.equal(strikes(plan, [...weekly(0), ...weekly(1), ...weekly(2)], 's1', now).strikes, 0);

// guarantee states
const stu = { tier: 'pro', gradeSourceVerified: true, joinedTs: now - 21 * DAY, plan, planBlocksTotal: { PHY121: 18 } };
const good = [...weekly(0), ...weekly(1), ...weekly(2)];
assert.equal(guaranteeState({ ...stu, tier: 'basic' }, good, 's1', now).state, 'off');
assert.equal(guaranteeState({ ...stu, gradeSourceVerified: false }, good, 's1', now).state, 'off');
assert.equal(guaranteeState(stu, good, 's1', now).state, 'protected');
assert.equal(guaranteeState({ ...stu, joinedTs: now - 3 * DAY }, good, 's1', now).state, 'waiting');
assert.equal(guaranteeState(stu, [], 's1', now).state, 'ended');
assert.equal(guaranteeState(stu, [...weekly(0), ...weekly(1)], 's1', now).state, 'at-risk');

// claims
const fail = { course: 'PHY121', finalGrade: 40, passMark: 50, source: 'portal' };
assert.equal(evaluateClaim(stu, good, 's1', fail, now).payout, RULES.maxPayout);
assert.equal(evaluateClaim(stu, good, 's1', { ...fail, finalGrade: 80 }, now).eligible, false);
assert.equal(evaluateClaim(stu, good, 's1', { ...fail, source: 'upload' }, now).eligible, false);
assert.equal(evaluateClaim({ ...stu, paidCourses: ['PHY121'] }, good, 's1', fail, now).eligible, false);
assert.equal(evaluateClaim({ ...stu, planBlocksTotal: { PHY121: 100 } }, good, 's1', fail, now).eligible, false, 'plan not followed');
assert.equal(evaluateClaim(stu, [], 's1', fail, now).eligible, false, 'ended');
console.log('engine: all tests passed');
