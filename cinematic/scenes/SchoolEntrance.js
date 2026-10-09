// Scene 02: walk the plaza to the entrance; the glass doors open as we arrive. Owner: Jim.
import { STATES } from '../state.js';
export default {
  id: 'entrance', state: STATES.SCHOOL_ENTRANCE, weight: 260, keys: [[0, 0], [1, 1]], stop: 0.9,
  captions: [
    { text: 'Welcome.', from: 0.04, to: 0.24, pos: 'low' },
    { text: 'But not the school you remember.', from: 0.34, to: 0.64, pos: 'low' },
  ],
};
