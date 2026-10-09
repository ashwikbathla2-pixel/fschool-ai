// Grade verification (PRD section 9 and spike "Grade verification"). The guarantee cannot launch without a verified final grade.
// A school plugs in an adapter; this module normalises what it returns and decides whether the grade counts.
// Decision 2 in the PRD: when a school blocks the portal, a typed or uploaded transcript is NOT verified and coverage stays off.
//
// Adapter contract:  { id: 'school-id', kind: 'portal' | 'partner', fetchGrades(session) -> Promise<RawGrade[]> }
// RawGrade: { course, term, final: boolean, grade: '87.5' | 87.5 | 'B+' | '3.3', scale?: 'percent'|'letter'|'gpa4', passMark?: number (percent), fetchedAt?: ms }
// NOTE: real portals need each school's OAuth/SSO or a partnership. createJsonPortalAdapter and createCsvAdapter cover the two shapes
// most schools can give us (a REST gradebook endpoint, or a gradebook CSV export) so the first two schools are a mapping, not a rewrite.

const LETTER = { 'A+': 97, A: 94, 'A-': 90, 'B+': 87, B: 84, 'B-': 80, 'C+': 77, C: 74, 'C-': 70, 'D+': 67, D: 64, 'D-': 60, F: 30 };   // midpoints of the common US bands
export const SOURCES = Object.freeze({ PORTAL: 'portal', PARTNER: 'partner', TRANSCRIPT: 'transcript' });
const VERIFIED_KINDS = new Set([SOURCES.PORTAL, SOURCES.PARTNER]);

export function toPercent(grade, scale) {
  const g = String(grade).trim().toUpperCase();
  if (scale === 'letter' || (!scale && LETTER[g] !== undefined)) return LETTER[g] ?? NaN;
  const n = parseFloat(g); if (!Number.isFinite(n)) return NaN;
  if (scale === 'gpa4' || (!scale && n <= 4.0 && g.includes('.') && n >= 0)) return Math.round((n / 4) * 1000) / 10;
  return n >= 0 && n <= 100 ? n : NaN;
}

export function normalizeGrade(raw, adapter) {
  const percent = toPercent(raw.grade, raw.scale);
  if (!raw.course || !Number.isFinite(percent)) return { ok: false, reason: `unreadable grade for ${raw.course || 'unknown course'}` };
  return { ok: true, course: raw.course, term: raw.term || '', final: raw.final !== false, percent, passMark: raw.passMark ?? 50, source: adapter.kind, adapterId: adapter.id, fetchedAt: raw.fetchedAt || Date.now() };
}

// Pull from the student's school adapter. Never throws: every failure becomes a reason the student can read.
export async function syncGrades(student, adapters, session = {}) {
  const adapter = adapters.get ? adapters.get(student.schoolId) : adapters[student.schoolId];
  if (!adapter) return { status: 'unavailable', grades: [], reason: 'We cannot read your school portal yet. You can keep studying; the guarantee stays off until a grade source is verified.' };
  let rows;
  try { rows = await adapter.fetchGrades(session); } catch (e) { return { status: 'unavailable', grades: [], reason: `The portal did not answer (${e.message || 'error'}). Try again, or the guarantee stays off.` }; }
  const grades = [], bad = [];
  for (const r of rows || []) { const g = normalizeGrade(r, adapter); (g.ok ? grades : bad).push(g); }
  if (!VERIFIED_KINDS.has(adapter.kind)) return { status: 'unverified', grades, reason: 'This source is not a verified school source.' };
  return { status: bad.length ? 'partial' : 'verified', grades, reason: bad.map(b => b.reason).join('; ') };
}

// A verified final grade becomes the event that evaluateClaim() expects.
export function claimFrom(grade) {
  return { course: grade.course, finalGrade: grade.percent, passMark: grade.passMark, source: VERIFIED_KINDS.has(grade.source) ? 'portal' : grade.source, final: grade.final };
}

// Decision 2: no portal, no coverage. A transcript the student typed or uploaded is kept as a note and never starts the guarantee.
export function transcriptFallback(entries) {
  return { status: 'unverified', verified: false, coverage: 'off', grades: entries.map(e => ({ ...e, source: SOURCES.TRANSCRIPT })),
    reason: 'Typed or uploaded grades are not verified. Coverage starts once your school portal, or a school partnership, confirms them.' };
}

// Cross-check two reads of the same course (for example portal vs the student's own entry). A mismatch is a fraud signal, not a typo.
export function reconcile(a, b, tolerance = 0.5) { return Math.abs(a.percent - b.percent) <= tolerance; }

// ---- reference adapters -------------------------------------------------------------------------------------------------------
export function createJsonPortalAdapter({ id, baseUrl, fetch: f = globalThis.fetch, map = r => r, kind = SOURCES.PORTAL }) {
  return { id, kind, async fetchGrades(session = {}) {
    const res = await f(`${baseUrl}/grades`, { headers: session.token ? { authorization: `Bearer ${session.token}` } : {} });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()).map(map);
  } };
}

export function parseCsv(text) {
  const rows = []; let cur = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true; else if (c === ',') { cur.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; cur.push(cell); cell = ''; if (cur.some(x => x !== '')) rows.push(cur); cur = []; }
    else cell += c;
  }
  cur.push(cell); if (cur.some(x => x !== '')) rows.push(cur);
  return rows;
}
// CSV gradebook export with a header row; column names are mapped so each school only supplies its own header names.
export function createCsvAdapter({ id, text, columns = { course: 'Course', term: 'Term', grade: 'Final Grade', status: 'Status' }, kind = SOURCES.PARTNER }) {
  return { id, kind, async fetchGrades() {
    const [head, ...rows] = parseCsv(text), ix = k => head.indexOf(columns[k]);
    if (ix('course') < 0 || ix('grade') < 0) throw new Error('missing Course or Final Grade column');
    return rows.map(r => ({ course: r[ix('course')], term: ix('term') >= 0 ? r[ix('term')] : '', grade: r[ix('grade')], final: ix('status') < 0 || /final|complete/i.test(r[ix('status')]) }));
  } };
}
