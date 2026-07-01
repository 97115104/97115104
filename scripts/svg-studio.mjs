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

const BG = '#000000';
const INK = '#ffffff';
const MUTED = '#a3a3a3';
const BORDER = '#ffffff';
const FAINT = '#171717';
const INSET = 0.5;
const PINK = '#e879a9';

const FEED_BLOG_LIMIT = 6;
const FEED_COMMIT_LIMIT = 12;
const FEED_REPO_LIMIT = 3;
const FEED_COMMITS_PER_REPO = 3;
const FEED_TREE_REPO_H = 14;
const FEED_TREE_COMMIT_H = 20;
const FEED_TREE_GAP = 6;
const FEED_TREE_MORE_H = 12;
const FEED_BOOK_LINE_H = 20;
const FEED_BOOKS_READING_LIMIT = 3;
const CANVAS_W = 920;
const FEED_W = 450;
const RHYTHM_H = 108;
const HERO_H = 200;
const HERO_FRAME = { x: 16, y: 16, size: 168, pad: 4 };
const HERO_TEXT_X = 208;
const PT = 'America/Los_Angeles';
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const HERO_TAGLINE = [
  [
    { text: '"', pink: false },
    { text: 'silent ', pink: false },
    { text: 'waiting', pink: true },
    { text: ' on the ', pink: false },
    { text: 'truth', pink: true },
    { text: ',', pink: false },
  ],
  [
    { text: 'pure ', pink: false },
    { text: 'sitting', pink: true },
    { text: ' and ', pink: false },
    { text: 'breathing', pink: true },
  ],
  [
    { text: 'in the ', pink: false },
    { text: 'presence', pink: true },
    { text: ' of', pink: false },
  ],
  [
    { text: 'the ', pink: false },
    { text: 'question mark', pink: true },
    { text: '.', pink: false },
    { text: '"', pink: false },
  ],
];

const HERO_CHAR_W = 0.62;
const HERO_CLIP_PAD = 12;

function heroLineWidth(text, fontSize) {
  return text.length * fontSize * HERO_CHAR_W + HERO_CLIP_PAD;
}

function renderHeroTagline(tx, start) {
  const fontSize = 18;
  const lineH = 23;
  const y0 = 98;
  const charsPerSec = 17;
  const linePause = 0.1;
  let time = start;
  const clips = [];
  const texts = [];

  for (let i = 0; i < HERO_TAGLINE.length; i += 1) {
    const parts = HERO_TAGLINE[i];
    const plain = parts.map((p) => p.text).join('');
    const lineW = heroLineWidth(plain, fontSize);
    const dur = Math.max(plain.length / charsPerSec, 0.55);
    const y = y0 + i * lineH;
    const clipId = `hero-tag-${i}`;
    const clipY = y - fontSize + 4;
    const clipH = fontSize + 8;
    const begin = time.toFixed(2);
    const durStr = dur.toFixed(2);
    const lineWStr = lineW.toFixed(1);

    clips.push(`<clipPath id="${clipId}"><rect x="${tx}" y="${clipY}" height="${clipH}" width="0">
      <animate attributeName="width" from="0" to="${lineWStr}" begin="${begin}s" dur="${durStr}s" fill="freeze"/>
    </rect></clipPath>`);

    const tspans = parts
      .map((part) => `<tspan fill="${part.pink ? PINK : INK}">${escapeXml(part.text)}</tspan>`)
      .join('');
    texts.push(`<text x="${tx}" y="${y}" font-family="ui-monospace,monospace" font-size="${fontSize}" font-weight="400" clip-path="url(#${clipId})">${tspans}</text>`);
    time += dur + linePause;
  }

  const lastY = y0 + (HERO_TAGLINE.length - 1) * lineH;
  const cursorX = tx + heroLineWidth('the question mark', fontSize);
  const cursorBegin = time.toFixed(2);
  const cursor = `<text x="${cursorX.toFixed(1)}" y="${lastY}" fill="${PINK}" font-family="ui-monospace,monospace" font-size="${fontSize}" opacity="0">
  <animate attributeName="opacity" values="0;1;0;1;0" begin="${cursorBegin}s" dur="1.4s" fill="freeze"/>
  ▋</text>`;

  return { clips: clips.join('\n'), markup: `${texts.join('\n')}\n${cursor}` };
}

export function renderHero(artDataUri = null) {
  const hasArt = Boolean(artDataUri);
  const { x, y, size, pad } = HERO_FRAME;
  const tx = hasArt ? HERO_TEXT_X : 16;
  const ix = x + pad;
  const iy = y + pad;
  const is = size - pad * 2;
  const ruleW = hasArt ? CANVAS_W - tx - 32 : 488;
  const taglineStart = hasArt ? 1.05 : 0.45;
  const tagline = renderHeroTagline(tx, taglineStart);

  const corner = (cx, cy, dx, dy) =>
    `<path d="M${cx} ${cy + dy * 10} L${cx} ${cy} L${cx + dx * 10} ${cy}" fill="none" stroke="${INK}" stroke-width="1.5"/>`;

  const cx = ix + is / 2;
  const cy = iy + is / 2;

  const portrait = hasArt ? `<g>
    <rect x="${x}" y="${y}" width="${size}" height="${size}" fill="${FAINT}" stroke="${BORDER}" stroke-width="2"/>
    <rect x="${x + 6}" y="${y + 6}" width="${size - 12}" height="${size - 12}" fill="none" stroke="${MUTED}" stroke-width="1"/>
    ${corner(x + 10, y + 10, 1, 1)}
    ${corner(x + size - 10, y + 10, -1, 1)}
    ${corner(x + 10, y + size - 10, 1, -1)}
    ${corner(x + size - 10, y + size - 10, -1, -1)}
    <g clip-path="url(#hero-crt-clip)">
      <image href="${artDataUri}" x="${ix}" y="${iy}" width="${is}" height="${is}" preserveAspectRatio="xMidYMid slice"/>
      <rect x="${ix}" y="${iy}" width="${is}" height="${is}" fill="url(#hero-vignette)"/>
      <rect x="${ix}" y="${iy}" width="${is}" height="${is}" fill="#ffffff" opacity="0">
        <animate attributeName="opacity" values="0.95;0.55;0" keyTimes="0;0.18;0.42" dur="0.75s" fill="freeze"/>
      </rect>
      <rect x="${ix}" y="${cy - 1}" width="${is}" height="2" fill="#ffffff" opacity="0">
        <animate attributeName="opacity" values="0;1;0.35;0" keyTimes="0;0.22;0.38;0.55" dur="0.9s" fill="freeze"/>
        <animate attributeName="width" values="4;${is};${is}" keyTimes="0;0.32;1" dur="0.9s" fill="freeze"/>
        <animate attributeName="x" values="${cx - 2};${ix};${ix}" keyTimes="0;0.32;1" dur="0.9s" fill="freeze"/>
      </rect>
    </g>
    <rect x="${ix}" y="${iy}" width="${is}" height="2" fill="${INK}" opacity="0" clip-path="url(#hero-crt-clip)">
      <animate attributeName="opacity" values="0;0;0.08;0.08" keyTimes="0;0.55;0.65;1" dur="0.9s" fill="freeze"/>
      <animate attributeName="y" values="${iy};${iy + is - 2};${iy}" begin="0.9s" dur="6s" repeatCount="indefinite"/>
    </rect>
    <rect x="${x}" y="${y + size - 3}" width="${size}" height="3" fill="${PINK}" opacity="0.75">
      <animate attributeName="opacity" values="0.45;0.85;0.45" dur="3s" begin="0.9s" repeatCount="indefinite"/>
    </rect>
  </g>` : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${CANVAS_W}" height="${HERO_H}" viewBox="0 0 ${CANVAS_W} ${HERO_H}" role="img" aria-label="97 115 104">
  <defs>
    ${hasArt ? `<clipPath id="hero-crt-clip" clipPathUnits="userSpaceOnUse">
      <rect x="${cx - 2}" y="${cy - 2}" width="4" height="4">
        <animate attributeName="x" values="${cx - 2};${ix};${ix}" keyTimes="0;0.32;1" dur="0.9s" fill="freeze"/>
        <animate attributeName="y" values="${cy - 2};${cy - 1.5};${iy}" keyTimes="0;0.32;1" dur="0.9s" fill="freeze"/>
        <animate attributeName="width" values="4;${is};${is}" keyTimes="0;0.32;1" dur="0.9s" fill="freeze"/>
        <animate attributeName="height" values="4;3;${is}" keyTimes="0;0.32;1" dur="0.9s" fill="freeze"/>
      </rect>
    </clipPath>
    <radialGradient id="hero-vignette" cx="50%" cy="45%" r="65%">
      <stop offset="55%" stop-color="#000000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.4"/>
    </radialGradient>` : ''}
    ${tagline.clips}
    <style>
      @keyframes draw { from { stroke-dashoffset: ${ruleW}; } to { stroke-dashoffset: 0; } }
      .rule { stroke-dasharray: 2 10; stroke-linecap: round; animation: draw 1s ease 0.2s forwards; }
    </style>
  </defs>
  <rect width="${CANVAS_W}" height="${HERO_H}" fill="${BG}" stroke="${BORDER}" stroke-width="1"/>
  ${portrait}
  <text x="${tx}" y="56" fill="${INK}" font-family="ui-monospace,monospace" font-size="48" font-weight="700">97 115 104</text>
  <line x1="${tx}" y1="72" x2="${tx + ruleW}" y2="72" stroke="${INK}" stroke-width="2" class="rule"/>
  ${tagline.markup}
</svg>`;
}

function statLine(x, y, label, value, bold = false) {
  return `<text x="${x}" y="${y}" font-family="ui-monospace,monospace" font-size="10">
    <tspan fill="${MUTED}">${escapeXml(label)}</tspan><tspan fill="${INK}" font-weight="${bold ? '700' : '400'}"> ${escapeXml(value)}</tspan>
  </text>`;
}

function langRow(x, y, lang, repo, barW, maxBar, contentW, begin = null) {
  const barMax = Math.max(contentW, 1);
  const w = maxBar > 0 ? Math.min(barMax, Math.round((barW / maxBar) * barMax)) : 0;
  if (begin == null) {
    return `<text x="${x}" y="${y}" fill="${INK}" font-family="ui-monospace,monospace" font-size="10" font-weight="700">${escapeXml(truncate(lang, 14))}</text>
<text x="${x + contentW}" y="${y}" text-anchor="end" fill="${MUTED}" font-family="ui-monospace,monospace" font-size="9">${escapeXml(truncate(repo, 16))}</text>
<rect x="${x}" y="${y + 4}" width="${w}" height="4" fill="${INK}"/>`;
  }
  const barY = y + 4;
  return `<text x="${x}" y="${y}" fill="${INK}" font-family="ui-monospace,monospace" font-size="10" font-weight="700" opacity="0">
  <animate attributeName="opacity" from="0" to="1" begin="${begin}s" dur="0.3s" fill="freeze"/>
  ${escapeXml(truncate(lang, 14))}
</text>
<text x="${x + contentW}" y="${y}" text-anchor="end" fill="${MUTED}" font-family="ui-monospace,monospace" font-size="9" opacity="0">
  <animate attributeName="opacity" from="0" to="1" begin="${begin}s" dur="0.3s" fill="freeze"/>
  ${escapeXml(truncate(repo, 16))}
</text>
<rect x="${x}" y="${barY}" width="0" height="4" fill="${INK}">
  <animate attributeName="width" from="0" to="${w}" begin="${begin}s" dur="0.45s" fill="freeze"/>
</rect>`;
}

function sectionHeader(x, y, title) {
  return `<text x="${x}" y="${y}" fill="${INK}" font-family="ui-monospace,monospace" font-size="10" font-weight="700">${escapeXml(title)}</text>`;
}

function sectionRule(x, y, w) {
  return `<line x1="${x}" y1="${y}" x2="${x + w}" y2="${y}" stroke="${BORDER}" stroke-width="1"/>`;
}

function renderStatsPanel(snapshot, x, y, w, h) {
  const stats = snapshot.commit_stats ?? {};
  const profile = snapshot.profile_stats ?? {};
  const repo = snapshot.repo_stats ?? {};
  const langs = snapshot.languages_by_recency ?? [];
  const totals = snapshot.language_totals ?? [];
  const pad = 12;
  const contentW = w - pad * 2;
  const line = 14;
  const counts = snapshot.repo_counts ?? {};
  const pub = counts.public ?? snapshot.repo_count ?? '—';
  const priv = counts.private != null ? counts.private : '—';

  const blocks = [];
  let cy = y + 50;

  if (profile.followers != null) {
    blocks.push(sectionHeader(x + pad, cy, 'account'));
    cy += 6;
    blocks.push(sectionRule(x + pad, cy, w - pad * 2));
    cy += 10;
    blocks.push(statLine(x + pad, cy, 'followers', String(profile.followers)));
    cy += line;
    blocks.push(statLine(x + pad, cy, 'following', String(profile.following)));
    cy += line;
    blocks.push(statLine(x + pad, cy, 'since', profile.member_since ?? '—'));
    cy += line + 6;
  }

  blocks.push(sectionHeader(x + pad, cy, 'repos'));
  cy += 6;
  blocks.push(sectionRule(x + pad, cy, w - pad * 2));
  cy += 10;
  for (const [label, value] of [
    ['public', String(pub)],
    ['private', String(priv)],
    ['owned', String(repo.owned ?? '—')],
    ['forked', String(repo.forked ?? '—')],
    ['archived', String(repo.archived ?? '—')],
    ['stars', String(repo.stars ?? '—')],
    ['forks', String(repo.forks ?? '—')],
  ]) {
    blocks.push(statLine(x + pad, cy, label, value));
    cy += line;
  }
  cy += 6;

  const peakHour = stats.peak_hour_pt;
  const peakHourLabel = peakHour != null && stats.sample_size
    ? `${String(peakHour).padStart(2, '0')}:00 PT`
    : '—';
  const readingCount = snapshot.books?.currently_reading?.length ?? 0;
  const postCount = snapshot.recent_posts?.length ?? 0;

  blocks.push(sectionHeader(x + pad, cy, 'activity'));
  cy += 6;
  blocks.push(sectionRule(x + pad, cy, w - pad * 2));
  cy += 10;
  for (const [label, value] of [
    ['commits 7d', String(stats.commits_7d ?? '—')],
    ['commits 30d', String(stats.commits_30d ?? '—')],
    ['repos 7d', String(repo.pushed_7d ?? '—')],
    ['repos 30d', String(repo.pushed_30d ?? '—')],
    ['peak hour', peakHourLabel],
    ['peak day', stats.peak_day_pt ?? '—'],
    ['top repo', truncate(stats.top_commit_repo?.name ?? repo.active_repo?.name ?? '—', 18)],
    ['top starred', truncate(repo.top_starred ? `${repo.top_starred.name} (${repo.top_starred.stars})` : '—', 22)],
    ['reading', readingCount ? String(readingCount) : '—'],
    ['posts', postCount ? String(postCount) : '—'],
  ]) {
    blocks.push(statLine(x + pad, cy, label, value));
    cy += line;
  }
  cy += 6;

  const aggregateCount = Math.min(totals.length, 8);
  const totalsAnimStart = 2.2;
  if (aggregateCount) {
    const displayTotals = totals.slice(0, aggregateCount);
    const maxTotal = Math.max(...displayTotals.map((t) => t.bytes), 1);
    blocks.push(`<text x="${x + pad}" y="${cy}" fill="${INK}" font-family="ui-monospace,monospace" font-size="10" font-weight="700" opacity="0">
  <animate attributeName="opacity" from="0" to="1" begin="${(totalsAnimStart - 0.2).toFixed(2)}s" dur="0.3s" fill="freeze"/>all languages
</text>`);
    cy += 12;
    blocks.push(`<text x="${x + pad}" y="${cy}" fill="${MUTED}" font-family="ui-monospace,monospace" font-size="8" opacity="0">
  <animate attributeName="opacity" from="0" to="1" begin="${(totalsAnimStart - 0.1).toFixed(2)}s" dur="0.3s" fill="freeze"/>aggregate bytes across owned repos
</text>`);
    cy += 10;
    for (let i = 0; i < aggregateCount; i += 1) {
      const begin = (totalsAnimStart + i * 0.18).toFixed(2);
      blocks.push(langRow(x + pad, cy, displayTotals[i].name, 'all repos', displayTotals[i].bytes, maxTotal, contentW, begin));
      cy += 20;
    }
    cy += 4;
  }

  const displayLangs = langs.slice(0, 3);
  const maxBytes = Math.max(...displayLangs.map((l) => l.bytes), 1);
  const recencyAnimStart = aggregateCount ? totalsAnimStart + aggregateCount * 0.18 + 0.35 : 2.2;
  blocks.push(`<text x="${x + pad}" y="${cy}" fill="${INK}" font-family="ui-monospace,monospace" font-size="10" font-weight="700" opacity="0">
  <animate attributeName="opacity" from="0" to="1" begin="${(recencyAnimStart - 0.2).toFixed(2)}s" dur="0.3s" fill="freeze"/>languages
</text>`);
  cy += 12;
  blocks.push(`<text x="${x + pad}" y="${cy}" fill="${MUTED}" font-family="ui-monospace,monospace" font-size="8" opacity="0">
  <animate attributeName="opacity" from="0" to="1" begin="${(recencyAnimStart - 0.1).toFixed(2)}s" dur="0.3s" fill="freeze"/>by recency
</text>`);
  cy += 10;
  for (let i = 0; i < displayLangs.length; i += 1) {
    const begin = (recencyAnimStart + i * 0.18).toFixed(2);
    blocks.push(langRow(x + pad, cy, displayLangs[i].name, displayLangs[i].repo, displayLangs[i].bytes, maxBytes, contentW, begin));
    cy += 20;
  }
  cy += 4;

  return `<g>
  <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${BG}"/>
  <rect x="${x}" y="${y}" width="${w}" height="40" fill="${FAINT}"/>
  <text x="${x + pad}" y="${y + 26}" fill="${INK}" font-family="ui-monospace,monospace" font-size="11" font-weight="700">stats</text>
  ${blocks.join('\n')}
</g>`;
}

export function statsPanelHeight(snapshot) {
  const profile = snapshot.profile_stats ?? {};
  const langs = Math.min((snapshot.languages_by_recency ?? []).length, 3);
  const totals = Math.min((snapshot.language_totals ?? []).length, 8);
  let h = 40 + 8;
  if (profile.followers != null) h += 20 + 3 * 14 + 6;
  h += 20 + 7 * 14 + 6;
  h += 20 + 10 * 14 + 6;
  if (totals) h += 22 + totals * 20 + 4;
  h += 22 + langs * 20 + 8;
  return Math.max(h, 280);
}

function renderRhythmGraph(snapshot, y, w, h) {
  const stats = snapshot.commit_stats ?? {};
  const hours = stats.hours_pt ?? Array(24).fill(0);
  const days = stats.days_pt ?? Array(7).fill(0);
  const maxH = Math.max(...hours, 1);
  const maxD = Math.max(...days, 1);
  const peakHour = hours.indexOf(maxH);
  const peakDayIdx = days.indexOf(maxD);
  const peakDay = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][peakDayIdx] ?? '—';
  const pad = 16;
  const headerH = 40;
  const chartW = w - pad * 2;
  const hourBarW = chartW / 24;
  const hourChartH = 28;
  const hourBase = y + headerH + 8 + hourChartH;
  const hourLabelY = hourBase + 12;
  const dayChartH = 12;
  const dayBarTop = hourLabelY + 10;
  const dayBase = dayBarTop + dayChartH;
  const dayLabelY = dayBase + 10;

  const hourBars = hours.map((count, i) => {
    const barH = Math.round((count / maxH) * hourChartH);
    const bx = pad + i * hourBarW + 1;
    const fill = i === peakHour ? INK : '#525252';
    return `<rect x="${bx.toFixed(1)}" y="${(hourBase - barH).toFixed(1)}" width="${Math.max(hourBarW - 2, 1).toFixed(1)}" height="${barH}" fill="${fill}"/>`;
  });

  const hourTicks = [0, 6, 12, 18].map((hr) => {
    const tx = pad + hr * hourBarW + hourBarW / 2;
    return `<text x="${tx.toFixed(1)}" y="${hourLabelY}" text-anchor="middle" fill="${MUTED}" font-family="ui-monospace,monospace" font-size="7">${String(hr).padStart(2, '0')}</text>`;
  });

  const dayBarW = chartW / 7;
  const dayBars = days.map((count, i) => {
    const barH = Math.round((count / maxD) * dayChartH);
    const bx = pad + i * dayBarW + 2;
    const fill = i === peakDayIdx ? INK : '#333333';
    return `<rect x="${bx.toFixed(1)}" y="${(dayBarTop + dayChartH - barH).toFixed(1)}" width="${(dayBarW - 4).toFixed(1)}" height="${barH}" fill="${fill}"/>
<text x="${(bx + (dayBarW - 4) / 2).toFixed(1)}" y="${dayLabelY}" text-anchor="middle" fill="${MUTED}" font-family="ui-monospace,monospace" font-size="7">${DAY_LABELS[i]}</text>`;
  });

  const peakLabel = maxH > 0 ? `${String(peakHour).padStart(2, '0')}:00 PT` : '—';
  const meta = `peak ${peakLabel} · ${peakDay} · n=${stats.sample_size ?? 0}`;

  return `<g>
  <rect x="0" y="${y}" width="${w}" height="${h}" fill="${BG}"/>
  <rect x="0" y="${y}" width="${w}" height="${headerH}" fill="${FAINT}"/>
  <text x="${pad}" y="${y + 18}" fill="${INK}" font-family="ui-monospace,monospace" font-size="10" font-weight="700">commit rhythm</text>
  <text x="${pad}" y="${y + 32}" fill="${MUTED}" font-family="ui-monospace,monospace" font-size="8">${escapeXml(meta)}</text>
  <text x="${w - pad}" y="${y + 32}" text-anchor="end" fill="${MUTED}" font-family="ui-monospace,monospace" font-size="8">hourly · PT</text>
  <line x1="${pad}" y1="${hourBase + 1}" x2="${w - pad}" y2="${hourBase + 1}" stroke="${BORDER}" stroke-width="1"/>
  ${hourBars.join('\n')}
  ${hourTicks.join('\n')}
  ${dayBars.join('\n')}
</g>`;
}

function formatSyncedAt(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: PT,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute} PT`;
}

function formatFeedPacific(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: PT,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
  return `${parts.month}/${parts.day} ${parts.hour}:${parts.minute}`;
}

function commitTreeHeight(groups) {
  if (!groups.length) return 0;
  let h = 0;
  for (const g of groups) {
    h += FEED_TREE_REPO_H + g.commits.length * FEED_TREE_COMMIT_H;
    if (g.more > 0) h += FEED_TREE_MORE_H;
  }
  return h + FEED_TREE_GAP * Math.max(groups.length - 1, 0);
}

function normalizeCommitTree(groups) {
  return groups.map((g) => {
    if (g.commits?.length) {
      return {
        repo: g.repo,
        commits: g.commits,
        more: g.more ?? 0,
      };
    }
    const legacyCount = g.count ?? 1;
    return {
      repo: g.repo,
      commits: [{ sha: g.sha, message: g.message, at: g.at }],
      more: Math.max(legacyCount - 1, 0),
    };
  });
}

function feedCommitMoreLine(y, more, delay) {
  return `<text x="20" y="${y}" font-family="ui-monospace,monospace" font-size="10" opacity="0">
    <animate attributeName="opacity" from="0" to="1" begin="${delay}s" dur="0.3s" fill="freeze"/>
    <tspan fill="${MUTED}">└─ </tspan><tspan fill="${MUTED}">(${more} more)</tspan>
  </text>`;
}

function feedRepoTree(y, group, delay) {
  const d = delay.toFixed(1);
  const lines = [`<text x="16" y="${y}" font-family="ui-monospace,monospace" font-size="10" opacity="0">
    <animate attributeName="opacity" from="0" to="1" begin="${d}s" dur="0.3s" fill="freeze"/>
    <tspan fill="${INK}" font-weight="700">${escapeXml(group.repo)}</tspan><tspan fill="${MUTED}">/</tspan>
  </text>`];
  let cy = y + FEED_TREE_REPO_H;
  group.commits.forEach((commit, i) => {
    const isLast = i === group.commits.length - 1 && !group.more;
    const cd = (Number(d) + 0.15 + i * 0.25).toFixed(2);
    lines.push(feedCommitTreeItem(cy, commit, cd, isLast));
    cy += FEED_TREE_COMMIT_H;
  });
  if (group.more > 0) {
    const md = (Number(d) + 0.15 + group.commits.length * 0.25).toFixed(2);
    lines.push(feedCommitMoreLine(cy, group.more, md));
    cy += FEED_TREE_MORE_H;
  }
  let animEnd = Number(d) + 0.3;
  group.commits.forEach((commit, i) => {
    const cd = Number(d) + 0.15 + i * 0.25;
    animEnd = Math.max(animEnd, cd + 0.35);
  });
  if (group.more > 0) {
    const md = Number(d) + 0.15 + group.commits.length * 0.25;
    animEnd = Math.max(animEnd, md + 0.3);
  }
  return { markup: lines.join('\n'), height: cy - y + FEED_TREE_GAP, animEnd };
}

function feedCommitTreeItem(y, commit, delay, isLast) {
  const branch = isLast ? '└─' : '├─';
  const guide = isLast ? '  ' : '│ ';
  const when = formatFeedPacific(commit.at);
  const msg = truncate(commit.message, 26);
  return `<text x="20" y="${y}" font-family="ui-monospace,monospace" font-size="10" opacity="0">
    <animate attributeName="opacity" from="0" to="1" begin="${delay}s" dur="0.3s" fill="freeze"/>
    <tspan fill="${MUTED}">${branch} </tspan><tspan fill="${INK}" font-weight="700">@git</tspan><tspan fill="${MUTED}"> ${escapeXml(commit.sha)}</tspan>
  </text>
<text x="28" y="${y + 10}" fill="${MUTED}" font-family="ui-monospace,monospace" font-size="8" opacity="0">
    <animate attributeName="opacity" from="0" to="1" begin="${(Number(delay) + 0.05).toFixed(2)}s" dur="0.3s" fill="freeze"/>${guide}${escapeXml(when)} PT · ${escapeXml(msg)}
  </text>`;
}

function booksSectionHeight(books) {
  if (!books) return 0;
  const reading = (books.currently_reading ?? []).slice(0, FEED_BOOKS_READING_LIMIT);
  const hasLast = Boolean(books.last_read?.title);
  if (!reading.length && !hasLast) return 0;
  let h = 12 + 14;
  if (reading.length) h += FEED_TREE_REPO_H + reading.length * FEED_BOOK_LINE_H;
  if (hasLast) h += (reading.length ? FEED_TREE_GAP : FEED_TREE_REPO_H) + FEED_BOOK_LINE_H;
  return h;
}

function feedBookLine(y, tag, title, subline, delay, branch, isLast) {
  const guide = isLast ? '  ' : '│ ';
  return `<text x="20" y="${y}" font-family="ui-monospace,monospace" font-size="10" opacity="0">
    <animate attributeName="opacity" from="0" to="1" begin="${delay}s" dur="0.3s" fill="freeze"/>
    <tspan fill="${MUTED}">${branch} </tspan><tspan fill="${INK}" font-weight="700">${escapeXml(tag)}</tspan><tspan fill="${INK}"> ${escapeXml(truncate(title, 32))}</tspan>
  </text>
<text x="28" y="${y + 10}" fill="${MUTED}" font-family="ui-monospace,monospace" font-size="8" opacity="0">
    <animate attributeName="opacity" from="0" to="1" begin="${(Number(delay) + 0.05).toFixed(2)}s" dur="0.3s" fill="freeze"/>${guide}${escapeXml(truncate(subline, 40))}
  </text>`;
}

function feedBooksSection(y, books, delay) {
  if (!books) return { markup: '', height: 0 };
  const reading = (books.currently_reading ?? []).slice(0, FEED_BOOKS_READING_LIMIT);
  const last = books.last_read;
  const hasLast = Boolean(last?.title);
  if (!reading.length && !hasLast) return { markup: '', height: 0, animEnd: delay };

  const d = delay.toFixed(1);
  const lines = [`<text x="16" y="${y}" fill="${MUTED}" font-family="ui-monospace,monospace" font-size="8" opacity="0">
    <animate attributeName="opacity" from="0" to="1" begin="${d}s" dur="0.3s" fill="freeze"/># books.97115104.com
  </text>`];
  let cy = y + 18;
  let step = 0.2;

  if (reading.length) {
    lines.push(`<text x="16" y="${cy}" font-family="ui-monospace,monospace" font-size="10" font-weight="700" opacity="0">
    <animate attributeName="opacity" from="0" to="1" begin="${(Number(d) + step).toFixed(2)}s" dur="0.3s" fill="freeze"/>
    <tspan fill="${INK}">reading</tspan><tspan fill="${MUTED}">/</tspan>
  </text>`);
    cy += FEED_TREE_REPO_H;
    reading.forEach((book, i) => {
      const isLastInReading = i === reading.length - 1 && !hasLast;
      const branch = isLastInReading ? '└─' : '├─';
      const sub = [book.author, book.progress].filter(Boolean).join(' · ');
      const cd = (Number(d) + step + 0.1 + i * 0.2).toFixed(2);
      lines.push(feedBookLine(cy, '@now', book.title, sub, cd, branch, isLastInReading));
      cy += FEED_BOOK_LINE_H;
    });
    if (hasLast) cy += FEED_TREE_GAP;
  }

  if (hasLast) {
    lines.push(`<text x="16" y="${cy}" font-family="ui-monospace,monospace" font-size="10" font-weight="700" opacity="0">
    <animate attributeName="opacity" from="0" to="1" begin="${(Number(d) + step + reading.length * 0.2 + 0.1).toFixed(2)}s" dur="0.3s" fill="freeze"/>
    <tspan fill="${INK}">last read</tspan><tspan fill="${MUTED}">/</tspan>
  </text>`);
    cy += FEED_TREE_REPO_H;
    const sub = [last.author, last.completedDate].filter(Boolean).join(' · ');
    const cd = (Number(d) + step + reading.length * 0.2 + 0.25).toFixed(2);
    lines.push(feedBookLine(cy, '@read', last.title, sub, cd, '└─', true));
    cy += FEED_BOOK_LINE_H;
  }

  let animEnd = Number(d) + 0.3;
  if (reading.length) {
    animEnd = Math.max(animEnd, Number(d) + step + 0.3);
    reading.forEach((book, i) => {
      animEnd = Math.max(animEnd, Number(d) + step + 0.1 + i * 0.2 + 0.35);
    });
  }
  if (hasLast) {
    animEnd = Math.max(animEnd, Number(d) + step + reading.length * 0.2 + 0.25 + 0.35);
  }

  return { markup: lines.join('\n'), height: cy - y + FEED_TREE_GAP, animEnd };
}

function feedBlogEntry(y, post, delay) {
  const d = delay.toFixed(1);
  const when = formatFeedPacific(post.updated);
  return `<text x="16" y="${y}" font-family="ui-monospace,monospace" font-size="10" opacity="0">
    <animate attributeName="opacity" from="0" to="1" begin="${d}s" dur="0.4s" fill="freeze"/>
    <tspan fill="${INK}" font-weight="700">@blog</tspan><tspan fill="${INK}"> ${escapeXml(truncate(post.title, 38))}</tspan>
  </text>
<text x="24" y="${y + 10}" fill="${MUTED}" font-family="ui-monospace,monospace" font-size="8" opacity="0">
    <animate attributeName="opacity" from="0" to="1" begin="${d}s" dur="0.4s" fill="freeze"/>${escapeXml(when)} PT
  </text>`;
}

function feedPanelHeight(snapshot) {
  const posts = Math.min(snapshot.recent_posts.length, FEED_BLOG_LIMIT);
  const tree = normalizeCommitTree(snapshot.recent_commits.slice(0, FEED_REPO_LIMIT));
  const blogH = 22;
  const sectionGap = 14;
  const booksH = booksSectionHeight(snapshot.books);
  const booksBlock = booksH ? sectionGap + booksH : 0;
  return 60 + posts * blogH + booksBlock + sectionGap + 12 + sectionGap + commitTreeHeight(tree) + 12;
}

function renderFeedPanel(snapshot, h) {
  const posts = snapshot.recent_posts.slice(0, FEED_BLOG_LIMIT);
  const tree = normalizeCommitTree(snapshot.recent_commits.slice(0, FEED_REPO_LIMIT));
  const blogH = 22;
  const sectionGap = 14;
  const termH = h - 52;

  let y = 76;
  let feedAnimEnd = 0.3;
  const blogLines = posts.map((p, i) => {
    const begin = 0.2 + i * 0.4;
    feedAnimEnd = Math.max(feedAnimEnd, begin + 0.4);
    const line = feedBlogEntry(y, p, begin);
    y += blogH;
    return line;
  });

  const booksStart = 0.2 + posts.length * 0.4 + 0.2;
  const booksBlock = feedBooksSection(y + sectionGap, snapshot.books, booksStart);
  if (booksBlock.height) {
    y += sectionGap + booksBlock.height;
    feedAnimEnd = Math.max(feedAnimEnd, booksBlock.animEnd);
  }

  const gitHeaderY = y + 4;
  y = gitHeaderY + sectionGap;
  const commitStart = booksStart + 0.3 + (booksBlock.height ? 0.4 : 0);
  feedAnimEnd = Math.max(feedAnimEnd, commitStart - 0.1 + 0.3);
  let delay = commitStart;
  const gitLines = tree.map((group) => {
    const block = feedRepoTree(y, group, delay);
    y += block.height;
    delay += 0.35 + group.commits.length * 0.25;
    feedAnimEnd = Math.max(feedAnimEnd, block.animEnd);
    return block.markup;
  });
  const cursorY = y + 4;
  const cursorBegin = (feedAnimEnd + 0.15).toFixed(2);

  return `<g>
  <rect x="0" y="0" width="${FEED_W}" height="${h}" fill="${BG}"/>
  <rect x="0" y="0" width="${FEED_W}" height="40" fill="${FAINT}"/>
  <text x="16" y="26" fill="${INK}" font-family="ui-monospace,monospace" font-size="11" font-weight="700">feed</text>
  <text x="${FEED_W - 16}" y="26" text-anchor="end" fill="${MUTED}" font-family="ui-monospace,monospace" font-size="10">synced</text>
  <clipPath id="term"><rect x="0" y="40" width="${FEED_W}" height="${termH}"/></clipPath>
  <g clip-path="url(#term)">
    <text x="16" y="60" fill="${MUTED}" font-family="ui-monospace,monospace" font-size="8" opacity="0">
      <animate attributeName="opacity" from="0" to="1" begin="0s" dur="0.3s" fill="freeze"/># blog.97115104.com
    </text>
    ${blogLines.join('\n')}
    ${booksBlock.markup}
    <text x="16" y="${gitHeaderY}" fill="${MUTED}" font-family="ui-monospace,monospace" font-size="8" opacity="0">
      <animate attributeName="opacity" from="0" to="1" begin="${commitStart - 0.1}s" dur="0.3s" fill="freeze"/># recent commits
    </text>
    ${gitLines.join('\n')}
    <text x="16" y="${cursorY}" fill="${INK}" font-family="ui-monospace,monospace" font-size="10" opacity="0">
      <animate attributeName="opacity" values="0;1;0;1;0" begin="${cursorBegin}s" dur="2s" fill="freeze"/>
      ▋
    </text>
  </g>
</g>`;
}

export function renderCanvas(snapshot) {
  const topH = Math.max(feedPanelHeight(snapshot), statsPanelHeight(snapshot), 280);
  const gap = 0;
  const h = topH + gap + RHYTHM_H + 20;
  const statsW = CANVAS_W - FEED_W;
  const statsX = FEED_W;
  const rhythmY = topH + gap;
  const s = INSET;
  const right = CANVAS_W - s;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_W}" height="${h}" viewBox="0 0 ${CANVAS_W} ${h}" role="img" aria-label="feed and stats">
  <rect width="${CANVAS_W}" height="${h}" fill="${BG}"/>
  <text x="16" y="${h - 8}" fill="${MUTED}" font-family="ui-monospace,monospace" font-size="8">synced ${escapeXml(formatSyncedAt(snapshot.synced_at))}</text>
  ${renderFeedPanel(snapshot, topH)}
  ${renderStatsPanel(snapshot, statsX, 0, statsW, topH)}
  ${renderRhythmGraph(snapshot, rhythmY, CANVAS_W, RHYTHM_H)}
  <g fill="none" stroke="${BORDER}" stroke-width="1">
    <rect x="${s}" y="${s}" width="${CANVAS_W - 1}" height="${h - 1}"/>
    <line x1="${FEED_W + s}" y1="${s}" x2="${FEED_W + s}" y2="${topH - s}"/>
    <line x1="${s}" y1="${topH + s}" x2="${right}" y2="${topH + s}"/>
    <line x1="${s}" y1="40" x2="${FEED_W - s}" y2="40"/>
    <line x1="${FEED_W + s}" y1="40" x2="${right}" y2="40"/>
    <line x1="${s}" y1="${rhythmY + 40}" x2="${right}" y2="${rhythmY + 40}"/>
  </g>
</svg>`;
}
