// Scene 04: the reception hall. The camera slows for the last stretch to the desk. Owner: Jim.
import { STATES } from '../state.js';
export default {
  id: 'reception', state: STATES.RECEPTION, weight: 360, keys: [[0, 0], [0.6, 0.78], [1, 1]], stop: 1, captions: [],
  questionAt: 0.985, // fraction of the whole flow after which the question appears
};
