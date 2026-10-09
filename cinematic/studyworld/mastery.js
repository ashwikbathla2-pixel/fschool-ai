// What "mastered" means (PRD section 8, spike "Mastery measurement"). The guarantee is only as strong as this definition.
//
// Definition. A keypoint is MASTERED when the tutor is confident the student understands, not when they clicked through:
//   1. weighted evidence from four signals reaches 0.8 (engine RULES.masteredAt), AND
//   2. at least one signal is a *production* signal (explain-back or transfer problem), because scores and retries can be guessed, AND
//   3. at least two different signal kinds agree, AND
//   4. it is still true after a spaced re-check (retention): evidence older than `halfLifeDays` counts for half, so an old pass fades unless re-tested.
// The mix differs per subject (a physics keypoint leans on transfer problems, an essay course on explain-back); weights below are the
// starting values to be validated against real exams (decision 12), so they live in one table.
import { RULES } from './engine.js';
const DAY = 864e5;

export const SIGNALS = ['score', 'retry', 'explain', 'transfer'];
// score: the check question (0..1).  retry: fraction right across repeated attempts that are spaced out (0..1).
// explain: how well the student explained it back, graded by the tutor (0..1).  transfer: a new problem that needs the idea (0..1).
export const WEIGHTS = {
  quantitative: { score: 0.2, retry: 0.15, explain: 0.2, transfer: 0.45 },   // physics, maths, chemistry, engineering
  writing:      { score: 0.15, retry: 0.1, explain: 0.5, transfer: 0.25 },   // essays, law, history, literature
  memory:       { score: 0.3, retry: 0.35, explain: 0.2, transfer: 0.15 },   // anatomy, vocabulary, case names
  default:      { score: 0.25, retry: 0.2, explain: 0.3, transfer: 0.25 },
};
const PRODUCTION = new Set(['explain', 'transfer']);
export const CAPPED = 0.79;      // without a production signal and two kinds, mastery cannot reach the line, however many clicks

// attempts: [{ kind: 'score'|'retry'|'explain'|'transfer', value: 0..1, ts, secondsTaken? }]
export function masteryOf(attempts, subject = 'default', now = Date.now(), { halfLifeDays = 21, minSeconds = 5 } = {}) {
  const w = WEIGHTS[subject] || WEIGHTS.default;
  const latest = {};
  for (const a of attempts) {
    if (!SIGNALS.includes(a.kind) || !(a.value >= 0 && a.value <= 1)) continue;
    if (a.secondsTaken != null && a.secondsTaken < minSeconds) continue;          // speed-clicking is not evidence
    if (!latest[a.kind] || a.ts > latest[a.kind].ts) latest[a.kind] = a;
  }
  const kinds = Object.keys(latest);
  if (!kinds.length) return { mastery: 0, mastered: false, kinds: [], why: 'No evidence yet' };
  let sum = 0, wsum = 0;
  for (const k of kinds) {
    const age = Math.max(0, now - latest[k].ts) / DAY, fade = Math.pow(0.5, age / halfLifeDays);
    sum += w[k] * latest[k].value * fade; wsum += w[k];
  }
  // missing signals count as zero evidence against the full weight, so a student cannot pass on one lucky number
  let m = sum / 1;
  const production = kinds.some(k => PRODUCTION.has(k)), spread = kinds.length >= 2;
  if (!(production && spread)) m = Math.min(m, CAPPED);
  m = Math.round(Math.min(1, m) * 1000) / 1000;
  const mastered = m >= RULES.masteredAt;
  const why = mastered ? 'Strong evidence from several kinds of work, including something you produced yourself'
    : !production ? 'Needs an explain-back or a new problem, not only checks'
      : !spread ? 'Needs a second kind of evidence'
        : 'Evidence is not strong enough yet, or has faded: a quick spaced re-check will lift it';
  return { mastery: m, mastered, kinds, why };
}

// The progress bar is mastery-based, not completion-based: it fills by the average mastery of the course's keypoints.
export function courseProgress(keypointMastery) {
  const v = Object.values(keypointMastery); if (!v.length) return { progress: 0, mastered: 0, total: 0 };
  return { progress: Math.round(v.reduce((s, x) => s + Math.min(1, x), 0) / v.length * 1000) / 1000, mastered: v.filter(x => x >= RULES.masteredAt).length, total: v.length };
}
