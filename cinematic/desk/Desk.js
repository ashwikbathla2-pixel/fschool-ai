// The Desk: 2D whiteboard tutor wrapper (PRD section 8). No three.js. mount(host, ctx) per app/contract.js; also runs standalone.
// Pure helpers are exported (and tested in desk.test.mjs); DOM work only happens inside mount().
import { loadProfile, loadEvents, recordEvent, RULES } from '../app/contract.js';
import { climbScore } from '../studyworld/engine.js';
import { skinFor, portraitSvg } from './deskSkin.js';
import { CONFIG, LESSON, isCorrect, nextMastery, masteryFill, createActiveClock, createStrokeCounter, keypointEvent, blockEvent, summarize, planBlock } from './deskLogic.js';

export * from './deskLogic.js';

const prefersReduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches || new URLSearchParams(location.search).get('motion') === 'reduce'; } catch { return false; } };
const fmt = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };

// ---- mount ---------------------------------------------------------------------------------------------------------------------
// ctx (all optional): { profile, nav, now, blockMinutes }. Returns { dispose() }.
export function mount(host, ctx = {}) {
  const profile = ctx.profile || loadProfile();   // none saved: planBlock/skinFor fall back to the Studio theme
  const plan = planBlock(profile);
  const skin = skinFor(plan.theme, plan.course);
  const now = ctx.now || (() => Date.now());
  const blockMinutes = ctx.blockMinutes || plan.minutes;
  const blockId = `${now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const reduce = prefersReduced();
  const climbBefore = climbScore(loadEvents(), 'me', now());

  const masteries = {}, missed = {}, recorded = new Set(), results = {};
  const clock = createActiveClock(), strokes = createStrokeCounter();
  const startedAt = now();
  let finished = false, checkResult = null, disposed = false, tickTimer = null;
  const checkShown = {};   // secondsPerCheck: when a question was put in front of the student
  const pasted = {};

  host.innerHTML = '';
  const root = document.createElement('div');
  root.className = 'desk'; root.style.setProperty('--accent', skin.accent); root.dataset.theme = skin.theme; root.classList.toggle('reduce', reduce);
  root.innerHTML = `
    <header class="desk-top">
      <div class="desk-id"><span class="portrait" aria-hidden="true">${portraitSvg(skin)}</span>
        <div><p class="eyebrow">${skin.label} desk</p><h1 class="course">${skin.courseLabel}</h1>
        <p class="plan">Today: ${blockMinutes} minute block on ${plan.course}</p></div></div>
      <div class="timer" role="timer" aria-label="Block time left"><span class="t" id="t">${fmt(blockMinutes * 60000)}</span><span class="tl">left, active time</span></div>
    </header>
    <p class="hint"><strong>${skin.greet}</strong> ${skin.hint}</p>
    <div class="grid">
      <aside class="rail" aria-label="Class Keypoints">
        <h2>Class Keypoints</h2>
        <div class="bar" role="progressbar" aria-label="${skin.progressName}" aria-valuemin="0" aria-valuemax="${LESSON.keypoints.length}" aria-valuenow="0"><i id="fill"></i></div>
        <p class="pname"><span id="pname">${skin.progressName}</span> <b id="pcount">0 / ${LESSON.keypoints.length}</b> ${skin.unit}</p>
        <ol class="kps" id="kps"></ol>
      </aside>
      <main class="board">
        <h2>${LESSON.title}</h2>
        <ul class="notes">${LESSON.notes.map(n => `<li>${n}</li>`).join('')}</ul>
        <div class="canvaswrap"><canvas id="cv" aria-label="Whiteboard. Draw with a pointer or finger." role="img"></canvas>
          <div class="tools"><button type="button" id="clear" aria-label="Clear whiteboard">Clear</button><span class="acts" id="acts">0 canvas actions</span></div></div>
        <section class="check" aria-labelledby="cq"><h3 id="cq">Quick check</h3><p>${LESSON.check.q}</p>
          <form id="cf"><label class="sr" for="ca">Your answer</label><input id="ca" inputmode="decimal" autocomplete="off" placeholder="Type your answer" />
          <button type="submit" class="primary" id="cb">Check answer</button></form><p class="res" id="cres" role="status"></p></section>
      </main>
    </div>
    <footer class="desk-foot"><button type="button" class="primary" id="finish">Finish block</button><span class="note" id="note" role="status"></span></footer>
    <div class="summary" id="sum" hidden role="dialog" aria-modal="true" aria-labelledby="sumh"></div>`;
  host.appendChild(root);
  const $ = id => root.querySelector('#' + id);

  // ---- rail ----
  const kps = $('kps');
  LESSON.keypoints.forEach(k => {
    const li = document.createElement('li'); li.dataset.kp = k.id;
    li.innerHTML = `<div class="kp-h"><span class="dot" aria-hidden="true"></span><span class="kp-t">${k.title}</span><span class="kp-s" data-s></span></div>
      <details><summary>Check yourself</summary><p>${k.q}</p>
      <form><label class="sr" for="a-${k.id}">Answer for ${k.title}</label><input id="a-${k.id}" inputmode="decimal" autocomplete="off" placeholder="Answer" />
      <button type="submit">Submit</button></form><p class="res" role="status"></p></details>`;
    kps.appendChild(li);
    const input = li.querySelector('input');
    li.querySelector('details').addEventListener('toggle', e => { if (e.target.open && checkShown[k.id] == null) checkShown[k.id] = now(); });
    input.addEventListener('paste', () => { pasted[k.id] = true; });
    li.querySelector('form').addEventListener('submit', e => { e.preventDefault(); answerKeypoint(k, li, input.value); });
  });

  function renderRail(tickId) {
    const f = masteryFill(LESSON.keypoints, masteries);
    $('fill').style.width = `${Math.round(f.fraction * 100)}%`;
    $('pcount').textContent = `${f.mastered} / ${f.total}`;
    root.querySelector('.bar').setAttribute('aria-valuenow', f.mastered);
    LESSON.keypoints.forEach(k => { const li = kps.querySelector(`[data-kp="${k.id}"]`); li.classList.toggle('done', (masteries[k.id] ?? 0) >= RULES.masteredAt); });
    if (tickId && !reduce) {   // elevator tick: the dot rises a few pixels and settles, same family as the tower motion
      const dot = kps.querySelector(`[data-kp="${tickId}"] .dot`);
      dot.classList.remove('tick'); void dot.offsetWidth; dot.classList.add('tick');
    }
  }

  function answerKeypoint(k, li, typed) {
    if (finished || (masteries[k.id] ?? 0) >= RULES.masteredAt) return;
    if (checkShown[k.id] == null) checkShown[k.id] = startedAt;
    const ok = isCorrect(typed, k.answer);
    masteries[k.id] = nextMastery(masteries[k.id] ?? 0, ok, !!missed[k.id]);
    if (!ok) missed[k.id] = true;
    const res = li.querySelector('.res');
    if (!ok) { res.textContent = 'Not quite. Look at the notes and try again.'; renderRail(); return; }
    renderRail(masteries[k.id] >= RULES.masteredAt ? k.id : null);
    if (masteries[k.id] < RULES.masteredAt) { res.textContent = 'Right, but you missed once. One clean answer next time and it counts as mastered.'; return; }
    // Mastered: one event, once.
    const spc = (now() - checkShown[k.id]) / 1000;
    const key = 'kp:' + k.id;
    if (!recorded.has(key)) {
      recorded.add(key);
      const r = recordEvent(keypointEvent({ blockId, kp: k, course: plan.course, mastery: masteries[k.id], secondsPerCheck: spc, pastedAi: pasted[k.id], ts: now() }));
      results[k.id] = r.event;
      li.querySelector('[data-s]').textContent = r.event.verified ? 'Verified' : 'Not counted';
      res.textContent = r.event.verified ? 'Mastered. This counts toward your climb.' : `Mastered, but not counted: ${r.event.reason}.`;
    }
  }

  // ---- timer (active time only; hidden tab pauses) ----
  const onVis = () => { if (finished) return; document.hidden ? clock.pause(now()) : clock.start(now()); };
  document.addEventListener('visibilitychange', onVis);
  addEventListener('pagehide', onVis);
  if (!document.hidden) clock.start(now());
  const paint = () => { $('t').textContent = fmt(blockMinutes * 60000 - clock.read(now())); };
  tickTimer = setInterval(() => { if (!finished) { paint(); if (clock.read(now()) >= blockMinutes * 60000) $('note').textContent = 'Block time is up. Finish when you are ready.'; } }, 500);

  // ---- canvas whiteboard ----
  const cv = $('cv'), g = cv.getContext('2d');
  function fit() {
    const r = cv.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(r.width * d)), h = Math.max(1, Math.round(r.height * d));
    if (cv.width === w && cv.height === h) return;
    const keep = cv.width ? g.getImageData(0, 0, cv.width, cv.height) : null;
    cv.width = w; cv.height = h; g.lineWidth = 2.5 * d; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#2b2b2f';
    if (keep) g.putImageData(keep, 0, 0);
  }
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null; ro?.observe(cv); fit();
  let drawing = false;
  const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height]; };
  cv.addEventListener('pointerdown', e => { drawing = true; cv.setPointerCapture?.(e.pointerId); const [x, y] = pos(e); g.beginPath(); g.moveTo(x, y); strokes.down(); });
  cv.addEventListener('pointermove', e => { if (!drawing) return; const [x, y] = pos(e); g.lineTo(x, y); g.stroke(); strokes.move(); });
  const end = () => { if (!drawing) return; drawing = false; strokes.up(); $('acts').textContent = `${strokes.count} canvas action${strokes.count === 1 ? '' : 's'}`; };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  $('clear').addEventListener('click', () => g.clearRect(0, 0, cv.width, cv.height));

  // ---- quick check (block level) ----
  const ca = $('ca'); let checkStart = null;
  ca.addEventListener('focus', () => { if (checkStart == null) checkStart = now(); });
  ca.addEventListener('paste', () => { pasted.check = true; });
  $('cf').addEventListener('submit', e => {
    e.preventDefault(); if (finished || checkResult) return;
    if (checkStart == null) checkStart = startedAt;
    const ok = isCorrect(ca.value, LESSON.check.answer);
    checkResult = { score: ok ? 1 : 0, secondsPerCheck: (now() - checkStart) / 1000 };
    $('cres').textContent = ok ? 'Correct.' : `Not this time. The answer is ${LESSON.check.answer}.`;
    $('cb').disabled = true; ca.readOnly = true;
  });

  // ---- finish: one block event, then the exit summary ----
  $('finish').addEventListener('click', () => {
    if (finished) return;
    finished = true; clock.pause(now()); paint();
    const ev = recordEvent(blockEvent({
      blockId, course: plan.course, ts: now(), minutes: blockMinutes, activeMs: clock.read(now()),
      checkScore: checkResult ? checkResult.score : null, canvasActions: strokes.count,
      secondsPerCheck: checkResult?.secondsPerCheck ?? null, pastedAi: !!pasted.check,
    }), now()).event;
    const f = masteryFill(LESSON.keypoints, masteries);
    const s = summarize({ blockResult: ev, keypointsMastered: f.mastered, keypointsTotal: f.total, climbBefore, climbAfter: climbScore(loadEvents(), 'me', now()) });
    showSummary(s);
  });

  function showSummary(s) {
    const box = $('sum'); box.hidden = false;
    const sign = s.climbGained > 0 ? '+' : '';
    box.innerHTML = `<div class="card"><h2 id="sumh">Block finished</h2>
      <p class="why ${s.blockVerified ? 'ok' : 'no'}">${s.blockVerified ? 'This block is verified and counts toward your climb.' : `This block was not counted: ${s.blockReason}.`}</p>
      <dl><div><dt>Keypoints mastered</dt><dd>${s.keypointsMastered} of ${s.keypointsTotal}</dd></div>
      <div><dt>Climb gained</dt><dd>${sign}${s.climbGained} <small>(${s.climbBefore} to ${s.climbAfter})</small></dd></div></dl>
      <button type="button" class="primary" id="exit">${ctx.nav ? 'Back to the room' : 'Start another block'}</button></div>`;
    const b = box.querySelector('#exit'); b.focus();
    b.addEventListener('click', () => { if (ctx.nav) ctx.nav.go('room'); else { dispose(); mount(host, ctx); } });
  }

  renderRail();
  function dispose() {
    if (disposed) return; disposed = true;
    clearInterval(tickTimer); ro?.disconnect();
    document.removeEventListener('visibilitychange', onVis); removeEventListener('pagehide', onVis);
    host.innerHTML = '';
  }
  return { dispose, _state: () => ({ masteries, recorded: [...recorded], results, strokes: strokes.count, activeMs: clock.read(now()) }) };
}
