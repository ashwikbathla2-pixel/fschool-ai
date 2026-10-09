// App shell (PRD section 4): tower > room > desk, joined by camera-style transitions. Pure routing logic is exported at the top and tested in
// shell.test.mjs (runs in node); every DOM or history call lives inside boot(). The shell never imports a level module until that level is opened,
// so ?level=desk loads no 3D code at all (PRD rule 3). Module shape follows app/contract.js: mount(host, ctx) -> { dispose() }.
import { LEVELS, parentLevel, makeNav, loadProfile, loadStudent, loadEvents } from './contract.js';

// ---- config: every value here is a proposal, not a PRD decision --------------------------------------------------------------
export const CONFIG = {
  interviewUrl: '../interview/index.html',
  defaultLevel: 'room',          // PRD: after the lobby, the app opens on the student's own room
  moveMs: 520,                   // camera-style crossfade length; 0 when reduced motion is on
  // Decision 5 (PRD section 4, "Sachcit decides"), proposal: the Desk is the same app, mounted by this shell, and the Room instance stays alive
  // (hidden, inert, render loop paused) while the Desk is open so the pull-back is instant. Cost: the room's GPU memory stays held during a block.
  // Set keepRoomAlive false to dispose the room and rebuild it on return instead (slower return, less memory on weak laptops).
  keepRoomAlive: true,
  loaders: {
    tower: { mod: '../app/towerAdapter.js', css: [] },
    room: { mod: '../room/Room.js', css: ['../room/room.css'] },
    desk: { mod: '../desk/Desk.js', css: ['../desk/desk.css'] },
  },
};

// ---- pure routing logic ------------------------------------------------------------------------------------------------------
export const levelIndex = l => LEVELS.indexOf(l);
export const isLevel = l => LEVELS.includes(l);
export const backTarget = l => (levelIndex(l) > 0 ? parentLevel(l) : null);           // the tower has nothing above it

// Every move is exactly one level: a request for a farther level is clamped to one step toward it.
export function clampMove(from, to) {
  if (!isLevel(from) || !isLevel(to) || from === to) return from;
  return LEVELS[levelIndex(from) + Math.sign(levelIndex(to) - levelIndex(from))];
}
// 'in' = zooming toward the desk, 'out' = pulling back toward the tower.
export const direction = (from, to) => (levelIndex(to) > levelIndex(from) ? 'in' : levelIndex(to) < levelIndex(from) ? 'out' : 'none');

// Where to go on load. No saved profile means first visit: the lobby, except a Desk deep link, which must work alone and so never waits on the lobby.
export function resolveRoute({ search = '', profile = null } = {}) {
  const asked = new URLSearchParams(search).get('level');
  const level = isLevel(asked) ? asked : CONFIG.defaultLevel;
  if (!profile && level !== 'desk') return { kind: 'interview', url: CONFIG.interviewUrl };
  return { kind: 'open', level, deepLink: isLevel(asked) };
}

// History is seeded with the ancestors of the entry level, so browser Back always has a parent entry to land on, including after a deep link.
export const historyChain = level => LEVELS.slice(0, levelIndex(level) + 1);

// What a popstate means: the entry's level, but never more than one step from where we are.
export const popTarget = (current, entryLevel) => (isLevel(entryLevel) ? clampMove(current, entryLevel) : backTarget(current) || current);

// Leaving a level: does the instance stay mounted (hidden, paused) so coming back is instant?
export const keepAlive = (from, to, cfg = CONFIG) => cfg.keepRoomAlive && from === 'room' && to === 'desk';

export const levelLabel = l => ({ tower: 'Tower', room: 'Room', desk: 'Desk' }[l] || l);

// ---- DOM ---------------------------------------------------------------------------------------------------------------------
const reducedMotion = () => {
  try { return matchMedia('(prefers-reduced-motion: reduce)').matches || new URLSearchParams(location.search).get('motion') === 'reduce'; } catch { return false; }
};
const loadCss = href => new Promise(res => {
  const url = new URL(href, import.meta.url).href;
  if ([...document.querySelectorAll('link[rel=stylesheet]')].some(l => l.href === url)) return res();
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = url; l.onload = l.onerror = () => res(); document.head.appendChild(l);
});

export function boot(root = document.getElementById('shell')) {
  const route = resolveRoute({ search: location.search, profile: loadProfile() });
  if (route.kind === 'interview') { location.replace(route.url); return null; }

  const stage = root.querySelector('.stage'), backBtn = root.querySelector('#back'), crumb = root.querySelector('#crumb'), live = root.querySelector('#live');
  const layers = {};            // level -> { el, host, inst, ready: Promise }
  let shown = null, token = 0, disposed = false;

  const ctxFor = (level, extra = {}) => {
    const profile = loadProfile();
    return { profile, student: loadStudent(profile), events: loadEvents(), nav, level, ...extra };
  };

  function errorPanel(host, level, err, retry) {
    host.innerHTML = '';
    const p = document.createElement('div'); p.className = 'err'; p.setAttribute('role', 'alert');
    p.innerHTML = `<h2>The ${levelLabel(level).toLowerCase()} could not open</h2><p>This part is not available right now. Nothing you did was lost.</p>`;
    const row = document.createElement('div'); row.className = 'err-row';
    const again = Object.assign(document.createElement('button'), { type: 'button', textContent: 'Try again' }); again.className = 'primary';
    again.onclick = retry; row.appendChild(again);
    if (backTarget(level)) { const b = Object.assign(document.createElement('button'), { type: 'button', textContent: `Back to the ${levelLabel(backTarget(level)).toLowerCase()}` }); b.onclick = () => nav.back(); row.appendChild(b); }
    p.appendChild(row); host.appendChild(p);
    console.warn('[shell]', level, err);
  }

  // Build (or reuse) a layer and mount its module. The layer stays hidden until ready, so the outgoing level is never replaced by a blank frame.
  function prepare(level, extra) {
    let L = layers[level];
    if (L && L.inst) return L.ready;
    if (!L) {
      const el = document.createElement('section'); el.className = 'lv'; el.dataset.level = level; el.hidden = true;
      el.setAttribute('aria-label', levelLabel(level));
      const host = document.createElement('div'); host.className = 'lv-host'; el.appendChild(host); stage.appendChild(el);
      L = layers[level] = { el, host, inst: null, ready: null };
    }
    const retry = () => { L.ready = null; prepare(level, extra).then(() => { if (shown === level) reveal(level); }); };
    L.ready = (async () => {
      try {
        const cfg = CONFIG.loaders[level];
        await Promise.all(cfg.css.map(loadCss));
        const mod = await import(cfg.mod);
        if (typeof mod.mount !== 'function') throw new Error(`${cfg.mod} has no mount()`);
        L.host.innerHTML = '';
        L.inst = (await mod.mount(L.host, ctxFor(level, extra))) || { dispose() {} };
        // a module may expose `ready` (a promise): wait briefly so the camera move lands on a finished picture, never a half-built one
        if (L.inst.ready?.then) await Promise.race([L.inst.ready.catch(() => {}), new Promise(r => setTimeout(r, 4000))]);
      } catch (e) { errorPanel(L.host, level, e, retry); }   // calm inline panel, never a crash
      return L;
    })();
    return L.ready;
  }

  const setActive = (level, active) => {
    const L = layers[level]; if (!L) return;
    L.el.inert = !active;
    L.host.dispatchEvent(new CustomEvent('study:visibility', { detail: { active }, bubbles: false }));
    try { active ? L.inst?.resume?.() : L.inst?.pause?.(); } catch (e) { console.warn('[shell] pause/resume', e); }
  };
  const drop = level => {
    const L = layers[level]; if (!L) return;
    try { L.inst?.dispose?.(); } catch (e) { console.warn('[shell] dispose', e); }
    L.el.remove(); delete layers[level];
  };
  function reveal(level) { const L = layers[level]; if (L) { L.el.hidden = false; setActive(level, true); L.el.querySelector('button, [tabindex], input, a')?.focus?.({ preventScroll: true }); } }

  function chrome(level) {
    backBtn.hidden = !backTarget(level);
    if (backTarget(level)) backBtn.setAttribute('aria-label', `Back to the ${levelLabel(backTarget(level)).toLowerCase()}`), backBtn.querySelector('.t').textContent = levelLabel(backTarget(level));
    crumb.innerHTML = LEVELS.map(l => `<li${l === level ? ' aria-current="step" class="on"' : ''}>${levelLabel(l)}</li>`).join('');
    document.title = `${levelLabel(level)} · Study World`;
    root.dataset.level = level;
  }

  // The one place a level changes on screen. The outgoing layer stays visible until the incoming one has mounted, then they crossfade with a zoom.
  async function transition(to, opts = {}) {
    const from = shown;
    if (from === to) return;
    const my = ++token;
    const L = await prepare(to, opts.extra);
    if (disposed || my !== token) return;               // a newer move superseded this one
    const dir = from ? direction(from, to) : 'none';
    const ms = reducedMotion() ? 0 : CONFIG.moveMs;
    const inc = L.el, out = from && layers[from]?.el;
    shown = to; chrome(to);
    inc.hidden = false; inc.style.zIndex = 2; if (out) out.style.zIndex = 1;
    root.setAttribute('aria-busy', 'true');
    if (out) layers[from].el.inert = true;
    if (ms && out && inc.animate) {
      // zooming in: the incoming level grows from small, the outgoing one swells past the camera. Pulling out is the reverse.
      const inFrom = dir === 'in' ? 'scale(.86)' : 'scale(1.18)', outTo = dir === 'in' ? 'scale(1.18)' : 'scale(.86)';
      const o = { duration: ms, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'both' };
      await Promise.all([
        inc.animate([{ opacity: 0, transform: inFrom }, { opacity: 1, transform: 'scale(1)' }], o).finished,
        out.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: outTo }], o).finished,
      ]).catch(() => {});
      inc.getAnimations().forEach(a => a.cancel()); out.getAnimations().forEach(a => a.cancel());
    }
    if (disposed || my !== token) return;
    if (from) {
      if (keepAlive(from, to)) { layers[from].el.hidden = true; setActive(from, false); } else drop(from);
    }
    setActive(to, true);
    root.removeAttribute('aria-busy');
    inc.querySelector('button, [tabindex], input, a')?.focus?.({ preventScroll: true });
    live.textContent = `${levelLabel(to)}`;
  }

  // ---- navigation: nav (from contract.js) is what modules call; history stays in step with it --------------------------------
  const pushEntry = (level, replace) => history[replace ? 'replaceState' : 'pushState']({ level, shell: 1 }, '', location.href);
  const nav = makeNav((next, prev, opts) => {
    if (opts.init || opts.fromPop) { transition(next, opts); return; }
    const step = clampMove(prev, next);
    if (step !== next) { nav.go(step, opts); return; }          // one level per move; nav.go re-enters this handler with the clamped target
    if (direction(prev, next) === 'out') { history.back(); return; }   // popstate then performs the move, so the history entry is consumed, not duplicated
    pushEntry(next); transition(next, opts);
  });

  // Back from the Desk lets it show its exit summary first (optional hook: inst.requestExit() returns true when it took over).
  function goUp() {
    const L = layers[shown];
    try { if (shown === 'desk' && L?.inst?.requestExit?.()) return; } catch {}
    nav.back();
  }
  backBtn.addEventListener('click', goUp);
  addEventListener('keydown', e => { if (e.key === 'Escape' && !e.defaultPrevented && backTarget(shown)) { e.preventDefault(); goUp(); } });
  addEventListener('popstate', e => {
    const target = popTarget(shown, e.state?.level);
    if (target === shown) { if (e.state?.level !== shown) pushEntry(shown, true); return; }
    nav.go(target, { fromPop: true });
  });

  // ---- start: seed history with the ancestors so Back works even after a deep link; the entry level is the current entry ---------
  const chain = historyChain(route.level);
  chain.slice(0, -1).forEach((l, i) => { if (i === 0) pushEntry(l, true); else pushEntry(l); });
  pushEntry(route.level, chain.length === 1);
  nav.go(route.level, { init: true });

  return { nav, get level() { return shown; }, dispose() { disposed = true; Object.keys(layers).forEach(drop); } };
}
