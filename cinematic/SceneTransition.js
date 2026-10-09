// Scene handoffs. Owner: Jim.
// blendEntries(): virtual frames that cross-fade the last frame of one clip into the first of the next.
// leave(): fade the whole stage to cream, then run a callback (used for APP_ENTRY).

export function blendEntries(prev, next, n) {
  const out = [];
  for (let k = 1; k <= n; k++) out.push({ ...prev, b: { clip: next.clip, i: next.i }, t: k / (n + 1) });
  return out;
}

export function fadeVeil(veil, to, ms = 700) {
  return new Promise(resolve => {
    if (!veil) return resolve();
    veil.style.transitionDuration = ms + 'ms';
    veil.style.opacity = String(to);
    setTimeout(resolve, ms);
  });
}

export async function leave(veil, fn, ms = 800) {
  await fadeVeil(veil, 1, ms);
  fn();
}
