// Tests for portal.js, notices.js, mastery.js, fraud.js, tutor.js and economics.mjs.   Run: node --test modules.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { toPercent, normalizeGrade, syncGrades, claimFrom, transcriptFallback, reconcile, createJsonPortalAdapter, createCsvAdapter, parseCsv } from './portal.js';
import { strikeReport, currentWeek, effectiveStrikes, guardFutureSelf, STRIKE_RULES } from './notices.js';
import { masteryOf, courseProgress, CAPPED } from './mastery.js';
import { reviewClaim, ATTACKS, CONTROLS } from './fraud.js';
import { tutorFor, nextStep, difficultyFrom, tutorBrief, STYLES } from './tutor.js';
import { model, breakEvenClaimRate, PRD } from './economics.mjs';
import { verify, RULES, evaluateClaim } from './engine.js';

const DAY = 864e5, now = Date.UTC(2026, 9, 8);

// ------------------------------------------------------------------------------------------------ portal
test('grades normalise from percent, letter and 4.0 scale', () => {
  assert.equal(toPercent('87.5'), 87.5); assert.equal(toPercent('B+'), 87); assert.equal(toPercent('3.0'), 75); assert.equal(toPercent(40), 40);
  assert.ok(Number.isNaN(toPercent('banana'))); assert.ok(Number.isNaN(toPercent(140)));
  assert.equal(normalizeGrade({ course: 'PHY121', grade: 'F' }, { kind: 'portal', id: 's' }).percent, 30);
  assert.equal(normalizeGrade({ grade: 50 }, { kind: 'portal', id: 's' }).ok, false);
});
test('a JSON portal adapter is verified; failures become readable reasons, never exceptions', async () => {
  const fetch = async () => ({ ok: true, json: async () => [{ course: 'PHY121', term: 'F26', grade: '41', final: true }] });
  const ad = createJsonPortalAdapter({ id: 'uni-a', baseUrl: 'https://x', fetch });
  const r = await syncGrades({ schoolId: 'uni-a' }, { 'uni-a': ad });
  assert.equal(r.status, 'verified'); assert.equal(claimFrom(r.grades[0]).source, 'portal'); assert.equal(claimFrom(r.grades[0]).finalGrade, 41);
  const down = createJsonPortalAdapter({ id: 'uni-b', baseUrl: 'https://x', fetch: async () => ({ ok: false, status: 503 }) });
  const d = await syncGrades({ schoolId: 'uni-b' }, { 'uni-b': down }); assert.equal(d.status, 'unavailable'); assert.match(d.reason, /503/);
  assert.equal((await syncGrades({ schoolId: 'nobody' }, {})).status, 'unavailable');
});
test('a CSV gradebook export works as the second school', async () => {
  const text = 'Course,Term,Final Grade,Status\nPHY121,F26,B-,Final\n"CHEM, 101",F26,72,Complete\nMATH200,F26,55,In progress\n';
  assert.deepEqual(parseCsv('a,"b,c"\n1,2').slice(0, 2), [['a', 'b,c'], ['1', '2']]);
  const r = await syncGrades({ schoolId: 'uni-c' }, { 'uni-c': createCsvAdapter({ id: 'uni-c', text }) });
  assert.equal(r.status, 'verified'); assert.equal(r.grades.length, 3); assert.equal(r.grades[1].course, 'CHEM, 101'); assert.equal(r.grades[2].final, false);
});
test('decision 2: a typed or uploaded transcript never starts the guarantee', () => {
  const t = transcriptFallback([{ course: 'PHY121', percent: 40 }]);
  assert.equal(t.verified, false); assert.equal(t.coverage, 'off');
  assert.equal(evaluateClaim({ tier: 'pro', gradeSourceVerified: false, joinedTs: now - 40 * DAY, plan: { startTs: now - 21 * DAY, hoursPerWeek: 5 } }, [], 's', { course: 'PHY121', finalGrade: 40, passMark: 50, source: 'transcript' }, now).eligible, false);
  assert.equal(reconcile({ percent: 40 }, { percent: 40.4 }), true); assert.equal(reconcile({ percent: 40 }, { percent: 55 }), false);
});

// ------------------------------------------------------------------------------------------------ strike notices
const blk = (o = {}) => ({ id: Math.random() + '', studentId: 's1', type: 'block', course: 'PHY121', ts: now - DAY, minutes: 25, activeMs: 25 * 60000, checkScore: 0.9, ...o });
const plan = { startTs: now - 21 * DAY - 4 * DAY, hoursPerWeek: 5, course: 'PHY121' };       // three full weeks and 4 days into the fourth
const week = (i, k) => Array.from({ length: k }, (_, j) => verify(blk({ ts: plan.startTs + i * 7 * DAY + (j + 1) * 3600e3 })));
const stu = { tier: 'pro', gradeSourceVerified: true, joinedTs: plan.startTs, plan };

test('every strike is explained, in plain numbers', () => {
  const r = strikeReport(stu, [...week(0, 6), ...week(1, 1), ...week(2, 6)], 's1', now);
  assert.equal(r.strikes, 1); assert.equal(r.weeks[1].struck, true);
  assert.match(r.weeks[1].why, /1 of 12 planned blocks; 6 are needed/); assert.equal(r.weeks[0].why, 'On plan');
});
test('a warning arrives mid-week while there is still time; it is gentle and counts what is left', () => {
  const r = strikeReport(stu, [...week(0, 6), ...week(1, 6), ...week(2, 6), ...week(3, 2).map(e => ({ ...e }))], 's1', now);
  assert.equal(r.currentWeek.status, 'behind'); assert.equal(r.currentWeek.left, 4);
  const w = r.notices.find(n => n.kind === 'warning'); assert.match(w.body, /4 more blocks/); assert.equal(w.from, 'future-self');
});
test('three struck weeks end coverage with a gentle note; one before gives a final warning', () => {
  const ended = strikeReport(stu, [], 's1', now); assert.equal(ended.strikes, 3); assert.equal(ended.notices[0].kind, 'ended'); assert.equal(ended.notices[0].tone, 'gentle');
  const two = strikeReport(stu, [...week(0, 6)], 's1', now); assert.equal(two.strikes, 2);
  assert.ok(two.notices.some(n => n.kind === 'final-warning'));
});
test('the open rules are switches: work-off and reset are off by default and change the answer when on', () => {
  const ev = [...week(1, 1), ...week(2, 1), ...week(3, 14).map(e => ({ ...e, ts: e.ts - 3 * DAY }))];
  const p = { ...plan, startTs: now - 21 * DAY };                                  // exactly three full weeks
  const evs = [...Array.from({ length: 1 }, (_, j) => verify(blk({ ts: p.startTs + 3600e3 * (j + 1) }))), ...Array.from({ length: 1 }, (_, j) => verify(blk({ ts: p.startTs + 7 * DAY + 3600e3 * (j + 1) }))), ...Array.from({ length: 9 }, (_, j) => verify(blk({ ts: p.startTs + 14 * DAY + 3600e3 * (j + 1) })))];
  assert.equal(effectiveStrikes(p, evs, 's1', now).strikes, 2);
  assert.equal(effectiveStrikes(p, evs, 's1', now, RULES, { ...STRIKE_RULES, workOff: true }).strikes, 1, 'worked off one strike');
  assert.equal(effectiveStrikes(p, evs, 's1', now, RULES, { ...STRIKE_RULES, resetAfterCleanWeeks: 1 }).strikes, 0, 'a clean week resets');
  assert.ok(ev.length > 0);
});
test('future-self guardrail rejects invented memories and voice cloning, allows next steps', () => {
  for (const bad of ['When I was in first year I froze on this too.', 'I remember failing physics.', 'I used to struggle with this', 'In my first year I cried']) assert.equal(guardFutureSelf(bad).ok, false, bad);
  assert.equal(guardFutureSelf('You have three blocks left this week. You can do this one in 25 minutes.').ok, true);
});

// ------------------------------------------------------------------------------------------------ mastery
test('mastered needs a production signal and two kinds of evidence; clicks alone cap below the line', () => {
  const t = now;
  const clicks = masteryOf([{ kind: 'score', value: 1, ts: t }, { kind: 'retry', value: 1, ts: t }], 'quantitative', t);
  assert.equal(clicks.mastered, false); assert.ok(clicks.mastery <= CAPPED); assert.match(clicks.why, /explain-back|new problem/);
  const real = masteryOf([{ kind: 'score', value: 0.95, ts: t }, { kind: 'retry', value: 0.9, ts: t }, { kind: 'explain', value: 0.9, ts: t }, { kind: 'transfer', value: 0.9, ts: t }], 'quantitative', t);
  assert.equal(real.mastered, true);
  assert.equal(masteryOf([{ kind: 'transfer', value: 1, ts: t }], 'quantitative', t).mastered, false, 'one kind is not enough');
});
test('evidence fades without a spaced re-check, speed-clicks are ignored, and the subject changes the mix', () => {
  const evs = ts => [{ kind: 'score', value: 0.95, ts }, { kind: 'retry', value: 0.9, ts }, { kind: 'explain', value: 0.9, ts }, { kind: 'transfer', value: 0.9, ts }];
  assert.equal(masteryOf(evs(now), 'default', now).mastered, true);
  assert.equal(masteryOf(evs(now - 60 * DAY), 'default', now).mastered, false, 'two months old: needs a re-check');
  assert.equal(masteryOf([{ kind: 'explain', value: 1, ts: now, secondsTaken: 1 }], 'writing', now).mastery, 0);
  const sameEv = [{ kind: 'explain', value: 1, ts: now }, { kind: 'score', value: 0.4, ts: now }];
  assert.ok(masteryOf(sameEv, 'writing', now).mastery > masteryOf(sameEv, 'quantitative', now).mastery, 'writing leans on explain-back');
});
test('progress is the average mastery, not the number of things clicked', () => {
  assert.deepEqual(courseProgress({ a: 1, b: 0.5, c: 0 }), { progress: 0.5, mastered: 1, total: 3 });
  assert.equal(courseProgress({}).progress, 0);
});

// ------------------------------------------------------------------------------------------------ fraud
const stu2 = { courses: ['PHY121'], paidCourses: [], joinedTs: now - 90 * DAY };
const termStart = now - 84 * DAY, termEnd = now;
const spread = n => Array.from({ length: n }, (_, i) => verify(blk({ course: 'PHY121', ts: termStart + (i + 0.5) * (84 * DAY / n) })));
const claim = { course: 'PHY121', finalGrade: 40, source: 'portal' };
const ctx = { sat: true, portalGrade: 40, passMark: 50, termStartTs: termStart, termEndTs: termEnd };
test('a clean claim is paid as retake tuition or credit', () => {
  const r = reviewClaim(stu2, spread(18), 's1', claim, ctx); assert.equal(r.decision, 'pay'); assert.equal(r.form, 'retake-tuition-or-credit');
});
test('hard flags deny: did not sit the final, typed grade, mismatch, wrong course, already paid', () => {
  assert.equal(reviewClaim(stu2, spread(18), 's1', claim, { ...ctx, sat: false }).decision, 'deny');
  assert.equal(reviewClaim(stu2, spread(18), 's1', { ...claim, source: 'transcript' }, ctx).decision, 'deny');
  assert.equal(reviewClaim(stu2, spread(18), 's1', claim, { ...ctx, portalGrade: 62 }).flags[0].id, 'grade-mismatch');
  assert.equal(reviewClaim({ ...stu2, courses: ['CHEM'] }, spread(18), 's1', claim, ctx).decision, 'deny');
  assert.equal(reviewClaim({ ...stu2, paidCourses: ['PHY121'] }, spread(18), 's1', claim, ctx).decision, 'deny');
});
test('soft flags hold for a person: effort collapse, last-minute burst, known failing at join, shared device', () => {
  const early = Array.from({ length: 14 }, (_, i) => verify(blk({ ts: termStart + (i + 1) * 2 * DAY })));        // all in the first third
  const r = reviewClaim(stu2, [...early, ...Array.from({ length: 2 }, (_, i) => verify(blk({ ts: termEnd - (i + 1) * DAY })))], 's1', claim, ctx);
  assert.equal(r.decision, 'hold'); assert.ok(r.flags.some(f => f.id === 'effort-collapse'));
  const burst = Array.from({ length: 18 }, (_, i) => verify(blk({ ts: termEnd - (i % 9 + 1) * DAY })));
  assert.ok(reviewClaim(stu2, burst, 's1', claim, ctx).flags.some(f => f.id === 'late-burst'));
  assert.ok(reviewClaim(stu2, spread(18), 's1', claim, { ...ctx, knownGradeAtJoin: 30 }).flags.some(f => f.id === 'known-failing-at-join'));
  assert.equal(reviewClaim(stu2, spread(18), 's1', claim, { ...ctx, deviceClaims: 2 }).decision, 'hold');
});
test('every documented attack is backed by a control that exists', () => {
  assert.ok(ATTACKS.length >= 12);
  for (const a of ATTACKS) assert.ok(CONTROLS.has(a.control), `${a.id} -> ${a.control}`);
});

// ------------------------------------------------------------------------------------------------ tutor
const base = { learning: 'doing', hoursPerWeek: 5, worriedCourse: 'PHY121' };
test('two different students get different tutors; the same student gets the same one', () => {
  const a = tutorFor(base, { course: 'PHY121', mastery: 0.1 }), b = tutorFor({ learning: 'seeing', hoursPerWeek: 15 }, { course: 'ENG101', mastery: 0.8, velocity: 0.08 });
  assert.notEqual(a.style, b.style); assert.notEqual(a.lead, b.lead); assert.ok(b.pace.blocksPerWeek > a.pace.blocksPerWeek);
  assert.ok(a.depth > b.depth, 'a new, worried course gets the fuller explanation'); assert.ok(a.hintLevels > b.hintLevels);
  assert.deepEqual(tutorFor(base, { course: 'PHY121', mastery: 0.1 }), a);
  for (const s of STYLES) assert.ok(tutorFor({ learning: s }, {}).brief.length > 20);
});
test('difficulty is a staircase: three right goes up, two wrong goes down, bounded', () => {
  assert.equal(difficultyFrom([true, true, true], 0.5), 0.6); assert.equal(difficultyFrom([false, false], 0.5), 0.4); assert.equal(difficultyFrom([true, false, true], 0.5), 0.5);
  assert.equal(difficultyFrom([true, true, true], 1), 1); assert.equal(difficultyFrom([false, false], 0), 0);
});
test('hints escalate and the brief carries the student-specific rules and the future-self guardrails', () => {
  const t = tutorFor(base, { course: 'PHY121', mastery: 0.1 });
  assert.equal(nextStep(t, { attempt: 0 }).modality, 'problem'); assert.equal(nextStep(t, { attempt: 0 }).explanation, 'none');
  assert.equal(nextStep(t, { attempt: t.hintLevels }).explanation, 'full');
  const brief = tutorBrief(t, { role: 'pilot' });
  assert.match(brief, /most worried/); assert.match(brief, /Never state a personal memory/); assert.match(brief, /pilot/);
});

// ------------------------------------------------------------------------------------------------ economics
test('economics reproduces the PRD table exactly before costs', () => {
  const rows = [[0.05, 33.4], [0.1, 28.4], [0.2, 18.4]];
  for (const [rate, net] of rows) { const m = model({ claimRate: rate, withCosts: false }); assert.equal(Math.round(m.revenue / 1e5) / 10, 38.4); assert.equal(Math.round(m.netBeforeOpex / 1e5) / 10, net); }
  assert.equal(model({ claimRate: 0.05, withCosts: false }).payoutsFace, 5e6);
});
test('with costs the same cases are worse, and the break-even claim rate is below the PRD bad case at 10,000 students', () => {
  const m = model({ claimRate: 0.1 }); assert.ok(m.net < m.netBeforeOpex); assert.ok(m.opex > 0);
  const be100 = breakEvenClaimRate({ students: 100000 }), be10 = breakEvenClaimRate({ students: 10000 });
  assert.ok(be100 > 0.2, 'at 100k the model survives the PRD bad case: ' + be100);
  assert.ok(be10 > 0 && be10 < be100, 'small scale is tighter because staff cost is spread over fewer students: ' + be10);
  assert.equal(PRD.students, 100000);
});
