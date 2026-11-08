// Phones and touch tablets open the settings, the guide and the ON DEMAND / library lists as
// full-screen pages with finger-sized controls; desktops with a mouse keep them inside the TV picture.
// (This never changes the TV and remote layout itself.)
export const sheetMode = () => matchMedia('(max-width: 760px), (pointer: coarse)').matches;
export const isPhone = () => matchMedia('(max-width: 760px), (max-height: 500px)').matches;   // incl. phones turned sideways

// Full-screen pages cover exactly what's visible. (On phones and tablets the page underneath can be
// wider than the screen, and "position: fixed" alone would size them to the page, not the screen.)
const pinned = new Map();
function place(el, panel) {
  const vv = window.visualViewport, x = vv ? vv.offsetLeft : 0, y = vv ? vv.offsetTop : 0;
  const w = vv ? vv.width : innerWidth, h = vv ? vv.height : innerHeight;
  if (panel) {   // tablets: a centered panel
    const pw = Math.min(900, w * 0.94), ph = Math.min(1200, h * 0.92);
    Object.assign(el.style, { left: x + (w - pw) / 2 + 'px', top: y + (h - ph) / 2 + 'px', width: pw + 'px', height: ph + 'px', right: 'auto', bottom: 'auto', transform: 'none' });
  } else Object.assign(el.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px', right: 'auto', bottom: 'auto' });
}
export function pinToView(el, panel = false) {
  unpinFromView(el);
  const f = () => place(el, panel);
  f(); pinned.set(el, f);
  window.visualViewport?.addEventListener('resize', f); window.visualViewport?.addEventListener('scroll', f);
  addEventListener('resize', f);
}
export function unpinFromView(el) {
  const f = pinned.get(el); if (!f) return;
  window.visualViewport?.removeEventListener('resize', f); window.visualViewport?.removeEventListener('scroll', f);
  removeEventListener('resize', f); pinned.delete(el);
  for (const k of ['left', 'top', 'width', 'height', 'right', 'bottom', 'transform']) el.style[k] = '';
}
