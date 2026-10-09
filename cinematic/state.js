// Shared contract for the cinematic onboarding. Owner: Jim.
// Everyone imports from here; keep it tiny and dependency-free.

export const STATES = Object.freeze({
  WELCOME: 'WELCOME',
  SCHOOL_ENTRANCE: 'SCHOOL_ENTRANCE',
  SCHOOL_HALLWAY: 'SCHOOL_HALLWAY',
  RECEPTION: 'RECEPTION',
  QUESTION: 'QUESTION',
  LISTENING: 'LISTENING',
  PROCESSING: 'PROCESSING',
  CAREER_IDENTIFIED: 'CAREER_IDENTIFIED',
  CAREER_TRANSITION: 'CAREER_TRANSITION',
  PERSONALIZED_PATH: 'PERSONALIZED_PATH',
  APP_ENTRY: 'APP_ENTRY',
});

// Shared answer profile, filled by the voice/career pieces.
export const profile = {
  career_goal: '',
  confidence: 0,
  interests: [],
  recommended_foundations: [],
};

const listeners = new Map(); // event -> Set<fn>
const store = { state: STATES.WELCOME };

// on(event, fn) -> unsubscribe fn. Use '*' to hear every event as fn(event, payload).
export function on(event, fn) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(fn);
  return () => listeners.get(event)?.delete(fn);
}

export function emit(event, payload) {
  for (const fn of listeners.get(event) || []) {
    try { fn(payload); } catch (e) { console.warn('[cinematic] listener failed', event, e); }
  }
  for (const fn of listeners.get('*') || []) {
    try { fn(event, payload); } catch (e) { console.warn('[cinematic] listener failed', '*', e); }
  }
}

export function get(key) { return store[key]; }

// set(key, value) emits 'change:<key>' with { value, prev }.
// set('state', STATES.X) is how scenes move the flow; listen with on('change:state', ...).
export function set(key, value) {
  const prev = store[key];
  if (prev === value) return;
  store[key] = value;
  emit(`change:${key}`, { value, prev });
}

// Merge into the profile and emit 'profile' with the full profile.
export function updateProfile(patch) {
  Object.assign(profile, patch);
  emit('profile', profile);
}

// Mount points (created by CinematicOnboarding during the QUESTION state):
//   #voice-mount  -> Stanley's mic UI (must include a typed fallback)
//   #career-mount -> Phyllis's career / path scenes
// Conventional events: 'answer' {text, source:'voice'|'typed'}, 'career' {career_goal, confidence}.

if (typeof window !== 'undefined') window.__cinematic = { STATES, profile, on, emit, get, set, updateProfile };
