// "Break the guarantee" (PRD section 9 and the spike of the same name): every way someone could collect $2,000 unfairly, and the check that catches it.
// reviewClaim() runs after evaluateClaim() says the claim is eligible. It never auto-denies on a soft signal: soft flags HOLD the claim for a human,
// hard flags DENY. The payout form stays the PRD proposal: retake tuition or account credit.
const DAY = 864e5;

export const ATTACKS = [
  { id: 'fail-on-purpose',      how: 'Study to the 80% line, then stop trying and fail the final.',                    control: 'did-not-sit-final',  kind: 'hard', note: 'The student must sit the final; a withdrawal or no-show is not a failed course.' },
  { id: 'effort-collapse',      how: 'Coast through the term, then stop working in the last weeks.',                    control: 'effort-collapse',    kind: 'soft', note: 'Late-term blocks fall under 30% of the early-term rate.' },
  { id: 'late-burst',           how: 'Farm the 80% of blocks in the last days before the term ends.',                   control: 'late-burst',         kind: 'soft', note: 'More than half of the verified blocks sit in the final 10 days.' },
  { id: 'join-after-failing',   how: 'Sign up in week 10 when a failing midterm is already known.',                    control: 'known-failing-at-join', kind: 'soft', note: '14-day waiting period plus a check on grades known when coverage began.' },
  { id: 'fake-grade',           how: 'Type or upload a failing transcript.',                                             control: 'grade-not-portal',   kind: 'hard', note: 'Only a portal or partner grade can start or settle a claim.' },
  { id: 'grade-mismatch',       how: 'Claim a fail the portal does not show.',                                           control: 'grade-mismatch',     kind: 'hard', note: 'Claimed grade must match the portal within half a point.' },
  { id: 'wrong-course',         how: 'Claim a course that was never in the plan.',                                       control: 'course-not-in-plan', kind: 'hard', note: 'The course must be in the enrolled list and have plan blocks.' },
  { id: 'paste-ai-blocks',      how: 'Let an AI do the work so blocks verify without learning.',                         control: 'pasted-work',        kind: 'soft', note: 'Share of blocks rejected for pasted answers is above 30%.' },
  { id: 'duplicate-accounts',   how: 'One person, several accounts, claim on each.',                                     control: 'shared-device',      kind: 'soft', note: 'Another account on the same device fingerprint has a claim open.' },
  { id: 'collusion-farming',    how: 'Friends sign each other in so blocks look done.',                                  control: 'identical-timing',   kind: 'soft', note: 'Event timestamps match another account within a minute, repeatedly.' },
  { id: 'double-claim',         how: 'Claim the same course twice, or on a retake.',                                     control: 'already-paid',       kind: 'hard', note: 'One claim per course.' },
  { id: 'event-replay',         how: 'Resend the same event to farm the climb.',                                         control: 'duplicate-id',       kind: 'hard', note: 'engine.ingest() drops repeated ids.' },
];

const SOFT = { lateShare: 0.5, lateDays: 10, collapseRatio: 0.3, pastedShare: 0.3 };

// student: { courses[], paidCourses[], joinedTs }  events: the full stream  claim: { course, finalGrade, source }
// ctx: { sat: boolean (sat the final), portalGrade: percent, termEndTs, termStartTs, knownGradeAtJoin?: percent, passMark, deviceClaims?: number, sharedMinutes?: number, rejected?: events[] }
export function reviewClaim(student, events, studentId, claim, ctx) {
  const flags = [], add = (id, kind, detail) => flags.push({ id, kind, detail });
  const mine = events.filter(e => e.studentId === studentId && e.course === claim.course);
  const blocks = mine.filter(e => e.verified && e.type === 'block');

  if (ctx.sat === false) add('did-not-sit-final', 'hard', 'The final exam was not sat.');
  if (claim.source !== 'portal') add('grade-not-portal', 'hard', 'The grade did not come from a school portal.');
  if (ctx.portalGrade != null && Math.abs(ctx.portalGrade - claim.finalGrade) > 0.5) add('grade-mismatch', 'hard', `Portal says ${ctx.portalGrade}, claim says ${claim.finalGrade}.`);
  if (!(student.courses || []).includes(claim.course) || !blocks.length) add('course-not-in-plan', 'hard', 'No plan work exists for this course.');
  if ((student.paidCourses || []).includes(claim.course)) add('already-paid', 'hard', 'This course was already paid out.');

  if (ctx.termStartTs && ctx.termEndTs && blocks.length >= 6) {
    const span = ctx.termEndTs - ctx.termStartTs, third = ctx.termStartTs + span / 3, lastThird = ctx.termEndTs - span / 3;
    const early = blocks.filter(b => b.ts <= third).length, late = blocks.filter(b => b.ts >= lastThird).length;
    if (early >= 4 && late < early * SOFT.collapseRatio) add('effort-collapse', 'soft', `${late} blocks in the last third against ${early} in the first.`);
    const burst = blocks.filter(b => b.ts >= ctx.termEndTs - SOFT.lateDays * DAY).length;
    if (burst / blocks.length > SOFT.lateShare) add('late-burst', 'soft', `${burst} of ${blocks.length} blocks in the final ${SOFT.lateDays} days.`);
  }
  if (ctx.knownGradeAtJoin != null && ctx.knownGradeAtJoin < (ctx.passMark ?? 50)) add('known-failing-at-join', 'soft', `A grade of ${ctx.knownGradeAtJoin} was already known when coverage began.`);
  const rej = (ctx.rejected || []).filter(e => e.studentId === studentId), pasted = rej.filter(e => e.reason && /pasted/.test(e.reason)).length, total = mine.length + rej.length;
  if (total >= 6 && pasted / total > SOFT.pastedShare) add('pasted-work', 'soft', `${pasted} of ${total} submissions were pasted.`);
  if ((ctx.deviceClaims || 0) > 1) add('shared-device', 'soft', `${ctx.deviceClaims} accounts on this device have claims open.`);
  if ((ctx.sharedMinutes || 0) >= 5) add('identical-timing', 'soft', `${ctx.sharedMinutes} events landed in the same minute as another account.`);

  const hard = flags.filter(f => f.kind === 'hard'), soft = flags.filter(f => f.kind === 'soft');
  const decision = hard.length ? 'deny' : soft.length ? 'hold' : 'pay';
  return { decision, flags, form: 'retake-tuition-or-credit', reason: decision === 'pay' ? 'Plan followed, final sat, grade verified' : decision === 'hold' ? 'A person reviews this before it is paid' : hard[0].detail };
}

// Used by tests and the review screen: every documented attack must be backed by a control that exists.
export const CONTROLS = new Set(['did-not-sit-final', 'effort-collapse', 'late-burst', 'known-failing-at-join', 'grade-not-portal', 'grade-mismatch', 'course-not-in-plan', 'pasted-work', 'shared-device', 'identical-timing', 'already-paid', 'duplicate-id']);
