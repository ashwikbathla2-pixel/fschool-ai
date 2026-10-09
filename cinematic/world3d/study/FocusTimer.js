// Pomodoro focus timer + local progress store. No DOM, no three.js. Owner: Phyllis.
// States: idle | focus | paused | break | done.  Config-driven: new FocusTimer({ focusMin: 25, breakMin: 5, speed: 1 })
const KEY = 'fschool.study';
const day = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const EMPTY = { streak: 0, lastDay: '', totalMinutes: 0, sessions: 0, today: { date: '', minutes: 0 } };

export function loadStats() {
  try { const s = { ...EMPTY, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; if (s.today?.date !== day()) s.today = { date: day(), minutes: 0 }; return s; }
  catch { return { ...EMPTY, today: { date: day(), minutes: 0 } }; }
}
function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage blocked: progress just is not kept */ } }

// Record studied minutes; completed=true counts a full focus session toward the streak.
export function recordStudy(minutes, completed) {
  const s = loadStats(), m = Math.max(0, Math.round(minutes));
  s.totalMinutes += m; s.today.minutes += m;
  if (completed) {
    s.sessions += 1;
    const yesterday = day(new Date(Date.now() - 864e5));
    if (s.lastDay !== day()) { s.streak = s.lastDay === yesterday ? s.streak + 1 : 1; s.lastDay = day(); }
  }
  save(s); return s;
}

export class FocusTimer {
  constructor({ focusMin = 25, breakMin = 5, speed = 1, onChange } = {}) {
    Object.assign(this, { focusMin, breakMin, speed, onChange, state: 'idle', remaining: focusMin * 60, total: focusMin * 60, startedAt: 0, resumeFrom: null, focusSeconds: 0, last: 0 });
  }
  _set(state) { this.state = state; this.onChange?.(state, this); }
  start() { this.remaining = this.total = this.focusMin * 60; this.focusSeconds = 0; this.last = performance.now(); this._set('focus'); }
  pause() { if (this.state === 'focus' || this.state === 'break') { this.resumeFrom = this.state; this._set('paused'); } }
  resume() { if (this.state === 'paused') { this.last = performance.now(); this._set(this.resumeFrom || 'focus'); } }
  // End early: saves the minutes actually studied (not counted as a completed session).
  end() {
    if (this.state === 'idle') return null;
    const wasFocus = this.state === 'focus' || (this.state === 'paused' && this.resumeFrom === 'focus');
    const stats = recordStudy((wasFocus ? this.focusSeconds : 0) / 60, false);
    this._reset(); return stats;
  }
  _reset() { this.remaining = this.total = this.focusMin * 60; this.focusSeconds = 0; this._set('idle'); }
  // Call every frame.
  update(now = performance.now()) {
    if (this.state !== 'focus' && this.state !== 'break') return;
    const dt = Math.min((now - this.last) / 1000, 1) * this.speed; this.last = now;
    this.remaining -= dt; if (this.state === 'focus') this.focusSeconds += dt;
    if (this.remaining > 0) return;
    if (this.state === 'focus') {
      this.stats = recordStudy(this.focusMin, true);
      this.remaining = this.total = this.breakMin * 60; this._set('break');
      this.onComplete?.(this.stats);
    } else { this._reset(); }
  }
  get fraction() { return this.total ? 1 - Math.max(0, this.remaining) / this.total : 0; }
  get label() { const r = Math.max(0, Math.ceil(this.remaining)); return `${String(Math.floor(r / 60)).padStart(2, '0')}:${String(r % 60).padStart(2, '0')}`; }
}
