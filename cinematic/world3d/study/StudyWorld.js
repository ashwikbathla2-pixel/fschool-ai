// Study world: the cutaway tower of rooms. Browse neighbours, open "My room", start a focus session. Owner: Phyllis.
// createStudyWorld(host, { career, night, config }) -> { dispose }
import * as THREE from 'three';
import { createStage, createDollhouse } from '../Dollhouse.js';
import { createStudyRoom, themeFor } from './StudyRoom.js';
import { createPet, PET } from './Pet.js';
import { createReggie } from './Reggie.js';
import { mountInvitePanel } from './InvitePanel.js';
import { FocusTimer, loadStats } from './FocusTimer.js';
import { reducedMotion } from '../../quality.js';
import { createPresence, formatCode, MESSAGES } from './Presence.js';

export const CONFIG = {
  totalFloors: 40, myFloor: 12, cols: 5, focusMin: 25, breakMin: 5, petName: 'Reggie', myCell: 7,
  neighbours: [   // mock data: name, room type, minutes studied today, studying now?
    ['Aanya', 'biology', 95, true], ['Marcus', 'computer', 140, true], ['Lena', 'art', 40, false], ['Sam', 'physics', 60, true], ['Priya', 'medical', 120, true],
    ['Jonas', 'engineering', 0, false], ['Mei', 'design', 75, true], ['Omar', 'math', 30, false], ['Chloe', 'humanities', 55, true], ['Diego', 'sports', 20, false],
    ['Ines', 'astronomy', 110, true], ['Noah', 'business', 45, true], ['Zoe', 'chemistry', 85, true], ['Ravi', 'research', 150, true]
  ]
};

const CSS = `
.sw{position:absolute;inset:0;overflow:hidden;font-family:Inter,system-ui,sans-serif;color:#26231f;--sw-navy:#1f3350;--sw-cream:#f6efe3;--sw-wood:#a67c52;touch-action:none}
.sw canvas{cursor:grab}.sw.drag canvas{cursor:grabbing}
.sw button{font:600 .95rem Inter,system-ui,sans-serif;min-height:44px;padding:0 20px;border-radius:999px;border:1.5px solid var(--sw-navy);background:rgba(246,239,227,.94);color:var(--sw-navy);cursor:pointer;transition:transform .2s,background .2s}
.sw button:hover{transform:translateY(-1px);background:#fff}.sw button.primary{background:var(--sw-navy);color:var(--sw-cream)}.sw button.primary:hover{background:#2a4468}
.sw :focus-visible{outline:3px solid #a67c52;outline-offset:3px}
.sw-chip{position:absolute;left:16px;top:16px;padding:10px 16px;border-radius:999px;background:rgba(246,239,227,.94);border:1.5px solid rgba(31,51,80,.3);font-weight:600;font-size:.9rem;color:var(--sw-navy)}
.sw-chip small{display:block;font-weight:400;opacity:.8;font-size:.75rem}
.sw-top{position:absolute;right:16px;top:12px;display:flex;gap:8px}
.sw-zoom{position:absolute;right:16px;bottom:16px;display:flex;flex-direction:column;gap:8px}.sw-zoom button{width:44px;padding:0;font-size:1.3rem}
.sw-tip{position:absolute;pointer-events:none;padding:6px 12px;border-radius:8px;background:var(--sw-navy);color:var(--sw-cream);font-size:.8rem;opacity:0;transform:translate(-50%,-130%);transition:opacity .15s;white-space:nowrap}.sw-tip.on{opacity:1}
.sw-card{position:absolute;left:50%;bottom:20px;transform:translate(-50%,20px);width:min(420px,calc(100% - 32px));padding:20px 22px;border-radius:14px;background:rgba(251,247,239,.96);border:1.5px solid rgba(31,51,80,.28);box-shadow:0 18px 50px rgba(20,24,32,.25);opacity:0;pointer-events:none;transition:opacity .5s,transform .6s cubic-bezier(.2,.7,.2,1)}
.sw-card.on{opacity:1;transform:translate(-50%,0);pointer-events:auto}
.sw-card h2{margin:0 0 4px;font:500 1.5rem 'Iowan Old Style','Palatino Linotype',Georgia,serif;color:var(--sw-navy)}.sw-card p{margin:0 0 14px;color:#5b5348;line-height:1.45;font-size:.92rem}
.sw-row{display:flex;gap:10px;flex-wrap:wrap}
.sw-hud{text-align:center}.sw-time{font:500 3.4rem/1 'Iowan Old Style','Palatino Linotype',Georgia,serif;color:var(--sw-navy);letter-spacing:.02em;margin:2px 0 6px}
.sw-bar{height:5px;border-radius:5px;background:rgba(31,51,80,.15);margin:8px 0 14px;overflow:hidden}.sw-bar i{display:block;height:100%;width:0;background:var(--sw-wood);transition:width .4s linear}
.sw-hud .sw-row{justify-content:center}
.sw-pet{position:absolute;left:16px;bottom:20px;padding:8px 14px;border-radius:12px;background:rgba(246,239,227,.94);border:1.5px solid rgba(31,51,80,.25);font-size:.82rem;color:var(--sw-navy);opacity:0;transition:opacity .4s}.sw-pet.on{opacity:1}.sw-pet b{display:block;font-size:.95rem}.sw-pet{display:flex;gap:10px;align-items:center}.sw-pet img{border-radius:8px;object-fit:cover}
.sw-stats{font-size:.82rem;color:var(--sw-navy);font-weight:600}
.sw-code{font:600 2rem/1.1 ui-monospace,Menlo,Consolas,monospace;letter-spacing:.18em;color:var(--sw-navy);margin:2px 0 12px}
.sw-field{width:100%;box-sizing:border-box;min-height:44px;border-radius:10px;border:1.5px solid rgba(31,51,80,.4);background:#fff;padding:0 14px;font:600 1.1rem ui-monospace,Menlo,Consolas,monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--sw-navy);margin-bottom:10px}
.sw-field.name{font:500 .95rem Inter,sans-serif;letter-spacing:0;text-transform:none}
.sw-err{color:#a3322b;font-size:.85rem;min-height:1.2em;margin:0 0 8px}
.sw-toast{position:absolute;left:50%;top:76px;transform:translate(-50%,-8px);padding:10px 20px;border-radius:999px;background:rgba(31,51,80,.94);color:var(--sw-cream);font-weight:500;opacity:0;transition:opacity .6s,transform .6s;pointer-events:none}.sw-toast.on{opacity:1;transform:translate(-50%,0)}
.sw-friends{font-size:.8rem;color:#5b5348;margin:0 0 10px}
.sw-live{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
@media (max-width:640px){.sw-card{bottom:12px}.sw-pet{bottom:auto;top:64px}.sw-zoom{bottom:auto;top:64px;right:12px}.sw-time{font-size:2.8rem}.sw-top button{padding:0 14px}}
@media (prefers-reduced-motion:reduce){.sw-card,.sw-bar i,.sw button{transition:none}}`;

const ease = t => t * t * (3 - 2 * t);
const fmt = n => n.toLocaleString('en-US');

export async function createStudyWorld(host, { career = 'default', night = false, config = {}, speed = 1, intro = false, line = '', onReady, presence } = {}) {
  const C = { ...CONFIG, ...config };
  if (!document.getElementById('sw-style')) { const s = document.createElement('style'); s.id = 'sw-style'; s.textContent = CSS; document.head.appendChild(s); }
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
  const ui = document.createElement('div'); ui.className = 'sw';
  ui.innerHTML = `
    <div class="sw-chip" id="sw-floor" aria-label="Current floor"></div>
    <div class="sw-top"><button type="button" id="sw-back" hidden>Back to the tower</button><button type="button" id="sw-mine" class="primary">My room</button></div>
    <div class="sw-zoom" role="group" aria-label="Zoom"><button type="button" id="sw-in" aria-label="Zoom in">+</button><button type="button" id="sw-out" aria-label="Zoom out">&minus;</button></div>
    <div class="sw-tip" id="sw-tip" role="presentation"></div>
    <div class="sw-pet" id="sw-pet"></div>
    <div class="sw-toast" id="sw-toast" role="status"></div>
    <section class="sw-card" id="sw-card" aria-live="polite"></section>
    <div class="sw-live" id="sw-live" role="status" aria-live="polite"></div>`;
  host.appendChild(ui);
  const $ = id => ui.querySelector('#' + id);

  const stage = createStage(host); stage.canvas.style.touchAction = 'none';
  host.appendChild(ui);                                            // keep UI above the canvas
  const low = (await import('../../quality.js')).quality.tier === 'low';
  const theme = themeFor(career);
  const mine = createStudyRoom(theme, { night });
  const nbAll = C.neighbours.slice(0, low ? 8 : C.neighbours.length).map(n => ({ name: n[0], type: n[1], minutes: n[2], live: n[3], friend: false }));
  let peers = [], entries = [], house, cellOf, mineCell, mineIdx = 0, hasView = false;
  const R = reducedMotion;
  const info = i => entries[i];
  const rowH = 4.7 * .8;
  function buildHouse() {
    house?.dispose();
    const friends = peers.map(p => ({ name: p.name, type: p.type || 'blank', minutes: p.minutesToday, live: p.status === 'studying', friend: true }));
    const others = nbAll.slice(0, Math.max(3, nbAll.length - friends.length));
    const at = Math.min(C.myCell, others.length);
    entries = [...others.slice(0, at), { name: 'You', mine: true }, ...friends, ...others.slice(at)];
    mineIdx = at;
    const rooms = entries.map(e => (e.mine ? mine.group : e.type));
    house = createDollhouse(stage, { rooms, cols: C.cols, labels: entries.map(e => (e.mine ? 'My room' : e.name)) });
    house.dimAll(); entries.forEach((e, i) => { if (e.mine || e.live) house.setLit(i, true); }); house.cells.forEach(c => { c.show = false; });
    cellOf = house.cells; mineCell = cellOf[mineIdx];
    if (hasView) { applyLight(); mineCell.room.add(pet.object); if (student) mineCell.room.add(student.object); }
  }

  let student = null;
  // Reggie (the FSchool pet) is the default. ?pet=pip or ?pet=file.glb (or PET.model) selects the swappable placeholder in Pet.js.
  const petQ = new URLSearchParams(location.search).get('pet');
  const reggie = !(petQ === 'pip' || (petQ && /\.glb$/i.test(petQ)) || PET.model);
  const pet = reggie ? createReggie({ name: C.petName }) : createPet({ name: PET.name });
  const petImg = reggie ? new URL('../../assets/reggie.png', import.meta.url).href : '';
  buildHouse();

  /* ---------- camera ---------- */
  const cam = stage.camera, view = { x: 0, y: 0, d: 20 };
  const fov = () => cam.fov * Math.PI / 180;
  const fit = (w, h) => Math.max(h / 2 / Math.tan(fov() / 2), w / 2 / (Math.tan(fov() / 2) * cam.aspect)) * 1.12;
  const roomView = c => ({ x: c.x, y: c.y + 1.0, d: fit(4.6, 3.6) * 1.1 });
  const W = C.cols * 4.7;
  const towerView = () => { const ys = cellOf.map(c => c.y); const cy = (Math.min(...ys) + Math.max(...ys)) / 2 + 1.5; return { x: 0, y: cy, d: Math.min(fit(W * .62, 3.76 * 3.2 + 3), 34) }; };
  let tween = null;
  const go = (to, dur = 1.6) => new Promise(res => {
    tween?.res(); const from = { ...view };
    if (R || dur <= 0) { Object.assign(view, to); return res(); }
    tween = { t: 0, t0: performance.now(), from, to, dur, res };
  });
  function applyCam() { cam.position.set(view.x, view.y + view.d * .1, view.d); cam.lookAt(view.x, view.y, 0); }
  Object.assign(view, towerView()); applyCam();

  /* ---------- lighting / night ---------- */
  const L = { v: night ? .55 : 1, target: night ? .55 : 1 };
  const bgDay = new THREE.Color('#ece3d2'), bgNight = new THREE.Color('#1c2331');
  const applyLight = () => {
    const k = L.v; house.lights.hemi.intensity = 1.05 * k; house.lights.sun.intensity = 1.35 * k; house.lights.rim.intensity = .55 * k;
    stage.scene.background.copy(bgNight).lerp(bgDay, Math.min(1, (k - .3) / .7));
    mine.lampLight.intensity = (1 - k) * 9;
    mine.screens.forEach(m => { m.emissiveIntensity = .55 + (1 - k) * 1.3; });
  };
  applyLight();

  /* ---------- character + pet in my room ---------- */
  pet.object.position.set(mine.petHome.x, 0, mine.petHome.z + .9); pet.setHome(mine.petHome.x, mine.petHome.z, .6);
  mineCell.room.add(pet.object);
  (async () => {
    try {
      const { loadKit, createStudent } = await import('../Characters.js'); const kit = await loadKit();
      student = createStudent(kit, { variant: 3, pose: 'sit' }); student.object.position.set(mine.seat.x, 0, mine.seat.z); student.object.rotation.y = Math.PI; mineCell.room.add(student.object);
    } catch (e) { console.warn('[study] character unavailable', e); }
  })();

  /* ---------- timer + progress ---------- */
  const timer = new FocusTimer({ focusMin: C.focusMin, breakMin: C.breakMin, speed, onChange: st => onTimer(st) });
  timer.onComplete = () => { pet.setState('happy'); say(`Focus session complete. ${C.focusMin} minutes saved.`); drawCard(); };
  const say = t => { $('sw-live').textContent = t; };
  const statsLine = () => { const s = loadStats(); return `${s.today.minutes} min today · ${s.streak} day streak · ${fmt(s.totalMinutes)} min total`; };

  /* ---------- modes: tower | neighbour | mine | study ---------- */
  let mode = 'tower', selected = -1, sheet = null, sheetErr = '';
  const NAME_KEY = 'fschool.study.name';
  const myName = () => { try { let n = localStorage.getItem(NAME_KEY); if (!n) { n = 'Student ' + (10 + Math.floor(Math.random() * 90)); localStorage.setItem(NAME_KEY, n); } return n; } catch { return 'Student'; } };
  const pres = presence || createPresence();
  let panel = null;
  const card = $('sw-card');
  const setCard = html => { card.innerHTML = html; card.classList.add('on'); };
  const hideCard = () => card.classList.remove('on');
  function drawCard() {
    if (mode === 'neighbour') {
      const n = info(selected);
      setCard(`<h2>${n.name}'s room</h2><p>${n.live ? 'Studying now' : 'Away'} · ${n.minutes} min today</p><div class="sw-row"><button type="button" class="primary" data-a="back">Back to the tower</button></div>`);
    } else if (mode === 'mine' && sheet === 'friends') {
      setCard(`<h2>Study with friends</h2><div id="sw-friends-host"></div><div class="sw-row" style="margin-top:12px"><button type="button" class="primary" data-a="sheet-close">Done</button></div>`);
      panel?.destroy(); panel = mountInvitePanel(card.querySelector('#sw-friends-host'), pres);
    } else if (mode === 'mine') {
      setCard(`<h2>${theme.label}</h2><p class="sw-stats">${statsLine()}</p>${pres.code ? `<p class="sw-friends">Room ${formatCode(pres.code)} · ${peers.length} friend${peers.length === 1 ? '' : 's'} here</p>` : ''}<div class="sw-row"><button type="button" class="primary" data-a="start">Start studying</button><button type="button" data-a="friends">Friends</button><button type="button" data-a="back">Back to the tower</button></div>`);
    } else if (mode === 'study') {
      const s = timer.state, brk = s === 'break' || (s === 'paused' && timer.resumeFrom === 'break');
      setCard(`<div class="sw-hud"><p style="margin:0">${s === 'paused' ? 'Paused' : brk ? 'Break' : 'Focus session'}</p><div class="sw-time" role="timer" aria-label="Time remaining" id="sw-time">${timer.label}</div><div class="sw-bar"><i id="sw-bar"></i></div><div class="sw-row">${s === 'paused' ? '<button type="button" class="primary" data-a="resume">Resume</button>' : '<button type="button" data-a="pause">Pause</button>'}<button type="button" data-a="end">End session</button></div></div>`);
    } else hideCard();
    card.querySelector('button')?.focus?.({ preventScroll: true });
    const m = $('sw-mine'), b = $('sw-back'); m.hidden = mode === 'mine' || mode === 'study' || mode === 'intro'; b.hidden = mode === 'tower' || mode === 'intro';
    pet$();
  }
  const pet$ = () => { const p = $('sw-pet'); p.classList.toggle('on', mode === 'mine' || mode === 'study'); p.innerHTML = `${petImg ? `<img src="${petImg}" alt="" width="32" height="32">` : ''}<span><b>${pet.name}</b>${pet.mood}</span>`; };
  pet.onMood = pet$;

  async function toTower() {
    mode = 'tower'; selected = -1; setLightTarget(night ? .55 : 1); timerPauseOnLeave(); drawCard(); say('Back at the tower.'); student?.play('sit');
    await go(towerView(), 1.6);
  }
  async function toRoom(i) {
    selected = i; mode = i === mineIdx ? 'mine' : 'neighbour'; setLightTarget(night ? .55 : 1);
    drawCard(); say(i === mineIdx ? 'Your study room.' : `${info(i).name}'s room.`);
    if (i === mineIdx) { pet.setState('idle'); pet.setHome(mine.petHome.x, mine.petHome.z, .6); }
    await go(roomView(cellOf[i]), 1.6);
  }
  async function startStudy() {
    mode = 'study'; sheet = null; pushStatus(); timer.start(); setLightTarget(.38); student?.play('type'); pet.setState('focus'); pet.setHome(mine.petHome.x + .35, mine.petHome.z - .55, .3);
    drawCard(); say('Focus session started.');
    await go({ x: mineCell.x, y: mineCell.y + 1.25, d: 4.3 }, 1.8);
  }
  function timerPauseOnLeave() { if (timer.state === 'focus') timer.end(); else if (timer.state !== 'idle') timer.end(); }
  const setLightTarget = v => { L.target = v; };
  function onTimer(st) {
    if (mode !== 'study') return;
    if (st === 'break') { student?.play('sit'); pet.setState('happy'); drawCard(); }
    else if (st === 'idle') { student?.play('sit'); pet.setState('idle'); mode = 'mine'; setLightTarget(night ? .55 : 1); drawCard(); go(roomView(mineCell), 1.4); }
    else if (st === 'paused') { student?.play('sit'); drawCard(); }
    else if (st === 'focus') { student?.play('type'); pet.setState('focus'); drawCard(); }
  }
  const toast = t => { const el = $('sw-toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), 2600); say(t); };
  const roomTypeOf = { doctor: 'biology', engineer: 'engineering', software: 'computer', scientist: 'research', entrepreneur: 'business', designer: 'design', artist: 'art', architect: 'design', lawyer: 'humanities', astronaut: 'astronomy' }[career] || 'blank';
  const pushStatus = () => { if (pres.code) pres.setStatus({ name: myName() || 'Student', status: mode === 'study' && timer.state === 'focus' ? 'studying' : 'away', minutesToday: loadStats().today.minutes, type: roomTypeOf }); };
  card.addEventListener('click', e => {
    const a = e.target.closest('button')?.dataset.a; if (!a) return;
    if (a === 'back') toTower(); else if (a === 'start') startStudy(); else if (a === 'pause') timer.pause(); else if (a === 'resume') timer.resume();
    else if (a === 'end') { timer.end(); say('Session ended. Progress saved.'); }
    else if (a === 'friends') { sheet = 'friends'; drawCard(); }
    else if (a === 'sheet-close') { panel?.destroy(); panel = null; sheet = null; drawCard(); }
  });
  $('sw-mine').onclick = () => toRoom(mineIdx);
  $('sw-back').onclick = () => { if (mode === 'study') { timer.end(); } else toTower(); };

  /* ---------- pointer / zoom / keyboard ---------- */
  const cv = stage.canvas, tip = $('sw-tip'); let drag = null, moved = 0, hoverRaf = 0;
  const ndc = e => { const r = cv.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1]; };
  cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; moved = 0; cv.setPointerCapture?.(e.pointerId); });
  cv.addEventListener('pointermove', e => {
    if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y; moved += Math.abs(dx) + Math.abs(dy); drag = { x: e.clientX, y: e.clientY };
      if (mode === 'tower' && moved > 6) { ui.classList.add('drag'); const wpp = 2 * view.d * Math.tan(fov() / 2) / cv.clientHeight; view.x -= dx * wpp; view.y += dy * wpp; clampView(); }
      return;
    }
    if (mode !== 'tower' || hoverRaf) return;
    hoverRaf = requestAnimationFrame(() => {
      hoverRaf = 0; const [nx, ny] = ndc(e), i = house.pick(nx, ny);
      if (i < 0) { tip.classList.remove('on'); return; }
      tip.textContent = i === mineIdx ? 'My room' : `${info(i).name} · ${info(i).live ? 'studying now' : 'away'}`;
      const r = cv.getBoundingClientRect(); tip.style.left = e.clientX - r.left + 'px'; tip.style.top = e.clientY - r.top + 'px'; tip.classList.add('on');
    });
  });
  const endDrag = e => {
    if (!drag) return; const was = moved; drag = null; ui.classList.remove('drag');
    if (was <= 6 && mode === 'tower') { const [nx, ny] = ndc(e), i = house.pick(nx, ny); if (i >= 0) toRoom(i); }
  };
  cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', () => { drag = null; ui.classList.remove('drag'); });
  cv.addEventListener('pointerleave', () => tip.classList.remove('on'));
  const zoom = f => { if (mode !== 'tower') return; view.d = Math.min(Math.max(view.d * f, 9), towerView().d * 1.15); clampView(); };
  cv.addEventListener('wheel', e => { if (mode !== 'tower') return; e.preventDefault(); zoom(Math.exp(e.deltaY * .0012)); }, { passive: false });
  $('sw-in').onclick = () => zoom(.8); $('sw-out').onclick = () => zoom(1.25);
  function clampView() { const t = towerView(); const ys = cellOf.map(c => c.y); view.x = Math.max(-W / 2, Math.min(W / 2, view.x)); view.y = Math.max(Math.min(...ys) + 1, Math.min(Math.max(...ys) + 2, view.y)); }
  const onKey = e => {
    if (mode !== 'tower' || /INPUT|TEXTAREA/.test(document.activeElement?.tagName)) return;
    const step = view.d * .06;
    if (e.key === 'ArrowLeft') view.x -= step; else if (e.key === 'ArrowRight') view.x += step; else if (e.key === 'ArrowUp') view.y += step; else if (e.key === 'ArrowDown') view.y -= step;
    else if (e.key === '+' || e.key === '=') zoom(.85); else if (e.key === '-') zoom(1.18); else return;
    clampView(); e.preventDefault();
  };
  addEventListener('keydown', onKey);
  addEventListener('resize', () => { if (mode === 'tower') Object.assign(view, { d: Math.min(view.d, towerView().d * 1.15) }); });

  /* ---------- frame loop ---------- */
  let lastFloor = -1;
  // tweens are wall-clock based, so slow devices still arrive on time
  const off = stage.addUpdater(dt => {
    if (tween) { tween.t = Math.min(1, (performance.now() - tween.t0) / 1000 / tween.dur); const e = ease(tween.t); for (const k of ['x', 'y', 'd']) view[k] = tween.from[k] + (tween.to[k] - tween.from[k]) * e; if (tween.t >= 1) { const r = tween.res; tween = null; r(); } }
    applyCam();
    if (Math.abs(L.v - L.target) > .002) { L.v += (L.target - L.v) * Math.min(1, dt * 3); applyLight(); }
    timer.update(); student?.update(dt); pet.update(dt);
    if (mode === 'study') { const t = $('sw-time'); if (t) t.textContent = timer.label; const b = $('sw-bar'); if (b) b.style.width = (timer.fraction * 100).toFixed(1) + '%'; }
    const fl = Math.round(C.myFloor + (view.y - (mineCell.y + 1.5)) / rowH);
    if (fl !== lastFloor) { lastFloor = fl; $('sw-floor').innerHTML = `Floor ${fl} of ${C.totalFloors}<small>${entries.filter(n => n.live && !n.mine).length} neighbours studying now</small>`; }
  });
  hasView = true;
  let peerKey = '';
  pres.onPeers(list => {
    const key = JSON.stringify(list.map(p => [p.id, p.type, p.name]));
    peers = list;
    if (key !== peerKey) { peerKey = key; if (mode === 'neighbour') { mode = 'tower'; selected = -1; } buildHouse(); if (mode === 'mine' && !sheet) drawCard(); }
    else entries.forEach((en, i) => { const p = en.friend && peers.find(q => q.name === en.name); if (p) { en.live = p.status === 'studying'; en.minutes = p.minutesToday; house.setLit(i, true); } });
  });
  const beat = setInterval(pushStatus, 4000);
  if (intro) {
    const t = roomView(mineCell); Object.assign(view, { x: t.x - 7, y: t.y - .6, d: t.d * 1.9 }); mode = 'intro'; applyCam();
    if (line) toast(line);
    go(t, R ? 0 : 2.8).then(() => { mode = 'mine'; drawCard(); onReady?.({ career }); });
  }
  drawCard();
  window.__study = { pres, pushStatus, get roomCode() { return pres.code; }, go, view, timer, pet, toRoom, startStudy, toTower, house, mineIdx, get mode() { return mode; } };
  return { stage, house, timer, pet, dispose() { off(); clearInterval(beat); pres.leave?.(); removeEventListener('keydown', onKey); house.dispose(); stage.dispose(); ui.remove(); } };
}
