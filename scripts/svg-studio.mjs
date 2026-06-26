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

const CANVAS_W = 920;
const FEED_W = 450;
const RHYTHM_H = 80;
const PT = 'America/Los_Angeles';
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function renderHero() {
  const words = ['code', 'is', 'cool'];
  const wordLines = words
    .map((word, i) => {
      const letters = word.split('').map((ch, j) => {
        const x = 24 + j * 22;
        const delay = 0.4 + i * 0.45 + j * 0.08;
        return `<tspan x="${x}" fill="${INK}" opacity="0">
          <animate attributeName="opacity" from="0" to="1" begin="${delay.toFixed(2)}s" dur="0.15s" fill="freeze"/>
          ${escapeXml(ch)}
        </tspan>`;
      }).join('');
      return `<text y="${108 + i * 28}" font-family="ui-monospace,monospace" font-size="22" font-weight="700">${letters}</text>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_W}" height="200" viewBox="0 0 ${CANVAS_W} 200" role="img" aria-label="97 115 104">
  <defs>
    <style>
      @keyframes draw { from { stroke-dashoffset: 400; } to { stroke-dashoffset: 0; } }
      .rule { stroke-dasharray: 400; animation: draw 1s ease 0.2s forwards; }
    </style>
  </defs>
  <rect width="${CANVAS_W}" height="200" fill="${BG}" stroke="${BORDER}" stroke-width="1"/>
  <text x="24" y="56" fill="${INK}" font-family="ui-monospace,monospace" font-size="48" font-weight="700">97 115 104</text>
  <line x1="24" y1="72" x2="320" y2="72" stroke="${INK}" stroke-width="2" class="rule"/>
  ${wordLines}
</svg>`;
}

function statLine(x, y, label, value, bold = false) {
  return `<text x="${x}" y="${y}" font-family="ui-monospace,monospace" font-size="10">
    <tspan fill="${MUTED}">${escapeXml(label)}</tspan><tspan fill="${INK}" font-weight="${bold ? '700' : '400'}"> ${escapeXml(value)}</tspan>
  </text>`;
}

function langRow(x, y, lang, repo, barW, maxBar) {
  const w = maxBar > 0 ? Math.round((barW / maxBar) * 120) : 0;
  return `<text x="${x}" y="${y}" fill="${INK}" font-family="ui-monospace,monospace" font-size="10" font-weight="700">${escapeXml(truncate(lang, 14))}</text>
<text x="${x + 110}" y="${y}" fill="${MUTED}" font-family="ui-monospace,monospace" font-size="9">${escapeXml(truncate(repo, 16))}</text>
<rect x="${x}" y="${y + 4}" width="${w}" height="4" fill="${INK}"/>`;
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
  const maxBytes = langs[0]?.bytes ?? 1;
  const maxTotal = totals[0]?.bytes ?? 1;
  const pad = 12;
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
  ]) {
    blocks.push(statLine(x + pad, cy, label, value));
    cy += line;
  }
  cy += 6;

  blocks.push(sectionHeader(x + pad, cy, 'activity'));
  cy += 6;
  blocks.push(sectionRule(x + pad, cy, w - pad * 2));
  cy += 10;
  for (const [label, value] of [
    ['pushes 7d', String(stats.pushes_7d ?? '—')],
    ['pushes 30d', String(stats.pushes_30d ?? '—')],
    ['repos 7d', String(repo.pushed_7d ?? '—')],
    ['repos 30d', String(repo.pushed_30d ?? '—')],
    ['top repo', truncate(stats.top_push_repo?.name ?? repo.active_repo?.name ?? '—', 18)],
    ['top starred', truncate(repo.top_starred ? `${repo.top_starred.name} (${repo.top_starred.stars})` : '—', 22)],
  ]) {
    blocks.push(statLine(x + pad, cy, label, value));
    cy += line;
  }
  cy += 6;

  const aggregateCount = Math.min(totals.length, 8);
  if (aggregateCount) {
    blocks.push(sectionHeader(x + pad, cy, 'all languages'));
    cy += 12;
    blocks.push(`<text x="${x + pad}" y="${cy}" fill="${MUTED}" font-family="ui-monospace,monospace" font-size="8">aggregate bytes across owned repos</text>`);
    cy += 10;
    for (let i = 0; i < aggregateCount; i += 1) {
      blocks.push(langRow(x + pad, cy, totals[i].name, 'all repos', totals[i].bytes, maxTotal));
      cy += 20;
    }
    cy += 4;
  }

  blocks.push(sectionHeader(x + pad, cy, 'languages'));
  cy += 12;
  blocks.push(`<text x="${x + pad}" y="${cy}" fill="${MUTED}" font-family="ui-monospace,monospace" font-size="8">by recency</text>`);
  cy += 10;
  for (let i = 0; i < Math.min(langs.length, 3); i += 1) {
    blocks.push(langRow(x + pad, cy, langs[i].name, langs[i].repo, langs[i].bytes, maxBytes));
    cy += 20;
  }
  cy += 4;

  return `<g>
  <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${BG}" stroke="${BORDER}" stroke-width="1"/>
  <rect x="${x}" y="${y}" width="${w}" height="40" fill="${FAINT}" stroke="${BORDER}" stroke-width="1"/>
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
  h += 20 + 6 * 14 + 6;
  h += 20 + 6 * 14 + 6;
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
  const chartW = w - pad * 2;
  const hourBarW = chartW / 24;
  const hourChartH = 32;
  const hourBase = y + 48;
  const dayChartH = 14;
  const dayBase = y + h - 14;

  const hourBars = hours.map((count, i) => {
    const barH = Math.round((count / maxH) * hourChartH);
    const bx = pad + i * hourBarW + 1;
    const fill = i === peakHour ? INK : '#525252';
    return `<rect x="${bx.toFixed(1)}" y="${hourBase - barH}" width="${Math.max(hourBarW - 2, 1).toFixed(1)}" height="${barH}" fill="${fill}"/>`;
  });

  const hourTicks = [0, 6, 12, 18].map((hr) => {
    const tx = pad + hr * hourBarW + hourBarW / 2;
    return `<text x="${tx.toFixed(1)}" y="${hourBase + 10}" text-anchor="middle" fill="${MUTED}" font-family="ui-monospace,monospace" font-size="7">${String(hr).padStart(2, '0')}</text>`;
  });

  const dayBarW = chartW / 7;
  const dayBars = days.map((count, i) => {
    const barH = Math.round((count / maxD) * dayChartH);
    const bx = pad + i * dayBarW + 2;
    const fill = i === peakDayIdx ? INK : '#333333';
    return `<rect x="${bx.toFixed(1)}" y="${dayBase - barH - 12}" width="${(dayBarW - 4).toFixed(1)}" height="${barH}" fill="${fill}"/>
<text x="${(bx + (dayBarW - 4) / 2).toFixed(1)}" y="${dayBase}" text-anchor="middle" fill="${MUTED}" font-family="ui-monospace,monospace" font-size="7">${DAY_LABELS[i]}</text>`;
  });

  const peakLabel = maxH > 0 ? `${String(peakHour).padStart(2, '0')}:00 PT` : '—';
  const meta = `peak ${peakLabel} · ${peakDay} · n=${stats.sample_size ?? 0}`;

  return `<g>
  <rect x="0" y="${y}" width="${w}" height="${h}" fill="${BG}" stroke="${BORDER}" stroke-width="1"/>
  <text x="${pad}" y="${y + 18}" fill="${INK}" font-family="ui-monospace,monospace" font-size="10" font-weight="700">commit rhythm</text>
  <text x="${pad}" y="${y + 30}" fill="${MUTED}" font-family="ui-monospace,monospace" font-size="8">${escapeXml(meta)}</text>
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

function chatLine(y, user, msg, delay, maxLen = 44) {
  const d = delay.toFixed(1);
  return `<text x="16" y="${y}" font-family="ui-monospace,monospace" font-size="11" opacity="0">
    <animate attributeName="opacity" from="0" to="1" begin="${d}s" dur="0.4s" fill="freeze"/>
    <tspan fill="${INK}" font-weight="700">${escapeXml(user)}</tspan><tspan fill="${INK}"> ${escapeXml(truncate(msg, maxLen))}</tspan>
  </text>`;
}

function feedPanelHeight(snapshot) {
  const posts = snapshot.recent_posts.slice(0, 2).length;
  const commits = snapshot.recent_commits.slice(0, 3).length;
  const lineH = 22;
  const sectionGap = 18;
  // header(60) + blog lines + section gap + git header + section gap + git lines + cursor
  return 60 + posts * lineH + sectionGap + 12 + sectionGap + commits * lineH + 24;
}

function renderFeedPanel(snapshot, h) {
  const posts = snapshot.recent_posts.slice(0, 2);
  const commits = snapshot.recent_commits.slice(0, 3);
  const lineH = 22;
  const sectionGap = 18;
  const termH = h - 52;

  let y = 76;
  const blogLines = posts.map((p, i) => {
    const line = chatLine(y, '@blog', p.title, 0.2 + i * 0.35);
    y += lineH;
    return line;
  });

  const gitHeaderY = y + 4;
  y = gitHeaderY + sectionGap;
  const commitStart = 0.2 + posts.length * 0.35 + 0.3;
  const gitLines = commits.map((c, i) => {
    const msg = `${c.repo}: ${c.message}`;
    const line = chatLine(y, '@git', msg, commitStart + i * 0.35);
    y += lineH;
    return line;
  });
  const cursorY = y + 8;

  return `<g>
  <rect x="0" y="0" width="${FEED_W}" height="${h}" fill="${BG}" stroke="${BORDER}" stroke-width="1"/>
  <rect x="0" y="0" width="${FEED_W}" height="40" fill="${FAINT}" stroke="${BORDER}" stroke-width="1"/>
  <text x="16" y="26" fill="${INK}" font-family="ui-monospace,monospace" font-size="11" font-weight="700">feed</text>
  <text x="${FEED_W - 16}" y="26" text-anchor="end" fill="${MUTED}" font-family="ui-monospace,monospace" font-size="10">synced</text>
  <rect x="0" y="40" width="${FEED_W}" height="${termH}" fill="${BG}" stroke="${BORDER}" stroke-width="1"/>
  <clipPath id="term"><rect x="0" y="40" width="${FEED_W}" height="${termH}"/></clipPath>
  <g clip-path="url(#term)">
    <text x="16" y="60" fill="${MUTED}" font-family="ui-monospace,monospace" font-size="10" opacity="0">
      <animate attributeName="opacity" from="0" to="1" begin="0s" dur="0.3s" fill="freeze"/># blog.97115104.com
    </text>
    ${blogLines.join('\n')}
    <text x="16" y="${gitHeaderY}" fill="${MUTED}" font-family="ui-monospace,monospace" font-size="10" opacity="0">
      <animate attributeName="opacity" from="0" to="1" begin="${commitStart - 0.1}s" dur="0.3s" fill="freeze"/># recent commits
    </text>
    ${gitLines.join('\n')}
    <text x="16" y="${cursorY}" fill="${INK}" font-family="ui-monospace,monospace" font-size="12" class="cursor">▋</text>
  </g>
</g>`;
}

export function renderCanvas(snapshot) {
  const topH = Math.max(feedPanelHeight(snapshot), statsPanelHeight(snapshot), 280);
  const gap = 2;
  const h = topH + gap + RHYTHM_H + 20;
  const statsW = CANVAS_W - FEED_W - 2;
  const statsX = FEED_W + 2;
  const rhythmY = topH + gap;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_W}" height="${h}" viewBox="0 0 ${CANVAS_W} ${h}" role="img" aria-label="feed and stats">
  <defs>
    <style>
      @keyframes blink { 0%,49% { opacity: 1; } 50%,100% { opacity: 0; } }
      .cursor { animation: blink 1s step-end infinite; }
    </style>
  </defs>
  <rect width="${CANVAS_W}" height="${h}" fill="${BG}" stroke="${BORDER}" stroke-width="1"/>
  <text x="16" y="${h - 8}" fill="${MUTED}" font-family="ui-monospace,monospace" font-size="8">synced ${escapeXml(formatSyncedAt(snapshot.synced_at))}</text>
  ${renderFeedPanel(snapshot, topH)}
  ${renderStatsPanel(snapshot, statsX, 0, statsW, topH)}
  ${renderRhythmGraph(snapshot, rhythmY, CANVAS_W, RHYTHM_H)}
</svg>`;
}
