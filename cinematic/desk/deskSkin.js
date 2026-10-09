// Desk skin: one identical lesson layout, reskinned per dream theme (PRD section 8, "One lesson, three dreams").
// Pure data + functions, no DOM. Labels / progress metaphor / accent come from THEMES[theme].desk in studyworld/profile.js.
import { THEMES } from '../studyworld/profile.js';

// Voice line + hint copy per theme. Text only: PRD guardrails say no voice clone, no photo, no invented biography.
const COPY = {
  pilot:  { hint: 'Check the numbers twice before you commit. Then go.',        greet: 'Preflight first.' },
  doctor: { hint: 'Name what you see, then reason from it.',                   greet: 'Ready for rounds.' },
  coder:  { hint: 'Write the test first. What should the answer be?',          greet: 'Let us get tests green.' },
  studio: { hint: 'Slow is fine. Say it in your own words.',                   greet: 'Here is today\'s plan.' },
};

// Abstract portrait: never a photo. A head circle and shoulders, plus one theme mark. All shapes are generic.
const MARK = { pilot: 'horizon', doctor: 'ring', coder: 'brackets', studio: 'dot' };

export function skinFor(theme, course = '') {
  const key = THEMES[theme] ? theme : 'studio';
  const T = THEMES[key];
  const name = String(course || '').trim() || 'PHY 121';
  return {
    theme: key,
    label: T.label,
    accent: T.accent,
    courseLabel: T.desk.course(name),
    progressName: T.desk.progress,
    unit: T.desk.unit,
    hint: COPY[key].hint,
    greet: COPY[key].greet,
    portrait: { mark: MARK[key], photo: false },
  };
}

// Inline SVG string for the portrait placeholder. Decorative (aria-hidden by the caller).
export function portraitSvg(skin) {
  const c = skin.accent;
  const mark = {
    horizon:  `<path d="M14 30 H66" stroke="${c}" stroke-width="3" stroke-linecap="round"/>`,
    ring:     `<circle cx="40" cy="22" r="26" fill="none" stroke="${c}" stroke-width="3"/>`,
    brackets: `<path d="M16 14 L8 24 L16 34 M64 14 L72 24 L64 34" fill="none" stroke="${c}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`,
    dot:      `<circle cx="62" cy="12" r="4" fill="${c}"/>`,
  }[skin.portrait.mark];
  return `<svg viewBox="0 0 80 80" width="64" height="64" focusable="false"><rect width="80" height="80" rx="20" fill="${c}" opacity=".12"/>${mark}`
    + `<circle cx="40" cy="30" r="12" fill="${c}" opacity=".85"/><path d="M16 74 C16 54 64 54 64 74 Z" fill="${c}" opacity=".55"/></svg>`;
}
