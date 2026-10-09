// Scene 03: through the vestibule and down the hallway. Owner: Jim.
import { STATES } from '../state.js';
export default {
  id: 'hallway', state: STATES.SCHOOL_HALLWAY, weight: 220, keys: [[0, 0], [1, 1]], stop: 0.5,
  captions: [{ text: 'Every door leads somewhere.', from: 0.2, to: 0.62, pos: 'low' }],
};
