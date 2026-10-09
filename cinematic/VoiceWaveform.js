// Soft waveform ring around the mic button. Owner: Stanley.
// Driven only by real mic level (setLevel). No equalizer bars, no fake motion when silent.

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export class VoiceWaveform {
  constructor(canvas, { color = '31,45,68' } = {}) { // navy, as "r,g,b"
    this.c = canvas; this.ctx = canvas.getContext('2d'); this.color = color;
    this.level = 0; this.target = 0; this.t = 0; this.running = false;
    this.resize = this.resize.bind(this); this.frame = this.frame.bind(this);
    addEventListener('resize', this.resize); this.resize();
  }
  resize() {
    const d = Math.min(devicePixelRatio || 1, 2), r = this.c.getBoundingClientRect();
    this.c.width = Math.max(1, r.width * d); this.c.height = Math.max(1, r.height * d);
  }
  setLevel(v) { this.target = v; if (!this.running && v > 0.001) this.start(); }
  start() { if (this.running) return; this.running = true; this.raf = requestAnimationFrame(this.frame); }
  frame() {
    const { ctx, c } = this; const w = c.width, h = c.height, cx = w / 2, cy = h / 2;
    this.level += (this.target - this.level) * 0.25; this.t += 0.016;
    ctx.clearRect(0, 0, w, h);
    const base = Math.min(w, h) * 0.3, L = this.level;
    if (reduced()) { // a single still ring whose opacity follows the voice
      ctx.strokeStyle = `rgba(${this.color},${0.15 + L * 0.6})`; ctx.lineWidth = 2 * (devicePixelRatio || 1);
      ctx.beginPath(); ctx.arc(cx, cy, base * 1.25, 0, Math.PI * 2); ctx.stroke();
    } else {
      for (let k = 0; k < 3; k++) { // three soft rings, each gently deformed by amplitude
        const amp = base * L * (0.22 - k * 0.05), rad = base * (1.12 + k * 0.16 + L * 0.25);
        ctx.strokeStyle = `rgba(${this.color},${(0.5 - k * 0.14) * (0.25 + L)})`;
        ctx.lineWidth = (2.2 - k * 0.5) * (devicePixelRatio || 1);
        ctx.beginPath();
        for (let i = 0; i <= 96; i++) {
          const a = (i / 96) * Math.PI * 2;
          const r = rad + amp * Math.sin(a * 3 + this.t * (1.6 + k * 0.4)) * Math.sin(a * 2 - this.t * 1.1);
          i ? ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r) : ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        }
        ctx.closePath(); ctx.stroke();
      }
    }
    if (this.target < 0.001 && this.level < 0.005) { this.running = false; ctx.clearRect(0, 0, w, h); return; }
    this.raf = requestAnimationFrame(this.frame);
  }
  destroy() { cancelAnimationFrame(this.raf); removeEventListener('resize', this.resize); }
}
