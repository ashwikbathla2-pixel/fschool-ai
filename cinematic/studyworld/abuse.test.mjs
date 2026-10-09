// "Break the guarantee" (PRD section 10 spike): every way we could think of to collect $2,000 unfairly or farm the climb,
// and what engine.js does about it. Run: node --test studyworld/abuse.test.mjs
//
// Two kinds of test:
//   - normal tests assert something the engine DOES stop (these must pass).
//   - KNOWN GAP tests assert the SAFE behavior we would want. The engine does not give it today, so they are registered as
//     node:test `todo` (reported as TODO, do not fail the run). Each carries the exact hole and whether it is a policy
//     question for Sachcit or a server/data-source job the pure engine cannot do. When a gap is closed its todo starts
//     passing and the summary at the end flips it from OPEN to CLOSED.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { verify, ingest, climbScore, strikes, guaranteeState, evaluateClaim, RULES } from './engine.js';

const DAY = 864e5, HOUR = 36e5, now = Date.UTC(2026, 9, 8);
let n = 0;
const blk = (o = {}) => ({ id: 'e' + ++n, studentId: 's1', type: 'block', course: 'PHY121', ts: now - DAY, minutes: 25, activeMs: 25 * 60000, checkScore: 0.9, secondsPerCheck: 20, ...o });
const weekly = (plan, i, k = 6, o = {}) => Array.from({ length: k }, (_, j) => verify(blk({ ts: plan.startTs + i * 7 * DAY + (j + 1) * 3600e3, ...o })));
const plan = { startTs: now - 21 * DAY, hoursPerWeek: 5, course: 'PHY121' };
const stu = { tier: 'pro', gradeSourceVerified: true, joinedTs: now - 21 * DAY, plan, planBlocksTotal: { PHY121: 18 } };
const good = [0, 1, 2].flatMap(i => weekly(plan, i));
const fail = { course: 'PHY121', finalGrade: 40, passMark: 50, source: 'portal' };
const claim = (s = stu, ev = good, c = fail, t = now) => evaluateClaim(s, ev, 's1', c, t);

// Sanity: the baseline student is genuinely eligible, so every "rejected" below is rejected for the reason named.
test('baseline: a student who followed the plan and failed is paid', () => {
  assert.equal(claim().eligible, true);
  assert.equal(claim().payout, RULES.maxPayout);
});

// ---- Known gaps (registered at the bottom as todo tests) -----------------------------------------------------------------
const GAPS = [];
const gap = (id, kind, title, hole, check) => GAPS.push({ id, kind, title, hole, check });

// 1. Replayed event ids
test('1 replayed ids: same id twice, or another student replaying it, earns nothing extra', () => {
  let r = ingest([], blk({ id: 'x' }), RULES, now);
  r = ingest(r.stream, blk({ id: 'x' }), RULES, now);
  assert.equal(r.duplicate, true);
  const r2 = ingest(r.stream, blk({ id: 'x', studentId: 's2' }), RULES, now);
  assert.equal(r2.duplicate, true, 'a different student replaying the id is also a duplicate');
  assert.equal(r2.stream.length, 1);
  assert.equal(climbScore(r2.stream, 's2', now), 0);
});
gap('G1', 'server', 'Same real session replayed under a fresh id', 'Event ids are chosen by the client. Re-sending identical work with a new id is a new, verified event. Needs a server-issued session or block id that is unique per real block.', () => {
  const a = blk({ sessionId: 'sess1' }), b = blk({ sessionId: 'sess1' });
  const r = ingest(ingest([], a, RULES, now).stream, b, RULES, now);
  return r.event.verified === false || r.duplicate === true;
});

// 2. Pasted AI answers
test('2 pasted AI answers: a block or keypoint flagged pastedAi never verifies', () => {
  assert.equal(verify(blk({ pastedAi: true, canvasActions: 99 })).verified, false);
  assert.equal(verify({ type: 'keypoint', mastery: 1, pastedAi: true }).verified, false);
});
gap('G2', 'server', 'Pasted answer when the client does not set pastedAi', 'The engine trusts the client-reported pastedAi flag. A modified client simply omits it. Needs a paste signal measured server-side (paste size, input timing).', () =>
  verify(blk({ pastedChars: 800, canvasActions: 0 })).verified === false);

// 3. Idle tab
test('3 idle tab: a block left open and walked away from does not verify', () => {
  assert.equal(verify(blk({ activeMs: 0 })).verified, false);
  assert.equal(verify(blk({ activeMs: 25 * 60000 * 0.59 })).verified, false);
  assert.equal(verify(blk({ activeMs: 25 * 60000 * 0.6 })).verified, true, 'boundary: exactly the minimum share passes');
});
gap('G3', 'server', 'Mouse-jiggler / auto-clicker that keeps activeMs high', 'activeMs is client-reported and is not bounded by wall-clock time. A script can hold the tab "active". Needs server heartbeats and a canvas-action sanity check.', () =>
  verify(blk({ minutes: 25, activeMs: 10 * HOUR, canvasActions: 0, checkScore: 0.9 })).verified === false);

// 4. Speed-clicking
test('4 speed-clicking: answering checks faster than the minimum is not proof, in keypoints or in blocks', () => {
  assert.equal(verify({ type: 'keypoint', mastery: 0.95, secondsPerCheck: 2 }).verified, false);
  assert.equal(verify(blk({ checkScore: 1, canvasActions: 0, secondsPerCheck: 1 })).verified, false, 'block with an instant correct check');
  assert.equal(verify(blk({ checkScore: 1, canvasActions: 9, secondsPerCheck: 1 })).verified, true, 'real writing on the canvas is still a valid proof');
});
gap('G4', 'policy', 'Keypoint with the timing field simply left out', 'secondsPerCheck is skipped when absent (!= null). Whether missing telemetry should count as unverified is a policy call: it would reject legitimate clients that cannot measure it.', () =>
  verify({ type: 'keypoint', mastery: 0.95 }).verified === false);

// 5. Week-10 signup
test('5 week-10 signup: the waiting period blocks any claim until it ends', () => {
  const late = { ...stu, joinedTs: now - 3 * DAY };
  assert.equal(guaranteeState(late, good, 's1', now).state, 'waiting');
  assert.equal(claim(late).eligible, false);
  assert.equal(guaranteeState({ ...late, joinedTs: now - RULES.waitingDays * DAY }, good, 's1', now).state, 'protected', 'boundary: covered the moment the waiting period ends');
});
gap('G5', 'policy', 'Late joiner whose plan only covers the rest of the term', 'The 80% test divides by planBlocksTotal, which is the size of the plan we generated at join time, not of the course. Join in week 10 with a 3-block plan, finish 3, fail, and 100% is "done". Needs total taken from the syllabus; the 14-day wait alone does not fix this.', () =>
  claim({ ...stu, planBlocksTotal: { PHY121: 3 }, courseSyllabusBlocks: { PHY121: 40 } }, good.slice(0, 3)).eligible === false);

// 6. Typed-only courses, unverified grade
test('6 unverified grade or course: no portal source means no shield and no payout', () => {
  assert.equal(guaranteeState({ ...stu, gradeSourceVerified: false }, good, 's1', now).state, 'off');
  assert.equal(claim(stu, good, { ...fail, source: 'upload' }).eligible, false);
  assert.equal(claim(stu, good, { ...fail, source: 'typed' }).eligible, false);
  assert.equal(claim(stu, good, { ...fail, course: 'MADE-UP-101' }).eligible, false, 'a course with no plan blocks cannot be claimed');
  assert.equal(claim({ ...stu, planBlocksTotal: {} }, good, fail).eligible, false);
});
test('6b KNOWN GAP (boundary, pinned): claim fields are trusted as given', () => {
  // The engine cannot tell a real portal pull from a claim object a client built. passMark and source are just fields.
  // Pinned as current behavior so nobody assumes the engine defends this: the claim MUST be constructed server-side from the portal fetch.
  assert.equal(claim(stu, good, { ...fail, finalGrade: 80, passMark: 101 }).eligible, true, 'a passing grade counts as failing if passMark is forged');
});

// 7. Double claim per course
test('7 double claim: once the course is recorded in paidCourses it cannot pay again', () => {
  assert.equal(claim().eligible, true);
  assert.equal(claim({ ...stu, paidCourses: ['PHY121'] }).eligible, false);
});
test('7b KNOWN GAP (boundary, pinned): evaluateClaim is pure and does not record the payout', () => {
  // Two concurrent evaluations before the first one is written back both say eligible. The payout write must be atomic
  // (unique key on student+course) in the backend; the engine cannot enforce it.
  assert.equal(claim().eligible, true); assert.equal(claim().eligible, true);
});
gap('G6', 'policy', 'No cap across courses: one student can claim once per failed course', 'PRD says "one claim per course, capped at $2,000" and models $2,000 per claimant. A Pro student who fails four courses is owed four payouts ($8,000). Needs a per-term or per-student cap, or economics.mjs must model claims per claimant.', () =>
  claim({ ...stu, paidCourses: ['A', 'B', 'C'] }).eligible === false);

// 8. Failing on purpose after effort collapses late
test('8 fail on purpose: 80% of blocks done early then nothing, engine still pays', () => {
  const early = [0, 1].flatMap(i => weekly(plan, i)); // 12 blocks in weeks 0-1, nothing in week 2
  const s = { ...stu, planBlocksTotal: { PHY121: 12 } };
  assert.equal(strikes(plan, early, 's1', now).strikes, 1);
  assert.equal(claim(s, early).eligible, true, 'documents current behavior');
});
gap('G7', 'policy', 'Effort collapses in the last weeks, then the student fails the final on purpose', 'Strikes allow up to two missed weeks and the 80% test is cumulative, so someone can bank 80% early and coast. PRD ideas to test: pay as retake tuition or credit, require sitting the final, review claims where effort collapsed late. Engine returns form "retake-tuition-or-credit" but nothing reviews late collapse.', () => {
  const early = [0, 1].flatMap(i => weekly(plan, i));
  const r = claim({ ...stu, planBlocksTotal: { PHY121: 12 } }, early);
  return r.eligible === false || r.review === true;
});

// 9. Backdated timestamps
test('9 backdated: blocks stamped before the student joined do not count toward 80%', () => {
  const pre = Array.from({ length: 18 }, () => verify(blk({ ts: stu.joinedTs - 30 * DAY })));
  assert.equal(claim(stu, pre).eligible, false);
});
gap('G8', 'server', 'Backdated blocks that fill old weeks and erase strikes', 'The engine derives strikes from event timestamps, which the client sends. After coverage ended (3 empty weeks) a student can ingest blocks backdated into those weeks, strikes drop and coverage comes back. Needs a server receivedAt, a max back-fill window (a number for Sachcit), and a sticky "ended" state.', () => {
  const ended = guaranteeState(stu, [], 's1', now).state === 'ended';
  const back = [0, 1, 2].flatMap(i => weekly(plan, i)); // arrive late, but stamped inside the old weeks
  return ended && guaranteeState(stu, back, 's1', now).state === 'ended';
});

// 10. Future timestamps
test('10 future timestamps: rejected at ingest, ignored by climb and by the 80% count', () => {
  assert.equal(ingest([], blk({ ts: now + 10 * DAY }), RULES, now).event.verified, false);
  assert.equal(ingest([], blk({ ts: now + 60e3 }), RULES, now).event.verified, true, 'small clock skew is tolerated');
  const fut = Array.from({ length: 18 }, () => verify(blk({ ts: now + 2 * HOUR })));
  assert.equal(climbScore(fut, 's1', now), 0);
  assert.equal(claim(stu, fut).eligible, false, 'future-dated blocks cannot satisfy coverage even if they bypass ingest');
  assert.equal(ingest([], blk({ ts: undefined }), RULES, now).event.verified, false, 'missing timestamp');
});

// 11. Negative / NaN / Infinity fields
test('11 hostile numbers: NaN, Infinity, negatives and out-of-range scores never verify', () => {
  const bad = [
    blk({ activeMs: NaN, canvasActions: 9 }), blk({ activeMs: Infinity }), blk({ activeMs: -5, canvasActions: 9 }),
    blk({ minutes: -100, activeMs: 0, canvasActions: 9 }), blk({ minutes: NaN, activeMs: 0, canvasActions: 9 }),
    blk({ checkScore: NaN, canvasActions: 0 }), blk({ checkScore: Infinity, canvasActions: 0 }), blk({ checkScore: 7, canvasActions: 0 }),
    blk({ canvasActions: Infinity, checkScore: 0 }), blk({ canvasActions: -1, checkScore: 0 }),
    { type: 'keypoint', mastery: NaN }, { type: 'keypoint', mastery: Infinity }, { type: 'keypoint', mastery: 1.5 },
    { type: 'keypoint', mastery: 0.9, secondsPerCheck: -3 }, { type: 'keypoint', mastery: 0.9, secondsPerCheck: NaN },
  ];
  bad.forEach((e, i) => assert.equal(verify(e).verified, false, `case ${i} ${JSON.stringify(e)}`));
});
test('11b hostile claim and plan numbers do not pay or disable strikes', () => {
  for (const finalGrade of [NaN, undefined, null, '40']) assert.equal(claim(stu, good, { ...fail, finalGrade }).eligible, false, 'finalGrade ' + finalGrade);
  assert.equal(claim(stu, good, { ...fail, passMark: NaN }).eligible, false);
  assert.equal(strikes({ ...plan, hoursPerWeek: NaN }, [], 's1', now).strikes, 3, 'NaN hoursPerWeek must not make weeks unstrikeable');
  assert.notEqual(guaranteeState({ ...stu, joinedTs: NaN }, good, 's1', now).state, 'protected', 'no join date means no waiting period to enforce');
  assert.equal(guaranteeState({ ...stu, plan: undefined }, good, 's1', now).state, 'off');
  assert.equal(guaranteeState({ ...stu, plan: { ...plan, startTs: NaN } }, good, 's1', now).state, 'off');
});

// 12. Multiple students sharing events
test('12 sharing: events only ever score for the student id they carry', () => {
  const evs = [verify(blk({ studentId: 's1' }))];
  assert.equal(climbScore(evs, 's2', now), 0);
  assert.equal(claim(stu, [verify(blk({ studentId: 's2' }))].concat([]), fail).eligible, false, 'another student\'s blocks do not satisfy my coverage');
});
gap('G9', 'server', 'Two accounts credited for one real session (shared device or friend group)', 'Event content is not tied to a person. Same work submitted for s1 and s2 under different ids both verify. Needs a session id bound to one authenticated account (see G1) and an authenticated studentId, since studentId is just a field the client sends.', () => {
  const a = blk({ studentId: 's1', sessionId: 'dev1' }), b = blk({ studentId: 's2', sessionId: 'dev1' });
  const r = ingest(ingest([], a, RULES, now).stream, b, RULES, now);
  return r.event.verified === false || r.duplicate === true;
});

// 13. Gaming the 80% coverage with tiny blocks
test('13 tiny blocks: a declared 1-minute (or negative) block does not count as a 25-minute block', () => {
  assert.equal(verify(blk({ minutes: 1, activeMs: 36e3, canvasActions: 9 })).verified, false);
  assert.equal(verify(blk({ minutes: 0, activeMs: 0, canvasActions: 9 })).verified, false);
  const tiny = Array.from({ length: 18 }, () => verify(blk({ minutes: 1, activeMs: 40e3 })));
  assert.equal(claim(stu, tiny).eligible, false);
  assert.equal(verify(blk({ minutes: 50, activeMs: 25 * 60000 })).verified, false, 'a declared longer block needs proportionally more active time');
});
gap('G10', 'server', 'Back-to-back or overlapping blocks, and the same plan block repeated', 'Coverage counts verified blocks, not distinct plan items or non-overlapping time. 18 blocks each "25 active minutes" inside one wall-clock hour all verify, and repeating one topic 18 times fills 80%. PRD wants mastery, not completion. Needs planBlockId (distinct per plan item) and a no-overlap rule per student.', () => {
  const hour = Array.from({ length: 18 }, (_, i) => verify(blk({ ts: now - 5 * DAY + i * 60e3, planBlockId: 'same' })));
  return claim(stu, hour).eligible === false;
});
gap('G11', 'policy', 'No daily cap on the climb score', 'Same as G10 for ranking: no per-day ceiling on verified blocks, so grinding 40 blocks in a day tops the tower. Cap (or diminishing returns) is a climb-score design decision (PRD decision 3).', () => {
  const day = Array.from({ length: 40 }, (_, i) => verify(blk({ ts: now - 5 * HOUR + i * 60e3 })));
  return climbScore(day, 's1', now) < 100;
});

// 14. Strike reset by gaps / by replacing the plan
test('14 strikes accumulate per full week since the plan started and never reset on their own', () => {
  assert.equal(strikes(plan, [], 's1', now).strikes, 3);
  // 2 weeks off then a good week does NOT wipe the 2 strikes.
  const t = strikes(plan, weekly(plan, 2), 's1', now);
  assert.equal(t.strikes, 2);
  assert.equal(guaranteeState(stu, weekly(plan, 2), 's1', now).state, 'at-risk');
});
gap('G12', 'policy', 'Regenerating the plan resets strikes to zero', 'Strikes are derived from plan.startTs. Anything that issues a new plan with a new startTs (tutor re-plan, a course add, a reinstall) silently clears them, even at two strikes. Needs a strike ledger that outlives plans, and a decision on reset vs accumulate (see STRIKES.md).', () => {
  const replanned = { ...stu, plan: { ...plan, startTs: now - 2 * DAY } };
  return guaranteeState(replanned, [], 's1', now).strikes >= 3;
});
gap('G13', 'server', 'Plan start in the future turns strike enforcement off', 'A plan whose startTs is after now has zero complete weeks, so zero strikes, while the shield is already green once the waiting period passes. plan.startTs must be set server-side at plan creation and be >= joinedTs and <= now.', () =>
  guaranteeState({ ...stu, plan: { ...plan, startTs: now + 365 * DAY } }, [], 's1', now).state !== 'protected');

// 15. Forged grade events
test('15 grade events: only portal-sourced ones verify, and only improvements move the climb', () => {
  assert.equal(verify({ type: 'grade', source: 'upload' }).verified, false);
  assert.equal(verify({ type: 'grade', source: 'portal' }).verified, true);
  assert.equal(climbScore([verify({ type: 'grade', source: 'portal', studentId: 's1', ts: now - DAY })], 's1', now), 0, 'no improved flag, no climb credit');
});
test('15b KNOWN GAP (boundary, pinned): source:"portal" is a string the client can type', () => {
  // verify() cannot authenticate the source. Grade events must only be created by the server-side portal connector and the
  // public ingest endpoint must refuse type:"grade". Pinned so the assumption is explicit.
  assert.equal(verify({ type: 'grade', source: 'portal', improved: true, studentId: 's1', ts: now - DAY }).verified, true);
});

// ---- Register the gaps and print the status table -------------------------------------------------------------------------
for (const g of GAPS) {
  test(`KNOWN GAP ${g.id} [${g.kind}]: ${g.title}`, { todo: g.hole }, () => assert.ok(g.check(), 'safe behavior not implemented'));
}
after(() => {
  const rows = GAPS.map(g => `  ${g.id.padEnd(4)} ${(g.check() ? 'CLOSED' : 'OPEN').padEnd(7)} ${g.kind.padEnd(7)} ${g.title}`);
  console.log('\nKNOWN GAP summary (OPEN = engine lets it through; policy = Sachcit decides, server = needs backend/data source)\n' + rows.join('\n'));
});
