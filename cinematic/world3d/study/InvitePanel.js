// Invite panel for the study room: share a code, join a friend's room, see who is studying. Owner: presence temp.
//   const panel = mountInvitePanel(hostEl, createPresence());   // panel.destroy() to remove
import { formatCode, normalizeCode, isValidCode, MESSAGES } from './Presence.js';

const CSS = `
.ip{--cream:#f6efe0;--cream2:#ece3d2;--ink:#2b2d31;--navy:#1f3350;--mute:#6b6a66;font:500 14px/1.45 Inter,system-ui,sans-serif;color:var(--ink);background:var(--cream);border:1px solid #d8ccb4;border-radius:14px;padding:16px;width:min(320px,100%);box-sizing:border-box}
.ip *{box-sizing:border-box}
.ip h3{margin:0 0 8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--navy)}
.ip section{padding:12px 0;border-top:1px solid #d8ccb4}.ip section:first-child{border:0;padding-top:0}
.ip button{font:inherit;cursor:pointer;border-radius:9px;border:1px solid var(--navy);padding:8px 12px;background:var(--navy);color:var(--cream)}
.ip button.alt{background:transparent;color:var(--navy)}
.ip button:hover{filter:brightness(1.12)}
.ip :focus-visible{outline:3px solid #6f93c9;outline-offset:2px}
.ip .code{display:flex;gap:8px;align-items:center;margin-top:8px}
.ip .code output{flex:1;font:700 24px/1 ui-monospace,Menlo,monospace;letter-spacing:.12em;background:var(--cream2);border-radius:9px;padding:10px 12px;color:var(--navy)}
.ip input{width:100%;font:700 18px ui-monospace,Menlo,monospace;letter-spacing:.14em;text-transform:uppercase;padding:9px 12px;border-radius:9px;border:1px solid #b9ad94;background:#fffaf0;color:var(--ink)}
.ip input[aria-invalid=true]{border-color:#9b3b2e}
.ip .row{display:flex;gap:8px;margin-top:8px}.ip .row input{flex:1;min-width:0}
.ip .msg{min-height:1.4em;margin:6px 0 0;font-size:13px;color:var(--mute)}.ip .msg.err{color:#9b3b2e}
.ip ul{list-style:none;margin:0;padding:0}.ip li{display:flex;justify-content:space-between;gap:8px;padding:6px 0}
.ip li small{color:var(--mute)}.ip li .dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:8px;background:#b9ad94}
.ip li.studying .dot{background:var(--navy)}
.ip .empty{color:var(--mute);margin:0}
.ip .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
`;
let styled = false;
function injectCss() { if (styled) return; styled = true; const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s); }
const el = (tag, props = {}, ...kids) => { const n = Object.assign(document.createElement(tag), props); kids.flat().forEach(k => n.append(k)); return n; };

export function mountInvitePanel(host, presence) {
  injectCss();
  let code = null, off = () => {};
  const root = el('div', { className: 'ip', role: 'region', ariaLabel: 'Study with friends' });
  const status = el('div', { className: 'sr', role: 'status', ariaLive: 'polite' });

  const codeOut = el('output', { ariaLabel: 'Your room code' });
  const copyBtn = el('button', { type: 'button', className: 'alt', textContent: 'Copy' });
  const inviteBtn = el('button', { type: 'button', textContent: 'Invite friends' });
  const codeRow = el('div', { className: 'code', hidden: true }, codeOut, copyBtn);
  const inviteMsg = el('p', { className: 'msg' });

  const input = el('input', { id: 'ip-code', type: 'text', maxLength: 8, autocomplete: 'off', spellcheck: false, placeholder: 'ABC 234', ariaDescribedby: 'ip-err' });
  const joinBtn = el('button', { type: 'submit', textContent: 'Join' });
  const joinMsg = el('p', { className: 'msg', id: 'ip-err' });
  const form = el('form', { noValidate: true }, el('label', { htmlFor: 'ip-code', className: 'sr', textContent: 'Room code' }), el('div', { className: 'row' }, input, joinBtn), joinMsg);

  const leaveBtn = el('button', { type: 'button', className: 'alt', textContent: 'Leave room', hidden: true });
  const list = el('ul', { ariaLabel: 'Friends in this room' });

  root.append(
    el('section', {}, el('h3', { textContent: 'Invite friends' }), inviteBtn, codeRow, inviteMsg),
    el('section', {}, el('h3', { textContent: 'Join a room' }), form),
    el('section', {}, el('h3', { textContent: 'In this room' }), list, leaveBtn),
    status);
  host.appendChild(root);

  const say = (n, text, err) => { n.textContent = text; n.classList.toggle('err', !!err); };
  const showCode = c => { code = c; codeOut.textContent = formatCode(c); codeRow.hidden = false; leaveBtn.hidden = false; };
  const renderPeers = peers => {
    list.replaceChildren();
    if (!peers.length) { list.append(el('li', {}, el('p', { className: 'empty', textContent: code ? 'No one else is here yet. Share your code.' : 'Create or join a room to see friends.' }))); return; }
    peers.forEach(p => {
      const st = p.state || p.status, mins = p.minutesToday | 0;
      list.append(el('li', { className: st }, el('span', {}, el('span', { className: 'dot', ariaHidden: 'true' }), p.name), el('small', { textContent: `${st === 'studying' ? 'Studying' : 'Away'}, ${mins} min today` })));
    });
  };
  off = presence.onPeers(renderPeers);

  inviteBtn.onclick = async () => {
    try { const r = await presence.createRoom(); showCode(String(r)); say(inviteMsg, 'Share this code with a friend.'); status.textContent = `Room code ${formatCode(String(r))}`; copyBtn.focus(); }
    catch (e) { say(inviteMsg, e.message || MESSAGES.offline, true); }
  };
  copyBtn.onclick = async () => {
    try { await navigator.clipboard.writeText(code); say(inviteMsg, 'Code copied.'); }
    catch { const r = document.createRange(); r.selectNodeContents(codeOut); const s = getSelection(); s.removeAllRanges(); s.addRange(r); say(inviteMsg, 'Press Ctrl+C to copy the selected code.'); }
  };
  input.oninput = () => { input.removeAttribute('aria-invalid'); say(joinMsg, ''); };
  form.onsubmit = async e => {
    e.preventDefault();
    const c = normalizeCode(input.value);
    if (!isValidCode(c)) { input.setAttribute('aria-invalid', 'true'); say(joinMsg, MESSAGES.badCode, true); input.focus(); return; }
    joinBtn.disabled = true;
    const r = await presence.joinRoom(c);
    joinBtn.disabled = false;
    if (!r.ok) { input.setAttribute('aria-invalid', 'true'); say(joinMsg, r.error || MESSAGES.notFound, true); input.focus(); return; }
    showCode(r.code); input.value = ''; say(joinMsg, 'You joined the room.'); renderPeers(presence.list?.() || []);
  };
  leaveBtn.onclick = () => { (presence.leaveRoom || presence.leave).call(presence); code = null; codeRow.hidden = true; leaveBtn.hidden = true; say(inviteMsg, ''); say(joinMsg, 'You left the room.'); inviteBtn.focus(); };

  return { root, destroy() { off(); root.remove(); } };
}
