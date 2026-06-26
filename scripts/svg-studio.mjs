/**
 * SVG generators — GitHub-safe (CSS + SMIL only, no JavaScript).
 */

export function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function truncate(s, n) {
  const t = String(s ?? '');
  return t.length <= n ? t : `${t.slice(0, n - 1)}…`;
}

const BG = '#0d1117';
const PANEL = '#161b22';
const BORDER = '#30363d';
const GREEN = '#3fb950';
const BLUE = '#58a6ff';
const PURPLE = '#bc8cff';
const MUTED = '#8b949e';
const TEXT = '#c9d1d9';

export function renderHero() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="920" height="120" viewBox="0 0 920 120" role="img" aria-label="97 115 104">
  <defs>
    <style>
      @keyframes glow { 0%,100% { opacity: 0.85; } 50% { opacity: 1; } }
      @keyframes slide { from { letter-spacing: 28px; opacity: 0; } to { letter-spacing: 18px; opacity: 1; } }
      .nums { animation: slide 1.2s ease-out forwards, glow 3s ease-in-out 1.2s infinite; }
      @keyframes tagline { from { opacity: 0; } to { opacity: 1; } }
      .tag { animation: tagline 0.8s ease 1s forwards; opacity: 0; }
    </style>
  </defs>
  <rect width="920" height="120" fill="${BG}" rx="12"/>
  <text x="460" y="62" text-anchor="middle" fill="${GREEN}" font-family="ui-monospace,monospace" font-size="42" font-weight="700" class="nums">97 115 104</text>
  <text x="460" y="98" text-anchor="middle" fill="${MUTED}" font-family="ui-monospace,monospace" font-size="16" class="tag">code is cool</text>
</svg>`;
}

function chatLine(y, user, color, msg, delay) {
  const d = delay.toFixed(1);
  return `<text x="24" y="${y}" fill="${MUTED}" font-family="ui-monospace,monospace" font-size="11" opacity="0">
    <animate attributeName="opacity" from="0" to="1" begin="${d}s" dur="0.4s" fill="freeze"/>
    <tspan fill="${color}" font-weight="600">${escapeXml(user)}</tspan><tspan fill="${TEXT}"> ${escapeXml(truncate(msg, 52))}</tspan>
  </text>`;
}

function tetrisCell(x, y, fill) {
  return `<rect x="${x}" y="${y}" width="11" height="11" rx="1" fill="${fill}" stroke="#0d1117" stroke-width="0.5"/>`;
}

function tetrisPiece(blocks, color, startY, dur, delay) {
  const rects = blocks.map(([cx, cy]) => tetrisCell(cx * 12, cy * 12, color)).join('');
  return `<g opacity="0">
    <animate attributeName="opacity" from="0" to="1" begin="${delay}s" dur="0.1s" fill="freeze"/>
    <animateTransform attributeName="transform" type="translate"
      values="0 ${startY}; 0 ${startY + 24}; 0 ${startY + 48}; 0 ${startY + 72}; 0 ${startY + 96}"
      dur="${dur}s" begin="${delay}s" repeatCount="indefinite"/>
    ${rects}
  </g>`;
}

function renderTetrisPanel(ox, oy) {
  const grid = Array.from({ length: 10 }, (_, row) =>
    Array.from({ length: 8 }, (_, col) => {
      const settled = (row > 7 && col > 2 && col < 7) || (row === 7 && col >= 3 && col <= 5);
      return settled ? tetrisCell(ox + col * 12, oy + row * 12, ['#f85149', '#a371f7', '#58a6ff', '#3fb950'][(col + row) % 4]) : '';
    }).join(''),
  ).join('');

  return `<g>
  <rect x="${ox - 4}" y="${oy - 4}" width="104" height="128" rx="4" fill="#010409" stroke="${BORDER}"/>
  ${grid}
  ${tetrisPiece([[3, 0], [4, 0], [5, 0], [6, 0]], '#58a6ff', 0, 3, 0)}
  ${tetrisPiece([[3, 0], [4, 0], [3, 1], [4, 1]], '#f85149', -24, 2.5, 3)}
  ${tetrisPiece([[4, 0], [3, 1], [4, 1], [5, 1]], '#a371f7', -24, 2.8, 5.5)}
  ${tetrisPiece([[3, 0], [4, 0], [5, 0], [4, 1]], '#3fb950', -24, 2.6, 8)}
  <text x="${ox + 40}" y="${oy + 140}" text-anchor="middle" fill="${MUTED}" font-family="ui-monospace,monospace" font-size="9">lines: <tspan fill="${GREEN}">42</tspan></text>
</g>`;
}

export function renderCanvas(snapshot) {
  const w = 920;
  const h = 400;
  const posts = snapshot.recent_posts.slice(0, 4);
  const commits = snapshot.recent_commits.slice(0, 5);

  let y = 88;
  const blogLines = posts.map((p, i) => {
    const line = chatLine(y + i * 22, '@blog', BLUE, p.title, 0.2 + i * 0.35);
    return line;
  });

  const commitStart = 0.2 + posts.length * 0.35 + 0.3;
  const gitLines = commits.map((c, i) => {
    const msg = `${c.repo}: ${c.message}`;
    return chatLine(88 + (posts.length + i) * 22, '@git', GREEN, msg, commitStart + i * 0.35);
  });

  const totalLines = posts.length + commits.length;
  const cursorY = 88 + totalLines * 22 + 8;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="terminal feed">
  <defs>
    <style>
      @keyframes blink { 0%,49% { opacity: 1; } 50%,100% { opacity: 0; } }
      .cursor { animation: blink 1s step-end infinite; }
      @keyframes scanline { 0% { transform: translateY(-400px); } 100% { transform: translateY(400px); } }
      .scan { animation: scanline 6s linear infinite; opacity: 0.04; }
    </style>
    <clipPath id="term"><rect x="12" y="52" width="640" height="336" rx="0"/></clipPath>
  </defs>
  <rect width="${w}" height="${h}" fill="${BG}" rx="12" stroke="${BORDER}" stroke-width="1"/>
  <!-- title bar -->
  <rect x="12" y="12" width="696" height="36" rx="8" fill="${PANEL}"/>
  <circle cx="32" cy="30" r="5" fill="#ff5f57"/>
  <circle cx="50" cy="30" r="5" fill="#febc2e"/>
  <circle cx="68" cy="30" r="5" fill="#28c840"/>
  <text x="92" y="34" fill="${MUTED}" font-family="ui-monospace,monospace" font-size="11">97115104 — feed</text>
  <text x="680" y="34" fill="${MUTED}" font-family="ui-monospace,monospace" font-size="10">synced ${escapeXml(snapshot.synced_at.slice(0, 16))}Z</text>
  <!-- terminal body -->
  <rect x="12" y="52" width="696" height="336" fill="#010409" stroke="${BORDER}" stroke-width="1"/>
  <rect class="scan" x="12" y="0" width="696" height="2" fill="${GREEN}"/>
  <g clip-path="url(#term)">
    <text x="24" y="72" fill="${PURPLE}" font-family="ui-monospace,monospace" font-size="10" opacity="0">
      <animate attributeName="opacity" from="0" to="0.8" begin="0s" dur="0.3s" fill="freeze"/># latest from blog.97115104.com
    </text>
    ${blogLines.join('\n')}
    <text x="24" y="${88 + posts.length * 22 - 6}" fill="${PURPLE}" font-family="ui-monospace,monospace" font-size="10" opacity="0">
      <animate attributeName="opacity" from="0" to="0.8" begin="${commitStart - 0.1}s" dur="0.3s" fill="freeze"/># recent commits
    </text>
    ${gitLines.join('\n')}
    <text x="24" y="${cursorY}" fill="${GREEN}" font-family="ui-monospace,monospace" font-size="12" class="cursor">▋</text>
  </g>
  <!-- tetris panel -->
  <rect x="724" y="12" width="184" height="376" rx="8" fill="${PANEL}" stroke="${BORDER}"/>
  <text x="816" y="36" text-anchor="middle" fill="${MUTED}" font-family="ui-monospace,monospace" font-size="10">TETRIS</text>
  ${renderTetrisPanel(748, 52)}
</svg>`;
}
