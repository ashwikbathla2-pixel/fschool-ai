// Tutor differentiation (PRD spike "Tutor differentiation"): "personalized" has to mean something specific in the code, or this is a chat wrapper with a tower on top.
// A tutor is five numbers/choices derived from the interview profile and updated from the student's own results. Same student + same history = same tutor.
//   style      how it teaches first (from "how do you learn best")              seeing | doing | reading | talking
//   pace       blocks per week it plans and how much new material per block     from hours/week and the course's mastery velocity
//   difficulty the staircase that keeps the student at ~75% success             moves with results, never random
//   depth      explanation length and scaffolding: 3 full worked step-by-step -> 0 a one-line nudge   shrinks as mastery rises, grows on the worried course
//   hint       how many hint levels exist before the answer is shown            fewer for a high-confidence student, more for the worried course
// The prompt a language model gets is built from these fields (tutorBrief), so two students really do get different teaching, and tests can prove it.
import { guardFutureSelf } from './notices.js';

const STYLE = {
  seeing:  { lead: 'diagram', then: ['example', 'text'],     brief: 'Open with a diagram or picture of the idea, then one worked example, then the words.' },
  doing:   { lead: 'problem', then: ['example', 'text'],     brief: 'Open with a small problem to try, give help only after an attempt, then name the idea.' },
  reading: { lead: 'text',    then: ['example', 'diagram'],  brief: 'Open with a short clear explanation in writing, then an example, then a picture.' },
  talking: { lead: 'dialogue', then: ['example', 'text'],    brief: 'Open by asking the student to say what they already think, build the idea from their answer, then ask them to explain it back.' },
};
export const STYLES = Object.keys(STYLE);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const r1 = x => Math.round(x * 10) / 10;

// profile: { learning, hoursPerWeek, worriedCourse, dream, theme }   state: { course, mastery (0..1), recent: [true|false...], velocity (mastery gained per block, optional) }
export function tutorFor(profile, state = {}) {
  const style = STYLE[profile.learning] ? profile.learning : 'doing';
  const mastery = clamp(state.mastery ?? 0, 0, 1), worried = !!profile.worriedCourse && state.course === profile.worriedCourse;
  const hours = clamp(profile.hoursPerWeek || 5, 1, 40);
  const velocity = state.velocity ?? 0.04;
  const blocksPerWeek = Math.max(1, Math.round(hours * 60 / 25));
  const newItemsPerBlock = clamp(Math.round(2 + velocity * 40 - (worried ? 1 : 0)), 1, 5);            // a fast learner gets more new ideas per block; the worried course gets fewer
  const depth = clamp(Math.round(3 * (1 - mastery) + (worried ? 1 : 0)), 0, 3);                         // full worked solution at first, a nudge once it is known
  const hintLevels = clamp(2 + (worried ? 1 : 0) + (mastery < 0.3 ? 1 : 0) - (mastery > 0.7 ? 1 : 0), 1, 4);
  const recent = (state.recent || []).slice(-5);
  return { style, ...STYLE[style], pace: { blocksPerWeek, newItemsPerBlock }, depth, hintLevels, worried, mastery, difficulty: difficultyFrom(recent, state.difficulty ?? 0.5), recent };
}

// Difficulty staircase: 3 right in a row -> harder; 2 wrong in a row -> easier; otherwise hold. Bounded 0..1 in steps of 0.1.
export function difficultyFrom(recent, current = 0.5) {
  const last3 = recent.slice(-3), last2 = recent.slice(-2);
  if (last3.length === 3 && last3.every(Boolean)) return r1(clamp(current + 0.1, 0, 1));
  if (last2.length === 2 && last2.every(x => !x)) return r1(clamp(current - 0.1, 0, 1));
  return r1(current);
}

// Next thing to give the student. Pure, so it can be tested and replayed.
export function nextStep(tutor, { attempt = 0 } = {}) {
  const level = Math.min(attempt, tutor.hintLevels);
  return { modality: attempt === 0 ? tutor.lead : tutor.then[Math.min(attempt - 1, tutor.then.length - 1)], difficulty: tutor.difficulty, explanation: attempt >= tutor.hintLevels ? 'full' : ['none', 'nudge', 'hint', 'worked'][clamp(level, 0, 3)], depth: tutor.depth, newItems: tutor.pace.newItemsPerBlock };
}

// What the language model is told. Future-self rules from the PRD are part of the brief and are also checked on every reply with guardFutureSelf().
export function tutorBrief(tutor, profile) {
  const role = profile.role || 'future self';
  return [
    `You are the student's ${role}: the one tutor presence. Teach, do not lecture.`,
    tutor.brief,
    `Depth ${tutor.depth} of 3: ${['one-line nudge', 'short explanation', 'step-by-step with reasons', 'full worked example with every step explained'][tutor.depth]}.`,
    `Offer up to ${tutor.hintLevels} hint levels before showing the answer. Keep difficulty near ${Math.round(tutor.difficulty * 100)}% of the course's hardest material.`,
    tutor.worried ? 'This is the course the student is most worried about: be warm, go slower, celebrate small wins.' : '',
    'Never state a personal memory or a past you cannot have ("when I was in first year"). Never imitate or clone the student\'s voice. Speak about what the student can do next.',
  ].filter(Boolean).join('\n');
}

export const checkReply = guardFutureSelf;      // run on every generated line before it is shown
