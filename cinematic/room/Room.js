// The Room level (PRD section 7), module contract from app/contract.js: mount(host, ctx) -> { dispose() }.
// ctx = { profile, student, events, nav, level } plus optional { floor, floorCount, visitors, onTalk, flat }.
// One model (roomThemes.buildRoomModel) feeds a 3D scene (Scene3D.js, three loaded lazily) or the flat SVG room (FlatRoom.js).
// Both sit beside the same accessible list of targets, so the room is fully usable by keyboard, screen reader, and without WebGL.
import { reducedMotion } from '../quality.js';
import { buildRoomModel, panelFor, targetById, TARGETS } from './roomThemes.js';
import { mountFlat } from './FlatRoom.js';

const h = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (v == null || v === false) continue; if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v); }
  for (const kid of kids.flat()) if (kid != null) e.append(kid.nodeType ? kid : document.createTextNode(kid));
  return e;
};

export function mount(host, ctx = {}) {
  let disposed = false, view = null, mode = 'loading', openId = null, lastFocus = null;
  const model = buildRoomModel({ profile: ctx.profile, student: ctx.student, events: ctx.events || [], floor: ctx.floor, floorCount: ctx.floorCount });
  const sh = model.shield;

  // ---- navigation / activation ----
  const go = (level, opts = {}) => {
    if (ctx.nav?.go) ctx.nav.go(level, opts);
    else host.dispatchEvent(new CustomEvent('room:navigate', { bubbles: true, detail: { level, opts } }));   // standalone page: the shell is not there
  };
  function activate(id) {
    const t = targetById(id); if (!t) return;
    if (t.kind === 'nav') { closePanel(); go(t.to); return; }                  // desk (always works) and window (tower)
    openPanel(id);
  }

  // ---- DOM ----
  const root = h('section', { class: 'room', 'data-mode': 'loading', 'data-theme': model.theme, 'aria-label': `Your room. ${model.summary}` });
  root.style.setProperty('--accent', model.accent);
  const badge = h('div', { class: 'room-shield', 'data-kind': sh.kind, role: 'status' },
    h('span', { class: 'shield-glyph', 'aria-hidden': 'true' }),
    h('div', { class: 'shield-text' }, h('strong', {}, `Pass Guarantee: ${sh.label}`), h('span', {}, sh.detail), h('span', { class: 'strikes' }, sh.strikeText)));
  const hud = h('header', { class: 'room-hud' },
    h('div', {}, h('h2', { class: 'room-title' }, `${model.themeLabel} room`), h('p', { class: 'room-sub' }, `Floor ${model.floor} · ${model.shape.corner ? 'Corner room, skyline view' : 'View of the next building'}`)), badge);
  const stage = h('div', { class: 'room-stage', 'aria-busy': 'true' }, h('p', { class: 'room-loading' }, 'Building your room…'));
  const list = h('ul', { class: 'room-list' }, TARGETS.map(t => h('li', {},
    h('button', { type: 'button', class: 'room-item', 'data-id': t.id, 'aria-describedby': `hint-${t.id}`,
      onclick: () => activate(t.id), onpointerenter: () => view?.hover(t.id), onpointerleave: () => view?.hover(null), onfocus: () => view?.focus(t.id), onblur: () => view?.focus(null) },
    h('span', { class: 'room-item-label' }, t.label), h('span', { class: 'room-item-hint', id: `hint-${t.id}` }, t.hint)))));
  const nav = h('nav', { class: 'room-nav', 'aria-label': 'Things in your room' }, list);
  const panel = h('aside', { class: 'room-panel', hidden: true, role: 'region', tabindex: '-1' });
  root.append(hud, stage, nav, panel);
  host.append(root);

  // ---- info panel for the non-navigating targets ----
  function openPanel(id) {
    const p = panelFor(id, model, { visitors: ctx.visitors, talkReady: !!ctx.onTalk });
    if (!p) return;
    lastFocus = document.activeElement; openId = id; panel.replaceChildren();
    const titleId = `room-panel-title-${id}`;
    panel.setAttribute('aria-labelledby', titleId);
    panel.append(h('div', { class: 'panel-head' }, h('h3', { id: titleId }, p.title), h('button', { type: 'button', class: 'panel-close', onclick: closePanel }, 'Close')));
    if (id === 'door' || id === 'trophy') panel.append(h('div', { class: 'room-shield small', 'data-kind': sh.kind }, h('span', { class: 'shield-glyph', 'aria-hidden': 'true' }), h('strong', {}, `${sh.label} · ${sh.strikeText}`)));
    panel.append(h('ul', { class: 'panel-lines' }, p.lines.map(l => h('li', {}, l))));
    if (p.talk) {
      const note = h('p', { class: 'panel-note', 'aria-live': 'polite' });
      const input = h('input', { type: 'text', id: 'room-talk', autocomplete: 'off', placeholder: 'Say something to your future self' });
      panel.append(h('form', { class: 'panel-talk', onsubmit: e => {
        e.preventDefault(); const text = input.value.trim(); if (!text) return;
        host.dispatchEvent(new CustomEvent('room:talk', { bubbles: true, detail: { text } })); ctx.onTalk?.(text);
        note.textContent = ctx.onTalk ? 'Sent.' : 'Not connected yet, so this was not sent.'; input.value = '';
      } }, h('label', { for: 'room-talk', class: 'sr' }, 'Message to your future self'), input, h('button', { type: 'submit' }, 'Send')), note);
    }
    for (const a of p.actions) panel.append(h('button', { type: 'button', class: 'panel-action', onclick: () => { closePanel(); go(a.go, a.opts); } }, a.label));
    panel.hidden = false; root.dataset.panel = id; list.querySelectorAll('.room-item').forEach(b => b.setAttribute('aria-expanded', String(b.dataset.id === id)));
    panel.focus({ preventScroll: true });
  }
  function closePanel() {
    if (panel.hidden) return;
    panel.hidden = true; openId = null; delete root.dataset.panel;
    list.querySelectorAll('.room-item').forEach(b => b.removeAttribute('aria-expanded'));
    (lastFocus && document.contains(lastFocus) ? lastFocus : list.querySelector('.room-item'))?.focus?.({ preventScroll: true });
  }
  const onKey = e => { if (e.key === 'Escape' && openId) { e.stopPropagation(); closePanel(); } };
  root.addEventListener('keydown', onKey);

  // ---- renderer choice: 3D unless ?flat=1 / ctx.flat, or anything about WebGL fails ----
  const setMode = (m, why) => { mode = m; root.dataset.mode = m; if (why) root.dataset.why = why; stage.removeAttribute('aria-busy'); stage.querySelector('.room-loading')?.remove(); };
  function useFlat(why) {
    if (disposed) return;
    view?.dispose(); stage.querySelectorAll('.room-canvas, .room-tag').forEach(n => n.remove());
    view = mountFlat(stage, model, { onPick: activate });
    setMode('flat', why);
    if (why && why !== 'forced') console.warn('[room] using the flat room:', why);
  }
  const forceFlat = ctx.flat ?? new URLSearchParams(location.search).get('flat') === '1';
  const ready = (async () => {
    if (forceFlat) return useFlat('forced');
    try {
      const { createScene } = await import('./Scene3D.js');
      const v = await createScene(stage, model, { reduced: reducedMotion, onPick: activate, onHover: id => list.querySelectorAll('.room-item').forEach(b => b.classList.toggle('on', b.dataset.id === id)), onLost: () => useFlat('webgl context lost') });
      if (disposed) { v.dispose(); return; }
      view = v; setMode('3d');
    } catch (err) { useFlat(String(err?.message || err).slice(0, 120)); }
  })();

  return {
    get mode() { return mode; },
    ready, model,
    dispose() {
      if (disposed) return; disposed = true;
      root.removeEventListener('keydown', onKey); view?.dispose(); view = null; root.remove();
    },
  };
}

export default { mount };
