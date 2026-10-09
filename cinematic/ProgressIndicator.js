// Vertical chapter indicator: 01 Welcome .. 05 Your Path. Owner: Jim.
import { STATES, on, get } from './state.js';

const CHAPTERS = [
  { n: '01', label: 'Welcome' },
  { n: '02', label: 'School' },
  { n: '03', label: 'Reception' },
  { n: '04', label: 'Your Goal' },
  { n: '05', label: 'Your Path' },
];
const CHAPTER_OF = {
  [STATES.WELCOME]: 0, [STATES.SCHOOL_ENTRANCE]: 1, [STATES.SCHOOL_HALLWAY]: 1, [STATES.RECEPTION]: 2,
  [STATES.QUESTION]: 3, [STATES.LISTENING]: 3, [STATES.PROCESSING]: 3, [STATES.CAREER_IDENTIFIED]: 3,
  [STATES.CAREER_TRANSITION]: 4, [STATES.PERSONALIZED_PATH]: 4, [STATES.APP_ENTRY]: 4,
};

export function mountProgress(host, { onChapter } = {}) {
  host.innerHTML = '<ol>' + CHAPTERS.map((c, i) =>
    `<li data-i="${i}"><button type="button" ${i > 2 ? 'aria-disabled="true" tabindex="-1"' : ''} aria-label="Chapter ${c.n}: ${c.label}"><b>${c.n}</b><span>${c.label}</span></button></li>`).join('') + '</ol>';
  const items = [...host.querySelectorAll('li')];
  const paint = state => {
    const a = CHAPTER_OF[state] ?? 0;
    items.forEach((li, i) => {
      li.classList.toggle('on', i === a);
      li.classList.toggle('past', i < a);
      const b = li.firstElementChild;
      if (i === a) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    });
  };
  items.forEach((li, i) => { if (i <= 2) li.firstElementChild.addEventListener('click', () => onChapter?.(i)); });
  on('change:state', ({ value }) => paint(value));
  paint(get('state'));
}
