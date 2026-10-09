// Microphone + speech recognition. Owner: Stanley.
// Real amplitude from a Web Audio AnalyserNode; transcript from the browser SpeechRecognition.
// Failures are reported as one of: 'denied' | 'unavailable' | 'nocatch' — never raw errors.

const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

const DEBUG = typeof location !== 'undefined' && /[?&]debug\b/.test(location.search);

export function micSupported() {
  // Mic needs a secure context (https or localhost); a LAN IP over http has no mediaDevices -> typed fallback.
  return !!(SR && window.isSecureContext !== false && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

export class MicrophoneInteraction {
  // handlers: { onLevel(0..1), onInterim(text), onFinal(text), onFail(kind), onEnd() }
  constructor(handlers = {}) { this.h = handlers; this.active = false; }

  async start() {
    if (this.active) return;
    if (!micSupported()) return this.h.onFail?.('unavailable');
    this.active = true; this.finalText = ''; this.failed = false;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (e) {
      this.active = false;
      if (DEBUG) console.warn('[voice] getUserMedia failed:', e && e.name);
      return this.h.onFail?.(e && (e.name === 'NotAllowedError' || e.name === 'SecurityError') ? 'denied' : 'unavailable');
    }
    if (!this.active) return this.cleanup(); // stopped while the permission prompt was open
    this.startMeter();
    this.startRecognition();
  }

  startMeter() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ac = new AC();
      const src = this.ac.createMediaStreamSource(this.stream);
      this.an = this.ac.createAnalyser(); this.an.fftSize = 512; this.an.smoothingTimeConstant = 0.6;
      src.connect(this.an);
      const buf = new Uint8Array(this.an.fftSize);
      let smooth = 0;
      const tick = () => {
        if (!this.an) return;
        this.an.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
        const rms = Math.sqrt(sum / buf.length);           // ~0.0–0.3 for speech
        const lvl = Math.min(1, rms * 4.5);
        smooth += (lvl - smooth) * (lvl > smooth ? 0.5 : 0.12); // fast attack, slow release
        this.h.onLevel?.(smooth);
        this.raf = requestAnimationFrame(tick);
      };
      tick();
    } catch { /* meter is decorative; recognition still works */ }
  }

  startRecognition() {
    const rec = this.rec = new SR();
    rec.lang = navigator.language || 'en-US';
    rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
    rec.onresult = e => {
      let interim = '', fin = '';
      for (const r of e.results) (r.isFinal ? (fin += r[0].transcript) : (interim += r[0].transcript));
      if (fin) this.finalText = fin.trim();
      this.h.onInterim?.((fin || interim).trim());
    };
    rec.onerror = e => {
      this.failed = true;
      const kind = e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'denied'
        // 'network': browser has the API but no speech service (Brave, some Chromium builds) -> stop offering the mic
        : e.error === 'audio-capture' || e.error === 'network' || e.error === 'language-not-supported' ? 'unavailable' : 'nocatch';
      if (DEBUG) console.warn('[voice] recognition error:', e.error);
      if (e.error !== 'aborted') this.h.onFail?.(kind);
    };
    rec.onend = () => {
      const text = this.finalText;
      const failed = this.failed;
      this.cleanup();
      if (text) this.h.onFinal?.(text);
      else if (!failed) this.h.onFail?.('nocatch');
      this.h.onEnd?.();
    };
    try { rec.start(); } catch { this.cleanup(); this.h.onFail?.('nocatch'); }
  }

  // User tapped again: finish listening and use what we have.
  stop() {
    if (this.rec) { try { this.rec.stop(); } catch { this.cleanup(); } }
    else this.cleanup();
  }

  cleanup() {
    this.active = false;
    cancelAnimationFrame(this.raf);
    this.an = null;
    if (this.rec) { this.rec.onresult = this.rec.onerror = this.rec.onend = null; try { this.rec.abort(); } catch {} this.rec = null; }
    this.stream?.getTracks().forEach(t => t.stop()); this.stream = null;
    if (this.ac) { this.ac.close().catch(() => {}); this.ac = null; }
    this.h.onLevel?.(0);
  }
}
