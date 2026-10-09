// Presence adapter: friends join your room with a share code and appear as neighbours. Owner: Phyllis.
//   const p = createPresence();            // LocalPresence unless REMOTE_ENDPOINT is set
//   const { code } = await p.createRoom();     // or: await p.joinRoom('K7M2QX')
//   p.onPeers(list => ...);                // [{id,name,status:'studying'|'away',minutesToday,type}]
//   p.setStatus({ name, status, minutesToday, type });
//   p.leave();
// LocalPresence works across tabs of one browser (BroadcastChannel + localStorage) for testing.
// RemotePresence is a WebSocket stub: set REMOTE_ENDPOINT to a server speaking the same JSON messages.
export const REMOTE_ENDPOINT = null;          // e.g. 'wss://presence.fschoolai.com/rooms'

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // no 0/O/1/I
export const CODE_LENGTH = 6;
export function makeCode(len = CODE_LENGTH) {
  const a = new Uint8Array(len);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(a); else for (let i = 0; i < len; i++) a[i] = Math.floor(Math.random() * 256);
  return Array.from(a, n => ALPHABET[n % ALPHABET.length]).join('');
}
export function normalizeCode(s) { return String(s || '').toUpperCase().replace(/[\s-]/g, ''); }
export function isValidCode(s) { return new RegExp(`^[${ALPHABET}]{${CODE_LENGTH}}$`).test(normalizeCode(s)); }
export const formatCode = c => `${c.slice(0, 3)} ${c.slice(3)}`;

export const MESSAGES = {
  badCode: 'That code does not look right. Codes have 6 letters and numbers.',
  notFound: 'We could not find a room with that code. Check it and try again.',
  offline: 'Friends are not available right now. You can still study on your own.',
  full: 'That room is full. Ask your friend to start a new one.'
};
const ROOM_TTL = 24 * 3600e3, STALE = 12e3, BEAT = 3e3, MAX_PEERS = 8;
// createRoom() resolves to a value that reads as the code itself (`${r}`, r.code) and keeps the older { code } shape.
const roomResult = code => ({ code, toString: () => code, valueOf: () => code });
const newId = () => makeCode(8);

class Base {
  constructor() { this.id = newId(); this.code = null; this.peers = new Map(); this.cbs = new Set(); this.me = { name: 'Student', status: 'away', minutesToday: 0, type: 'blank' }; this._timer = 0; }
  onPeers(cb) { this.cbs.add(cb); cb(this.list()); return () => this.cbs.delete(cb); }
  list() { return [...this.peers.values()].map(p => ({ id: p.id, name: p.name, status: p.status, state: p.status, minutesToday: p.minutesToday, type: p.type })).sort((a, b) => a.id.localeCompare(b.id)); }
  _emit() { const l = this.list(); this.cbs.forEach(cb => { try { cb(l); } catch { /* listener errors never break presence */ } }); }
  leaveRoom() { return this.leave(); }
  setStatus(s) { const { state, ...rest } = s || {}; Object.assign(this.me, rest, state ? { status: state } : {}); this._send({ t: 'state', id: this.id, ...this.me }); }
  _hear(m) {
    if (!m || m.id === this.id) return;
    if (m.t === 'bye') { if (this.peers.delete(m.id)) this._emit(); return; }
    if (m.t === 'hello') this._send({ t: 'state', id: this.id, ...this.me });
    if (m.t === 'hello' || m.t === 'state') {
      if (!this.peers.has(m.id) && this.peers.size >= MAX_PEERS) return;
      const prev = JSON.stringify(this.peers.get(m.id) || {}), p = { id: m.id, name: String(m.name || 'Friend').slice(0, 20), status: m.status === 'studying' ? 'studying' : 'away', minutesToday: +m.minutesToday || 0, type: m.type || 'blank', seen: Date.now() };
      this.peers.set(m.id, p); if (JSON.stringify({ ...p, seen: 0 }) !== JSON.stringify({ ...JSON.parse(prev || '{}'), seen: 0 })) this._emit();
    }
  }
  _beat() {
    clearInterval(this._timer);
    this._timer = setInterval(() => {
      this._send({ t: 'state', id: this.id, ...this.me });
      let changed = false; for (const [k, p] of this.peers) if (Date.now() - p.seen > STALE) { this.peers.delete(k); changed = true; }
      if (changed) this._emit();
    }, BEAT);
  }
  leave() { if (this.code) this._send({ t: 'bye', id: this.id }); clearInterval(this._timer); this.peers.clear(); this._emit(); this.code = null; this._close(); }
}

export class LocalPresence extends Base {
  _registry() { try { const r = JSON.parse(localStorage.getItem('fschool.rooms') || '{}'); for (const k in r) if (Date.now() - r[k] > ROOM_TTL) delete r[k]; return r; } catch { return {}; } }
  _save(r) { try { localStorage.setItem('fschool.rooms', JSON.stringify(r)); } catch { /* storage blocked */ } }
  async createRoom() { const r = this._registry(); let c; do c = makeCode(); while (r[c]); r[c] = Date.now(); this._save(r); this._open(c); return roomResult(c); }
  async joinRoom(code) {
    const c = normalizeCode(code);
    if (!isValidCode(c)) return { ok: false, error: MESSAGES.badCode };
    if (typeof BroadcastChannel === 'undefined') return { ok: false, error: MESSAGES.offline };
    if (!this._registry()[c]) return { ok: false, error: MESSAGES.notFound };
    this._open(c); return { ok: true, code: c };
  }
  _open(c) { this._close(); this.code = c; this.ch = new BroadcastChannel('fschool-study-' + c); this.ch.onmessage = e => this._hear(e.data); this._send({ t: 'hello', id: this.id, ...this.me }); this._beat(); }
  _send(m) { try { this.ch?.postMessage(m); } catch { /* channel closed */ } }
  _close() { try { this.ch?.close(); } catch { /* already closed */ } this.ch = null; }
}

export class RemotePresence extends Base {
  constructor(endpoint = REMOTE_ENDPOINT) { super(); this.endpoint = endpoint; }
  _connect(code) {
    return new Promise((res, rej) => {
      if (!this.endpoint || typeof WebSocket === 'undefined') return rej(new Error('offline'));
      const ws = this.ws = new WebSocket(`${this.endpoint}?room=${encodeURIComponent(code)}`);
      ws.onopen = () => { this.code = code; ws.send(JSON.stringify({ t: 'hello', id: this.id, ...this.me })); this._beat(); res(); };
      ws.onmessage = e => { try { this._hear(JSON.parse(e.data)); } catch { /* ignore malformed */ } };
      ws.onerror = () => rej(new Error('offline')); ws.onclose = () => { this.ws = null; };
    });
  }
  // Server contract: creating a room = POST {endpoint}/new -> {code}; unknown codes close the socket with code 4404.
  async createRoom() { try { const r = await fetch(this.endpoint.replace(/^ws/, 'http') + '/new', { method: 'POST' }); const { code } = await r.json(); await this._connect(code); return roomResult(code); } catch { throw new Error(MESSAGES.offline); } }
  async joinRoom(code) { const c = normalizeCode(code); if (!isValidCode(c)) return { ok: false, error: MESSAGES.badCode }; try { await this._connect(c); return { ok: true, code: c }; } catch { return { ok: false, error: MESSAGES.offline }; } }
  _send(m) { if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(m)); }
  _close() { try { this.ws?.close(); } catch { /* already closed */ } this.ws = null; }
}

export function createPresence() { return REMOTE_ENDPOINT ? new RemotePresence() : new LocalPresence(); }
