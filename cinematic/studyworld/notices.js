// Strike detection as a pipeline that explains itself at every step (PRD section 9, spike "Strike detection").
// engine.js decides *that* a week was struck; this module says *why*, warns before it happens, and writes the note the student sees.
// Voice rules from the PRD: it is the student's future self, so it never invents a biographical memory ("I froze on this in first year"),
// never blames, and moving down is a gentle note, not a red alert.
import { RULES, strikes } from './engine.js';
const DAY = 864e5;

export const STRIKE_RULES = Object.freeze({
  // Open PRD question: can a strike be worked off? Off until the decision is made; the code path exists so the answer is a switch, not a rewrite.
  workOff: false, workOffBlocks: 2,        // with workOff on: this many extra blocks above the weekly need, in a later week, clears the oldest strike
  resetAfterCleanWeeks: 0,                 // 0 = strikes accumulate; N = N clean weeks in a row clears all strikes
  warnFromDay: 3.5,                        // warn once half the week has gone and the student is behind
});

const needed = (planned, rules) => Math.max(1, Math.ceil(planned * rules.weeklyShare));

// What the student sees about the week in progress: a projection, so a warning arrives while there is still time to fix it.
export function currentWeek(plan, events, studentId, now = Date.now(), rules = RULES, opts = STRIKE_RULES) {
  const planned = Math.max(1, Math.round(plan.hoursPerWeek * 60 / rules.blockMinutes));
  const weeks = Math.floor((now - plan.startTs) / (7 * DAY));
  const start = plan.startTs + weeks * 7 * DAY, end = start + 7 * DAY;
  const done = events.filter(e => e.verified && e.type === 'block' && e.studentId === studentId && e.ts >= start && e.ts < end).length;
  const need = needed(planned, rules), left = Math.max(0, need - done), daysLeft = Math.max(0, (end - now) / DAY), elapsed = (now - start) / DAY;
  const status = left === 0 ? 'safe' : daysLeft <= 1 ? 'critical' : elapsed >= opts.warnFromDay ? 'behind' : 'on-track';
  return { start, end, planned, need, done, left, daysLeft: Math.round(daysLeft * 10) / 10, status };
}

// Apply the reset and work-off rules (both off by default) to the plain weekly strikes from the engine.
export function effectiveStrikes(plan, events, studentId, now = Date.now(), rules = RULES, opts = STRIKE_RULES) {
  const base = strikes(plan, events, studentId, now, rules), log = [];
  let active = 0, clean = 0;
  base.weeks.forEach((w, i) => {
    if (w.struck) { active++; clean = 0; log.push({ week: i + 1, event: 'strike', why: weekWhy(w, rules) }); }
    else {
      clean++;
      if (opts.workOff && active > 0 && w.done >= needed(w.planned, rules) + opts.workOffBlocks) { active--; log.push({ week: i + 1, event: 'worked-off', why: `${w.done} blocks, ${opts.workOffBlocks} above the weekly need` }); }
      if (opts.resetAfterCleanWeeks && clean >= opts.resetAfterCleanWeeks && active > 0) { log.push({ week: i + 1, event: 'reset', why: `${clean} clean weeks in a row` }); active = 0; }
    }
  });
  return { strikes: active, weeks: base.weeks, log };
}

const weekWhy = (w, rules) => `${w.done} of ${w.planned} planned blocks; ${needed(w.planned, rules)} are needed to stay in the plan`;

// The full explanation: per-week reasons, what is happening now, and the notices to show. Pure: same inputs, same output.
export function strikeReport(student, events, studentId, now = Date.now(), rules = RULES, opts = STRIKE_RULES) {
  const eff = effectiveStrikes(student.plan, events, studentId, now, rules, opts), cw = currentWeek(student.plan, events, studentId, now, rules, opts), notices = [];
  const left = rules.strikeLimit - eff.strikes;
  if (eff.strikes >= rules.strikeLimit) notices.push(note('ended', 'Your coverage has ended', 'Three weeks fell short of the plan, so the Pass Guarantee has ended for this term. Your tutor and your room stay with you, and you can keep climbing.', eff));
  else {
    const last = eff.log.filter(l => l.event === 'strike').pop();
    if (last && last.week === eff.weeks.length) notices.push(note('strike', `Strike ${eff.strikes} of ${rules.strikeLimit}`, `Last week: ${last.why}. ${left === 1 ? 'One more short week would end your coverage.' : `You have ${left} left before coverage ends.`} Let us make this week a good one.`, eff));
    if (cw.status === 'behind' || cw.status === 'critical') notices.push(note('warning', cw.status === 'critical' ? 'Today is the day to catch up' : 'This week is slipping', `${cw.done} of the ${cw.need} blocks you need this week are done, with ${cw.daysLeft} day${cw.daysLeft === 1 ? '' : 's'} left. ${cw.left} more block${cw.left === 1 ? '' : 's'} keeps you covered.`, eff));
    if (eff.strikes === rules.strikeLimit - 1 && cw.status !== 'safe') notices.push(note('final-warning', 'You are one week away from losing coverage', `Finish ${cw.left} more block${cw.left === 1 ? '' : 's'} this week to stay covered.`, eff));
  }
  return { strikes: eff.strikes, limit: rules.strikeLimit, weeks: eff.weeks.map((w, i) => ({ week: i + 1, done: w.done, planned: w.planned, struck: w.struck, why: w.struck ? weekWhy(w, rules) : 'On plan' })), log: eff.log, currentWeek: cw, notices, rules: { weeklyShare: rules.weeklyShare, blockMinutes: rules.blockMinutes, workOff: opts.workOff } };
}
const note = (kind, title, body, eff) => ({ kind, tone: kind === 'ended' || kind === 'strike' ? 'gentle' : 'calm', title, body, from: 'future-self', strikes: eff.strikes });

// Guardrail from PRD section 5: the future self never states a memory it cannot have. Used on every generated line before it is shown.
const MEMORY = [/\bwhen i was (a |in |at )/i, /\bi remember\b/i, /\bback (when|in) (my|first|second|college|school)/i, /\bi (once )?(froze|failed|struggled|cried|panicked)\b/i, /\bmy (first|second|third) year\b/i, /\bin my (day|time)\b/i, /\bi used to (be|struggle|fail)/i];
export function guardFutureSelf(text) {
  const t = String(text || '');
  for (const re of MEMORY) if (re.test(t)) return { ok: false, reason: 'It states a personal memory. Future self speaks about what the student can do next, not a past it never had.' };
  if (/\b(your|the) (real )?voice (clone|cloned)\b/i.test(t)) return { ok: false, reason: 'Never clone the student\'s voice.' };
  return { ok: true, reason: '' };
}
