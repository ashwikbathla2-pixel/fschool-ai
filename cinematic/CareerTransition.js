// CareerTransition: after the answer, the school transforms around the student's goal,
// then zooms out into the JourneyMap and morphs into the dashboard. Owner: Phyllis.
// Usage: import { mount } from './CareerTransition.js'; mount(document.getElementById('career-mount'));
// Listens: 'career' {career_goal, confidence}. Drives states CAREER_TRANSITION -> PERSONALIZED_PATH -> APP_ENTRY.
import { STATES, on, emit, set, get, profile } from './state.js';
import { buildPath, applyProfile, renderDashboardChrome } from './LearningPath.js';
import { createJourneyMap } from './JourneyMap.js';

const PRIORITY = ['software', 'astronaut', 'architect', 'doctor', 'scientist', 'entrepreneur', 'lawyer', 'designer', 'artist', 'engineer'];
const FALLBACK = { label: 'Discovery', art: 'discovery', room: 'The Open School', interpretation: "You don't have to know yet. Let's explore.",
  lines: ["Let's explore."], interests: ['exploration'], foundations: ['science', 'technology', 'arts'],
  modules: [['Science', 'Ask how the world works.'], ['Technology', 'Build with tools.'], ['Arts', 'Make and express.'], ['Business', 'Turn ideas into action.'], ['Humanities', 'People and meaning.'], ['Design', 'Shape experiences.'], ['Sports', 'Learn through movement.']] };

let careersP;
function loadCareers() {
  return careersP ||= (async () => {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 4000);
    try { const r = await fetch(new URL('./careers.json', import.meta.url), { signal: ctl.signal }); if (!r.ok) throw 0; return await r.json(); }
    catch { return { unknown: FALLBACK }; }
    finally { clearTimeout(t); }
  })();
}

export function resolveCareer(data, text, confidence) {
  const t = String(text || '').toLowerCase().trim();
  if (data[t] && t !== 'unknown') return t; // exact key from the classifier
  if (confidence != null && confidence < 0.5) return 'unknown';
  for (const k of PRIORITY) if (data[k] && new RegExp(data[k].match, 'i').test(t)) return k;
  return 'unknown';
}

/* ---------- line art (restrained, navy on cream; wood accent) ---------- */
const helix = (x0, y0, h) => { let a = '', b = '', r = ''; for (let i = 0; i <= 24; i++) { const y = y0 + i * h / 24, dx = Math.sin(i / 24 * Math.PI * 4) * 26; a += `${i ? 'L' : 'M'}${x0 + dx} ${y} `; b += `${i ? 'L' : 'M'}${x0 - dx} ${y} `; if (i % 2 === 0) r += `<path d="M${x0 + dx} ${y}L${x0 - dx} ${y}"/>`; } return `<path d="${a}"/><path d="${b}"/>${r}`; };
const door = (x, label) => `<path d="M${x} 250V150a30 30 0 0 1 60 0V250z"/><circle cx="${x + 48}" cy="205" r="2.5"/><text x="${x + 30}" y="282" text-anchor="middle">${label}</text>`;
const ART = {
  medicine: `${helix(96, 70, 220)}<path d="M200 304H350M240 304V284H310V304M310 284C376 282 382 190 330 140M268 118L322 150 300 188 246 156Z M262 104L282 122M226 238H326"/><path class="ac" d="M244 232h54v6h-54z"/><rect x="400" y="70" width="150" height="230" rx="4"/><circle cx="475" cy="112" r="16"/><path d="M436 144Q475 132 514 144L520 236Q475 246 430 236Z"/><circle class="ac" cx="486" cy="180" r="9"/>`,
  engineering: `<path d="M90 304H220M155 304V256M155 256L232 180 318 214M318 214l22-16M318 214l22 18"/><circle cx="155" cy="256" r="8"/><circle cx="232" cy="180" r="8"/><circle class="ac" cx="470" cy="170" r="52"/><circle cx="470" cy="170" r="16"/><path d="M470 118v-14M470 222v14M418 170h-14M522 170h14M433 133l-10-10M507 207l10 10M507 133l10-10M433 207l-10 10"/><path d="M400 280H540M400 272v16M540 272v16"/><path d="M60 330H580"/>`,
  software: `<rect x="70" y="80" width="230" height="150" rx="6"/><path d="M140 230l-12 40h74l-12-40M100 120h80M100 140h50"/><path class="ac" d="M110 210l36-40 30 22 50-52 44 30"/><rect x="330" y="80" width="170" height="150" rx="6"/><path d="M360 120h110M360 146h80M360 172h100M415 230l-8 40h50l-8-40"/><rect x="530" y="70" width="64" height="210" rx="4"/><path d="M542 100h40M542 130h40M542 160h40M542 190h40M542 220h40"/><circle class="ac" cx="576" cy="100" r="3"/><path d="M60 304H590"/>`,
  science: `<path d="M110 90h50M125 90v70L82 260a14 14 0 0 0 12 20h82a14 14 0 0 0 12-20L145 160V90"/><path class="ac" d="M96 236h92"/><rect x="250" y="190" width="70" height="90" rx="4"/><path d="M250 214h70"/><path d="M370 280V90M370 280H580"/><circle cx="410" cy="230" r="5"/><circle cx="450" cy="200" r="5"/><circle cx="490" cy="170" r="5"/><circle cx="530" cy="130" r="5"/><path class="ac" d="M390 250C440 220 490 160 560 110"/>`,
  business: `<rect x="70" y="60" width="500" height="230" rx="6"/><rect x="110" y="100" width="90" height="70" transform="rotate(-3 155 135)"/><rect x="250" y="96" width="90" height="70" transform="rotate(2 295 131)"/><rect class="ac" x="400" y="104" width="100" height="70" transform="rotate(-2 450 139)"/><rect x="170" y="200" width="90" height="60" transform="rotate(2 215 230)"/><rect x="340" y="198" width="100" height="64" transform="rotate(-3 390 230)"/><path d="M200 135L250 131M340 131L400 139M215 170L200 200M295 166L340 198M450 174L440 198"/><path d="M130 120h40M130 136h30M270 116h44M270 132h30"/>`,
  design: `<rect x="70" y="60" width="330" height="240" rx="4"/><path class="ac" d="M110 250C150 80 250 80 280 170S340 260 370 110"/><path d="M110 250L150 196M280 170L246 120M280 170l36 44"/><rect x="104" y="244" width="12" height="12"/><rect x="274" y="164" width="12" height="12"/><rect x="364" y="104" width="12" height="12"/><circle cx="460" cy="110" r="24"/><circle class="ac" cx="520" cy="110" r="24"/><circle cx="460" cy="170" r="24"/><path d="M440 230H580M440 230v14M470 230v8M500 230v14M530 230v8M560 230v14"/>`,
  art: `<path d="M150 300L205 70M360 300L305 70M255 150v150"/><rect x="170" y="90" width="170" height="150" rx="2"/><circle class="ac" cx="230" cy="150" r="28"/><path d="M200 220C240 170 290 180 320 210M190 120l80-12"/><ellipse cx="490" cy="230" rx="76" ry="52"/><circle cx="458" cy="220" r="9"/><circle class="ac" cx="490" cy="206" r="9"/><circle cx="522" cy="224" r="9"/><circle cx="500" cy="250" r="9"/><path d="M420 150L560 90"/>`,
  architecture: `<path d="M120 300V120H300V300M300 300V190H440V300M70 300H520"/><path d="M120 120L210 70 300 120"/><path d="M150 160h30v30h-30zM210 160h30v30h-30zM250 160h30v30h-30zM150 220h30v30h-30zM250 220h30v30h-30zM330 220h30v30h-30zM390 220h30v30h-30z"/><path class="ac" d="M120 330H300M120 322v16M300 322v16"/><path d="M470 90a50 50 0 0 1 80 60M470 90l60 30"/>`,
  law: `<path d="M110 300H540M130 300V150M220 300V150M310 300V150M400 300V150M490 300V150M100 150H520L310 70Z"/><path class="ac" d="M310 210V260M270 260H350M262 210l-26 40h52zM358 210l-26 40h52z"/>`,
  space: `<circle cx="300" cy="180" r="84"/><path class="ac" d="M120 230C190 280 420 240 500 120"/><ellipse cx="300" cy="180" rx="180" ry="46" transform="rotate(-20 300 180)"/><path d="M230 140C260 120 330 120 360 140M246 190C280 210 330 205 354 186"/><circle cx="500" cy="118" r="6"/><circle cx="90" cy="80" r="2"/><circle cx="160" cy="130" r="2"/><circle cx="540" cy="250" r="2"/><circle cx="460" cy="60" r="2"/>`,
  discovery: `${door(40, 'Science')}${door(120, 'Technology')}${door(200, 'Arts')}${door(280, 'Business')}${door(360, 'Humanities')}${door(440, 'Design')}${door(520, 'Sports')}<path d="M20 250H620"/>`
};

const CSS = `
.cm-root{position:fixed;inset:0;z-index:60;display:none;color:var(--cm-ink);font-family:Inter,system-ui,sans-serif;--cm-cream:#f6efe3;--cm-paper:#fbf7ef;--cm-ink:#26231f;--cm-navy:#1f3350;--cm-wood:#a67c52;--cm-ease:cubic-bezier(.2,.7,.2,1)}
.cm-root.active{display:block}
.cm-root *{box-sizing:border-box}
.cm-wipe{position:absolute;inset:0;background:var(--cm-cream);clip-path:circle(0% at 50% 100%);transition:clip-path 1.1s var(--cm-ease)}
.cm-root.in .cm-wipe{clip-path:circle(150% at 50% 100%)}
.cm-stage3d{position:absolute;inset:0;opacity:0;transition:opacity .9s}.cm-root.in .cm-stage3d{opacity:1}.cm-root.is3d{background:#ece3d2}.cm-o{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.cm-shade{position:absolute;left:0;right:0;bottom:0;height:32vh;background:linear-gradient(transparent,rgba(246,239,227,.95) 70%);pointer-events:none;opacity:0;transition:opacity .8s .4s}.cm-root.in .cm-shade{opacity:1}.cm-root.path .cm-shade{opacity:0;transition-delay:0s}
.cm3-label{position:absolute;left:0;top:0;font:500 12px Inter,sans-serif;letter-spacing:.04em;background:#1f3350;color:#f6efe3;padding:5px 12px;border-radius:99px;opacity:0;transition:opacity .45s;white-space:nowrap;will-change:transform}.cm3-label.on{opacity:1}
@media (max-width:600px){.cm3-label{font-size:10px;padding:3px 8px}}
.cm-root.is3d .cm-path{transition:opacity .8s,background 1.4s,backdrop-filter 1.4s}.cm-root.dashing .cm-path{background:rgba(236,227,210,.86);backdrop-filter:blur(5px)}.cm-root.dashing .cm-o{opacity:0;transition:opacity .6s}.cm-root.is3d .cm-room{background:rgba(251,247,239,.93)}.cm-root.is3d .cm-dash-head{background:rgba(246,239,227,.92);padding:22px;border-radius:8px}
.cm-wipe::after{content:"";position:absolute;left:0;right:0;bottom:0;height:9vh;background:linear-gradient(#b48a5c,#8e6a43);opacity:.9}
.cm-brand{z-index:5;position:absolute;left:clamp(16px,4vw,48px);top:22px;font:700 1rem Outfit,Inter,sans-serif;letter-spacing:.24em;color:var(--cm-navy);opacity:0;transition:opacity .8s .6s;text-shadow:0 0 8px rgba(246,239,227,.9)}
.cm-root.in .cm-brand{opacity:1}
.cm-skip{z-index:5;position:absolute;text-shadow:0 0 8px rgba(246,239,227,.9);right:clamp(16px,4vw,48px);top:16px;background:none;border:0;color:var(--cm-ink);opacity:1;font:600 1rem Inter,sans-serif;cursor:pointer;padding:8px 12px;min-height:44px}
.cm-skip:hover{text-decoration:underline}
.cm-root :focus-visible{outline:2px solid var(--cm-navy);outline-offset:3px;border-radius:6px}
.cm-scene{position:absolute;inset:0;display:grid;grid-template-rows:1fr auto;justify-items:center;padding:8vh 20px 12vh;transition:opacity .8s,transform 1s var(--cm-ease)}
.cm-root.is3d .cm-scene{padding-bottom:7vh}.cm-scene.off{opacity:0;transform:scale(1.04);pointer-events:none}
.cm-art{width:min(640px,92vw);align-self:end;opacity:0;transition:opacity .9s .5s}
.cm-root.in .cm-art{opacity:1}
.cm-art svg{width:100%;height:auto;overflow:visible;fill:none;stroke:var(--cm-navy);stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.cm-art .ac{stroke:var(--cm-wood);stroke-width:2.2}
.cm-art text{fill:var(--cm-navy);stroke:none;font:500 11px Inter,sans-serif;letter-spacing:.04em}
.cm-art .ln{stroke-dasharray:1;stroke-dashoffset:1;animation:cmdraw 1.6s var(--cm-ease) forwards;animation-delay:calc(.5s + var(--i)*40ms)}
@keyframes cmdraw{to{stroke-dashoffset:0}}
.cm-room-tag{font:500 .78rem Inter,sans-serif;letter-spacing:.22em;text-transform:uppercase;color:var(--cm-wood);margin-bottom:10px;text-align:center}
.cm-kin{min-height:clamp(5rem,16vh,9rem);display:grid;align-content:start;justify-items:center;text-align:center}
.cm-line{grid-area:1/1;font:500 clamp(2rem,6vw,4.6rem)/1.08 'Iowan Old Style','Palatino Linotype',Georgia,serif;letter-spacing:-.02em;color:var(--cm-ink);max-width:16ch}
.cm-line.long{font-size:clamp(1.6rem,4.2vw,3rem);max-width:22ch}
.cm-w{display:inline-block;opacity:0;transform:translateY(.4em);animation:cmrise .7s var(--cm-ease) forwards;animation-delay:calc(var(--w)*110ms)}
.cm-line.out .cm-w{animation:cmout .5s ease forwards;animation-delay:0s}
@keyframes cmrise{to{opacity:1;transform:none}}
@keyframes cmout{from{opacity:1}to{opacity:0;transform:translateY(-.3em)}}
.cm-eyebrow{font:500 .78rem Inter,sans-serif;letter-spacing:.22em;text-transform:uppercase;color:var(--cm-wood);margin:0 0 10px}
/* path stage */
.cm-path{position:absolute;inset:0;overflow:auto;padding:7vh clamp(16px,5vw,64px) 8vh;opacity:0;pointer-events:none;transition:opacity .8s}
.cm-path.show{opacity:1;pointer-events:auto}
.cm-path-title{text-align:center;margin-bottom:4vh;font:500 clamp(1.8rem,4.5vw,3.2rem)/1.1 'Iowan Old Style','Palatino Linotype',Georgia,serif}
.cm-path-title small{display:block;font:400 1rem Inter,sans-serif;color:#6b6358;margin-top:8px}
.cm-stagebox{display:grid;grid-template-columns:minmax(0,1fr);gap:28px;max-width:1080px;margin:0 auto;align-items:start}
.cm-dash-head{display:none}
.cm-stagebox.dash{grid-template-columns:minmax(220px,320px) minmax(0,1fr)}
.cm-stagebox.dash .cm-dash-head{display:block;position:sticky;top:0}
.cm-dash-head h2{font:500 clamp(1.8rem,3.6vw,2.6rem)/1.1 'Iowan Old Style','Palatino Linotype',Georgia,serif;margin:0 0 10px}
.cm-sub{color:#5b5348;margin:0 0 22px;line-height:1.5}
.cm-begin{border:0;cursor:pointer;background:var(--cm-navy);color:var(--cm-cream);font:500 .95rem Inter,sans-serif;padding:13px 22px;border-radius:999px;min-height:44px;transition:transform .25s var(--cm-ease)}
.cm-begin:hover{transform:translateY(-2px)}
.cm-map{position:relative;opacity:0;transition:transform 1.8s var(--cm-ease),opacity 1.2s ease}
.cm-map.in{opacity:1}
.cm-links{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible;transition:opacity .5s}
.cm-links.gone{opacity:0}
.cm-links path{fill:none;stroke:var(--cm-wood);stroke-width:2;stroke-dasharray:1;stroke-dashoffset:1;transition:stroke-dashoffset .5s ease}
.cm-links path.lit{stroke-dashoffset:0}
.cm-rooms{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:clamp(18px,3vw,36px);position:relative}
.cm-room{background:var(--cm-paper);border:1.5px solid rgba(31,51,80,.28);border-radius:6px;padding:20px 20px 22px;min-height:132px;position:relative;opacity:.5;transition:opacity .5s,border-color .5s,background .5s}
.cm-room.on{opacity:1;border-color:var(--cm-navy)}
.cm-room:first-child.on{background:#fff}
.cm-num{font:500 .75rem Inter,sans-serif;letter-spacing:.18em;color:var(--cm-wood)}
.cm-room h3{font:500 1.3rem 'Iowan Old Style','Palatino Linotype',Georgia,serif;margin:8px 0 6px;color:var(--cm-navy)}
.cm-room p{margin:0;font-size:.9rem;color:#5b5348;line-height:1.4}
.cm-map.dash .cm-rooms{grid-template-columns:repeat(2,minmax(0,1fr))}
.cm-map.dash .cm-room{opacity:1}
@media (max-width:760px){
 .cm-rooms{grid-template-columns:repeat(2,minmax(0,1fr))}
 .cm-stagebox.dash{grid-template-columns:minmax(0,1fr)}
 .cm-stagebox.dash .cm-dash-head{position:static}
 .cm-map.dash .cm-rooms{grid-template-columns:minmax(0,1fr)}
}
@media (prefers-reduced-motion:reduce){
 .cm-wipe{clip-path:none;opacity:0;transition:opacity .5s}.cm-root.in .cm-wipe{opacity:1}
 .cm-art .ln{animation:none;stroke-dashoffset:0}
 .cm-w{animation:cmfade .5s forwards;transform:none;animation-delay:0s}
 .cm-line.out .cm-w{animation:cmfadeout .3s forwards}
 .cm-scene{transition:opacity .4s;transform:none!important}
 @keyframes cmfade{to{opacity:1}}@keyframes cmfadeout{to{opacity:0}}
 .cm-map{transition:opacity .4s}.cm-begin:hover{transform:none}
}`;

function injectStyle() {
  if (document.getElementById('cm-style')) return;
  const s = document.createElement('style'); s.id = 'cm-style'; s.textContent = CSS; document.head.appendChild(s);
}

function kinetic(text, i) {
  const el = document.createElement('div');
  el.className = 'cm-line' + (text.length > 26 ? ' long' : '');
  el.setAttribute('aria-live', 'polite');
  text.split(' ').forEach((w, n) => { const s = document.createElement('span'); s.className = 'cm-w'; s.style.setProperty('--w', n); s.textContent = w + ' '; el.appendChild(s); });
  return el;
}

export function mount(host) {
  if (!host) return () => {};
  injectStyle();
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.createElement('div');
  root.className = 'cm-root'; root.setAttribute('role', 'region'); root.setAttribute('aria-label', 'Your journey');
  host.appendChild(root);
  let running = false, skipped = false, map = null, g3 = null;

  const sleep = ms => new Promise(r => { const t = setTimeout(r, ms); const iv = setInterval(() => { if (skipped) { clearTimeout(t); clearInterval(iv); r(); } }, 60); setTimeout(() => clearInterval(iv), ms + 100); });

  async function init3D(stageEl, overlay, modules, reduced, hero = 0) {
    const dh = await import('./world3d/Dollhouse.js');
    const rr = await import('./world3d/rooms/careerRooms.js');
    const world = (await dh.getSharedWorld()) || dh.createStage(stageEl);
    const types = modules.map(m => rr.roomForModule(m.label));
    const house = dh.createDollhouse(world, { rooms: types, labels: modules.map(m => m.label), overlay, reduced });
    house.addCharacters(hero).catch(() => {});
    return { world, house, dh };
  }

  async function run(ev) {
    if (running) return; running = true; skipped = false;
    let key = 'unknown', career = FALLBACK, data = { unknown: FALLBACK };
    try {
      data = await loadCareers();
      key = resolveCareer(data, ev?.career_goal, ev?.confidence);
      career = data[key] || data.unknown || FALLBACK;
    } catch { key = 'unknown'; career = data.unknown || FALLBACK; }
    applyProfile(career, key, ev?.confidence);
    set('state', STATES.CAREER_TRANSITION);
    const path = buildPath(career, key);
    const R = reduced();

    g3?.world.own && g3.world.dispose(); g3?.house.dispose(); g3 = null;
    root.innerHTML = '';
    root.classList.remove('in', 'is3d', 'path', 'dashing'); root.classList.add('active');
    root.insertAdjacentHTML('beforeend', '<div class="cm-stage3d"></div><div class="cm-o"></div>');
    try { g3 = await init3D(root.querySelector('.cm-stage3d'), root.querySelector('.cm-o'), path.modules, R, career.hero ?? 0); }
    catch (err) { console.warn('[cinematic] 3D unavailable, using 2D', err); g3 = null; root.innerHTML = ''; }
    if (g3) root.classList.add('is3d');
    const is3d = !!g3;

    root.insertAdjacentHTML('beforeend', `
      ${is3d ? '<div class="cm-shade"></div>' : '<div class="cm-wipe"></div>'}<div class="cm-brand">FSCHOOL</div>
      <button type="button" class="cm-skip" aria-label="Skip to your path">Skip</button>
      <div class="cm-scene" role="img" aria-label="${career.room}">
        ${is3d ? '<div></div>' : `<div class="cm-art"><svg viewBox="0 0 640 340" aria-hidden="true">${ART[career.art] || ART.discovery}</svg></div>`}
        <div><p class="cm-room-tag">${career.room}</p><div class="cm-kin"></div></div>
      </div>
      <div class="cm-path" aria-live="polite"></div>`);
    if (!is3d) root.querySelectorAll('.cm-art svg > *:not(text)').forEach((n, i) => { n.classList.add('ln'); n.setAttribute('pathLength', '1'); n.style.setProperty('--i', i); });
    root.querySelector('.cm-skip').onclick = () => { skipped = true; };
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('in')));

    try {
      const kin = root.querySelector('.cm-kin');
      let glide = null;
      if (is3d) {
        const hero = key === 'unknown' ? -1 : (career.hero ?? 0);
        if (hero >= 0) glide = g3.house.enter(hero, R ? 0 : 3.4);
        else { g3.house.startOverview(); g3.house.dimAll(); }
      }
      await sleep(R ? 300 : 1300);
      for (const text of career.lines) {
        if (skipped) break;
        const el = kinetic(text); kin.appendChild(el);
        const words = text.split(' ').length;
        await sleep((R ? 500 : 600) + words * 280 + (text.length < 14 ? 250 : 0));
        el.classList.add('out'); await sleep(R ? 250 : 450); el.remove();
      }
      await glide;
      await pathStage(path, R);
    } catch (err) {
      console.warn('[cinematic] career transition fell back', err);
      try { await pathStage(path, R); } catch { /* stay on screen, never show an error */ }
    }
  }

  async function pathStage(path, R) {
    skipped = false;
    const is3d = !!g3;
    const scene = root.querySelector('.cm-scene'), box = root.querySelector('.cm-path');
    set('state', STATES.PERSONALIZED_PATH);
    root.classList.add('path');
    if (is3d) {
      // The school pulls back into the cutaway; the student's rooms light in order with their labels.
      scene.classList.add('off');
      g3.house.dimAll();
      await g3.house.overview(R ? 0 : 2.4);
      await g3.house.lightPath(path.modules.map((_, i) => i), { gap: 560 });
      await sleep(R ? 300 : 1100);
      const rise = g3.house.rise(R ? 0 : 2.4);
      box.innerHTML = `<div class="cm-stagebox"></div>`; box.classList.add('show');
      const sb = box.querySelector('.cm-stagebox');
      map?.destroy(); map = createJourneyMap(sb, path, { reduced: R });
      sb.classList.add('dash');
      renderDashboardChrome(sb, path, beginApp(path));
      sb.insertBefore(sb.lastElementChild, map.el);
      await sleep(R ? 100 : 900);
      root.classList.add('dashing');
      map.showDashboard();
      await rise;
      running = false;
      return;
    }
    scene.classList.add('off');
    box.innerHTML = `<h2 class="cm-path-title"></h2><div class="cm-stagebox"></div>`;
    const title = box.querySelector('.cm-path-title');
    title.innerHTML = '<span class="cm-eyebrow" style="display:block"></span><span class="cm-ttl"></span>';
    title.querySelector('.cm-eyebrow').textContent = path.title;
    title.querySelector('.cm-ttl').textContent = path.key === 'unknown' ? 'Your school, open.' : 'The school, mapped for you.';
    box.classList.add('show');
    await sleep(R ? 200 : 700);
    const sb = box.querySelector('.cm-stagebox');
    map?.destroy(); map = createJourneyMap(sb, path, { reduced: R });
    await map.zoomOut();
    await map.lightPath();
    skipped = false;
    await sleep(R ? 300 : 900);
    title.style.display = 'none';
    sb.classList.add('dash');
    renderDashboardChrome(sb, path, beginApp(path));
    sb.insertBefore(sb.lastElementChild, map.el);
    await map.toDashboard();
    running = false; // APP_ENTRY fires when the student presses Begin, so the dashboard stays visible
  }
  const beginApp = path => mod => {
    emit('app-begin', { module: mod, path, profile });
    set('state', STATES.APP_ENTRY);
    emit('app-entry', { path, profile });
  };

  /* ---------- default flow: straight into the study room (no info screens) ----------
     Emits 'enter-study' {career, profile} at the start and 'study-ready' {career, profile} on arrival.
     Sets window.__studyActive so the host does not redirect away. Journey flow: ?flow=journey */
  const isJourneyFlow = typeof location !== 'undefined' && new URLSearchParams(location.search).get('flow') === 'journey';
  let study = null;
  async function runStudy(ev) {
    if (running) return; running = true;
    let key = 'unknown', career = FALLBACK;
    try { const data = await loadCareers(); key = resolveCareer(data, ev?.career_goal, ev?.confidence); career = data[key] || data.unknown || FALLBACK; } catch { /* unknown career: generic room */ }
    applyProfile(career, key, ev?.confidence);
    window.__studyActive = true;
    try { localStorage.setItem('fschool.profile', JSON.stringify(profile)); } catch { /* storage blocked */ }
    emit('enter-study', { career: key, profile });
    set('state', STATES.CAREER_TRANSITION);
    root.innerHTML = ''; root.classList.remove('in', 'is3d', 'path', 'dashing'); root.classList.add('active');
    const hostEl = document.createElement('div'); hostEl.className = 'cm-study'; hostEl.style.cssText = 'position:absolute;inset:0;background:#ece3d2;opacity:0;transition:opacity .8s'; root.appendChild(hostEl);
    requestAnimationFrame(() => requestAnimationFrame(() => { hostEl.style.opacity = '1'; }));
    const ready = () => { emit('study-ready', { career: key, profile }); };
    try {
      const sw = await import('./world3d/study/StudyWorld.js');
      study = await sw.createStudyWorld(hostEl, { career: key === 'unknown' ? 'default' : key, intro: true, line: "Let's get you set up.", onReady: ready });
    } catch (err) {
      console.warn('[cinematic] study room fell back to the simple view', err);
      simpleStudy(hostEl, career, ready);
    }
  }
  // Fallback when 3D cannot start: same focus timer, no 3D.
  async function simpleStudy(hostEl, career, ready) {
    const { FocusTimer } = await import('./world3d/study/FocusTimer.js');
    hostEl.innerHTML = `<div style="position:absolute;inset:0;display:grid;place-content:center;text-align:center;font-family:Inter,system-ui,sans-serif;color:#1f3350;padding:24px">
      <h2 style="font:500 2rem 'Iowan Old Style',Georgia,serif;margin:0 0 6px">Your study room</h2><p style="margin:0 0 20px;opacity:.8">${career.label} focus session</p>
      <div id="ss-time" role="timer" aria-label="Time remaining" style="font:500 3.4rem 'Iowan Old Style',Georgia,serif;margin-bottom:16px">25:00</div>
      <div><button id="ss-go" type="button" style="min-height:44px;padding:0 24px;border-radius:999px;border:1.5px solid #1f3350;background:#1f3350;color:#f6efe3;font:600 1rem Inter,sans-serif;cursor:pointer">Start studying</button>
      <button id="ss-end" type="button" hidden style="min-height:44px;padding:0 24px;margin-left:8px;border-radius:999px;border:1.5px solid #1f3350;background:#f6efe3;color:#1f3350;font:600 1rem Inter,sans-serif;cursor:pointer">End session</button></div></div>`;
    const t = new FocusTimer(), el = hostEl.querySelector('#ss-time'), go = hostEl.querySelector('#ss-go'), end = hostEl.querySelector('#ss-end');
    t.onChange = st => { go.hidden = st !== 'idle'; end.hidden = st === 'idle'; };
    go.onclick = () => t.start(); end.onclick = () => t.end();
    (function tick() { t.update(); el.textContent = t.label; requestAnimationFrame(tick); })();
    ready();
  }

  const offCareer = on('career', ev => (isJourneyFlow ? run(ev) : runStudy(ev)));
  const offState = on('change:state', ({ value }) => {
    if (value === STATES.CAREER_TRANSITION && !running && profile.career_goal) (isJourneyFlow ? run : runStudy)({ career_goal: profile.career_goal, confidence: profile.confidence });
  });
  return () => { offCareer(); offState(); study?.dispose?.(); map?.destroy(); g3?.house.dispose(); g3?.world.own && g3.world.dispose(); root.remove(); };
}
