// Run: node towerData.test.mjs
import assert from 'node:assert/strict';
import { makeTower, roomCentre, roomAt, CELL, WINDOW, THEME_COUNT, ACCENT_COUNT, makeSkyline, skylineLocate, skylineCentre, skylineAt, displayName, searchNames, roomFacts, TOWER_GAP } from './towerData.js';

const t = makeTower({ rooms: 10000, cols: 25, seed: 7 });
assert.equal(t.rows, 400);
assert.equal(t.state.length, 10000);

const again = makeTower({ rooms: 10000, cols: 25, seed: 7 });
assert.deepEqual(t.state, again.state, 'same seed gives the same tower');
assert.notDeepEqual(t.state, makeTower({ rooms: 10000, cols: 25, seed: 8 }).state, 'different seed differs');

for (let i = 0; i < t.rooms; i++) assert.ok(t.tile[i] < THEME_COUNT * ACCENT_COUNT && t.state[i] <= 2 && t.shield[i] <= 3);

const share = s => t.state.filter(v => v === s).length / t.rooms;
assert.ok(share(WINDOW.LIT) > 0.05 && share(WINDOW.LIT) < 0.2, 'a minority of windows are lit');
assert.ok(share(WINDOW.DIM) > 0.4, 'most windows are dim');

// higher floors are more active than lower floors
const lit = (a, b) => t.state.slice(a * t.cols, b * t.cols).filter(v => v === WINDOW.LIT).length;
assert.ok(lit(300, 400) > lit(0, 100), 'the climb shows in the windows');

// cell <-> point round trip, for every room
for (let i = 0; i < t.rooms; i++) { const c = roomCentre(t, i); assert.equal(roomAt(t, c.x, c.y), i); }
assert.equal(roomAt(t, -t.width, 5), -1, 'left of the tower');
assert.equal(roomAt(t, 0, t.height + 1), -1, 'above the tower');
assert.equal(roomAt(t, -t.width / 2 + CELL.w - 0.01, 1), -1, 'inside the gap between rooms');

const odd = makeTower({ rooms: 103, cols: 25 });
assert.equal(odd.rows, 5);
assert.equal(roomAt(odd, odd.width / 2 - 0.5, 4.5 * CELL.h), -1, 'empty cells in the last row are misses');


// ---- skyline
const sky = makeSkyline({ towers: 5, rooms: 10000, cols: 25, seed: 7 });
assert.equal(sky.towers.length, 5); assert.equal(sky.towers[0].t.rooms, 10000);
assert.deepEqual(sky.towers[0].t.state, t.state, 'tower 0 is exactly the single tower');
assert.equal(sky.total, sky.towers.reduce((s, c) => s + c.t.rooms, 0));
assert.ok(sky.towers[1].t.rooms < sky.towers[0].t.rooms && sky.towers[4].t.rooms >= 500, 'smaller campuses, never tiny');
for (let k = 1; k < 5; k++) assert.ok(sky.towers[k].cx - sky.towers[k].t.width / 2 >= sky.towers[k - 1].cx + sky.towers[k - 1].t.width / 2 + TOWER_GAP - 1e-6, 'gap between towers');
assert.ok(Math.abs(sky.towers[0].cx - sky.towers[0].t.width / 2 + sky.width / 2) < 1e-6, 'skyline is centred');
for (const g of [0, 1, 9999, 10000, 12345, sky.total - 1]) { const c = skylineCentre(sky, g); assert.equal(skylineAt(sky, c.x, c.y), g, 'round trip ' + g); }
assert.equal(skylineLocate(sky, sky.total), null); assert.equal(skylineAt(sky, 1e6, 5), -1);
const again2 = makeSkyline({ towers: 5, rooms: 10000, cols: 25, seed: 7 }); assert.deepEqual(again2.towers[3].t.tile, sky.towers[3].t.tile, 'deterministic');
assert.equal(makeSkyline({ towers: 99 }).towers.length, 8, 'at most eight campuses');

// ---- friend search: synthetic names, no real names, stable
assert.equal(displayName(7, 5), displayName(7, 5)); assert.match(displayName(7, 5), /^[A-Z][a-z]+ [A-Z][a-z]+ \d{3}$/);
const sample = new Set(Array.from({ length: 500 }, (_, i) => displayName(7, i))); assert.ok(sample.size > 450, 'names are well spread');
const nm = displayName(sky.towers[2].seed, 77), hit = searchNames(sky, nm);
assert.ok(hit.includes(sky.towers[2].base + 77), 'a full name finds its room'); assert.equal(searchNames(sky, 'q').length, 0, 'one letter is not a search');
assert.ok(searchNames(sky, 'quiet ').every(g => roomFacts(sky, g).name.toLowerCase().startsWith('quiet')), 'prefix matches come first');
const f = roomFacts(sky, 12345); assert.equal(f.synthetic, true); assert.ok(f.floor >= 1 && f.floor <= f.floors); assert.equal(Object.keys(f).includes('realName'), false);

console.log('towerData: all tests passed');
