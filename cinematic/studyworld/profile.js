// Interview data + dream -> theme mapping + pause/resume. PRD section 4 ("what does the interview output look like as data?").
// Fields drive: ROOM (theme, accent), FUTURE SELF (role, look, voice line), PLAN (courses, hours, worried course, learning style).
// Guardrails (PRD): the future self never invents biographical memories, is never built from a real photo, never clones the student's voice.

export const THEMES = {
  pilot:  { label: 'Pilot',  role: 'pilot',    accent: '#4f8df7', match: /pilot|aviat|aerospace|astronaut|airline|flight|aircraft/i,
            desk: { code: 'FLIGHT', progress: 'Preflight checklist', unit: 'items checked', course: n => `FLIGHT ${n}` } },
  coder:  { label: 'Coder',  role: 'engineer', accent: '#7a6cf0', match: /cod(e|er|ing)|software|develop|program|engineer|hack|cyber|data|machine learning|\bai\b|computer|robot/i,
            desk: { code: '~/', progress: 'Tests passing', unit: 'tests passing', course: n => `~/${n.toLowerCase().replace(/\s+/g, '-')}` } },
  doctor: { label: 'Doctor', role: 'doctor',   accent: '#2fb7a4', match: /doctor|medic|nurs|surgeon|physician|health|dentist|pharma|vet|biolog|neuro|psych/i,
            desk: { code: 'CASE', progress: "Today's rounds", unit: 'rounds done', course: n => `CASE ${n}` } },
  studio: { label: 'Studio', role: 'mentor',   accent: '#e0a24a', match: /.*/,
            desk: { code: '', progress: "Today's plan", unit: 'keypoints done', course: n => n } },
};
export const LEARNING = [['seeing', 'Seeing it'], ['doing', 'Doing it'], ['reading', 'Reading it'], ['talking', 'Talking it through']];
export const HOURS = [3, 5, 8, 12, 15, 20];

// A free-text dream becomes a theme; anything we have no theme for gets the neutral Studio room (PRD: "still gets a good room").
export function themeFor(text) {
  const t = String(text || '');
  for (const k of ['pilot', 'doctor', 'coder']) if (THEMES[k].match.test(t)) return k;
  return 'studio';
}

export const STEPS = [
  { id: 'dream',   say: 'First, who do you want to become?',                       kind: 'text',    ph: 'A pilot, a doctor, a marine biologist…' },
  { id: 'why',     say: 'Why that? What pulls you toward it?',                       kind: 'text',    ph: 'Because…' },
  { id: 'learning', say: 'How do you learn best?',                                   kind: 'choice',  options: LEARNING },
  { id: 'courses', say: 'Which courses are you taking this term?',                   kind: 'courses' },
  { id: 'hours',   say: 'How many hours can you really study each week?',            kind: 'choice',  options: HOURS.map(h => [h, h + ' hours']) },
  { id: 'worried', say: 'Which course are you most worried about?',                  kind: 'worried' },
];

const KEY = 'fschool.interview.v1';
const safe = fn => { try { return fn(); } catch { return null; } };
export const saveDraft = d => safe(() => localStorage.setItem(KEY, JSON.stringify(d)));
export const loadDraft = () => safe(() => JSON.parse(localStorage.getItem(KEY) || 'null'));
export const clearDraft = () => safe(() => localStorage.removeItem(KEY));

// answers -> the profile every other module reads.
export function buildProfile(a) {
  const theme = themeFor(a.dream);
  const T = THEMES[theme];
  const courses = (a.courses || []).filter(Boolean);
  return {
    version: 1,
    dream: { text: a.dream || '', why: a.why || '', theme },
    learning: a.learning || 'doing',
    courses,
    hoursPerWeek: Number(a.hours) || 5,
    worriedCourse: a.worried || courses[0] || '',
    // PRD: guarantee stays off until a grade source is verified. Typed courses never verify anything.
    guarantee: { state: 'off', reason: a.portalVerified ? '' : 'No grade source verified yet', strikes: 0 },
    futureSelf: { role: T.role, theme, photo: false, voiceClone: false },   // guardrails, stated as data
    room: { theme, accent: T.accent, floor: 1, view: 'neighbour' },
    firstBlock: { minutes: 25, course: a.worried || courses[0] || 'your first course' },
  };
}
