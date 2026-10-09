// The receptionist's presence: her lines, a barely-there idle breath, and the focus dim while listening.
// The person is the procedural 3D character in world3d/Receptionist.js. Owner: Jim.
import { STATES, on, get } from '../state.js';
import { reducedMotion } from '../quality.js';

export function mountReceptionist({ root, stage }) {
  const wrap = root.querySelector('#cine-reception');
  const q = root.querySelector('#cine-question');
  let timer = 0, greeted = false;

  const say = (text, { instant = false } = {}) => {
    clearTimeout(timer);
    q.classList.remove('in');
    const put = () => { q.textContent = text; requestAnimationFrame(() => q.classList.add('in')); };
    if (instant || reducedMotion || !q.textContent) put(); else timer = setTimeout(put, 380);
  };

  on('change:state', ({ value }) => {
    const S = STATES;
    const inReception = [S.RECEPTION, S.QUESTION, S.LISTENING, S.PROCESSING, S.CAREER_IDENTIFIED].includes(value);
    wrap.classList.toggle('show', inReception);
    stage.classList.toggle('cine-breathe', [S.QUESTION, S.LISTENING, S.PROCESSING].includes(value) && !reducedMotion);
    stage.classList.toggle('cine-focus', value === S.LISTENING || value === S.PROCESSING);

    if (value === S.QUESTION) {
      if (!greeted) {
        greeted = true;
        say('Welcome to FSCHOOL.', { instant: true });
        timer = setTimeout(() => say('Where do you want to go?'), reducedMotion ? 1200 : 2000);
      } else say('Where do you want to go?');
    } else if (value === S.CAREER_IDENTIFIED) say('Got it.');
    else if (value === S.RECEPTION || value === S.SCHOOL_HALLWAY) { greeted = false; clearTimeout(timer); q.classList.remove('in'); }
  });
  if (get('state') === STATES.QUESTION) wrap.classList.add('show');
}
