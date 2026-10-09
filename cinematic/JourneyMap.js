// JourneyMap: the school pulls back into a floor plan (rooms = modules),
// the path lights up room by room, then the rooms morph (FLIP) into the dashboard.
// Owner: Phyllis.
const wait = ms => new Promise(r => setTimeout(r, ms));

export function createJourneyMap(host, path, { reduced = false } = {}) {
  const map = document.createElement('div');
  map.className = 'cm-map';
  map.innerHTML = `<svg class="cm-links" aria-hidden="true"></svg><div class="cm-rooms" role="list"></div>`;
  const roomsEl = map.querySelector('.cm-rooms');
  const svg = map.querySelector('.cm-links');
  const rooms = path.modules.map(m => {
    const el = document.createElement('div');
    el.className = 'cm-room';
    el.setAttribute('role', 'listitem');
    el.innerHTML = `<span class="cm-num"></span><h3></h3><p></p>`;
    el.querySelector('.cm-num').textContent = String(m.order).padStart(2, '0');
    el.querySelector('h3').textContent = m.label;
    el.querySelector('p').textContent = m.blurb;
    roomsEl.appendChild(el);
    return el;
  });
  host.appendChild(map);

  const center = el => {
    const r = el.getBoundingClientRect(), h = map.getBoundingClientRect();
    return [(r.left + r.width / 2 - h.left) / (map.__s || 1), (r.top + r.height / 2 - h.top) / (map.__s || 1)];
  };
  function drawLinks() {
    map.__s = 1;
    const h = map.getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${h.width} ${h.height}`);
    svg.innerHTML = '';
    for (let i = 0; i < rooms.length - 1; i++) {
      const [x1, y1] = center(rooms[i]), [x2, y2] = center(rooms[i + 1]);
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const my = (y1 + y2) / 2;
      p.setAttribute('d', `M${x1} ${y1} C${x1} ${my} ${x2} ${my} ${x2} ${y2}`);
      p.setAttribute('pathLength', '1');
      p.dataset.i = i;
      svg.appendChild(p);
    }
  }
  const onResize = () => { if (!map.classList.contains('dash')) drawLinks(); };
  addEventListener('resize', onResize);

  return {
    el: map,
    // Start zoomed into the first room, then pull back to the whole school.
    async zoomOut() {
      drawLinks();
      const first = center(rooms[0]);
      map.style.transformOrigin = `${first[0]}px ${first[1]}px`;
      if (reduced) { map.classList.add('in'); await wait(400); return; }
      map.style.transform = 'scale(2.4)'; map.style.opacity = '0';
      map.getBoundingClientRect();
      map.classList.add('in', 'pull');
      map.style.transform = 'scale(1)'; map.style.opacity = '1';
      await wait(1900);
    },
    // Light the path in order; each room becomes active, then done.
    async lightPath() {
      const links = [...svg.querySelectorAll('path')];
      for (let i = 0; i < rooms.length; i++) {
        rooms[i].classList.add('on');
        if (links[i - 1]) links[i - 1].classList.add('lit');
        await wait(reduced ? 120 : 420);
      }
    },
    // FLIP: rooms glide from floor-plan positions to dashboard cards.
    async toDashboard() {
      const first = rooms.map(r => r.getBoundingClientRect());
      svg.classList.add('gone');
      map.style.transform = ''; map.style.transformOrigin = '';
      map.classList.add('dash');
      if (!reduced) {
        rooms.forEach((r, i) => {
          const l = r.getBoundingClientRect();
          r.animate([
            { transform: `translate(${first[i].left - l.left}px,${first[i].top - l.top}px) scale(${first[i].width / l.width},${first[i].height / l.height})` },
            { transform: 'none' }
          ], { duration: 1100, delay: i * 60, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'backwards' });
        });
        await wait(1100 + rooms.length * 60);
      } else await wait(250);
    },
    // 3D mode: the cutaway stays behind; the rooms simply fade in as dashboard cards.
    showDashboard() { svg.classList.add('gone'); map.classList.add('in', 'dash'); rooms.forEach(r => r.classList.add('on')); },
    destroy() { removeEventListener('resize', onResize); map.remove(); }
  };
}
