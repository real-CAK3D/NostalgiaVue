// The NostalgiaVue brand mark: a little CRT with a rainbow "V" inside, plus the wordmark.
const STRIPES = ['#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#0a84ff'];

export function emblem(id = 'e') {
  // 5 rainbow chevrons nested to form a V inside a rounded tube
  const chevrons = STRIPES.map((c, i) => {
    const o = i * 5;
    return `<path d="M${14 + o} ${14 + o * .4} L50 ${78 - o * 1.2} L${86 - o} ${14 + o * .4}" fill="none" stroke="${c}" stroke-width="5.2" stroke-linejoin="round" stroke-linecap="round"/>`;
  }).join('');
  return `<svg class="nv-emblem" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
<defs><radialGradient id="${id}g" cx="40%" cy="30%" r="80%"><stop offset="0" stop-color="#3a4a5a"/><stop offset="1" stop-color="#05080c"/></radialGradient>
<clipPath id="${id}c"><rect x="6" y="8" width="88" height="80" rx="20"/></clipPath></defs>
<rect x="2" y="4" width="96" height="88" rx="24" fill="#c9ced6"/>
<rect x="6" y="8" width="88" height="80" rx="20" fill="url(#${id}g)"/>
<g clip-path="url(#${id}c)" class="nv-chevrons">${chevrons}</g>
<path d="M14 14 Q40 6 70 12" stroke="#fff" stroke-opacity=".35" stroke-width="3" fill="none" stroke-linecap="round"/>
<rect x="38" y="92" width="24" height="5" rx="2" fill="#9aa1ab"/></svg>`;
}

// Wordmark; style: 'chrome' (on the set), 'white', 'dark', 'color'
export function wordmark(style = 'chrome', id = 'w') {
  const fill = style === 'white' ? '#fff' : style === 'dark' ? '#2b3038' : style === 'color' ? `url(#${id}r)` : `url(#${id}m)`;
  return `<svg class="nv-word" viewBox="0 0 330 70" xmlns="http://www.w3.org/2000/svg">
<defs>
<linearGradient id="${id}m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#9ba3ad"/><stop offset=".55" stop-color="#5f6670"/><stop offset="1" stop-color="#e9edf2"/></linearGradient>
<linearGradient id="${id}r" x1="0" y1="0" x2="1" y2="0">${STRIPES.map((c, i) => `<stop offset="${i / 4}" stop-color="${c}"/>`).join('')}</linearGradient>
</defs>
<text x="4" y="50" font-family="'Lobster',cursive" font-size="48" fill="${fill}" stroke="rgba(0,0,0,.35)" stroke-width="1" paint-order="stroke">Nostalgia</text>
<text x="212" y="52" font-family="'Bungee',Impact,sans-serif" font-size="44" fill="${fill}" stroke="rgba(0,0,0,.35)" stroke-width="1" paint-order="stroke" letter-spacing="1">VUE</text></svg>`;
}

export function lockup(style = 'chrome', id = 'l') {
  return `<span class="nv-lockup">${emblem(id + 'e')}${wordmark(style, id + 'w')}</span>`;
}
