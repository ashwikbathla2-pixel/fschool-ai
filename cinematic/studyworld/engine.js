// Verified-study engine. PRD sections 6, 8, 9, 10: one event stream feeds the climb score, the tower floor and the Pass Guarantee.
// Pure functions, no DOM, no storage: the backend and the client can both import this and get the same answers.

export const RULES = Object.freeze({
  blockMinutes: 25,
  minActiveShare: 0.6,       // time on board must be >= 60% of the block, or it is "left open and walked away"
  minCheckScore: 0.6,        // the quick check question
  minCanvasActions: 5,       // real writing on the canvas
  masteredAt: 0.8,           // tutor confidence that the student understands, not clicks
  minSecondsPerCheck: 8,     // faster than this is speed-clicking
  windowDays: 14,            // climb looks at the last N days
  weights: { block: 10, keypoint: 6, gradeUp: 15 },
  waitingDays: 14,
  coverageAt: 0.8,           // 80% of plan blocks done, measured by mastery
  maxPayout: 2000,
  strikeLimit: 3,
  weeklyShare: 0.5,          // under 50% of planned weekly blocks = a strike
});

const DAY = 864e5;

// ---- Verification: PRD "what counts as verified study" = a mix, tested against cheating -------------------------------
// ev: { id, studentId, type: 'block'|'keypoint'|'grade', course, ts, minutes, activeMs, checkScore, canvasActions, mastery, secondsPerCheck, pastedAi }
// Verified when it passes the presence test AND one proof-of-understanding test. Returns the event with { verified, reason }.
const num = v => typeof v === 'number' && Number.isFinite(v);
const unit = v => num(v) && v >= 0 && v <= 1;
const MAX_BLOCK_MINUTES = 120;

export function verify(ev, rules = RULES) {
  const fail = reason => ({ ...ev, verified: false, reason });
  if (ev.type === 'grade') return ev.source === 'portal' ? { ...ev, verified: true, reason: '' } : fail('grade not from a school portal');
  if (ev.pastedAi) return fail('answer was pasted in, not written');
  // Hostile or broken numbers never verify: NaN, Infinity, negatives, scores outside 0..1. Absent optional fields are fine.
  if (ev.secondsPerCheck != null && !(num(ev.secondsPerCheck) && ev.secondsPerCheck >= 0)) return fail('timing is not a valid number');
  if (ev.type === 'keypoint') {
    if (!unit(ev.mastery)) return fail('mastery is not a number between 0 and 1');
    if (ev.mastery < rules.masteredAt) return fail('not mastered yet');
    if (ev.secondsPerCheck != null && ev.secondsPerCheck < rules.minSecondsPerCheck) return fail('clicked through too fast');
    return { ...ev, verified: true, reason: '' };
  }
  if (ev.type === 'block') {
    const minutes = ev.minutes === undefined ? rules.blockMinutes : ev.minutes;
    if (!num(minutes) || minutes < rules.blockMinutes || minutes > MAX_BLOCK_MINUTES) return fail(`a block is ${rules.blockMinutes} to ${MAX_BLOCK_MINUTES} minutes`);
    if (!(num(ev.activeMs) && ev.activeMs >= 0)) return fail('active time is not a valid number');
    if (ev.checkScore != null && !unit(ev.checkScore)) return fail('check score is not a number between 0 and 1');
    if (ev.canvasActions != null && !(num(ev.canvasActions) && ev.canvasActions >= 0)) return fail('canvas actions is not a valid number');
    if (ev.activeMs < minutes * 60000 * rules.minActiveShare) return fail('not enough active time on the board');
    const quick = ev.secondsPerCheck != null && ev.secondsPerCheck < rules.minSecondsPerCheck;      // an instant answer is a guess, not proof
    const proof = ((ev.checkScore ?? 0) >= rules.minCheckScore && !quick) || (ev.canvasActions ?? 0) >= rules.minCanvasActions;
    return proof ? { ...ev, verified: true, reason: '' } : fail(quick ? 'checks were answered too fast to count' : 'no check passed and no real writing on the canvas');
  }
  return fail('unknown event type');
}

// The stream rejects duplicates (same id) so replays and double-sends cannot farm the climb.
export const CLOCK_SKEW_MS = 5 * 60000;
export function ingest(stream, raw, rules = RULES, now = Date.now()) {
  if (stream.some(e => e.id === raw.id)) return { stream, event: stream.find(e => e.id === raw.id), duplicate: true };
  let event = verify(raw, rules);
  if (event.verified && raw.type !== 'grade' && !(num(raw.ts) && raw.ts <= now + CLOCK_SKEW_MS)) event = { ...raw, verified: false, reason: raw.ts === undefined ? 'event has no timestamp' : 'event is dated in the future' };
  return { stream: [...stream, event], event, duplicate: false };
}

// ---- Climb score: verified study only, last N days, linear fade so inactive students drift down ----------------------
export function climbScore(events, studentId, now = Date.now(), rules = RULES) {
  const span = rules.windowDays * DAY;
  let score = 0;
  for (const e of events) {
    if (!e.verified || e.studentId !== studentId) continue;
    const age = now - e.ts;
    if (age < 0 || age > span) continue;
    const w = e.type === 'block' ? rules.weights.block : e.type === 'keypoint' ? rules.weights.keypoint : e.improved ? rules.weights.gradeUp : 0;
    score += w * (1 - age / span * 0.5);   // oldest work in the window still counts half
  }
  return Math.round(score * 10) / 10;
}

// ---- Tower: your floor is your rank. Ties share a floor so nobody is shuffled arbitrarily ------------------------------
// scores: { studentId: number }  ->  { studentId: floor } where floor 1 is the ground and the top scorer gets the highest floor.
export function assignFloors(scores) {
  const ids = Object.keys(scores);
  const distinct = [...new Set(ids.map(i => scores[i]))].sort((a, b) => a - b);
  const floorOf = new Map(distinct.map((s, i) => [s, i + 1]));
  return Object.fromEntries(ids.map(i => [i, floorOf.get(scores[i])]));
}

// Moving up plays an elevator moment; moving down is a gentle note from the future self, never a red alert.
export function floorMove(prev, next) {
  if (next > prev) return { kind: 'up', by: next - prev };
  if (next < prev) return { kind: 'down', by: prev - next, tone: 'gentle' };
  return { kind: 'same', by: 0 };
}

// Window states from the tower table.
export function windowState({ studyingNow, streakDays, lastActiveTs, guaranteeActive }, now = Date.now()) {
  const state = studyingNow ? 'light' : streakDays >= 3 ? 'warm' : now - (lastActiveTs || 0) > 5 * DAY ? 'dim' : 'idle';
  return { state, shield: !!guaranteeActive };
}

// ---- Strikes: plan adherence per full week since the plan started; one strike per missed week -----------------------
// plan: { startTs, hoursPerWeek, course }.  Returns { strikes, weeks: [{ start, done, planned, struck }] }.
export function strikes(plan, events, studentId, now = Date.now(), rules = RULES) {
  const hours = num(plan.hoursPerWeek) && plan.hoursPerWeek > 0 ? plan.hoursPerWeek : 0;
  const planned = Math.max(1, Math.round(hours * 60 / rules.blockMinutes));
  const weeks = [];
  for (let start = plan.startTs; start + 7 * DAY <= now; start += 7 * DAY) {
    const done = events.filter(e => e.verified && e.type === 'block' && e.studentId === studentId && e.ts >= start && e.ts < start + 7 * DAY).length;
    weeks.push({ start, done, planned, struck: done < planned * rules.weeklyShare });
  }
  return { strikes: weeks.filter(w => w.struck).length, weeks };
}

// ---- Pass Guarantee state: what the shield on the door shows ---------------------------------------------------------
// student: { joinedTs, tier:'basic'|'pro', gradeSourceVerified, plan, planBlocksTotal }
export function guaranteeState(student, events, studentId, now = Date.now(), rules = RULES) {
  if (student.tier !== 'pro') return { state: 'off', shield: null, reason: 'Basic plan has no guarantee' };
  if (!student.gradeSourceVerified) return { state: 'off', shield: null, reason: 'No grade source verified yet' };
  if (!student.plan || !num(student.plan.startTs)) return { state: 'off', shield: null, reason: 'No valid plan yet' };
  if (!num(student.joinedTs)) return { state: 'off', shield: null, reason: 'No join date, so no waiting period can be enforced' };
  const s = strikes(student.plan, events, studentId, now, rules);
  if (s.strikes >= rules.strikeLimit) return { state: 'ended', shield: null, strikes: s.strikes, reason: 'Three strikes: coverage has ended' };
  const beginsTs = student.joinedTs + rules.waitingDays * DAY;
  if (now < beginsTs) return { state: 'waiting', shield: 'indigo', strikes: s.strikes, beginsTs, reason: 'Coverage begins on the date shown' };
  const lastWeek = s.weeks[s.weeks.length - 1];
  const slipping = s.strikes === rules.strikeLimit - 1 || (lastWeek && lastWeek.struck);
  return slipping
    ? { state: 'at-risk', shield: 'orange', strikes: s.strikes, reason: 'Plan slipping: do this week\'s blocks to stay covered' }
    : { state: 'protected', shield: 'green', strikes: s.strikes, reason: 'Plan on track' };
}

// ---- Claim: auto-detected from the verified grade; no uploads --------------------------------------------------------
// claim: { course, finalGrade, passMark, source }  student.paidCourses: courses already claimed.
export function evaluateClaim(student, events, studentId, claim, now = Date.now(), rules = RULES) {
  const g = guaranteeState(student, events, studentId, now, rules);
  const no = reason => ({ eligible: false, payout: 0, reason });
  if (g.state === 'off' || g.state === 'ended' || g.state === 'waiting') return no(g.reason);
  if (claim.source !== 'portal') return no('Final grade must come from the school portal');
  if (!num(claim.finalGrade) || !num(claim.passMark)) return no('Grade and pass mark must be numbers');
  if (claim.finalGrade >= claim.passMark) return no('Course passed: no claim');
  if ((student.paidCourses || []).includes(claim.course)) return no('One claim per course');
  const done = events.filter(e => e.verified && e.type === 'block' && e.studentId === studentId && e.course === claim.course && num(e.ts) && e.ts <= now).length;
  const total = student.planBlocksTotal?.[claim.course] || 0;
  if (!total || done / total < rules.coverageAt) return no(`Plan not followed: ${done}/${total} blocks, ${Math.round(rules.coverageAt * 100)}% needed`);
  return { eligible: true, payout: rules.maxPayout, form: 'retake-tuition-or-credit', reason: 'Plan followed and course failed' };
}
