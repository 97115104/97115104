#!/usr/bin/env node
/**
 * Profile sync: blog feed, recent commits, SVG generation, attestation.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderHero, renderCanvas } from './svg-studio.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const GENERATED = join(ROOT, 'generated');
const ATTESTATIONS = join(ROOT, 'attestations');

const GITHUB_USER = '97115104';
const ATTEST_BASE = 'https://attest.97115104.com';
const BLOG_FEED = 'https://blog.97115104.com/feed.xml';

const PINNED = [
  { name: 'attest', purpose: 'Cryptographically signed AI content attribution protocol.' },
  { name: 'endor-train', purpose: 'Aggregate personalized data to train a personal language model.' },
  { name: 'hsc-chat', purpose: 'Chat client for an OpenAI-compatible API.' },
  { name: 'voice-clone', purpose: 'Chatterbox-based voice cloning tool.' },
  { name: 'vLLM-harness', purpose: 'Serve models through vLLM with a secure public API.' },
  { name: 'ollama-harness', purpose: 'Serve models through Ollama with a secure public API.' },
];

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

async function fetchRecentCommits() {
  try {
    const events = await fetchJson(
      `https://api.github.com/users/${GITHUB_USER}/events/public?per_page=30`,
      githubHeaders(),
    );
    const commits = [];
    for (const event of events) {
      if (event.type !== 'PushEvent' || !event.payload?.head) continue;
      const repoFull = event.repo?.name ?? '';
      const repo = repoFull.replace(`${GITHUB_USER}/`, '');
      try {
        const detail = await fetchJson(
          `https://api.github.com/repos/${repoFull}/commits/${event.payload.head}`,
          githubHeaders(),
        );
        commits.push({
          repo,
          message: (detail.commit?.message ?? 'push').split('\n')[0],
          sha: event.payload.head.slice(0, 7),
          at: event.created_at,
        });
      } catch {
        commits.push({ repo, message: `push to ${event.payload.ref?.split('/').pop() ?? 'main'}`, sha: event.payload.head.slice(0, 7), at: event.created_at });
      }
      if (commits.length >= 6) break;
    }
    return commits;
  } catch (err) {
    console.warn('GitHub events unavailable:', err.message);
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
    entries.push({ title: title.trim(), link, updated });
  }
  return entries;
}

function hashContent(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function replaceSection(content, name, body) {
  const start = `<!-- profile-sync:${name}-start -->`;
  const end = `<!-- profile-sync:${name}-end -->`;
  const re = new RegExp(`${start}[\\s\\S]*?${end}`, 'm');
  if (!re.test(content)) throw new Error(`Missing sync section: ${name}`);
  return content.replace(re, `${start}\n${body}\n${end}`);
}

export function extractHumanProse(readme) {
  const re = /profile-sync:human-prose-start\s*\n?([\s\S]*?)\s*profile-sync:human-prose-end/;
  const m = readme.match(re);
  return m ? m[1].trim() : '';
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
    console.warn('Attest API unavailable:', err.message);
    return {
      success: false,
      placeholder: true,
      content_hash: contentHash,
      urls: { verify: `${ATTEST_BASE}/verify/`, short: `${ATTEST_BASE}/` },
    };
  }
}

function renderLlmsTxt(snapshot) {
  const posts = snapshot.recent_posts.map((p) => `- ${p.title}: ${p.link}`).join('\n');
  const pinned = PINNED.map((p) => `- ${p.name}: ${p.purpose}`).join('\n');

  return `# 97115104 — agent entity kernel

> Machine-readable index for agents in the 97115104 namespace.

## links

- GitHub: https://github.com/${GITHUB_USER}
- Links: https://links.97115104.com/
- Blog: https://blog.97115104.com/
- Attest: https://attest.97115104.com/
- Attest spec: https://attest.97115104.com/llms.txt

## attribution

1. Create attestation via https://attest.97115104.com/api/create or \`npm install attest-client\`
2. Use EXACT urls from the API response
3. Append verify URL to commits or PR descriptions

## pinned

${pinned}

## recent blog (${snapshot.synced_at.slice(0, 10)})

${posts || '- feed unavailable'}

## sync

Last: ${snapshot.synced_at}
`;
}

async function main() {
  mkdirSync(GENERATED, { recursive: true });
  mkdirSync(ATTESTATIONS, { recursive: true });

  console.log('Fetching data…');
  const [repos, blogPosts, recentCommits] = await Promise.all([
    fetchRepos(),
    fetchText(BLOG_FEED).then(parseAtomFeed).catch(() => []),
    fetchRecentCommits(),
  ]);

  const snapshot = {
    synced_at: new Date().toISOString(),
    repo_count: repos.length,
    recent_posts: blogPosts.slice(0, 6),
    recent_commits: recentCommits,
  };
  writeFileSync(join(GENERATED, 'entity-snapshot.json'), JSON.stringify(snapshot, null, 2));

  const readmePath = join(ROOT, 'README.md');
  let readme = readFileSync(readmePath, 'utf8');
  const proseHash = hashContent(extractHumanProse(readme));

  console.log('Creating attestation…');
  const attestation = await createAttestation(readme, proseHash);
  writeFileSync(join(ATTESTATIONS, 'README.latest.json'), JSON.stringify(attestation, null, 2));

  writeFileSync(join(GENERATED, 'hero.svg'), renderHero());
  writeFileSync(join(GENERATED, 'canvas.svg'), renderCanvas(snapshot));

  writeFileSync(join(ROOT, 'llms.txt'), renderLlmsTxt(snapshot));

  const verifyUrl = attestation.urls?.short ?? 'https://attest.97115104.com/';
  readme = replaceSection(
    readme,
    'hero',
    `<a href="https://links.97115104.com/"><img src="./generated/hero.svg" width="100%" alt="97 115 104"/></a>`,
  );
  readme = replaceSection(
    readme,
    'canvas',
    `<a href="https://blog.97115104.com/"><img src="./generated/canvas.svg" width="100%" alt="live feed"/></a>`,
  );
  readme = replaceSection(
    readme,
    'sync-meta',
    `<sub>[verify readme](${verifyUrl}) · synced ${snapshot.synced_at.slice(0, 16)}Z</sub>`,
  );

  writeFileSync(readmePath, readme);
  console.log('Profile sync complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
