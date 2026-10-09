// Lobby Interview (PRD section 5). Pure logic is exported at the top (tested in interview.test.mjs); the DOM only exists inside mount().
// Module shape follows app/contract.js: mount(host, ctx) -> { dispose() }, ctx = { nav, onStartBlock, onDone }, all optional.
import { STEPS, HOURS, THEMES, themeFor, buildProfile, saveDraft, loadDraft, clearDraft } from '../studyworld/profile.js';
import { meetLines, offerBlock, roleLabel, greet } from './futureSelf.js';

// proposal: nothing here is a PRD number. The PRD leaves "[X] minutes" for the interview length open, so there is no timer.
export const CONFIG = {
  maxCourses: 12,                       // proposal: sanity cap on typed courses
  roomBuiltKey: 'fschool.interview.roomBuilt.v1',
  portal: { connect: null },            // config slot: async () => ({ ok, courses?, reason? }). null = no portal integration exists yet.
  buildMs: 4200,                        // proposal: length of the skippable room-build moment
};

/* ---------------- pure logic ---------------- */
export function parseCourses(text, max = CONFIG.maxCourses) {
  const seen = new Set(), out = [];
  for (const raw of String(text || '').split(/[,;\n&]|\band\b/i)) {
    const c = raw.replace(/\s+/g, ' ').trim();
    if (c && !seen.has(c.toLowerCase())) { seen.add(c.toLowerCase()); out.push(c); }
  }
  return out.slice(0, max);
}
export const addCourses = (list, text) => parseCourses([...(list || []), ...parseCourses(text)].join(','));

const KEYWORDS = {
  seeing: /\b(see|seeing|watch|watching|visual|visually|diagram|diagrams|picture|video)\b/i,
  doing: /\b(do|doing|practice|practise|hands|try|trying|practical)\b/i,
  reading: /\b(read|reading|text|book|books|notes|write|writing)\b/i,
  talking: /\b(talk|talking|discuss|explain|conversation|listen|listening|speak)\b/i,
};
const WORDS = { three: 3, five: 5, eight: 8, ten: 10, twelve: 12, fifteen: 15, twenty: 20 };
// Spoken/typed words -> a choice value for 'learning' and 'hours' steps (null when we cannot tell).
export function matchChoice(step, said) {
  const t = String(said || '').toLowerCase();
  if (step.id === 'hours') {
    const n = Number((t.match(/\d+/) || [])[0]) || WORDS[Object.keys(WORDS).find(w => t.includes(w))];
    return n ? HOURS.reduce((a, b) => Math.abs(b - n) < Math.abs(a - n) ? b : a) : null;
  }
  for (const [v, label] of step.options) if (t.includes(String(label).toLowerCase())) return v;
  for (const [v, re] of Object.entries(KEYWORDS)) if (re.test(t) && step.options.some(o => o[0] === v)) return v;
  return null;
}
export const matchCourse = (courses, said) => {
  const t = String(said || '').toLowerCase().trim();
  return (courses || []).find(c => t && (t.includes(c.toLowerCase()) || c.toLowerCase().includes(t))) || null;
};

export function answerReady(step, a) {
  if (step.kind === 'text') return !!String(a[step.id] || '').trim();
  if (step.kind === 'courses') return (a.courses || []).length > 0;
  if (step.kind === 'worried') return !!a.worried;
  return a[step.id] !== undefined && a[step.id] !== '';
}
export const newState = () => ({ i: 0, answers: {}, portal: 'skipped' });
export const draftOf = (s, now = Date.now()) => ({ v: 1, i: s.i, answers: s.answers, portal: s.portal, ts: now });
export const resumable = d => !!d && d.v === 1 && Number.isInteger(d.i) && d.i >= 0 && d.i < STEPS.length &&
  (d.i > 0 || Object.values(d.answers || {}).some(v => Array.isArray(v) ? v.length : String(v ?? '').trim()));
export const restoreState = d => resumable(d) ? { i: d.i, answers: { ...d.answers }, portal: d.portal || 'skipped' } : newState();
// The guarantee never turns on from typed courses. portalVerified stays false until a real grade source exists (engine.guaranteeState).
export const finishProfile = a => buildProfile({ ...a, portalVerified: false });
export const micMessage = err => ({
  'not-allowed': 'The microphone is blocked in this browser. You can type your answer instead; nothing is lost.',
  'service-not-allowed': 'Voice input is not allowed here. You can type your answer instead.',
  'no-speech': "I didn't hear anything. Try again, or type your answer.",
  'audio-capture': 'No microphone was found. You can type your answer instead.',
  'network': 'Voice input needs a connection right now. You can type your answer instead.',
}[err] || 'Voice input did not work this time. You can type your answer instead.');

/* ---------------- DOM ---------------- */
const h = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null) e.append(k.nodeType ? k : document.createTextNode(k));
  return e;
};
const lsGet = k => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };

export function mount(host, ctx = {}) {
  const q = new URLSearchParams(location.search);
  if (q.get('reset') === '1') { clearDraft(); try { localStorage.removeItem(CONFIG.roomBuiltKey); } catch {} }
  const rm = q.get('motion') === 'reduce' || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let S = newState(), phase = 'ask', profile = null, rec = null, voiceOut = false, notice = '', portalNote = '', timers = [];

  host.classList.add('iv'); if (rm) host.classList.add('rm');
  const stage = h('div', { class: 'stage', 'data-state': 'idle', 'aria-hidden': 'true' },
    h('div', { class: 'orb' }), h('div', { class: 'wave' }, ...Array.from({ length: 9 }, (_, i) => h('i', { style: `--d:${(i % 5) * 0.12}s` }))));
  const prompt = h('h1', { class: 'prompt', tabindex: '-1', 'aria-live': 'polite' });
  const status = h('p', { class: 'status', role: 'status', 'aria-live': 'polite' });
  const body = h('div', { class: 'body' });
  const bar = h('div', { class: 'bar' });
  const meta = h('p', { class: 'meta' });
  host.append(stage, h('main', { class: 'card' }, meta, prompt, body, status, bar));

  const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); };
  const say = t => { if (!voiceOut || !('speechSynthesis' in window)) return; try { speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance(t)); } catch {} };
  const note = t => { notice = t; status.textContent = t; };
  const btn = (label, fn, cls = '', extra = {}) => h('button', { type: 'button', class: cls, onclick: fn, ...extra }, label);
  const persist = () => saveDraft(draftOf(S));
  const setState = s => { stage.dataset.state = s; };
  const focusPrompt = () => prompt.focus({ preventScroll: true });
  const accent = () => { const t = THEMES[themeFor(S.answers.dream)]; host.style.setProperty('--accent', t.accent); };

  function stopRec() { try { rec?.abort(); } catch {} rec = null; if (stage.dataset.state === 'listening') setState('idle'); }
  function listen(onText) {
    if (!SR) return note('Voice input is not available in this browser. Typing works everywhere.');
    stopRec();
    try {
      rec = new SR(); rec.lang = navigator.language || 'en-US'; rec.interimResults = false; rec.maxAlternatives = 1;
      rec.onresult = e => { const said = e.results[0][0].transcript; setState('idle'); note(`Heard: ${said}`); onText(said); };
      rec.onerror = e => { setState('idle'); note(micMessage(e.error)); };
      rec.onend = () => { if (stage.dataset.state === 'listening') setState('idle'); };
      rec.start(); setState('listening'); note('Listening…');
    } catch { setState('idle'); note(micMessage('')); }
  }
  const micBtn = onText => btn(SR ? 'Speak your answer' : 'Voice not available here', () => listen(onText), 'ghost',
    { 'aria-label': SR ? 'Speak your answer' : 'Voice input is not available in this browser, type instead', disabled: SR ? null : true });

  /* ---- screens ---- */
  function screen(title, kids, buttons, state = 'idle') {
    prompt.textContent = title; body.replaceChildren(...kids); bar.replaceChildren(...buttons); setState(state); status.textContent = notice; focusPrompt();
  }
  const voiceToggle = () => btn(voiceOut ? 'Voice: on' : 'Voice: off', e => { voiceOut = !voiceOut; e.currentTarget.textContent = voiceOut ? 'Voice: on' : 'Voice: off'; e.currentTarget.setAttribute('aria-pressed', voiceOut); if (voiceOut) say(prompt.textContent); else try { speechSynthesis.cancel(); } catch {} }, 'ghost', { 'aria-pressed': voiceOut });

  function showResume(d) {
    const n = d.i + 1;
    meta.textContent = 'Welcome back';
    screen(`Pick up where you left off? You were on part ${n} of ${STEPS.length}.`, [h('p', { class: 'sub' }, 'Your answers so far were saved on this device.')], [
      btn('Continue', () => { S = restoreState(d); accent(); notice = ''; showStep(); }, 'primary'),
      btn('Start over', () => { clearDraft(); S = newState(); notice = ''; showStep(); }),
    ]);
  }

  function showStep() {
    phase = 'ask'; const st = STEPS[S.i], a = S.answers;
    meta.textContent = `Part ${S.i + 1} of ${STEPS.length}`;
    const next = () => { if (!answerReady(st, S.answers)) return note('Add an answer first, or use the voice button.'); notice = ''; persist(); S.i + 1 < STEPS.length ? (S.i++, persist(), showStep()) : finish(); };
    const back = S.i > 0 ? btn('Back', () => { S.i--; notice = ''; persist(); showStep(); }) : null;
    const pause = btn('Save and pause', () => { persist(); showPaused(); });
    const nextB = btn(S.i + 1 < STEPS.length ? 'Next' : 'Finish', next, 'primary');
    let kids = [];
    if (st.kind === 'text') {
      const ta = h('textarea', { id: 'ans', rows: 3, placeholder: st.ph, 'aria-label': st.say, oninput: e => { a[st.id] = e.target.value; if (st.id === 'dream') accent(); persist(); } }); ta.value = a[st.id] || '';
      kids = [ta, h('div', { class: 'row' }, micBtn(t => { ta.value = (ta.value ? ta.value + ' ' : '') + t; a[st.id] = ta.value; if (st.id === 'dream') accent(); persist(); }), voiceToggle())];
    } else if (st.kind === 'choice') {
      const group = h('div', { class: 'choices', role: 'radiogroup', 'aria-label': st.say });
      const paint = () => [...group.children].forEach(b => b.setAttribute('aria-checked', String(String(b.dataset.v) === String(a[st.id]))));
      for (const [v, label] of st.options) group.append(h('button', { type: 'button', role: 'radio', class: 'choice', 'data-v': v, onclick: () => { a[st.id] = v; persist(); paint(); } }, label));
      paint();
      kids = [group, h('div', { class: 'row' }, micBtn(t => { const v = matchChoice(st, t); if (v == null) return note(`I heard "${t}" but could not match it. Tap an option instead.`); a[st.id] = v; persist(); paint(); note(`Chose ${st.options.find(o => o[0] === v)[1]}.`); }), voiceToggle())];
    } else if (st.kind === 'courses') kids = coursesUI(st);
    else if (st.kind === 'worried') kids = worriedUI(st);
    screen(st.say, kids, [back, pause, nextB].filter(Boolean));
    say(st.say);
  }

  function coursesUI(st) {
    const a = S.answers; a.courses = a.courses || [];
    const list = h('ul', { class: 'chips', 'aria-label': 'Your courses' });
    const input = h('input', { id: 'course-in', type: 'text', placeholder: 'Course name, then Add (commas work too)', 'aria-label': 'Type a course name', autocomplete: 'off' });
    const paintList = () => list.replaceChildren(...a.courses.map(c => h('li', {}, c, h('button', { type: 'button', class: 'x', 'aria-label': `Remove ${c}`, onclick: () => { a.courses = a.courses.filter(x => x !== c); if (a.worried === c) a.worried = ''; persist(); paintList(); } }, 'Remove'))));
    const add = t => { a.courses = addCourses(a.courses, t); input.value = ''; persist(); paintList(); };
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); add(input.value); } });
    paintList();
    const portalMsg = h('p', { class: 'sub', id: 'portal-note' }, portalNote);
    const connect = btn('Connect school portal', async () => {
      const f = CONFIG.portal.connect;
      let r; try { r = f ? await f() : { ok: false, reason: 'Portal connection is not available yet.' }; } catch { r = { ok: false, reason: 'We could not reach the portal.' }; }
      if (r.ok && r.courses?.length) { add(r.courses.join(',')); S.portal = 'connected'; portalNote = 'Portal connected.'; }
      else { S.portal = 'failed'; portalNote = `${r.reason || 'We could not connect.'} No problem: type your courses below. The Pass Guarantee stays off until a grade source is verified.`; }
      portalMsg.textContent = portalNote; note(portalNote); persist();
    }, 'ghost');
    return [connect, portalMsg, h('div', { class: 'row grow' }, input, btn('Add', () => add(input.value), 'ghost')), list,
      h('div', { class: 'row' }, micBtn(t => add(t)), voiceToggle()),
      h('p', { class: 'sub' }, 'Skip the portal any time. Typing your courses is enough to continue.')];
  }

  function worriedUI(st) {
    const a = S.answers, cs = a.courses || [];
    if (!cs.length) {
      const input = h('input', { type: 'text', 'aria-label': st.say, placeholder: 'Course name', oninput: e => { a.worried = e.target.value.trim(); persist(); } }); input.value = a.worried || '';
      return [input];
    }
    const group = h('div', { class: 'choices', role: 'radiogroup', 'aria-label': st.say });
    const paint = () => [...group.children].forEach(b => b.setAttribute('aria-checked', String(b.dataset.v === a.worried)));
    for (const c of cs) group.append(h('button', { type: 'button', role: 'radio', class: 'choice', 'data-v': c, onclick: () => { a.worried = c; persist(); paint(); } }, c));
    paint();
    return [group, h('div', { class: 'row' }, micBtn(t => { const c = matchCourse(cs, t); if (!c) return note(`I heard "${t}" but it is not in your list. Tap a course instead.`); a.worried = c; persist(); paint(); note(`Chose ${c}.`); }), voiceToggle())];
  }

  function showPaused() {
    stopRec(); meta.textContent = 'Paused';
    screen('Saved. Come back any time.', [h('p', { class: 'sub' }, 'Your answers are kept on this device. Open this page again to continue.')],
      [btn('Keep going', () => { const d = loadDraft(); S = restoreState(d); showStep(); }, 'primary')]);
  }

  // contract.js is imported lazily: app/ has no package.json, so Node tests of the pure logic above cannot load it as ESM.
  async function finish() {
    stopRec(); profile = finishProfile(S.answers);
    try { (await import('../app/contract.js')).saveProfile(profile); } catch (e) { console.error('saveProfile failed', e); }
    clearDraft(); accent(); host.dataset.theme = profile.dream.theme;
    ctx.onDone?.(profile); showMeet();
  }

  // The voice becomes someone: text persona only. No face, no photo, no voice clone (profile.futureSelf says so as data).
  function showMeet() {
    phase = 'meet'; meta.textContent = 'Your future self';
    const lines = meetLines(profile);
    const card = h('div', { class: 'future' }, h('p', { class: 'role' }, `Your future self · ${roleLabel(profile)}`), ...lines.map(l => h('p', { class: 'line' }, l)));
    screen(lines[0], [card], [btn('Build my room', showBuild, 'primary')], 'future');
    prompt.textContent = 'Meet your future self'; card.querySelector('.line')?.setAttribute('id', 'first-line'); say(lines.join(' '));
  }

  function showBuild() {
    if (lsGet(CONFIG.roomBuiltKey)) return showOffer(true);   // once only
    lsSet(CONFIG.roomBuiltKey, '1'); phase = 'build'; meta.textContent = 'Your room';
    const pieces = ['floor', 'desk', 'shelf', 'window', 'lamp', 'plant'];
    const scene = h('div', { class: 'build' + (rm ? ' done' : ''), 'aria-hidden': 'true' }, ...pieces.map((p, i) => h('div', { class: 'piece ' + p, style: `--i:${i}` })));
    const skip = btn('Skip', () => showOffer(), 'ghost');
    screen('Building your room…', [scene], [skip], 'future');
    status.textContent = 'Your room is being built from your answers.';
    later(() => { if (phase === 'build') showOffer(); }, rm ? 600 : CONFIG.buildMs);
  }

  function showOffer() {
    phase = 'offer'; meta.textContent = 'First block'; host.classList.add('built');
    const ready = h('div', { class: 'built-room', 'aria-hidden': 'true' }, ...['floor', 'desk', 'shelf', 'window', 'lamp', 'plant'].map(p => h('div', { class: 'piece ' + p })));
    const line = offerBlock(profile);
    screen(line, [ready, h('p', { class: 'sub' }, profile.guarantee.state === 'off' ? `Pass Guarantee: off. ${profile.guarantee.reason}.` : '')], [
      btn('Start 25-minute block', () => startBlock(), 'primary'),
      btn('Not now', () => { notice = 'Your room is ready whenever you are.'; status.textContent = notice; }),
    ], 'future');
    prompt.textContent = line; say(line);
  }

  function startBlock() {
    const detail = { course: profile.firstBlock.course, minutes: profile.firstBlock.minutes };
    host.dispatchEvent(new CustomEvent('interview:start-block', { bubbles: true, detail }));
    if (ctx.onStartBlock) ctx.onStartBlock(detail); else ctx.nav?.go('desk', detail);
    note(`Block ready: ${detail.minutes} minutes on ${detail.course}.`);
  }

  const d = loadDraft();
  if (resumable(d)) showResume(d); else showStep();
  return { dispose() { stopRec(); timers.forEach(clearTimeout); try { speechSynthesis.cancel(); } catch {} host.replaceChildren(); host.classList.remove('iv', 'rm', 'built'); } };
}
