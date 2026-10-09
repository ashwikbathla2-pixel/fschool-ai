import assert from 'node:assert/strict';
import { masteryFill, nextMastery, createActiveClock, createStrokeCounter, keypointEvent, blockEvent, summarize, planBlock, isCorrect, LESSON } from './deskLogic.js';
import { skinFor } from './deskSkin.js';
import { verify, climbScore, RULES } from '../studyworld/engine.js';

// answers + mastery
assert.equal(isCorrect(' 3 ', 3), true); assert.equal(isCorrect('abc', 3), false);
assert.ok(nextMastery(0, true, false) >= RULES.masteredAt, 'clean first try is mastered');
assert.ok(nextMastery(0, true, true) < RULES.masteredAt, 'right after a miss needs one more');
assert.equal(nextMastery(0.1, false, true), 0);

// rail fills on mastery, not clicks
const kps = LESSON.keypoints;
assert.equal(masteryFill(kps, {}).fraction, 0);
assert.equal(masteryFill(kps, { [kps[0].id]: 0.79, [kps[1].id]: 0.5 }).mastered, 0, 'below masteredAt does not fill');
const f = masteryFill(kps, { [kps[0].id]: 0.8, [kps[1].id]: 0.95 });
assert.equal(f.mastered, 2); assert.ok(Math.abs(f.fraction - 2 / 3) < 1e-9);

// active clock: hidden tab pauses
const c = createActiveClock(); c.start(1000); c.pause(61000); c.start(500000); assert.equal(c.read(530000), 90000);
c.pause(530000); assert.equal(c.read(999999), 90000);

// canvas actions: real strokes only
const s = createStrokeCounter(); s.down(); s.up(); assert.equal(s.count, 0, 'a bare tap is not writing');
s.down(); s.move(); s.move(); s.up(); assert.equal(s.count, 1);
s.move(); s.up(); assert.equal(s.count, 1, 'moves without a down do nothing');

// event assembly feeds verify
const kp = kps[0], ts = Date.UTC(2026, 9, 8);
const ke = keypointEvent({ blockId: 'b1', kp, course: 'PHY 121', mastery: 0.9, secondsPerCheck: 12, pastedAi: false, ts });
assert.equal(ke.id, 'keypoint:b1:' + kp.id); assert.equal(verify(ke).verified, true);
assert.equal(verify({ ...ke, secondsPerCheck: 2 }).reason, 'clicked through too fast');
assert.equal(verify({ ...ke, pastedAi: true }).reason, 'answer was pasted in, not written');
const be = blockEvent({ blockId: 'b1', course: 'PHY 121', ts, activeMs: 25 * 60000, checkScore: 1, canvasActions: 0, secondsPerCheck: 20 });
assert.equal(be.id, 'block:b1'); assert.equal(verify(be).verified, true);
assert.equal(verify({ ...be, activeMs: 1000 }).reason, 'not enough active time on the board');
assert.equal(verify({ ...be, checkScore: null, canvasActions: 2 }).reason, 'no check passed and no real writing on the canvas');

// summary delta from the real climb score
const v = verify({ ...be, studentId: 'me' });
const before = climbScore([], 'me', ts), after = climbScore([v], 'me', ts);
const sum = summarize({ blockResult: v, keypointsMastered: 2, keypointsTotal: 3, climbBefore: before, climbAfter: after });
assert.equal(sum.climbGained, RULES.weights.block); assert.equal(sum.blockVerified, true);
const bad = summarize({ blockResult: verify({ ...be, activeMs: 0 }), keypointsMastered: 0, keypointsTotal: 3, climbBefore: 0, climbAfter: 0 });
assert.equal(bad.climbGained, 0); assert.equal(bad.blockReason, 'not enough active time on the board');

// skin + plan: same lesson, three labels; no profile falls back to Studio
assert.equal(skinFor('pilot', 'PHY 121').courseLabel, 'FLIGHT PHY 121');
assert.equal(skinFor('doctor', 'PHY 121').courseLabel, 'CASE PHY 121');
assert.equal(skinFor('coder', 'PHY 121').courseLabel, '~/phy-121');
assert.equal(skinFor('nope').theme, 'studio'); assert.equal(skinFor('studio', 'Bio').courseLabel, 'Bio');
assert.equal(skinFor('pilot').portrait.photo, false);
assert.deepEqual(planBlock(null), { course: 'PHY 121', minutes: 25, theme: 'studio' });
assert.equal(planBlock({ worriedCourse: 'CHEM 101', room: { theme: 'doctor' } }).theme, 'doctor');
console.log('desk tests ok');
