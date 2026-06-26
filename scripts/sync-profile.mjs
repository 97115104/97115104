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
import {
  renderHero,
  renderCanvas,
  renderOrbit,
  renderTicker,
  renderStyleBadge,
} from './svg-studio.mjs';

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

  const readmePath = join(ROOT, 'README.md');
  let readme = readFileSync(readmePath, 'utf8');
  const humanProse = extractHumanProse(readme);
  const proseHash = hashContent(humanProse);

  console.log('Creating README attestation…');
  const attestation = await createAttestation(readme, proseHash);
  writeFileSync(join(ATTESTATIONS, 'README.latest.json'), JSON.stringify(attestation, null, 2));

  console.log('Linting writing profile…');
  const styleResult = writeStyleAttestation(readmePath);

  writeFileSync(join(GENERATED, 'hero.svg'), renderHero());
  writeFileSync(
    join(GENERATED, 'canvas.svg'),
    renderCanvas(snapshot, attestation, styleResult.pass, ledger),
  );
  writeFileSync(join(GENERATED, 'orbit.svg'), renderOrbit());
  writeFileSync(join(GENERATED, 'ticker.svg'), renderTicker(snapshot.recent_posts));
  writeFileSync(join(GENERATED, 'style-badge.svg'), renderStyleBadge(styleResult.pass));

  writeFileSync(join(ROOT, 'llms.txt'), renderLlmsTxt(snapshot));

  const verifyUrl = attestation.urls?.short ?? 'https://attest.97115104.com/';
  readme = replaceSection(readme, 'hero', `<a href="https://links.97115104.com/"><img src="./generated/hero.svg" width="100%" alt="97115104"/></a>`);
  readme = replaceSection(
    readme,
    'canvas',
    `<a href="${verifyUrl}"><img src="./generated/canvas.svg" width="100%" alt="live canvas"/></a>`,
  );
  readme = replaceSection(readme, 'orbit', `<img src="./generated/orbit.svg" width="100%" alt="pinned repos"/>`);
  readme = replaceSection(
    readme,
    'ticker',
    `<a href="https://blog.97115104.com/"><img src="./generated/ticker.svg" width="100%" alt="blog ticker"/></a>`,
  );
  readme = replaceSection(
    readme,
    'sync-meta',
    `<sub>${snapshot.repo_count} repos · ${snapshot.metrics?.total_attestations ?? '—'} attestations · [verify](${verifyUrl}) · synced ${snapshot.synced_at.slice(0, 16)}Z</sub>`,
  );

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
