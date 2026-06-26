#!/usr/bin/env node
/**
 * Profile sync orchestrator: GitHub repos, blog RSS, attest metrics,
 * provenance ledger, SVG generation, README attestation, llms.txt update.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeStyleAttestation } from './lint-writing-profile.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const GENERATED = join(ROOT, 'generated');
const ATTESTATIONS = join(ROOT, 'attestations');

const GITHUB_USER = '97115104';
const ATTEST_BASE = 'https://attest.97115104.com';
const BLOG_FEED = 'https://blog.97115104.com/feed.xml';

const REPO_GROUPS = {
  attribution: ['attest'],
  inference: ['vLLM-harness', 'ollama-harness', 'hsc-chat', 'voice-clone'],
  personal_lm: ['endor-train', 'endor-teach', 'humanlike'],
  language: ['jennifer-lang', 'PTL-3'],
};

const PINNED = [
  { name: 'attest', purpose: 'Cryptographically signed AI content attribution protocol.' },
  { name: 'endor-train', purpose: 'Aggregate personalized data to train a personal language model.' },
  { name: 'hsc-chat', purpose: 'Chat client for an OpenAI-compatible API.' },
  { name: 'voice-clone', purpose: 'Chatterbox-based voice cloning tool.' },
  { name: 'vLLM-harness', purpose: 'Serve models through vLLM with a secure public API.' },
  { name: 'ollama-harness', purpose: 'Serve models through Ollama with a secure public API.' },
];

const PLAN_REPOS = ['attest', 'endor-train', 'jennifer-lang', 'PTL-3'];

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function truncate(s, n) {
  const t = String(s ?? '');
  return t.length <= n ? t : `${t.slice(0, n - 1)}…`;
}

async function fetchJson(url, headers = {}) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function fetchText(url, headers = {}) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

function githubHeaders() {
  const token = process.env.GITHUB_TOKEN;
  return token
    ? { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' }
    : { Accept: 'application/vnd.github+json' };
}

async function fetchRepos() {
  const repos = [];
  let page = 1;
  while (true) {
    const batch = await fetchJson(
      `https://api.github.com/users/${GITHUB_USER}/repos?per_page=100&page=${page}&sort=updated`,
      githubHeaders(),
    );
    if (!batch.length) break;
    repos.push(...batch);
    if (batch.length < 100) break;
    page += 1;
  }
  return repos;
}

async function fetchRepoReadme(repoName) {
  try {
    const data = await fetchJson(
      `https://api.github.com/repos/${GITHUB_USER}/${repoName}/readme`,
      githubHeaders(),
    );
    const content = Buffer.from(data.content, 'base64').toString('utf8');
    return content;
  } catch {
    return null;
  }
}

async function fetchOpenIssues(repoName) {
  try {
    const issues = await fetchJson(
      `https://api.github.com/repos/${GITHUB_USER}/${repoName}/issues?state=open&per_page=5`,
      githubHeaders(),
    );
    return issues.filter((i) => !i.pull_request).map((i) => i.title);
  } catch {
    return [];
  }
}

function parseAtomFeed(xml) {
  const entries = [];
  const entryRe = /<entry>([\s\S]*?)<\/entry>/g;
  let m;
  while ((m = entryRe.exec(xml))) {
    const block = m[1];
    const title = block.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, '') ?? '';
    const link = block.match(/<link[^>]+href="([^"]+)"/)?.[1] ?? '';
    const updated = block.match(/<updated>([^<]+)<\/updated>/)?.[1] ?? '';
    const cats = [...block.matchAll(/<category term="([^"]+)"/g)].map((c) => c[1]);
    entries.push({ title: title.trim(), link, updated, categories: cats });
  }
  return entries;
}

function extractAttestSignals(text, repoName) {
  if (!text) return null;
  const signals = [];
  const shortRe = /https:\/\/attest\.97115104\.com\/s\/([a-z0-9]+)/gi;
  const verifyRe = /https:\/\/attest\.97115104\.com\/verify\/\?data=([A-Za-z0-9+/=_-]+)/gi;
  let m;
  while ((m = shortRe.exec(text))) {
    signals.push({ type: 'short', url: m[0], id: m[1] });
  }
  while ((m = verifyRe.exec(text))) {
    signals.push({ type: 'verify', url: m[0] });
  }
  const frontmatterType = text.match(/authorship_type:\s*(\w+)/i)?.[1];
  const frontmatterModel = text.match(/^model:\s*(.+)$/im)?.[1]?.trim();
  if (signals.length === 0 && !frontmatterType) return null;
  return {
    repo: repoName,
    signals,
    authorship_type: frontmatterType ?? null,
    model: frontmatterModel ?? null,
    latest_url: signals[0]?.url ?? null,
  };
}

function hashContent(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function replaceSection(content, name, body) {
  const start = `<!-- profile-sync:${name}-start -->`;
  const end = `<!-- profile-sync:${name}-end -->`;
  const re = new RegExp(`${start}[\\s\\S]*?${end}`, 'm');
  const replacement = `${start}\n${body}\n${end}`;
  if (!re.test(content)) {
    throw new Error(`Missing sync section: ${name}`);
  }
  return content.replace(re, replacement);
}

function renderAttestSealSvg(attestation, contentHash) {
  const w = 640;
  const h = 120;
  const a = attestation?.attestation ?? {};
  const shortUrl = attestation?.urls?.short ?? 'pending sync';
  const type = a.authorship_type ?? a.role ?? 'collab';
  const model = a.model ?? 'Human';
  const ts = (a.timestamp ?? new Date().toISOString()).slice(0, 19);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Attest seal">
  <defs>
    <style>
      .ring { fill: none; stroke: #40916c; stroke-width: 2; }
      @keyframes pulse { 0%,100% { stroke-opacity: 1; } 50% { stroke-opacity: 0.45; } }
      .ring-anim { animation: pulse 3s ease-in-out infinite; }
      @media (prefers-color-scheme: dark) {
        .bg { fill: #0d1b2a; }
        .label { fill: #adb5bd; }
        .value { fill: #e0e1dd; }
      }
      @media (prefers-color-scheme: light) {
        .bg { fill: #f8f9fa; }
        .label { fill: #495057; }
        .value { fill: #212529; }
      }
    </style>
  </defs>
  <rect class="bg" width="${w}" height="${h}" rx="10" stroke="#2d6a4f" stroke-width="2"/>
  <circle class="ring ring-anim" cx="60" cy="60" r="36"/>
  <circle class="ring" cx="60" cy="60" r="28" stroke-dasharray="4 3"/>
  <text x="60" y="56" text-anchor="middle" fill="#40916c" font-family="ui-monospace,monospace" font-size="11" font-weight="700">attest</text>
  <text x="60" y="72" text-anchor="middle" fill="#40916c" font-family="ui-monospace,monospace" font-size="9">v3.0</text>
  <text class="label" x="120" y="36" font-family="ui-monospace,monospace" font-size="11">authorship_type</text>
  <text class="value" x="120" y="54" font-family="ui-monospace,monospace" font-size="14" font-weight="600">${escapeXml(type)}</text>
  <text class="label" x="280" y="36" font-family="ui-monospace,monospace" font-size="11">model</text>
  <text class="value" x="280" y="54" font-family="ui-monospace,monospace" font-size="14" font-weight="600">${escapeXml(truncate(model, 24))}</text>
  <text class="label" x="120" y="82" font-family="ui-monospace,monospace" font-size="11">sha256</text>
  <text class="value" x="120" y="100" font-family="ui-monospace,monospace" font-size="10">${escapeXml(contentHash.slice(0, 32))}…</text>
  <text class="label" x="440" y="36" font-family="ui-monospace,monospace" font-size="11">timestamp</text>
  <text class="value" x="440" y="54" font-family="ui-monospace,monospace" font-size="12">${escapeXml(ts)}Z</text>
  <text class="label" x="440" y="82" font-family="ui-monospace,monospace" font-size="11">verify</text>
  <text class="value" x="440" y="100" font-family="ui-monospace,monospace" font-size="9">${escapeXml(truncate(shortUrl.replace('https://', ''), 28))}</text>
</svg>`;
}

function renderLoopSvg(snapshot) {
  const w = 780;
  const h = 320;
  const planItems = snapshot.plan.slice(0, 4);
  const buildItems = snapshot.build.slice(0, 5);
  const verifyItems = snapshot.verify.slice(0, 4);

  const planLines = planItems
    .map((p, i) => `<text x="24" y="${110 + i * 22}" fill="#495057" font-family="ui-monospace,monospace" font-size="11">· ${escapeXml(truncate(p, 42))}</text>`)
    .join('\n');
  const buildLines = buildItems
    .map((b, i) => {
      const pulse = i === 0 ? ' class="pulse"' : '';
      return `<text${pulse} x="284" y="${110 + i * 22}" fill="#495057" font-family="ui-monospace,monospace" font-size="11">· ${escapeXml(truncate(b.name, 18))} ${escapeXml(b.pushed_at?.slice(0, 10) ?? '')}</text>`;
    })
    .join('\n');
  const verifyLines = verifyItems
    .map((v, i) => `<text x="544" y="${110 + i * 22}" fill="#495057" font-family="ui-monospace,monospace" font-size="11">· ${escapeXml(truncate(v.repo, 14))} ${escapeXml(v.authorship_type ?? '—')}</text>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Plan build verify loop">
  <defs>
    <style>
      @keyframes pulse { 0%,100% { fill: #2d6a4f; } 50% { fill: #40916c; } }
      .pulse { animation: pulse 2s ease-in-out infinite; }
      @media (prefers-color-scheme: dark) {
        .bg { fill: #0d1b2a; }
        .panel { fill: #1b263b; stroke: #415a77; }
        .title { fill: #e0e1dd; }
        .head { fill: #90be6d; }
        .arrow { stroke: #40916c; }
      }
      @media (prefers-color-scheme: light) {
        .bg { fill: #f8f9fa; }
        .panel { fill: #fff; stroke: #adb5bd; }
        .title { fill: #212529; }
        .head { fill: #2d6a4f; }
        .arrow { stroke: #40916c; }
      }
    </style>
    <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="#40916c"/>
    </marker>
  </defs>
  <rect class="bg" width="${w}" height="${h}" rx="10"/>
  <text class="title" x="24" y="32" font-family="Georgia,serif" font-size="18" font-weight="600">plan → build → verify</text>
  <text class="title" x="24" y="52" font-family="ui-monospace,monospace" font-size="10" opacity="0.7">synced ${escapeXml(snapshot.synced_at.slice(0, 19))}Z</text>
  <rect class="panel" x="16" y="68" width="230" height="220" rx="8"/>
  <rect class="panel" x="276" y="68" width="230" height="220" rx="8"/>
  <rect class="panel" x="536" y="68" width="230" height="220" rx="8"/>
  <text class="head" x="32" y="92" font-family="ui-monospace,monospace" font-size="13" font-weight="700">PLAN</text>
  <text class="head" x="292" y="92" font-family="ui-monospace,monospace" font-size="13" font-weight="700">BUILD</text>
  <text class="head" x="552" y="92" font-family="ui-monospace,monospace" font-size="13" font-weight="700">VERIFY</text>
  ${planLines}
  ${buildLines}
  ${verifyLines}
  <line class="arrow" x1="246" y1="178" x2="276" y2="178" stroke-width="2" marker-end="url(#arrowhead)"/>
  <line class="arrow" x1="506" y1="178" x2="536" y2="178" stroke-width="2" marker-end="url(#arrowhead)"/>
  <path class="arrow" d="M 650 288 C 700 300, 700 20, 130 68" fill="none" stroke-width="1.5" stroke-dasharray="5 4" marker-end="url(#arrowhead)"/>
  <text x="390" y="308" text-anchor="middle" fill="#40916c" font-family="ui-monospace,monospace" font-size="10">loop closes on new attestation</text>
</svg>`;
}

function renderLedgerSvg(ledger) {
  const rows = ledger.entries.slice(0, 8);
  const w = 720;
  const h = 80 + rows.length * 26;
  const header = `<text x="16" y="56" fill="#2d6a4f" font-family="ui-monospace,monospace" font-size="11" font-weight="700">repo</text>
  <text x="180" y="56" fill="#2d6a4f" font-family="ui-monospace,monospace" font-size="11" font-weight="700">authorship</text>
  <text x="300" y="56" fill="#2d6a4f" font-family="ui-monospace,monospace" font-size="11" font-weight="700">model</text>
  <text x="480" y="56" fill="#2d6a4f" font-family="ui-monospace,monospace" font-size="11" font-weight="700">receipt</text>`;
  const body = rows
    .map((r, i) => {
      const y = 80 + i * 26;
      const has = r.latest_url ? 'yes' : '—';
      return `<text x="16" y="${y}" fill="#495057" font-family="ui-monospace,monospace" font-size="11">${escapeXml(r.repo)}</text>
<text x="180" y="${y}" fill="#495057" font-family="ui-monospace,monospace" font-size="11">${escapeXml(r.authorship_type ?? '—')}</text>
<text x="300" y="${y}" fill="#495057" font-family="ui-monospace,monospace" font-size="11">${escapeXml(truncate(r.model ?? '—', 20))}</text>
<text x="480" y="${y}" fill="#495057" font-family="ui-monospace,monospace" font-size="11">${escapeXml(has)}</text>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Provenance ledger">
  <defs>
    <style>
      @media (prefers-color-scheme: dark) {
        .bg { fill: #0d1b2a; }
        .title { fill: #e0e1dd; }
        .sub { fill: #adb5bd; }
      }
      @media (prefers-color-scheme: light) {
        .bg { fill: #f8f9fa; }
        .title { fill: #212529; }
        .sub { fill: #495057; }
      }
    </style>
  </defs>
  <rect class="bg" width="${w}" height="${h}" rx="8" stroke="#415a77" stroke-width="1"/>
  <text class="title" x="16" y="28" font-family="Georgia,serif" font-size="15" font-weight="600">Provenance ledger</text>
  <text class="sub" x="16" y="44" font-family="ui-monospace,monospace" font-size="10">${ledger.with_receipts} of ${ledger.total_repos} repos carry attest signals · sparse rows are expected until backfill</text>
  <line x1="16" y1="64" x2="${w - 16}" y2="64" stroke="#adb5bd" stroke-width="1"/>
  ${header}
  ${body}
</svg>`;
}

function extractHumanProse(readme) {
  const start = '<!-- profile-sync:human-prose-start -->';
  const end = '<!-- profile-sync:human-prose-end -->';
  const i = readme.indexOf(start);
  const j = readme.indexOf(end);
  if (i === -1 || j === -1) return readme;
  return readme.slice(i + start.length, j).trim();
}

async function createAttestation(readmeContent, contentHash) {
  const humanProse = extractHumanProse(readmeContent);
  const params = new URLSearchParams({
    content_name: 'README.md',
    model: 'claude-opus-4',
    role: 'collaborated',
    author: GITHUB_USER,
    platform: 'Cursor',
    content: humanProse,
  });
  try {
    const res = await fetch(`${ATTEST_BASE}/api/create?${params}`);
    if (!res.ok) throw new Error(`Attest API ${res.status}`);
    const data = await res.json();
    if (!data.success) throw new Error('Attest API returned success=false');
    data.content_hash = contentHash;
    return data;
  } catch (err) {
    console.warn('Attest API unavailable, using placeholder:', err.message);
    return {
      success: false,
      placeholder: true,
      content_hash: contentHash,
      attestation: {
        version: '3.0',
        content_name: 'README.md',
        model: 'claude-opus-4',
        role: 'collaborated',
        authorship_type: 'collab',
        timestamp: new Date().toISOString(),
        platform: 'Cursor',
        author: GITHUB_USER,
      },
      urls: {
        verify: `${ATTEST_BASE}/verify/`,
        short: `${ATTEST_BASE}/`,
      },
    };
  }
}

function buildEntitySnapshot({ repos, blogPosts, metrics, plan, build, verify, ledger }) {
  return {
    synced_at: new Date().toISOString(),
    identity: {
      name: 'Austin Harshberger',
      github: `https://github.com/${GITHUB_USER}`,
      links: 'https://links.97115104.com/',
      blog: 'https://blog.97115104.com/',
      orcid: 'https://orcid.org/0009-0003-7242-2456',
    },
    metrics: metrics ?? null,
    repo_count: repos.length,
    pinned: PINNED,
    repo_groups: REPO_GROUPS,
    recent_posts: blogPosts.slice(0, 6),
    plan,
    build,
    verify,
    ledger_summary: {
      total: ledger.total_repos,
      with_receipts: ledger.with_receipts,
    },
  };
}

function renderLlmsTxt(snapshot) {
  const posts = snapshot.recent_posts
    .map((p) => `- ${p.title}: ${p.link}`)
    .join('\n');
  const pinned = PINNED.map((p) => `- ${p.name}: ${p.purpose}`).join('\n');

  return `# 97115104 — agent entity kernel

> Austin Harshberger builds open systems for attribution, personal inference, and verifiable publishing.
> This file is the authoritative machine-readable index for agents working in the 97115104 namespace.

## canonical identity

- Name: Austin Harshberger
- GitHub: https://github.com/${GITHUB_USER}
- Links profile: https://links.97115104.com/
- Blog: https://blog.97115104.com/
- ORCID: https://orcid.org/0009-0003-7242-2456
- Attest protocol: https://attest.97115104.com/
- Attest agent spec: https://attest.97115104.com/llms.txt
- Writing profile (mandatory for human-facing prose): https://raw.githubusercontent.com/97115104/97115104-writing-profile/refs/heads/main/writing-profile.md

## attribution rules for agents

When you produce or modify content in this namespace:

1. Read the writing profile and obey it in full for any human-facing prose.
2. Create an attestation via https://attest.97115104.com/api/create or \`npm install attest-client\`.
3. Use the EXACT urls.short and urls.verify values from the API response. Never construct URLs.
4. Append the verify URL to commit messages, PR descriptions, or markdown frontmatter.
5. Record platform (Cursor, Claude Code, Copilot, etc.) and model name in every attestation.

## pinned repositories

${pinned}

## recent blog posts (synced ${snapshot.synced_at.slice(0, 10)})

${posts || '- (feed unavailable at last sync)'}

## live metrics

- Total attestations: ${snapshot.metrics?.total_attestations ?? 'unknown'}
- Total verifications: ${snapshot.metrics?.total_verifications ?? 'unknown'}
- Top authorship type: ${snapshot.metrics?.top_type?.authorship_type ?? 'unknown'}

## repository groups

- attribution: ${REPO_GROUPS.attribution.join(', ')}
- inference harnesses: ${REPO_GROUPS.inference.join(', ')}
- personal LM tooling: ${REPO_GROUPS.personal_lm.join(', ')}
- language design: ${REPO_GROUPS.language.join(', ')}

## profile sync

Machine snapshot: generated/entity-snapshot.json
Last sync: ${snapshot.synced_at}
`;
}

function renderAttestBlock(attestation) {
  if (attestation.placeholder) {
    return `Attestation pending next CI run with network access to [attest.97115104.com](https://attest.97115104.com/).

Content SHA-256: \`${attestation.content_hash}\``;
  }
  const short = attestation.urls?.short ?? '';
  const verify = attestation.urls?.verify ?? '';
  return `[Verify this README](${short}) · [Full attestation record](${verify})

Human prose SHA-256: \`${attestation.content_hash}\`

Sidecar: [attestations/README.latest.json](attestations/README.latest.json)`;
}

function renderSyncMeta(snapshot, styleResult) {
  return `Last profile sync: **${snapshot.synced_at.slice(0, 19)}Z** · ${snapshot.repo_count} repositories · ${snapshot.metrics?.total_attestations ?? '—'} total attestations on attest.97115104.com · style lint: **${styleResult.pass ? 'PASS' : 'FAIL'}**`;
}

async function main() {
  mkdirSync(GENERATED, { recursive: true });
  mkdirSync(ATTESTATIONS, { recursive: true });

  console.log('Fetching GitHub repos…');
  const repos = await fetchRepos();

  console.log('Fetching blog feed…');
  let blogPosts = [];
  try {
    const feedXml = await fetchText(BLOG_FEED);
    blogPosts = parseAtomFeed(feedXml);
  } catch (err) {
    console.warn('Blog feed unavailable:', err.message);
  }

  console.log('Fetching attest metrics…');
  let metrics = null;
  try {
    metrics = await fetchJson(`${ATTEST_BASE}/api/metrics`);
  } catch (err) {
    console.warn('Attest metrics unavailable:', err.message);
  }

  const plan = [];
  for (const title of blogPosts.slice(0, 3).map((p) => p.title)) {
    plan.push(title);
  }
  for (const repoName of PLAN_REPOS) {
    const issues = await fetchOpenIssues(repoName);
    for (const t of issues.slice(0, 1)) plan.push(`${repoName}: ${t}`);
  }

  const build = repos
    .filter((r) => !r.fork)
    .sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at))
    .slice(0, 8)
    .map((r) => ({ name: r.name, pushed_at: r.pushed_at, group: groupForRepo(r.name) }));

  console.log('Scanning provenance signals…');
  const ledgerEntries = [];
  const scanTargets = repos.filter((r) => !r.fork).slice(0, 20);
  for (const repo of scanTargets) {
    const readme = await fetchRepoReadme(repo.name);
    const signal = extractAttestSignals(readme, repo.name);
    if (signal) ledgerEntries.push(signal);
  }
  ledgerEntries.sort((a, b) => a.repo.localeCompare(b.repo));
  const ledger = {
    scanned_at: new Date().toISOString(),
    total_repos: repos.length,
    with_receipts: ledgerEntries.filter((e) => e.latest_url).length,
    entries: ledgerEntries,
  };

  const verify = ledgerEntries.length
    ? ledgerEntries
    : [{ repo: '97115104', authorship_type: 'collab', model: 'claude-opus-4', latest_url: null }];

  const snapshot = buildEntitySnapshot({ repos, blogPosts, metrics, plan, build, verify, ledger });
  writeFileSync(join(GENERATED, 'entity-snapshot.json'), JSON.stringify(snapshot, null, 2));

  writeFileSync(join(GENERATED, 'provenance-ledger.json'), JSON.stringify(ledger, null, 2));
  writeFileSync(join(GENERATED, 'loop-diagram.svg'), renderLoopSvg(snapshot));
  writeFileSync(join(GENERATED, 'provenance-ledger.svg'), renderLedgerSvg(ledger));

  const readmePath = join(ROOT, 'README.md');
  let readme = readFileSync(readmePath, 'utf8');
  const humanProse = extractHumanProse(readme);
  const proseHash = hashContent(humanProse);

  console.log('Creating README attestation…');
  const attestation = await createAttestation(readme, proseHash);
  writeFileSync(join(ATTESTATIONS, 'README.latest.json'), JSON.stringify(attestation, null, 2));
  writeFileSync(join(GENERATED, 'attest-seal.svg'), renderAttestSealSvg(attestation, proseHash));

  console.log('Linting writing profile…');
  const styleResult = writeStyleAttestation(readmePath);

  writeFileSync(join(ROOT, 'llms.txt'), renderLlmsTxt(snapshot));

  readme = replaceSection(readme, 'attest-seal', `![Attest seal](./generated/attest-seal.svg)\n\n${renderAttestBlock({ ...attestation, content_hash: proseHash })}`);
  readme = replaceSection(readme, 'loop-diagram', `![Plan build verify loop](./generated/loop-diagram.svg)`);
  readme = replaceSection(readme, 'style-attestation', `![Writing profile compliance](./generated/style-attestation.svg)`);
  readme = replaceSection(readme, 'provenance-ledger', `![Provenance ledger](./generated/provenance-ledger.svg)`);
  readme = replaceSection(readme, 'sync-meta', renderSyncMeta(snapshot, styleResult));

  writeFileSync(readmePath, readme);
  console.log('Profile sync complete.');
}

function groupForRepo(name) {
  for (const [group, names] of Object.entries(REPO_GROUPS)) {
    if (names.includes(name)) return group;
  }
  return 'other';
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
