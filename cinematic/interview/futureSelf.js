// Future-self lines for the Lobby Interview (PRD section 5, step 4 + 7). Pure functions: profile/answers in, string out. No DOM.
// Guardrails (PRD, "Sachcit decides" on the future self): the future self never invents biographical memories, is never built
// from a real photo, and never clones the student's voice. So every line speaks in the present or future, about what the student
// told us, and never in first-person past ("I froze on this in first year" is a story, not a memory).
import { THEMES } from '../studyworld/profile.js';

const clip = (s, n = 80) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t; };
const quote = s => `“${clip(s)}”`;   // student's own words are always shown inside quotes

// What the student called the dream, lower-cased only when it is a plain phrase. Studio dreams keep their own words.
export const dreamPhrase = p => clip(p?.dream?.text || '', 60) || 'the person you want to be';

export const greet = p =>
  `Hi. Think of me as you, a few years on, working as ${article(dreamPhrase(p))}. I only know what you have told me, and I'm here to study with you.`;

export const reflectWhy = p => p?.dream?.why
  ? `You said ${quote(p.dream.why)}. I'll keep that in sight when it gets hard.`
  : `I'll keep your reason in sight when it gets hard.`;

const LEARN = {
  seeing:  'You learn best by seeing it, so I will draw things out on the whiteboard first.',
  doing:   'You learn best by doing it, so we will try problems early and explain after.',
  reading: 'You learn best by reading it, so I will give you clear written steps to follow.',
  talking: 'You learn best by talking it through, so I will ask you to explain things back to me.',
};
export const learningLine = p => LEARN[p?.learning] || LEARN.doing;

export const hoursLine = p => {
  const h = Number(p?.hoursPerWeek) || 5;
  return `${h} hours a week is a plan we can keep. We will split it into 25-minute blocks.`;
};

export const worriedLine = p => p?.worriedCourse
  ? `${clip(p.worriedCourse, 60)} worries you most, so that is where we start.`
  : `Tell me which course worries you most and that is where we start.`;

// Honest, boring guarantee note: typed courses never turn the guarantee on.
export const guaranteeLine = p => p?.guarantee?.state === 'off'
  ? `Pass Guarantee is off for now. ${p.guarantee.reason || 'No grade source verified yet'}.`
  : '';

// PRD step 7: "Their future self offers a 25-minute block right away."
export const offerBlock = p => {
  const m = p?.firstBlock?.minutes || 25, c = p?.firstBlock?.course || 'your first course';
  return `Let's do one ${m}-minute block on ${c} right now. One finished block today is real progress.`;
};

export const roleLabel = p => (THEMES[p?.futureSelf?.theme || p?.dream?.theme] || THEMES.studio).label;

// Everything the future self says on the "meet" screen, in order.
export const meetLines = p => [greet(p), reflectWhy(p), learningLine(p), hoursLine(p), worriedLine(p), guaranteeLine(p)].filter(Boolean);

function article(s) { return /^(the|a|an|my)\b/i.test(s) ? s : (/^[aeiou]/i.test(s) ? 'an ' : 'a ') + s; }

// ---- guardrail checker (used by the tests, and cheap enough to run on any generated line) ----
// Flags first-person past-memory phrasing. Text inside quotes is the student's own words and is ignored.
const PAST = [
  /\bi (was|were|had|used to|remember|remembered|froze|failed|struggled|felt|got|went|did|learned|learnt|grew up|studied|couldn'?t|didn'?t|know how (it|that) feels)\b/,
  /\bi'?ve (been|failed|struggled|studied|done|had|felt|gone|seen)\b/,
  /\bwhen i (was|were|started|first|took)\b/, /\bback (then|when)\b/, /\b(years?|months?|semesters?) ago\b/,
  /\bmy (first|last) (year|term|semester|exam|day)\b/, /\bmy (childhood|mum|mom|dad|parents|school days|old)\b/,
  /\bin (first|second|third) year\b/, /\bwe (once|used to)\b/,
];
export function violations(line) {
  const t = String(line).toLowerCase().replace(/“[^”]*”/g, ' ').replace(/"[^"]*"/g, ' ');
  return PAST.filter(re => re.test(t)).map(re => re.source);
}
