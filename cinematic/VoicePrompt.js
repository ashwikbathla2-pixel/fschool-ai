// Voice prompt at the reception desk. Owner: Stanley.
// Mounts into #voice-mount when the flow reaches QUESTION (or call mountVoicePrompt(el) yourself).
// Flow: QUESTION -> LISTENING -> PROCESSING -> CAREER_IDENTIFIED. Typed fallback always available.
// Emits: 'mic-level' {level:0..1} per analyser tick (0 when done), 'answer' {text, source:'voice'|'typed'}, 'career' {career_goal, confidence, ...classification}.

import { STATES, on, emit, get, set, updateProfile } from './state.js';
import { MicrophoneInteraction, micSupported } from './MicrophoneInteraction.js';
import { VoiceWaveform } from './VoiceWaveform.js';
import { classify, toProfile } from './CareerClassifier.js';

const COPY = {
  title: 'Tap and tell us.',
  sub: 'You can speak naturally.',
  listening: 'Listening…',
  got: 'Got it.',
  denied: "That's okay. Type what you want to become.",
  unavailable: 'Tell us in writing.',
  nocatch: "We didn't catch that. Try again.",
  typeInstead: 'Type instead',
  placeholder: 'I want to become…',
};

const CSS = `
.vp{--vp-cream:#f4ede1;--vp-charcoal:#262421;--vp-navy:#1f2d44;--vp-wood:#9b6f47;
  display:flex;flex-direction:column;align-items:center;gap:14px;text-align:center;color:var(--vp-charcoal);
  font-family:inherit;padding:8px 16px;max-width:420px;margin:0 auto}
.vp-title{font:500 clamp(1.5rem,4vw,2rem)/1.15 var(--cin-serif,'Fraunces',Georgia,serif);letter-spacing:-.01em;margin:0}
.vp-sub{margin:0;font-size:.95rem;opacity:.7;min-height:1.4em}
.vp-micwrap{position:relative;width:200px;height:200px;display:grid;place-items:center}
.vp-wave{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.vp-mic{--lvl:0;width:112px;height:112px;border-radius:50%;border:1px solid rgba(155,111,71,.55);cursor:pointer;
  background:var(--vp-cream);color:var(--vp-navy);display:grid;place-items:center;
  box-shadow:0 10px 30px rgba(38,36,33,.18),inset 0 0 0 6px rgba(155,111,71,.08);
  transform:scale(calc(1 + var(--lvl) * .09));transition:background .4s,color .4s,box-shadow .4s}
.vp-mic svg{width:38px;height:38px}
.vp-mic:hover{box-shadow:0 14px 36px rgba(38,36,33,.24),inset 0 0 0 6px rgba(155,111,71,.14)}
.vp-mic:focus-visible{outline:2px solid var(--vp-navy);outline-offset:6px}
.vp[data-mode=listening] .vp-mic{background:var(--vp-navy);color:var(--vp-cream);border-color:var(--vp-navy)}
.vp[data-mode=processing] .vp-mic{animation:vp-breathe 1.8s ease-in-out infinite;cursor:default}
@keyframes vp-breathe{50%{transform:scale(.96);opacity:.75}}
.vp-said{margin:0;font-size:.95rem;font-style:italic;opacity:.8;min-height:1.4em;max-width:34ch}
.vp-type{background:none;border:0;color:var(--vp-navy);font:inherit;font-size:.85rem;text-decoration:underline;
  text-underline-offset:3px;cursor:pointer;opacity:.75;padding:6px}
.vp-type:hover{opacity:1}
.vp-form{display:flex;gap:8px;width:100%}
.vp [hidden]{display:none!important}
.vp-input{flex:1;min-width:0;padding:12px 16px;border-radius:999px;border:1px solid rgba(38,36,33,.25);
  background:#fffaf2;color:var(--vp-charcoal);font:inherit;font-size:1rem}
.vp-input:focus{outline:2px solid var(--vp-navy);outline-offset:1px}
.vp-go{padding:12px 18px;border-radius:999px;border:0;background:var(--vp-navy);color:var(--vp-cream);font:inherit;cursor:pointer}
.vp-go:disabled,.vp-input:disabled{opacity:.5;cursor:default}
.vp .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
/* over the dark reception scene (Jim's .cine-voice mount): light text */
.vp.vp-on-dark{color:var(--vp-cream);text-shadow:0 1px 2px rgba(31,29,27,.9),0 1px 18px rgba(31,29,27,.75);
  background:radial-gradient(ellipse at 50% 55%,rgba(31,29,27,.58),rgba(31,29,27,.32) 55%,rgba(31,29,27,0) 78%);border-radius:24px}
.vp.vp-on-dark .vp-sub,.vp.vp-on-dark .vp-said{opacity:.95}
.vp.vp-on-dark .vp-type{color:var(--vp-cream);opacity:.95}
.vp.vp-on-dark .vp-input,.vp.vp-on-dark .vp-go,.vp.vp-on-dark .vp-mic{text-shadow:none}
.vp.vp-on-dark .vp-mic:focus-visible{outline-color:var(--vp-cream)}
@media (prefers-reduced-motion:reduce){.vp-mic{transform:none!important;transition:none}.vp[data-mode=processing] .vp-mic{animation:none;opacity:.75}}
@media (max-width:480px){.vp-micwrap{width:170px;height:170px}.vp-mic{width:96px;height:96px}}
`;

const MIC_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6"/></svg>';

let mounted = null;

export function mountVoicePrompt(host = document.getElementById('voice-mount')) {
  if (!host) return null;
  if (mounted && mounted.host === host && host.contains(mounted.root)) { mounted.reset(); return mounted; }
  mounted?.destroy();
  if (!document.getElementById('vp-style')) {
    const s = document.createElement('style'); s.id = 'vp-style'; s.textContent = CSS; document.head.appendChild(s);
  }

  const root = document.createElement('div');
  root.className = 'vp'; root.dataset.mode = 'idle';
  root.innerHTML = `
    <p class="vp-title" id="vp-title">${COPY.title}</p>
    <p class="vp-sub" id="vp-sub" aria-live="polite">${COPY.sub}</p>
    <div class="vp-micwrap">
      <canvas class="vp-wave" aria-hidden="true"></canvas>
      <button type="button" class="vp-mic" aria-label="Speak your answer" aria-pressed="false">${MIC_SVG}</button>
    </div>
    <p class="vp-said" aria-live="polite"></p>
    <button type="button" class="vp-type">${COPY.typeInstead}</button>
    <form class="vp-form" hidden autocomplete="off">
      <label class="sr" for="vp-input">What do you want to become?</label>
      <input class="vp-input" id="vp-input" placeholder="${COPY.placeholder}" maxlength="200" />
      <button class="vp-go" type="submit" aria-label="Send">Go</button>
    </form>`;
  const onDark = !!host.closest('.cine-voice');
  root.classList.toggle('vp-on-dark', onDark);
  host.appendChild(root);

  const $ = s => root.querySelector(s);
  const sub = $('#vp-sub'), said = $('.vp-said'), micBtn = $('.vp-mic'), typeBtn = $('.vp-type'),
    form = $('.vp-form'), input = $('.vp-input'), goBtn = $('.vp-go');
  const wave = new VoiceWaveform($('.vp-wave'), onDark ? { color: '244,237,225' } : undefined); // cream on dark, navy on light
  let busy = false;

  const mode = m => { root.dataset.mode = m; micBtn.setAttribute('aria-pressed', m === 'listening'); };
  const showTyping = (msg) => {
    if (msg) sub.textContent = msg;
    form.hidden = false; typeBtn.hidden = true; input.disabled = goBtn.disabled = false;
    input.focus({ preventScroll: true });
  };

  const mic = new MicrophoneInteraction({
    onLevel: v => { micBtn.style.setProperty('--lvl', v.toFixed(3)); wave.setLevel(v); emit('mic-level', { level: v }); }, // receptionist leans in; 0 on stop
    onInterim: t => { said.textContent = t ? `“${t}”` : ''; },
    onFinal: t => submit(t, 'voice'),
    onFail: kind => {
      if (busy) return;
      mode('idle'); set('state', STATES.QUESTION);
      if (kind === 'nocatch') { sub.textContent = COPY.nocatch; said.textContent = ''; typeBtn.hidden = false; }
      else { micBtn.parentElement.hidden = true; showTyping(COPY[kind]); }
    },
  });

  if (!micSupported()) { micBtn.parentElement.hidden = true; $('#vp-title').textContent = COPY.unavailable; sub.textContent = ''; showTyping(); }

  micBtn.addEventListener('click', () => {
    if (busy) return;
    if (root.dataset.mode === 'listening') { mic.stop(); return; }
    try { speechSynthesis?.cancel(); } catch {}
    mode('listening'); sub.textContent = COPY.listening; said.textContent = '';
    set('state', STATES.LISTENING);
    mic.start();
  });
  typeBtn.addEventListener('click', () => { if (root.dataset.mode === 'listening') mic.cleanup(); mode('idle'); showTyping(); });
  form.addEventListener('submit', e => { e.preventDefault(); const t = input.value.trim(); if (t) submit(t, 'typed'); });

  async function submit(text, source) {
    if (busy) return; busy = true;
    mode('processing'); input.disabled = goBtn.disabled = true;
    said.textContent = `“${text}”`; sub.textContent = COPY.got;
    emit('answer', { text, source });
    set('state', STATES.PROCESSING);
    const r = await classify(text); // always resolves within the timeout, with an offline fallback
    sub.textContent = r.short_interpretation;
    updateProfile(toProfile(r));
    emit('career', { career_goal: r.career_category, confidence: r.confidence, ...r, text, source });
    set('state', STATES.CAREER_IDENTIFIED);
  }

  function reset() {
    busy = false; mic.cleanup(); mode('idle');
    sub.textContent = COPY.sub; said.textContent = ''; input.value = '';
    input.disabled = goBtn.disabled = false;
    if (micSupported()) { form.hidden = true; typeBtn.hidden = false; }
  }
  function destroy() { mic.cleanup(); wave.destroy(); root.remove(); if (mounted?.root === root) mounted = null; }

  if (/[?&]debug\b/.test(location.search)) console.info('[voice]', { secureContext: window.isSecureContext,
    speechRecognition: !!(window.SpeechRecognition || window.webkitSpeechRecognition),
    mediaDevices: !!navigator.mediaDevices?.getUserMedia, micSupported: micSupported(), darkMount: onDark });
  mounted = { host, root, reset, destroy };
  syncInert(get('state'));
  return mounted;
}

export const mount = mountVoicePrompt; // alias for the orchestrator

// Auto-mount when the flow reaches QUESTION (CinematicOnboarding creates #voice-mount then).
const LIVE = new Set([STATES.QUESTION, STATES.LISTENING, STATES.PROCESSING]);
// Past PROCESSING the panel is hidden by the scene: take it out of the tab order and the accessibility tree.
function syncInert(s) {
  if (!mounted) return;
  const off = !LIVE.has(s);
  mounted.root.inert = off;
  off ? mounted.root.setAttribute('aria-hidden', 'true') : mounted.root.removeAttribute('aria-hidden');
}
on('change:state', ({ value }) => syncInert(value));

function onState(s) {
  if (s !== STATES.QUESTION) return;
  if (mounted && document.body.contains(mounted.root)) return; // already up (also hit when a mic retry returns to QUESTION)
  requestAnimationFrame(() => mountVoicePrompt());
}
on('change:state', ({ value }) => onState(value));
onState(get('state'));
