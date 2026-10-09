// Optional sound. Muted by default, never autoplays, only starts after the user turns it on.
// Owner: Ryan. No audio files ship yet, so cues are synthesized with Web Audio (soft, quiet).
// Usage:
//   import { audio } from './audio.js';
//   audio.mountToggle(container);      // accessible "Sound off/on" button
//   audio.cue('ui' | 'mic' | 'door' | 'transition');
//   audio.footsteps(true|false);       // loop while walking
//   audio.ambience('school' | 'reception' | null);
//   audio.register('door', 'assets/audio/door.mp3'); // optional real file replaces a synth cue
// The environment "quiets" while listening: audio.duck(true) / audio.duck(false).

import { on } from './state.js';

const KEY = 'fschool.sound';
const store = { get() { try { return localStorage.getItem(KEY); } catch { return null; } }, set(v) { try { localStorage.setItem(KEY, v); } catch { /* ignore */ } } };

let ctx = null, master = null, ambBus = null, sfxBus = null;
let enabled = store.get() === 'on'; // remembered only if the user turned it on before; still waits for a gesture
let unlocked = false;
let ambNode = null, ambName = null, wantAmb = null, stepTimer = 0;
const files = new Map(); // name -> AudioBuffer | url
const listeners = new Set();

function ensureCtx() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
  ambBus = ctx.createGain(); ambBus.gain.value = 0.18; ambBus.connect(master);
  sfxBus = ctx.createGain(); sfxBus.gain.value = 0.5; sfxBus.connect(master);
  return ctx;
}
function ramp(param, v, t = 0.4) { if (!ctx) return; const n = ctx.currentTime; param.cancelScheduledValues(n); param.setValueAtTime(param.value, n); param.linearRampToValueAtTime(v, n + t); }

function noiseBuffer(sec = 2) {
  const b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate), d = b.getChannelData(0);
  let last = 0; for (let i = 0; i < d.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; } // brown-ish noise
  return b;
}
async function loadFile(name) {
  const v = files.get(name);
  if (!v || typeof v !== 'string') return v || null;
  try { const buf = await ctx.decodeAudioData(await (await fetch(v)).arrayBuffer()); files.set(name, buf); return buf; }
  catch { files.delete(name); return null; } // fall back to synth
}
function playBuffer(buf, bus = sfxBus, gain = 1) { const s = ctx.createBufferSource(), g = ctx.createGain(); g.gain.value = gain; s.buffer = buf; s.connect(g).connect(bus); s.start(); return s; }

const SYNTH = {
  ui() { tone(660, 0.07, 0.12, 'sine'); },
  mic() { tone(520, 0.09, 0.12, 'sine'); setTimeout(() => tone(780, 0.12, 0.1, 'sine'), 90); },
  transition() { swell(0.9); },
  door() { thud(0.35, 90); setTimeout(() => swell(0.6, 400), 120); },
  step() { thud(0.08, 140 + Math.random() * 40, 0.25); },
};
function tone(freq, dur, vol, type) {
  const o = ctx.createOscillator(), g = ctx.createGain(), n = ctx.currentTime;
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0, n); g.gain.linearRampToValueAtTime(vol, n + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, n + dur);
  o.connect(g).connect(sfxBus); o.start(n); o.stop(n + dur + 0.02);
}
function thud(dur, cutoff, vol = 0.6) {
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), n = ctx.currentTime;
  s.buffer = noiseBuffer(0.4); f.type = 'lowpass'; f.frequency.value = cutoff * 4;
  g.gain.setValueAtTime(vol, n); g.gain.exponentialRampToValueAtTime(0.0001, n + dur);
  s.connect(f).connect(g).connect(sfxBus); s.start(n); s.stop(n + dur + 0.05);
}
function swell(dur, freq = 900) {
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), n = ctx.currentTime;
  s.buffer = noiseBuffer(dur + 0.2); f.type = 'bandpass'; f.frequency.setValueAtTime(freq * 0.4, n); f.frequency.linearRampToValueAtTime(freq, n + dur);
  g.gain.setValueAtTime(0, n); g.gain.linearRampToValueAtTime(0.12, n + dur * 0.5); g.gain.linearRampToValueAtTime(0, n + dur);
  s.connect(f).connect(g).connect(sfxBus); s.start(n); s.stop(n + dur + 0.1);
}
async function startAmbience(name) {
  if (ambNode) { const old = ambNode; ramp(old.gain.gain, 0, 0.8); setTimeout(() => { try { old.src.stop(); } catch { /* ignore */ } }, 900); ambNode = null; }
  ambName = name; if (!name) return;
  const buf = (await loadFile('amb:' + name)) || noiseBuffer(4);
  const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), gain = ctx.createGain();
  src.buffer = buf; src.loop = true; f.type = 'lowpass'; f.frequency.value = name === 'reception' ? 700 : 450;
  gain.gain.value = 0; src.connect(f).connect(gain).connect(ambBus); src.start();
  ambNode = { src, gain }; ramp(gain.gain, 1, 1.5);
}

export const audio = {
  get enabled() { return enabled && unlocked; },
  // Must be called from a user gesture (the toggle does this).
  async setEnabled(v) {
    enabled = !!v; store.set(enabled ? 'on' : 'off');
    if (enabled) {
      if (!ensureCtx()) { enabled = false; notify(); return; }
      try { await ctx.resume(); unlocked = true; } catch { unlocked = false; }
      ramp(master.gain, 0.8, 0.6);
      if (wantAmb && wantAmb !== ambName) startAmbience(wantAmb);
    } else if (ctx) { ramp(master.gain, 0, 0.3); this.footsteps(false); }
    notify();
  },
  toggle() { return this.setEnabled(!this.enabled); },
  register(name, url) { files.set(name, url); },
  async cue(name) {
    if (!this.enabled) return;
    const buf = await loadFile(name);
    if (buf) playBuffer(buf); else SYNTH[name]?.();
  },
  footsteps(on, interval = 520) {
    clearInterval(stepTimer); stepTimer = 0;
    if (on && this.enabled) stepTimer = setInterval(() => this.cue('step'), interval);
  },
  ambience(name) { wantAmb = name; if (this.enabled && name !== ambName) startAmbience(name); },
  duck(down) { if (ambBus) ramp(ambBus.gain, down ? 0.04 : 0.18, 0.5); },
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  // Small text button, no emoji. Styles: .cine-sound (override in your CSS).
  mountToggle(parent = document.body) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'cine-sound';
    const sync = () => { b.textContent = this.enabled ? 'Sound on' : 'Sound off'; b.setAttribute('aria-pressed', String(this.enabled)); b.setAttribute('aria-label', this.enabled ? 'Turn sound off' : 'Turn sound on'); };
    b.addEventListener('click', () => { this.toggle().then(() => this.cue('ui')); });
    this.onChange(sync); sync(); parent.appendChild(b); return b;
  },
};
function notify() { listeners.forEach(fn => fn(audio.enabled)); }

// Auto-wire to the shared state machine so scene owners don't have to.
on('change:state', ({ value }) => {
  if (value === 'SCHOOL_ENTRANCE' || value === 'SCHOOL_HALLWAY') audio.ambience('school');
  if (value === 'SCHOOL_ENTRANCE') audio.cue('door');
  if (value === 'RECEPTION' || value === 'QUESTION') audio.ambience('reception');
  if (value === 'LISTENING') { audio.cue('mic'); audio.duck(true); }
  if (value === 'PROCESSING' || value === 'CAREER_IDENTIFIED') audio.duck(false);
  if (value === 'CAREER_TRANSITION') audio.cue('transition');
  if (value === 'APP_ENTRY') audio.ambience(null);
});
document.addEventListener('visibilitychange', () => { if (!ctx) return; document.hidden ? ctx.suspend() : (audio.enabled && ctx.resume()); });
