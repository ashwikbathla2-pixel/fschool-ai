// Backend for the verified-study event stream (PRD section 8: "every finished block and keypoint sends one verified event to the backend", and section 10).
// Zero dependencies; in-memory with an optional JSON file (STUDY_DATA=path). It exists to close the gaps the pure engine cannot (see abuse.test.mjs):
//   the CLIENT never chooses ids, timestamps, active time, plan start or grades. The server issues a session per block, measures active time from heartbeats,
//   stamps events with its own clock, binds every event to the authenticated account, and keeps a sticky strike ledger that outlives plans.
// Run:  node server.mjs   (PORT=8790)        Test: node --test server.test.mjs
// POLICY NUMBERS below are proposals for Sachcit (PRD decisions 3 and 10), kept in one object so changing one is a one-line edit.
import http from 'node:http';
import { randomUUID, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { RULES, ingest, climbScore, assignFloors, guaranteeState, evaluateClaim } from './engine.js';
import { strikeReport, effectiveStrikes } from './notices.js';
import { reviewClaim } from './fraud.js';

const DAY = 864e5;
export const POLICY = Object.freeze({
  heartbeatMinMs: 5000, heartbeatMaxCreditMs: 35000,   // each heartbeat credits at most this much active time, so a script cannot claim an hour in one ping
  backfillWindowMs: 48 * 3600e3,                       // events are stamped on receipt; sessions older than this cannot be submitted (G8)
  dailyBlockCap: 8,                                    // blocks above this per day score nothing for the climb (G11); still count toward the plan
  claimsPerTerm: 2,                                    // payouts per student per term (G6). PRD says $2,000 per claim: cap the claimant too
  sessionTtlMs: 3 * 3600e3,
});

export function createApp({ now = () => Date.now(), policy = POLICY, rules = RULES, file = process.env.STUDY_DATA, portalKey = process.env.PORTAL_KEY || 'dev-portal-key' } = {}) {
  const db = file && existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { students: {}, tokens: {}, events: [], rejected: [], sessions: {}, grades: [], claims: [] };
  const save = () => { if (file) writeFileSync(file, JSON.stringify(db)); };
  const send = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization,content-type,x-portal-key' }); res.end(JSON.stringify(body)); };
  const bad = (res, code, error) => send(res, code, { error });

  const sidOf = req => db.tokens[(req.headers.authorization || '').replace(/^Bearer /, '')];
  const dayStart = ts => Math.floor(ts / DAY) * DAY;

  // Climb with a per-day cap on blocks: the server counts the cap, the pure engine does not know about it.
  function climb(sid, at) {
    const mine = db.events.filter(e => e.studentId === sid), perDay = new Map(), kept = [];
    for (const e of mine.sort((a, b) => a.ts - b.ts)) {
      if (e.type === 'block' && e.verified) { const d = dayStart(e.ts), n = (perDay.get(d) || 0) + 1; perDay.set(d, n); if (n > policy.dailyBlockCap) continue; }
      kept.push(e);
    }
    return climbScore(kept, sid, at, rules);
  }

  // The ledger is sticky: once coverage has ended it stays ended, whatever is submitted afterwards (G8, G12).
  function guarantee(stu, at) {
    const g = guaranteeState(stu, db.events, stu.id, at, rules);
    if (g.state === 'ended' && !stu.endedAt) { stu.endedAt = at; save(); }
    return stu.endedAt ? { state: 'ended', shield: null, strikes: rules.strikeLimit, reason: 'Three strikes: coverage has ended' } : g;
  }

  async function route(req, res, url, body) {
    const t = now(), m = req.method, p = url.pathname;
    if (m === 'OPTIONS') return send(res, 204, {});

    if (m === 'POST' && p === '/students') {                       // sign-up. The server sets the join date; the client cannot backdate it (G13).
      const id = String(body.id || '').slice(0, 40); if (!/^[\w-]{3,40}$/.test(id)) return bad(res, 400, 'id must be 3-40 letters, numbers, - or _');
      if (db.students[id]) return bad(res, 409, 'id taken');
      const token = randomBytes(18).toString('hex');
      db.students[id] = { id, tier: body.tier === 'pro' ? 'pro' : 'basic', schoolId: body.schoolId || null, courses: Array.isArray(body.courses) ? body.courses.slice(0, 12).map(String) : [], joinedTs: t, plan: null, planBlocksTotal: {}, paidCourses: [], gradeSourceVerified: false, endedAt: null, deviceId: String(body.deviceId || '').slice(0, 80) };
      db.tokens[token] = id; save(); return send(res, 201, { id, token, joinedTs: t });
    }
    if (p === '/tower' && m === 'GET') {                            // public: floors by climb. No names or schools (PRD safety).
      const ids = Object.keys(db.students), floors = assignFloors(Object.fromEntries(ids.map(i => [i, climb(i, t)])));
      return send(res, 200, { students: ids.length, floors: ids.map(i => ({ id: i.slice(0, 2) + '…', floor: floors[i] })) });
    }
    if (p === '/grades' && m === 'POST') {                          // only a portal adapter holding the key may record a grade; the student cannot (G6 and fake-grade)
      if (req.headers['x-portal-key'] !== portalKey) return bad(res, 403, 'portal key required');
      const stu = db.students[body.studentId]; if (!stu) return bad(res, 404, 'unknown student');
      db.grades.push({ studentId: stu.id, course: String(body.course), percent: Number(body.percent), passMark: Number(body.passMark ?? 50), final: body.final !== false, sat: body.sat !== false, receivedAt: t });
      stu.gradeSourceVerified = true; save(); return send(res, 201, { ok: true });
    }

    const sid = sidOf(req); if (!sid) return bad(res, 401, 'sign in first');
    const stu = db.students[sid];

    if (m === 'POST' && p === '/plan') {                            // plan start is server time, never earlier than the join date (G13), and replacing a plan keeps the ledger (G12)
      const hours = Number(body.hoursPerWeek); if (!(hours > 0 && hours <= 60)) return bad(res, 400, 'hoursPerWeek must be 1-60');
      const course = String(body.course || ''); if (!stu.courses.includes(course)) return bad(res, 400, 'course is not on your list');
      const total = Math.round(Number(body.planBlocksTotal)); if (!(total > 0 && total < 500)) return bad(res, 400, 'planBlocksTotal must be 1-499');
      if (stu.plan) stu.plan = { ...stu.plan, hoursPerWeek: hours, course: stu.plan.course };   // re-planning changes the pace, not the start date or the strikes already earned
      else stu.plan = { startTs: t, hoursPerWeek: hours, course };
      stu.planBlocksTotal[course] = total; save(); return send(res, 200, { plan: stu.plan });
    }
    if (m === 'POST' && p === '/sessions') {                        // one session per block: the server's id, not the client's (G1)
      const course = String(body.course || ''), planBlockId = String(body.planBlockId || '');
      if (!stu.courses.includes(course) || !planBlockId) return bad(res, 400, 'course and planBlockId required');
      const open = Object.values(db.sessions).find(s => s.studentId === sid && !s.closed && t - s.startedAt < policy.sessionTtlMs);
      if (open) return bad(res, 409, 'finish your current block first');                                      // no overlapping blocks (G10)
      if (db.events.some(e => e.studentId === sid && e.verified && e.planBlockId === planBlockId)) return bad(res, 409, 'that plan block is already done');   // distinct plan items (G10)
      const id = randomUUID(); db.sessions[id] = { id, studentId: sid, course, planBlockId, startedAt: t, lastBeat: t, activeMs: 0, canvasActions: 0, closed: false };
      return send(res, 201, { sessionId: id, startedAt: t });
    }
    const hb = p.match(/^\/sessions\/([\w-]+)\/heartbeat$/);
    if (m === 'POST' && hb) {                                       // active time is what the server watched, capped per ping (G3)
      const s = db.sessions[hb[1]]; if (!s || s.studentId !== sid || s.closed) return bad(res, 404, 'no such open session');
      const gap = t - s.lastBeat; if (gap < policy.heartbeatMinMs) return send(res, 200, { activeMs: s.activeMs, ignored: true });
      s.activeMs += Math.min(gap, policy.heartbeatMaxCreditMs); s.lastBeat = t;
      s.canvasActions += Math.max(0, Math.min(40, Math.floor(Number(body.canvasActions) || 0)));              // bounded per ping: a burst cannot fake an hour of writing
      return send(res, 200, { activeMs: s.activeMs });
    }
    if (m === 'POST' && p === '/events') {
      const type = body.type;
      if (type === 'grade') return bad(res, 403, 'grades come from the school portal only');
      const ev = { id: randomUUID(), studentId: sid, type, course: String(body.course || ''), ts: t, receivedAt: t };             // client ts, id and studentId are ignored
      if (!stu.courses.includes(ev.course)) return bad(res, 400, 'course is not on your list');
      if (type === 'block') {
        const s = db.sessions[body.sessionId]; if (!s || s.studentId !== sid || s.course !== ev.course) return bad(res, 404, 'no such session');
        if (s.closed) return bad(res, 409, 'session already submitted');                                         // one verified block per real session (G1, G9)
        if (t - s.startedAt > policy.backfillWindowMs) { s.closed = true; return bad(res, 410, 'session is too old to submit'); }
        s.closed = true;
        Object.assign(ev, { sessionId: s.id, planBlockId: s.planBlockId, minutes: Math.min(Number(body.minutes) || rules.blockMinutes, rules.blockMinutes), activeMs: s.activeMs, canvasActions: s.canvasActions,
          checkScore: body.checkScore, secondsPerCheck: body.secondsPerCheck, pastedAi: !!body.pastedAi, ts: t });
        if (ev.minutes < rules.blockMinutes) ev.minutes = rules.blockMinutes;     // a block is a whole block; a short one fails on active time instead
      } else if (type === 'keypoint') Object.assign(ev, { keypoint: String(body.keypoint || ''), mastery: body.mastery, secondsPerCheck: body.secondsPerCheck, pastedAi: !!body.pastedAi });
      else return bad(res, 400, 'type must be block or keypoint');
      const dupe = type === 'keypoint' && db.events.some(e => e.studentId === sid && e.type === 'keypoint' && e.verified && e.keypoint === ev.keypoint && e.course === ev.course && t - e.ts < DAY);
      const r = dupe ? { event: { ...ev, verified: false, reason: 'that keypoint was already counted today' } } : ingest(db.events, ev, rules, t);
      (r.event.verified ? db.events : db.rejected).push(r.event); if (r.stream && r.event.verified) { /* ingest returned a new array; we keep our own */ }
      save(); return send(res, 201, { verified: r.event.verified, reason: r.event.reason, eventId: r.event.id });
    }
    if (m === 'GET' && p === '/me/state') {
      const g = guarantee(stu, t), ids = Object.keys(db.students), floors = assignFloors(Object.fromEntries(ids.map(i => [i, climb(i, t)])));
      const rep = stu.plan ? strikeReport(stu, db.events, sid, t, rules) : null;
      return send(res, 200, { climb: climb(sid, t), floor: floors[sid], guarantee: g, strikes: rep, tier: stu.tier });
    }
    if (m === 'POST' && p === '/claims') {                          // the grade is the portal's record, not the client's number (fake-grade, grade-mismatch)
      const course = String(body.course || ''), g = db.grades.filter(x => x.studentId === sid && x.course === course && x.final).pop();
      if (!g) return bad(res, 409, 'no verified final grade for this course yet');
      const mine = db.claims.filter(c => c.studentId === sid && c.decision === 'pay' && t - c.ts < 120 * DAY).length;
      if (mine >= policy.claimsPerTerm) return send(res, 200, { decision: 'deny', reason: `Limit of ${policy.claimsPerTerm} paid claims per term reached` });
      const claim = { course, finalGrade: g.percent, passMark: g.passMark, source: 'portal' };
      const gs = guarantee(stu, t), el = gs.state === 'ended' ? { eligible: false, reason: gs.reason } : evaluateClaim({ ...stu }, db.events, sid, claim, t, rules);
      if (!el.eligible) return send(res, 200, { decision: 'deny', reason: el.reason });
      const others = Object.values(db.students).filter(o => o.id !== sid && o.deviceId && o.deviceId === stu.deviceId && db.claims.some(c => c.studentId === o.id && c.course === course));
      const rv = reviewClaim(stu, db.events, sid, claim, { sat: g.sat, portalGrade: g.percent, passMark: g.passMark, termStartTs: stu.joinedTs, termEndTs: g.receivedAt, deviceClaims: 1 + others.length, rejected: db.rejected });
      db.claims.push({ studentId: sid, course, decision: rv.decision, ts: t });
      if (rv.decision === 'pay') stu.paidCourses.push(course);
      save(); return send(res, 200, { decision: rv.decision, payout: rv.decision === 'pay' ? el.payout : 0, form: rv.form, reason: rv.reason, flags: rv.flags.map(f => f.id) });
    }
    return bad(res, 404, 'not found');
  }

  const handler = (req, res) => {
    let raw = ''; req.on('data', c => { raw += c; if (raw.length > 1e5) req.destroy(); });
    req.on('end', async () => {
      let body = {}; try { body = raw ? JSON.parse(raw) : {}; } catch { return bad(res, 400, 'invalid JSON'); }
      try { await route(req, res, new URL(req.url, 'http://x'), body); } catch (e) { console.error(e); bad(res, 500, 'server error'); }
    });
  };
  return { handler, db };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = +process.env.PORT || 8790;
  http.createServer(createApp().handler).listen(port, () => console.log(`study events on http://localhost:${port}`));
}
