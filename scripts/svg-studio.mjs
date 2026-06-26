/**
 * Animated SVG generators for the 97115104 profile README.
 * GitHub-safe: CSS keyframes + SMIL only, no JavaScript.
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

const ACCENT = '#52b788';
const ACCENT2 = '#74c69d';
const GLOW = '#95d5b2';
const INK = '#d8f3dc';

export function renderHero() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="920" height="260" viewBox="0 0 920 260" role="img" aria-label="97115104">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0a0f1a">
        <animate attributeName="stop-color" values="#0a0f1a;#0d1b2a;#0a0f1a" dur="8s" repeatCount="indefinite"/>
      </stop>
      <stop offset="50%" stop-color="#1b263b">
        <animate attributeName="stop-color" values="#1b263b;#14213d;#1b263b" dur="8s" repeatCount="indefinite"/>
      </stop>
      <stop offset="100%" stop-color="#0a0f1a"/>
    </linearGradient>
    <linearGradient id="strokeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${ACCENT}"/>
      <stop offset="50%" stop-color="${GLOW}"/>
      <stop offset="100%" stop-color="${ACCENT2}"/>
    </linearGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="3" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e3a5f" stroke-width="0.5" opacity="0.35"/>
    </pattern>
    <pattern id="hex" width="56" height="100" patternUnits="userSpaceOnUse" patternTransform="scale(0.5)">
      <path d="M28 0 L56 16 L56 48 L28 64 L0 48 L0 16 Z" fill="none" stroke="#1e3a5f" stroke-width="0.6" opacity="0.25"/>
    </pattern>
    <style>
      @keyframes draw { from { stroke-dashoffset: 800; } to { stroke-dashoffset: 0; } }
      @keyframes fadeUp { from { opacity: 0; } to { opacity: 1; } }
      @keyframes scan { 0% { transform: translateY(-260px); } 100% { transform: translateY(260px); } }
      @keyframes drift { 0% { transform: translateX(0); } 100% { transform: translateX(-40px); } }
      @keyframes glitch1 { 0%,100% { transform: translate(0); } 20% { transform: translate(-3px,1px); } 40% { transform: translate(3px,-1px); } 60% { transform: translate(-2px,2px); } }
      @keyframes glitch2 { 0%,100% { transform: translate(0); opacity: 0; } 20% { transform: translate(3px,-1px); opacity: 0.4; } 40% { transform: translate(-3px,1px); opacity: 0.3; } }
      .title-stroke {
        fill: none; stroke: url(#strokeGrad); stroke-width: 2.5;
        stroke-dasharray: 800; stroke-dashoffset: 0;
        animation: draw 3s ease-out forwards;
        filter: url(#glow);
      }
      .sub { fill: ${INK}; opacity: 0; animation: fadeUp 1.2s ease 1.5s forwards; }
      .tag { fill: ${ACCENT2}; font-family: ui-monospace,monospace; opacity: 0; animation: fadeUp 1s ease 2.2s forwards; }
      .scanline { animation: scan 4s linear infinite; opacity: 0.06; }
      .grid-pan { animation: drift 20s linear infinite; }
      .glitch-a { animation: glitch1 4s infinite; }
      .glitch-b { fill: #e5383b; opacity: 0; animation: glitch2 4s infinite; }
    </style>
  </defs>
  <rect width="920" height="260" fill="url(#bg)" rx="16"/>
  <rect width="920" height="260" fill="url(#hex)" rx="16" opacity="0.5"/>
  <rect width="920" height="260" fill="url(#grid)" class="grid-pan" rx="16"/>
  <rect class="scanline" x="0" y="0" width="920" height="4" fill="${ACCENT}"/>
  ${particles(24)}
  <text x="460" y="108" text-anchor="middle" class="title-stroke glitch-b" font-family="ui-monospace,monospace" font-size="64" font-weight="700">97115104</text>
  <text x="460" y="108" text-anchor="middle" class="title-stroke glitch-a" font-family="ui-monospace,monospace" font-size="64" font-weight="700">97115104</text>
  <text x="460" y="142" text-anchor="middle" class="sub" font-family="Georgia,serif" font-size="22" letter-spacing="6">A U S T I N   H A R S H B E R G E R</text>
  <text x="460" y="188" text-anchor="middle" class="tag" font-size="15">plan → build → verify</text>
  <text x="460" y="210" text-anchor="middle" class="tag" font-size="11" opacity="0.7">open systems · attribution · personal inference</text>
  <rect x="380" y="228" width="160" height="2" rx="1" fill="${ACCENT}" opacity="0.5">
    <animate attributeName="width" values="40;160;40" dur="3s" repeatCount="indefinite"/>
    <animate attributeName="x" values="440;380;440" dur="3s" repeatCount="indefinite"/>
  </rect>
</svg>`;
}

function particles(n) {
  let out = '';
  for (let i = 0; i < n; i++) {
    const x = 60 + (i * 47) % 800;
    const y = 20 + (i * 31) % 220;
    const r = 1 + (i % 3);
    const dur = 3 + (i % 5);
    out += `<circle cx="${x}" cy="${y}" r="${r}" fill="${ACCENT}" opacity="0.4">
      <animate attributeName="cy" values="${y};${y - 30};${y}" dur="${dur}s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0.1;0.7;0.1" dur="${dur}s" repeatCount="indefinite"/>
    </circle>`;
  }
  return out;
}

export function renderCanvas(snapshot, attestation, stylePass, ledger) {
  const w = 920;
  const h = 520;
  const metrics = snapshot.metrics ?? {};
  const attests = metrics.total_attestations ?? '—';
  const repos = snapshot.repo_count ?? '—';
  const receipts = ledger.with_receipts ?? 0;
  const shortId = attestation.urls?.short?.split('/').pop() ?? '···';
  const plan = snapshot.plan.slice(0, 3);
  const build = snapshot.build.slice(0, 4);
  const verify = snapshot.verify.slice(0, 3);
  const posts = snapshot.recent_posts.slice(0, 4).map((p) => p.title);
  const marquee = posts.length ? posts.join('   ◆   ') : 'blog.97115104.com';

  const planItems = plan
    .map((p, i) => `<text x="48" y="${168 + i * 24}" fill="#b7e4c7" font-family="ui-monospace,monospace" font-size="10" opacity="0"><animate attributeName="opacity" from="0" to="0.9" begin="${0.3 + i * 0.2}s" dur="0.5s" fill="freeze"/>${escapeXml(truncate(p, 36))}</text>`)
    .join('\n');

  const buildItems = build
    .map((b, i) => {
      const barW = Math.max(20, 120 - i * 18);
      return `<text x="340" y="${168 + i * 28}" fill="#b7e4c7" font-family="ui-monospace,monospace" font-size="10">${escapeXml(truncate(b.name, 16))}</text>
<rect x="340" y="${174 + i * 28}" width="0" height="6" rx="3" fill="url(#barGrad)">
  <animate attributeName="width" from="0" to="${barW}" begin="${0.5 + i * 0.15}s" dur="0.8s" fill="freeze"/>
</rect>`;
    })
    .join('\n');

  const verifyItems = verify
    .map((v, i) => `<text x="632" y="${168 + i * 26}" fill="#b7e4c7" font-family="ui-monospace,monospace" font-size="10">${escapeXml(truncate(v.repo, 14))} <tspan fill="${ACCENT}">●</tspan></text>`)
    .join('\n');

  const ledgerDots = ledger.entries.slice(0, 12).map((e, i) => {
    const cx = 48 + i * 68;
    const lit = e.latest_url ? ACCENT : '#415a77';
    return `<circle cx="${cx}" cy="468" r="5" fill="${lit}"><animate attributeName="r" values="4;6;4" dur="${2 + (i % 3)}s" repeatCount="indefinite"/></circle>
<text x="${cx}" y="486" text-anchor="middle" fill="#8d99ae" font-family="ui-monospace,monospace" font-size="7">${escapeXml(truncate(e.repo, 8))}</text>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Live profile canvas">
  <defs>
    <linearGradient id="barGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${ACCENT}"/><stop offset="100%" stop-color="${GLOW}"/>
    </linearGradient>
    <linearGradient id="panelGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1b263b"/><stop offset="100%" stop-color="#0d1b2a"/>
    </linearGradient>
    <filter id="softGlow"><feGaussianBlur stdDeviation="2"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <style>
      @keyframes orbit { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      @keyframes pulse { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }
      @keyframes flow { 0% { offset-distance: 0%; opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { offset-distance: 100%; opacity: 0; } }
      @keyframes marquee { 0% { transform: translateX(920px); } 100% { transform: translateX(-100%); } }
      .orbit { transform-origin: 130px 130px; animation: orbit 24s linear infinite; }
      .ring-pulse { animation: pulse 2s ease-in-out infinite; }
      .marquee { animation: marquee 28s linear infinite; }
    </style>
    <path id="flowPath" d="M 280 200 C 310 200, 310 200, 340 200"/>
    <path id="flowPath2" d="M 570 200 C 600 200, 600 200, 632 200"/>
  </defs>
  <rect width="${w}" height="${h}" fill="#0a0f1a" rx="16" stroke="#1e3a5f" stroke-width="1"/>
  <rect width="${w}" height="${h}" fill="url(#panelGrad)" opacity="0.03" rx="16"/>
  <!-- stats bar -->
  <rect x="16" y="16" width="888" height="52" rx="10" fill="#111927" stroke="#2d6a4f" stroke-width="1"/>
  <text x="40" y="48" fill="${GLOW}" font-family="ui-monospace,monospace" font-size="13">${attests} attestations</text>
  <text x="240" y="48" fill="${GLOW}" font-family="ui-monospace,monospace" font-size="13">${repos} repos</text>
  <text x="420" y="48" fill="${GLOW}" font-family="ui-monospace,monospace" font-size="13">${receipts} provenance receipts</text>
  <text x="640" y="48" fill="${ACCENT}" font-family="ui-monospace,monospace" font-size="13">attest/s/${escapeXml(shortId)}</text>
  <rect x="820" y="30" width="60" height="24" rx="6" fill="${stylePass ? '#2d6a4f' : '#9b2226'}"/>
  <text x="850" y="47" text-anchor="middle" fill="#fff" font-family="ui-monospace,monospace" font-size="11" font-weight="700">${stylePass ? 'STYLE' : 'FAIL'}</text>
  <!-- attest ring -->
  <g transform="translate(130,130)">
    <circle r="52" fill="none" stroke="#1e3a5f" stroke-width="1"/>
    <g class="orbit">
      <circle cx="52" cy="0" r="3" fill="${ACCENT}"/>
    </g>
    <circle class="ring-pulse" r="42" fill="none" stroke="${ACCENT}" stroke-width="2" stroke-dasharray="8 6" filter="url(#softGlow)"/>
    <text text-anchor="middle" y="6" fill="${INK}" font-family="ui-monospace,monospace" font-size="14" font-weight="700">attest</text>
    <text text-anchor="middle" y="22" fill="${ACCENT2}" font-family="ui-monospace,monospace" font-size="9">v3.0 · live</text>
  </g>
  <!-- panels -->
  <rect x="16" y="88" width="280" height="280" rx="12" fill="url(#panelGrad)" stroke="#2d6a4f" stroke-width="1"/>
  <rect x="308" y="88" width="280" height="280" rx="12" fill="url(#panelGrad)" stroke="#2d6a4f" stroke-width="1"/>
  <rect x="600" y="88" width="304" height="280" rx="12" fill="url(#panelGrad)" stroke="#2d6a4f" stroke-width="1"/>
  <text x="32" y="118" fill="${ACCENT}" font-family="ui-monospace,monospace" font-size="12" font-weight="700">PLAN</text>
  <text x="324" y="118" fill="${ACCENT}" font-family="ui-monospace,monospace" font-size="12" font-weight="700">BUILD</text>
  <text x="616" y="118" fill="${ACCENT}" font-family="ui-monospace,monospace" font-size="12" font-weight="700">VERIFY</text>
  ${planItems}
  ${buildItems}
  ${verifyItems}
  <!-- flow particles -->
  <circle r="4" fill="${GLOW}"><animateMotion dur="2.5s" repeatCount="indefinite" path="M 296 200 L 340 200"/></circle>
  <circle r="4" fill="${GLOW}"><animateMotion dur="2.5s" begin="1.2s" repeatCount="indefinite" path="M 588 200 L 632 200"/></circle>
  <circle r="3" fill="${ACCENT}"><animateMotion dur="3s" begin="0.6s" repeatCount="indefinite" path="M 880 360 C 920 380, 920 100, 48 120"/></circle>
  <circle r="2" fill="${GLOW}"><animateMotion dur="4s" begin="2s" repeatCount="indefinite" path="M 880 360 C 920 380, 920 100, 48 120"/></circle>
  <circle r="2" fill="${ACCENT2}"><animateMotion dur="3.5s" begin="1s" repeatCount="indefinite" path="M 296 200 L 340 200"/></circle>
  <!-- ledger strip -->
  <rect x="16" y="432" width="888" height="72" rx="10" fill="#111927" stroke="#415a77" stroke-width="1"/>
  <text x="32" y="454" fill="#8d99ae" font-family="ui-monospace,monospace" font-size="9">PROVENANCE</text>
  ${ledgerDots}
  <!-- marquee -->
  <clipPath id="clip"><rect x="16" y="388" width="888" height="28" rx="4"/></clipPath>
  <g clip-path="url(#clip)">
    <text class="marquee" x="0" y="408" fill="#74c69d" font-family="ui-monospace,monospace" font-size="11">${escapeXml(marquee)}   ◆   ${escapeXml(marquee)}</text>
  </g>
</svg>`;
}

export function renderOrbit() {
  const pinned = [
    { name: 'attest', angle: 0 },
    { name: 'endor-train', angle: 60 },
    { name: 'hsc-chat', angle: 120 },
    { name: 'voice-clone', angle: 180 },
    { name: 'vLLM-harness', angle: 240 },
    { name: 'ollama-harness', angle: 300 },
  ];
  const nodes = pinned.map(({ name, angle }) => {
    const rad = (angle * Math.PI) / 180;
    const cx = 460 + Math.cos(rad) * 160;
    const cy = 100 + Math.sin(rad) * 70;
    return `<a xlink:href="https://github.com/97115104/${name}" target="_blank">
<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="22" fill="#1b263b" stroke="${ACCENT}" stroke-width="1.5">
  <animate attributeName="r" values="20;24;20" dur="${3 + (angle % 3)}s" repeatCount="indefinite"/>
</circle>
<text x="${cx.toFixed(1)}" y="${(cy + 4).toFixed(1)}" text-anchor="middle" fill="${INK}" font-family="ui-monospace,monospace" font-size="8">${escapeXml(truncate(name, 12))}</text>
</a>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="920" height="200" viewBox="0 0 920 200" role="img" aria-label="Pinned repositories orbit">
  <defs>
    <style>
      @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      @keyframes spinRev { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
      .orbit-ring { transform-origin: 460px 100px; animation: spin 60s linear infinite; }
      .orbit-ring-rev { transform-origin: 460px 100px; animation: spinRev 45s linear infinite; }
    </style>
  </defs>
  <rect width="920" height="200" fill="#0a0f1a" rx="16" stroke="#1e3a5f" stroke-width="1"/>
  <ellipse class="orbit-ring" cx="460" cy="100" rx="160" ry="70" fill="none" stroke="#2d6a4f" stroke-width="1" stroke-dasharray="4 8" opacity="0.6"/>
  <ellipse class="orbit-ring-rev" cx="460" cy="100" rx="120" ry="50" fill="none" stroke="#40916c" stroke-width="0.5" stroke-dasharray="2 12" opacity="0.4"/>
  <circle cx="460" cy="100" r="28" fill="#1b263b" stroke="${GLOW}" stroke-width="2"/>
  <text x="460" y="105" text-anchor="middle" fill="${INK}" font-family="ui-monospace,monospace" font-size="11" font-weight="700">97115104</text>
  ${nodes}
</svg>`;
}

export function renderTicker(posts) {
  const items = posts.length
    ? posts.map((p) => `${p.title}`).join('  ◆  ')
    : 'blog.97115104.com  ◆  random musings  ◆  AI guest posts  ◆  ';
  const doubled = `${items}  ◆  ${items}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="920" height="36" viewBox="0 0 920 36" role="img" aria-label="Blog ticker">
  <defs>
    <style>
      @keyframes scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
      .track { animation: scroll 40s linear infinite; }
    </style>
    <clipPath id="tclip"><rect width="920" height="36" rx="8"/></clipPath>
  </defs>
  <rect width="920" height="36" fill="#111927" rx="8" stroke="#2d6a4f" stroke-width="1"/>
  <g clip-path="url(#tclip)">
    <text class="track" x="0" y="23" fill="#74c69d" font-family="ui-monospace,monospace" font-size="11">${escapeXml(doubled)}</text>
  </g>
</svg>`;
}

export function renderStyleBadge(pass) {
  const color = pass ? '#52b788' : '#e5383b';
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="120" height="32" viewBox="0 0 120 32">
  <rect width="120" height="32" rx="8" fill="${color}">
    <animate attributeName="opacity" values="0.85;1;0.85" dur="2s" repeatCount="indefinite"/>
  </rect>
  <text x="60" y="21" text-anchor="middle" fill="#fff" font-family="ui-monospace,monospace" font-size="11" font-weight="700">${pass ? 'STYLE OK' : 'STYLE FAIL'}</text>
</svg>`;
}
