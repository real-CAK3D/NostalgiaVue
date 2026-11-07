// Fits the TV and the remote on screen together on any device (phone, tablet, desktop).
// Wide screens: the set and the remote side by side, both sized to the screen's height.
// Tall screens: the set on top and the remote under it, scaled to the room that's left; when even a
// shrunk remote won't fit (small phones upright), the set stays pinned at the top and the remote
// scrolls under it.
const $ = s => document.querySelector(s);
const MIN_REMOTE = 0.6;            // smallest the remote gets before its buttons are too small to hit
const minZoom = H => (H < 460 ? 0.45 : MIN_REMOTE);   // phones on their side have very little height

let raf = 0;
export const fitSoon = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; fit(); }); };

export function fit() {
  const body = document.body, room = $('#room'), set = $('#set'), remote = $('#remote');
  if (!room || !set) return;
  if (body.classList.contains('zoom')) { set.style.width = ''; if (remote) remote.style.zoom = ''; return; }
  const vv = window.visualViewport, vw = vv ? vv.width : innerWidth, vh = vv ? vv.height : innerHeight;
  const cs = getComputedStyle(body);
  const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight), padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
  // the keyboard-shortcut line under the set (desktops only) needs its room too
  const hint = $('#hint'), hintH = hint && hint.offsetParent ? hint.offsetHeight + parseFloat(getComputedStyle(hint).marginTop) : 0;
  const W = vw - padX, H = vh - padY - hintH;
  const showRemote = remote && !body.classList.contains('no-remote');

  // natural sizes: the set's height-to-width ratio and the remote's full size
  set.style.width = ''; if (remote) { remote.style.zoom = ''; remote.classList.remove('wide'); }
  body.classList.remove('fit-row', 'fit-col', 'pin-tv');
  const cap = set.offsetWidth >= 600 ? set.offsetWidth : 1000;     // the skin's own maximum width
  const ratio = () => set.offsetHeight / Math.max(1, set.offsetWidth);
  const rw = showRemote ? remote.offsetWidth : 0, rh = showRemote ? remote.offsetHeight : 0;

  const wide = vw > vh * 1.05;
  if (wide) {
    body.classList.add('fit-row');
    const gap = showRemote ? Math.min(40, W * 0.03) + (matchMedia('(pointer:coarse)').matches ? 0 : 24) : 0;
    const rz = showRemote ? Math.max(minZoom(H), Math.min(1, H / rh)) : 1;
    if (showRemote) remote.style.zoom = rz;
    let w = Math.min(cap, W - rw * rz - gap);
    set.style.width = w + 'px';
    // the set's proportions shift a little with its width, so settle in two passes
    for (let i = 0; i < 2; i++) { w = Math.min(cap, W - rw * rz - gap, H / ratio()); set.style.width = Math.max(240, w) + 'px'; }
  } else {
    body.classList.add('fit-col');
    const gap = showRemote ? 14 : 0;
    // the wide (three-column) remote is short, so the set can take more of the height with it
    let wideW = 0, wideH = 0;
    if (showRemote) { remote.classList.add('wide'); wideW = remote.offsetWidth; wideH = remote.offsetHeight; remote.classList.remove('wide'); }
    const tryShare = share => {
      let w = Math.min(cap, W, H * share / ratio()); set.style.width = w + 'px';
      w = Math.min(cap, W, H * share / ratio()); set.style.width = w + 'px';
      const left = H - set.offsetHeight - gap;
      const tall = Math.min(1, left / rh, W / rw), wide = Math.min(1, left / wideH, W / wideW);
      return { share, left, tall, wide, best: Math.max(tall, wide) };
    };
    if (showRemote) {
      // a bigger set or bigger remote buttons: prefer the set unless the buttons would get too small
      const opts = [0.72, 0.64, 0.56].map(tryShare);
      const pick = opts.find(o => o.best >= 0.8) || opts.reduce((a, b) => (b.best > a.best ? b : a));
      tryShare(pick.share);
      const useWide = pick.wide >= pick.tall;
      remote.classList.toggle('wide', useWide);
      const rz = Math.max(minZoom(H), useWide ? pick.wide : pick.tall);
      remote.style.zoom = rz;
      body.classList.toggle('pin-tv', (useWide ? wideH : rh) * rz > pick.left + 4);
    } else {
      let w = Math.min(cap, W, H / ratio()); set.style.width = w + 'px';
      w = Math.min(cap, W, H / ratio()); set.style.width = w + 'px';
    }
  }
  // some sets (the 80s console's knobs and side panel) don't scale evenly with their width:
  // measure what actually spills past the screen and shrink the set by that much
  for (let i = 0; i < 8; i++) {
    const over = document.documentElement.scrollHeight - Math.ceil(vh);
    if (over <= 1 || body.classList.contains('pin-tv')) break;
    if (i === 7) { if (body.classList.contains('fit-col')) body.classList.add('pin-tv'); break; }
    const sh = set.offsetHeight, w = set.offsetWidth, nw = w * (sh - over) / sh;
    // never shrink the set to a postage stamp: below 60% of the width, let the remote scroll under it
    if (nw < W * 0.6) { if (body.classList.contains('fit-col')) body.classList.add('pin-tv'); break; }
    set.style.width = nw + 'px';
  }
}

export function initFit() {
  addEventListener('resize', fitSoon);
  addEventListener('orientationchange', () => setTimeout(fit, 250));
  window.visualViewport?.addEventListener('resize', fitSoon);
  // a different set or remote, the remote shown/hidden, or zoom mode: fit again
  const mo = new MutationObserver(fitSoon);
  for (const el of [$('#cabinet'), $('#remote'), $('#decoTop'), $('#stand')]) if (el) mo.observe(el, { childList: true });
  // (only the classes that change the layout: fit's own classes would otherwise loop)
  const key = () => ['zoom', 'no-remote'].map(c => document.body.classList.contains(c)).join();
  let last = key();
  new MutationObserver(() => { const k = key(); if (k !== last) { last = k; fitSoon(); } }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  document.fonts?.ready.then(fitSoon);
  fit();
}
