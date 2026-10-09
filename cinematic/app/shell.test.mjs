import assert from 'node:assert/strict';
import { clampMove, direction, resolveRoute, historyChain, popTarget, keepAlive, backTarget, CONFIG } from './shell.js';
import { streakDays, myPlacement, roomInfo, clampView, toWorld, toScreen, zoomAt, fitScale, CONFIG as TC } from './towerAdapter.js';
import { makeTower } from '../tower/towerData.js';
import { makeNav } from './contract.js';

// route resolution
assert.deepEqual(resolveRoute({ search: '', profile: null }), { kind: 'interview', url: CONFIG.interviewUrl }, 'first visit -> lobby');
assert.deepEqual(resolveRoute({ search: '', profile: {} }), { kind: 'open', level: 'room', deepLink: false }, 'then your room');
assert.equal(resolveRoute({ search: '?level=tower', profile: {} }).level, 'tower');
assert.equal(resolveRoute({ search: '?level=desk', profile: null }).kind, 'open', 'desk deep link works alone, no lobby');
assert.equal(resolveRoute({ search: '?level=room', profile: null }).kind, 'interview');
assert.equal(resolveRoute({ search: '?level=bogus', profile: {} }).level, 'room', 'unknown level falls back');

// one level at a time
assert.equal(clampMove('tower', 'desk'), 'room');
assert.equal(clampMove('desk', 'tower'), 'room');
assert.equal(clampMove('room', 'desk'), 'desk');
assert.equal(clampMove('room', 'room'), 'room');
assert.equal(clampMove('room', 'nope'), 'room');
assert.equal(direction('room', 'desk'), 'in'); assert.equal(direction('desk', 'room'), 'out'); assert.equal(direction('room', 'room'), 'none');
assert.equal(backTarget('desk'), 'room'); assert.equal(backTarget('room'), 'tower'); assert.equal(backTarget('tower'), null);

// browser Back: history is seeded with ancestors; a pop never jumps more than one level
assert.deepEqual(historyChain('desk'), ['tower', 'room', 'desk']);
assert.deepEqual(historyChain('tower'), ['tower']);
assert.equal(popTarget('desk', 'room'), 'room');
assert.equal(popTarget('desk', 'tower'), 'room', 'a long pop is clamped to one level');
assert.equal(popTarget('tower', 'desk'), 'room');
assert.equal(popTarget('room', undefined), 'tower', 'foreign entry: go up one');
assert.equal(popTarget('tower', undefined), 'tower');

// room stays alive under the desk only
assert.equal(keepAlive('room', 'desk'), true);
assert.equal(keepAlive('room', 'tower'), false);
assert.equal(keepAlive('desk', 'room'), false);
assert.equal(keepAlive('room', 'desk', { keepRoomAlive: false }), false);

// nav from the contract walks the levels with back()
const seen = []; const nav = makeNav((n, p) => seen.push(p + '>' + n));
nav.go('tower'); nav.go('room'); nav.go('desk'); nav.back(); nav.back(); nav.back();
assert.deepEqual(seen, ['room>tower', 'tower>room', 'room>desk', 'desk>room', 'room>tower'], 'back at the tower does nothing');

// tower adapter
const DAY = 864e5, now = Date.UTC(2026, 9, 8, 12);
const ev = d => ({ verified: true, studentId: 'me', ts: now - d * DAY });
assert.equal(streakDays([ev(0), ev(1), ev(2)], 'me', now), 3);
assert.equal(streakDays([ev(1), ev(2)], 'me', now), 2, 'today not over yet');
assert.equal(streakDays([ev(0), ev(2)], 'me', now), 1);
assert.equal(streakDays([{ ...ev(0), verified: false }], 'me', now), 0);
assert.equal(streakDays([], 'me', now), 0);

const t = makeTower({ rooms: 10000, cols: 25, seed: 7 });
const rowOf = i => Math.floor(i / t.cols);
assert.equal(rowOf(myPlacement(t, 0)), 0); assert.equal(rowOf(myPlacement(t, TC.climbForTopFloor)), t.rows - 1);
assert.ok(rowOf(myPlacement(t, 999999)) <= t.rows - 1);
assert.ok(rowOf(myPlacement(t, 50)) > rowOf(myPlacement(t, 10)), 'more climb, higher floor');

const a = roomInfo(t, 1234), b = roomInfo(t, 1234);
assert.deepEqual(a, b, 'deterministic');
assert.equal(a.floor, rowOf(1234) + 1);
assert.ok(a.name && a.dream && Number.isInteger(a.streak) && a.studying);
assert.equal(roomInfo(t, -1), null); assert.equal(roomInfo(t, 10000), null);
const mine = roomInfo(t, 7, { me: 7, mine: { name: 'You', dream: 'Pilot', streak: 4, studying: 'Physics' } });
assert.equal(mine.isMe, true); assert.equal(mine.dream, 'Pilot');
const hid = roomInfo(t, 9, { hidden: new Set([9]) });
assert.equal(hid.hidden, true); assert.equal(hid.name, undefined, 'hidden rooms leak nothing');
for (const i of [0, 500, 9999]) assert.ok(!/school|college|university/i.test(JSON.stringify(roomInfo(t, i))), 'no schools');

// view maths
const W = 800, H = 600, v0 = { cx: 0, cy: t.height / 2, s: fitScale(t, W, H) };
const v1 = clampView({ cx: 1e6, cy: -1e6, s: 1e6 }, t, W, H);
assert.ok(v1.s <= TC.maxZoomPx); assert.ok(v1.cy >= H / 2 / v1.s - 1e-9); assert.ok(v1.cx <= t.width / 2);
const p = toScreen(v0, W, H, 3, 40), w = toWorld(v0, W, H, p.x, p.y);
assert.ok(Math.abs(w.x - 3) < 1e-9 && Math.abs(w.y - 40) < 1e-9, 'screen/world round trip');
const z = zoomAt(v0, 2, 123, 456, W, H), before = toWorld(v0, W, H, 123, 456), after = toWorld(z, W, H, 123, 456);
assert.ok(Math.abs(before.x - after.x) < 1e-9 && Math.abs(before.y - after.y) < 1e-9, 'zoom keeps the point under the finger');
console.log('shell.test.mjs ok');
