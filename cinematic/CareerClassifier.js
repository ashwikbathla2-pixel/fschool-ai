// Career classifier. Owner: Stanley.
// classify(text) -> { career_category, confidence, related_subjects, learning_domains, short_interpretation }
// Always resolves (never throws, never hangs): remote AI if configured, else / on failure the offline keyword classifier.

// The app has no AI backend yet. Point this at a server route that holds the API key
// (POST {text} -> the JSON shape above). Keep null to stay fully offline. Never put a key in client code.
export const CLASSIFIER_ENDPOINT = null; // e.g. '/api/classify-career'
export const TIMEOUT_MS = 6000;
export const MIN_CONFIDENCE = 0.55;

export const DISCOVERY = Object.freeze({
  career_category: 'unknown',
  confidence: 0,
  related_subjects: ['science', 'technology', 'arts', 'business', 'humanities', 'design', 'engineering', 'research'],
  learning_domains: ['curiosity', 'exploration', 'reasoning', 'communication'],
  short_interpretation: "Interesting. Let's explore that.",
});

// Offline knowledge, spec section 22. Ids match the keys in careers.json ('unknown' = discovery). Order matters: more specific first (software before engineer).
const CAREERS = [
  { id: 'undecided', re: /\b(don'?t know|not sure|no idea|undecided|unsure|haven'?t decided|anything)\b/i,
    subjects: DISCOVERY.related_subjects, domains: DISCOVERY.learning_domains,
    line: "You don't have to know yet. Let's explore." },
  { id: 'software', re: /software|programm|coder|coding|developer|computer|\bcode\b|\bapps?\b|\bai\b|machine learning|data scien|cyber|hack|web/i,
    subjects: ['computer science', 'mathematics', 'logic'], domains: ['programming', 'algorithms', 'systems', 'AI'],
    line: 'You want to build things that think and run.' },
  { id: 'doctor', re: /doctor|medic|mbbs|neet|nurse|surgeon|dentist|pharma|physician|hospital|health|heal people/i,
    subjects: ['biology', 'chemistry', 'physics'], domains: ['human biology', 'scientific reasoning', 'chemistry fundamentals', 'human health'],
    line: 'You want to understand the science behind the human body.' },
  { id: 'astronaut', re: /astronaut|space|rocket|nasa|isro|astronom|planet/i,
    subjects: ['physics', 'astronomy', 'mathematics'], domains: ['engineering', 'systems', 'orbital mechanics'],
    line: 'You want to go further than anyone has looked.' },
  { id: 'architect', re: /architect|buildings|urban|interior/i,
    subjects: ['mathematics', 'design', 'physics'], domains: ['engineering', 'spatial reasoning', 'drawing'],
    line: 'You want to shape the spaces people live in.' },
  { id: 'engineer', re: /engineer|robot|jee|mechanic|electric|electronic|civil|btech|b\.tech|machines?|build things/i,
    subjects: ['physics', 'mathematics', 'chemistry'], domains: ['problem solving', 'design', 'electronics', 'prototyping'],
    line: 'You want to build how things work.' },
  { id: 'scientist', re: /scien|research|chemist|physicist|biolog|lab|experiment|discover/i,
    subjects: ['biology', 'chemistry', 'physics', 'mathematics'], domains: ['experimentation', 'reasoning', 'analysis', 'research'],
    line: 'You want to find out what nobody knows yet.' },
  { id: 'entrepreneur', re: /entrepreneur|business|startup|start-up|own company|founder|ceo|market|finance|econom|invest/i,
    subjects: ['economics', 'mathematics', 'communication'], domains: ['leadership', 'product', 'strategy'],
    line: 'You want to build something of your own.' },
  { id: 'designer', re: /design|\bui\b|\bux\b|fashion|product look/i,
    subjects: ['design', 'art', 'technology'], domains: ['visual thinking', 'creativity', 'communication', 'prototyping'],
    line: 'You want to make ideas visible.' },
  { id: 'artist', re: /artist|\bart\b|creative|draw|paint|sketch|animat|illustrat|music|sing|film|writer|poet/i,
    subjects: ['art', 'history', 'literature'], domains: ['creativity', 'craft', 'storytelling', 'visual thinking'],
    line: 'You want to make things people feel.' },
  { id: 'lawyer', re: /lawyer|law\b|legal|judge|advocate|clat|attorney/i,
    subjects: ['history', 'english', 'civics'], domains: ['reasoning', 'argumentation', 'analysis', 'communication'],
    line: 'You want to argue for what is right.' },
];

export function classifyOffline(text) {
  const t = String(text || '').trim();
  if (!t) return { ...DISCOVERY };
  const hits = CAREERS.filter(c => c.re.test(t));
  if (!hits.length) return { ...DISCOVERY };
  const c = hits[0];
  if (c.id === 'undecided') return { ...DISCOVERY, short_interpretation: c.line };
  return {
    career_category: c.id,
    confidence: hits.length === 1 ? 0.82 : 0.68, // several matches = a bit less sure
    related_subjects: c.subjects,
    learning_domains: c.domains,
    short_interpretation: c.line,
  };
}

function valid(r) {
  return r && typeof r.career_category === 'string' && typeof r.confidence === 'number'
    && Array.isArray(r.related_subjects) && Array.isArray(r.learning_domains);
}

async function classifyRemote(text) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(CLASSIFIER_ENDPOINT, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }), signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const r = await res.json();
    return valid(r) ? r : null;
  } catch { return null; } finally { clearTimeout(timer); }
}

// Low confidence or failure -> discovery profile (spec section 23).
export async function classify(text) {
  let r = CLASSIFIER_ENDPOINT ? await classifyRemote(text) : null;
  if (!r) r = classifyOffline(text);
  if (r.career_category !== 'unknown' && r.confidence < MIN_CONFIDENCE) return { ...DISCOVERY };
  return r;
}

// Map a classification onto the shared profile shape (spec section 35).
export function toProfile(r) {
  return {
    career_goal: r.career_category,
    confidence: r.confidence,
    interests: r.related_subjects.map(s => s.replace(/\s+/g, '_')),
    recommended_foundations: [...new Set([...r.related_subjects, 'reasoning'])],
  };
}
