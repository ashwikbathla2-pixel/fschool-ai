// Tests the backend end to end over real HTTP with a fake clock, so a whole term runs in milliseconds.   Run: node --test server.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp, POLICY } from './server.mjs';

const DAY = 864e5, MIN = 6e4;
async function boot() {
  let t = Date.UTC(2026, 8, 1); const app = createApp({ now: () => t });
  const srv = http.createServer(app.handler); await new Promise(r => srv.listen(0, r));
  const base = `http://localhost:${srv.address().port}`;
  const call = async (method, path, body, token, headers = {}) => { const r = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, body: await r.json() }; };
  return { call, advance: ms => (t += ms), now: () => t, close: () => { srv.closeAllConnections?.(); srv.close(); }, app };
}
// one honest block: open a session, heartbeat for 25 minutes, submit
async function block(w, token, course, planBlockId, { minutes = 25, writing = 9 } = {}) {
  const s = await w.call('POST', '/sessions', { course, planBlockId }, token); if (s.status !== 201) return s;
  for (let i = 0; i < minutes * 2; i++) { w.advance(30000); await w.call('POST', `/sessions/${s.body.sessionId}/heartbeat`, { canvasActions: i === 0 ? writing : 0 }, token); }
  return w.call('POST', '/events', { type: 'block', course, sessionId: s.body.sessionId, checkScore: 0.9, secondsPerCheck: 20 }, token);
}
const signup = async (w, id, extra = {}) => (await w.call('POST', '/students', { id, tier: 'pro', courses: ['PHY121'], ...extra })).body.token;

test('an honest block verifies; the client cannot choose time, id, student or grade', async () => {
  const w = await boot(); const tok = await signup(w, 'alice1'); await w.call('POST', '/plan', { course: 'PHY121', hoursPerWeek: 5, planBlocksTotal: 18 }, tok);
  const r = await block(w, tok, 'PHY121', 'pb1'); assert.equal(r.body.verified, true);
  assert.equal((await w.call('POST', '/events', { type: 'grade', course: 'PHY121', source: 'portal' }, tok)).status, 403, 'students cannot send grades');
  w.close();
});
test('G1/G9: the same session cannot be replayed or sent twice, and another account cannot use it', async () => {
  const w = await boot(); const a = await signup(w, 'alice1'), b = await signup(w, 'bob22');
  const s = await w.call('POST', '/sessions', { course: 'PHY121', planBlockId: 'pb1' }, a); for (let i = 0; i < 50; i++) { w.advance(30000); await w.call('POST', `/sessions/${s.body.sessionId}/heartbeat`, { canvasActions: 9 }, a); }
  assert.equal((await w.call('POST', '/events', { type: 'block', course: 'PHY121', sessionId: s.body.sessionId, checkScore: 1 }, b)).status, 404, 'bob cannot submit alice\'s session');
  assert.equal((await w.call('POST', '/events', { type: 'block', course: 'PHY121', sessionId: s.body.sessionId, checkScore: 1 }, a)).body.verified, true);
  assert.equal((await w.call('POST', '/events', { type: 'block', course: 'PHY121', sessionId: s.body.sessionId, checkScore: 1 }, a)).status, 409, 'replay');
  w.close();
});
test('G3: a script that never heartbeats gets no active time, so the block does not verify', async () => {
  const w = await boot(); const tok = await signup(w, 'alice1');
  const s = await w.call('POST', '/sessions', { course: 'PHY121', planBlockId: 'pb1' }, tok); w.advance(26 * MIN);
  const r = await w.call('POST', '/events', { type: 'block', course: 'PHY121', sessionId: s.body.sessionId, checkScore: 1, activeMs: 9e9, canvasActions: 999 }, tok);
  assert.equal(r.body.verified, false); assert.match(r.body.reason, /active time/);
  // rapid pings are ignored: 100 pings in the same second credit nothing extra
  const s2 = await w.call('POST', '/sessions', { course: 'PHY121', planBlockId: 'pb2' }, tok);
  let last; for (let i = 0; i < 100; i++) last = await w.call('POST', `/sessions/${s2.body.sessionId}/heartbeat`, {}, tok); assert.equal(last.body.activeMs, 0);
  w.close();
});
test('G10: no overlapping blocks, and a plan block can be done once', async () => {
  const w = await boot(); const tok = await signup(w, 'alice1');
  const s = await w.call('POST', '/sessions', { course: 'PHY121', planBlockId: 'pb1' }, tok);
  assert.equal((await w.call('POST', '/sessions', { course: 'PHY121', planBlockId: 'pb2' }, tok)).status, 409, 'overlap');
  for (let i = 0; i < 50; i++) { w.advance(30000); await w.call('POST', `/sessions/${s.body.sessionId}/heartbeat`, { canvasActions: 9 }, tok); }
  await w.call('POST', '/events', { type: 'block', course: 'PHY121', sessionId: s.body.sessionId, checkScore: 1 }, tok);
  assert.equal((await w.call('POST', '/sessions', { course: 'PHY121', planBlockId: 'pb1' }, tok)).status, 409, 'same plan block again');
  w.close();
});
test('G8: events are stamped on receipt, old sessions cannot be back-filled', async () => {
  const w = await boot(); const tok = await signup(w, 'alice1');
  const s = await w.call('POST', '/sessions', { course: 'PHY121', planBlockId: 'pb1' }, tok); w.advance(3 * DAY);
  assert.equal((await w.call('POST', '/events', { type: 'block', course: 'PHY121', sessionId: s.body.sessionId, checkScore: 1, ts: 1 }, tok)).status, 410);
  w.close();
});
test('G11: blocks above the daily cap do not climb the tower', async () => {
  const w = await boot(); const tok = await signup(w, 'alice1'); await w.call('POST', '/plan', { course: 'PHY121', hoursPerWeek: 5, planBlocksTotal: 60 }, tok);
  for (let i = 0; i < POLICY.dailyBlockCap + 4; i++) await block(w, tok, 'PHY121', 'pb' + i, { minutes: 25 });
  const st = await w.call('GET', '/me/state', null, tok);
  assert.ok(st.body.climb <= POLICY.dailyBlockCap * 10 + 0.01, 'capped: ' + st.body.climb); w.close();
});
test('G12/G13: plan start is server time, re-planning does not reset the start or strikes', async () => {
  const w = await boot(); const tok = await signup(w, 'alice1');
  const p1 = await w.call('POST', '/plan', { course: 'PHY121', hoursPerWeek: 5, planBlocksTotal: 18, startTs: 0 }, tok);
  assert.equal(p1.body.plan.startTs, w.now(), 'the client cannot set the start'); w.advance(22 * DAY);
  await w.call('POST', '/plan', { course: 'PHY121', hoursPerWeek: 8, planBlocksTotal: 18 }, tok);
  const st = await w.call('GET', '/me/state', null, tok); assert.equal(st.body.strikes.strikes, 3, 'three empty weeks still count after a re-plan'); w.close();
});
test('G8: once coverage has ended it stays ended, even if blocks are added afterwards', async () => {
  const w = await boot(); const tok = await signup(w, 'alice1');
  await w.call('POST', '/grades', { studentId: 'alice1', course: 'PHY121', percent: 40, passMark: 50 }, null, { 'x-portal-key': 'dev-portal-key' });
  await w.call('POST', '/plan', { course: 'PHY121', hoursPerWeek: 5, planBlocksTotal: 18 }, tok); w.advance(40 * DAY);
  assert.equal((await w.call('GET', '/me/state', null, tok)).body.guarantee.state, 'ended');
  for (let i = 0; i < 12; i++) await block(w, tok, 'PHY121', 'late' + i);
  assert.equal((await w.call('GET', '/me/state', null, tok)).body.guarantee.state, 'ended'); w.close();
});
test('claims: the grade comes from the portal; a student who followed the plan and failed is paid as retake tuition; a student who did not is denied', async () => {
  const w = await boot(); const tok = await signup(w, 'alice1'); await w.call('POST', '/plan', { course: 'PHY121', hoursPerWeek: 5, planBlocksTotal: 20 }, tok);
  assert.equal((await w.call('POST', '/claims', { course: 'PHY121', finalGrade: 10 }, tok)).status, 409, 'no portal grade yet');
  const t0 = w.now();                                                                     // follow the plan: 7 blocks a week for three weeks, then the waiting period is over
  for (let wk = 0; wk < 3; wk++) for (let i = 0; i < 7; i++) { await block(w, tok, 'PHY121', `pb${wk}-${i}`); w.advance(20 * 3600e3); }
  w.advance(Math.max(0, t0 + 22 * DAY - w.now()));
  assert.equal((await w.call('POST', '/grades', { studentId: 'alice1', course: 'PHY121', percent: 40 }, tok)).status, 403, 'a student cannot post a grade');
  await w.call('POST', '/grades', { studentId: 'alice1', course: 'PHY121', percent: 40, passMark: 50 }, null, { 'x-portal-key': 'dev-portal-key' });
  const c = await w.call('POST', '/claims', { course: 'PHY121', finalGrade: 99 }, tok);              // the client's number is ignored
  assert.ok(['pay', 'hold'].includes(c.body.decision), JSON.stringify(c.body)); if (c.body.decision === 'pay') assert.equal(c.body.form, 'retake-tuition-or-credit');
  const w2 = await boot(); const t2 = await signup(w2, 'carol3'); await w2.call('POST', '/plan', { course: 'PHY121', hoursPerWeek: 5, planBlocksTotal: 10 }, t2); w2.advance(20 * DAY);
  await w2.call('POST', '/grades', { studentId: 'carol3', course: 'PHY121', percent: 40 }, null, { 'x-portal-key': 'dev-portal-key' });
  assert.equal((await w2.call('POST', '/claims', { course: 'PHY121' }, t2)).body.decision, 'deny'); w.close(); w2.close();
});
test('the tower shows floors without names or schools', async () => {
  const w = await boot(); await signup(w, 'alice1', { schoolId: 'secret-uni' }); const t = await w.call('GET', '/tower');
  assert.equal(t.body.students, 1); assert.ok(!JSON.stringify(t.body).includes('secret-uni')); assert.ok(!JSON.stringify(t.body).includes('alice1')); w.close();
});
