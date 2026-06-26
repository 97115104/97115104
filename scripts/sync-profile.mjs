#!/usr/bin/env node
/**
 * Profile sync: blog feed, recent commits, SVG generation, attestation.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
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
const PT = 'America/Los_Angeles';
const ATTEST_MODEL = 'composer-2.5-fast';

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

function githubToken() {
  return process.env.PROFILE_SYNC_TOKEN || process.env.GITHUB_TOKEN || null;
}

function githubHeaders() {
  const token = githubToken();
  return token
    ? { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' }
    : { Accept: 'application/vnd.github+json' };
}

function hasUserAuth() {
  return Boolean(process.env.PROFILE_SYNC_TOKEN);
}

async function fetchAllRepos() {
  const token = githubToken();
  const useUserRepos = Boolean(process.env.PROFILE_SYNC_TOKEN);
  const repos = [];
  let page = 1;
  while (true) {
    const url = useUserRepos
      ? `https://api.github.com/user/repos?per_page=100&page=${page}&affiliation=owner&visibility=all&sort=updated`
      : token
        ? `https://api.github.com/user/repos?per_page=100&page=${page}&affiliation=owner&sort=updated`
        : `https://api.github.com/users/${GITHUB_USER}/repos?per_page=100&page=${page}&sort=updated`;
    const batch = await fetchJson(url, githubHeaders());
    if (!batch.length) break;
    repos.push(...batch);
    if (batch.length < 100) break;
    page += 1;
  }
  return repos;
}

function countRepos(repos, hasAuth, userProfile = null) {
  const pub = repos.filter((r) => !r.private).length;
  const privFromRepos = hasAuth ? repos.filter((r) => r.private).length : null;
  const priv = userProfile?.total_private_repos ?? privFromRepos;
  return {
    public: userProfile?.public_repos ?? pub,
    private: hasAuth ? priv : null,
    total: hasAuth && userProfile
      ? (userProfile.public_repos ?? pub) + (userProfile.total_private_repos ?? privFromRepos ?? 0)
      : repos.length,
  };
}

function daysSince(iso) {
  return (Date.now() - new Date(iso).getTime()) / 86_400_000;
}

function buildRepoStats(repos) {
  const owned = repos.filter((r) => !r.fork);
  const forked = repos.filter((r) => r.fork);
  const archived = repos.filter((r) => r.archived);
  const stars = repos.reduce((sum, r) => sum + (r.stargazers_count ?? 0), 0);
  const forkTotal = repos.reduce((sum, r) => sum + (r.forks_count ?? 0), 0);
  const pushed7d = owned.filter((r) => daysSince(r.pushed_at) <= 7).length;
  const pushed30d = owned.filter((r) => daysSince(r.pushed_at) <= 30).length;
  const topStarred = [...owned].sort((a, b) => b.stargazers_count - a.stargazers_count)[0];
  const activeRepo = [...owned].sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at))[0];
  const oldest = [...owned].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))[0];

  return {
    owned: owned.length,
    forked: forked.length,
    archived: archived.length,
    stars,
    forks: forkTotal,
    pushed_7d: pushed7d,
    pushed_30d: pushed30d,
    top_starred: topStarred ? { name: topStarred.name, stars: topStarred.stargazers_count } : null,
    active_repo: activeRepo ? { name: activeRepo.name, at: activeRepo.pushed_at } : null,
    oldest_repo: oldest ? { name: oldest.name, at: oldest.created_at } : null,
  };
}

async function fetchUserProfile() {
  if (!hasUserAuth()) return null;
  try {
    return await fetchJson('https://api.github.com/user', githubHeaders());
  } catch (err) {
    console.warn('GitHub user profile unavailable:', err.message);
    return null;
  }
}

async function fetchLanguageTotals(repos) {
  const owned = repos.filter((r) => !r.fork);
  const totals = {};
  const batchSize = 8;

  for (let i = 0; i < owned.length; i += batchSize) {
    const batch = owned.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (repo) => {
        try {
          const langs = await fetchJson(
            `https://api.github.com/repos/${repo.full_name}/languages`,
            githubHeaders(),
          );
          for (const [name, bytes] of Object.entries(langs)) {
            totals[name] = (totals[name] ?? 0) + bytes;
          }
        } catch {
          if (repo.language) totals[repo.language] = (totals[repo.language] ?? 0) + 1;
        }
      }),
    );
  }

  return Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([name, bytes]) => ({ name, bytes }));
}

function pacificHour(date) {
  return Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: PT,
      hour: 'numeric',
      hour12: false,
    }).format(date),
  );
}

function formatSyncedPacific(iso) {
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

async function fetchLanguagesByRecency(repos) {
  const sorted = repos
    .filter((r) => !r.fork)
    .sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at));

  const seen = new Set();
  const result = [];

  for (const repo of sorted.slice(0, 12)) {
    if (result.length >= 8) break;
    try {
      const langs = await fetchJson(
        `https://api.github.com/repos/${repo.full_name}/languages`,
        githubHeaders(),
      );
      for (const [name, bytes] of Object.entries(langs)) {
        if (seen.has(name)) continue;
        seen.add(name);
        result.push({ name, repo: repo.name, bytes, pushed_at: repo.pushed_at });
        if (result.length >= 8) break;
      }
    } catch {
      if (repo.language && !seen.has(repo.language)) {
        seen.add(repo.language);
        result.push({ name: repo.language, repo: repo.name, bytes: 1, pushed_at: repo.pushed_at });
      }
    }
  }

  if (result.length === 0) {
    for (const repo of sorted.slice(0, 8)) {
      if (repo.language && !seen.has(repo.language)) {
        seen.add(repo.language);
        result.push({ name: repo.language, repo: repo.name, bytes: 1, pushed_at: repo.pushed_at });
      }
    }
  }

  return result;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

async function fetchActivity() {
  try {
    const events = await fetchJson(
      `https://api.github.com/users/${GITHUB_USER}/events/public?per_page=100`,
      githubHeaders(),
    );
    const pushEvents = events.filter((e) => e.type === 'PushEvent' && e.payload?.head);

    const sample = pushEvents.map((e) => new Date(e.created_at));
    const hourCounts = Array(24).fill(0);
    const dayCounts = Array(7).fill(0);
    for (const t of sample) {
      hourCounts[pacificHour(t)] += 1;
      const wd = new Intl.DateTimeFormat('en-US', { timeZone: PT, weekday: 'short' }).format(t);
      const dayIdx = DAY_NAMES.indexOf(wd);
      if (dayIdx >= 0) dayCounts[dayIdx] += 1;
    }
    const peakHour = sample.length ? hourCounts.indexOf(Math.max(...hourCounts)) : null;
    const peakDay = sample.length ? DAY_NAMES[dayCounts.indexOf(Math.max(...dayCounts))] : null;
    const sorted = [...sample].sort((a, b) => a - b);
    const pushes7d = pushEvents.filter((e) => daysSince(e.created_at) <= 7).length;
    const pushes30d = pushEvents.filter((e) => daysSince(e.created_at) <= 30).length;

    const repoPushCounts = {};
    for (const event of pushEvents) {
      const name = event.repo?.name?.replace(`${GITHUB_USER}/`, '') ?? '?';
      repoPushCounts[name] = (repoPushCounts[name] ?? 0) + 1;
    }
    const topPushRepo = Object.entries(repoPushCounts).sort((a, b) => b[1] - a[1])[0];

    const commits = [];
    for (const event of pushEvents) {
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
          at: detail.commit?.author?.date ?? event.created_at,
        });
      } catch {
        commits.push({
          repo,
          message: `push to ${event.payload.ref?.split('/').pop() ?? 'main'}`,
          sha: event.payload.head.slice(0, 7),
          at: event.created_at,
        });
      }
      if (commits.length >= 6) break;
    }

    return {
      recent_commits: commits,
      commit_stats: {
        peak_hour_pt: peakHour,
        peak_day_pt: peakDay,
        hours_pt: hourCounts,
        days_pt: dayCounts,
        pushes_7d: pushes7d,
        pushes_30d: pushes30d,
        top_push_repo: topPushRepo ? { name: topPushRepo[0], count: topPushRepo[1] } : null,
        latest: sorted.length ? sorted[sorted.length - 1].toISOString() : null,
        earliest: sorted.length ? sorted[0].toISOString() : null,
        sample_size: sample.length,
      },
    };
  } catch (err) {
    console.warn('GitHub events unavailable:', err.message);
    return { recent_commits: [], commit_stats: { sample_size: 0 } };
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
    model: ATTEST_MODEL,
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

function loadPreviousSnapshot() {
  const path = join(GENERATED, 'entity-snapshot.json');
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function deriveCommitStats(commits) {
  const timestamps = commits
    .map((c) => new Date(c.at))
    .filter((d) => !Number.isNaN(d.getTime()));
  if (!timestamps.length) return { sample_size: 0 };

  const hourCounts = Array(24).fill(0);
  const dayCounts = Array(7).fill(0);
  for (const t of timestamps) {
    hourCounts[pacificHour(t)] += 1;
    const wd = new Intl.DateTimeFormat('en-US', { timeZone: PT, weekday: 'short' }).format(t);
    const dayIdx = DAY_NAMES.indexOf(wd);
    if (dayIdx >= 0) dayCounts[dayIdx] += 1;
  }
  const sorted = [...timestamps].sort((a, b) => a - b);
  return {
    peak_hour_pt: hourCounts.indexOf(Math.max(...hourCounts)),
    peak_day_pt: DAY_NAMES[dayCounts.indexOf(Math.max(...dayCounts))],
    hours_pt: hourCounts,
    days_pt: dayCounts,
    latest: sorted[sorted.length - 1].toISOString(),
    earliest: sorted[0].toISOString(),
    sample_size: timestamps.length,
  };
}

async function main() {
  mkdirSync(GENERATED, { recursive: true });
  mkdirSync(ATTESTATIONS, { recursive: true });
  const previous = loadPreviousSnapshot();

  console.log('Fetching data…');
  const hasAuth = hasUserAuth();
  console.log(`GitHub auth: ${hasAuth ? 'PROFILE_SYNC_TOKEN (full)' : 'public only'}`);
  const [repos, userProfile] = await Promise.all([
    fetchAllRepos().catch((err) => {
      console.warn('GitHub repos unavailable:', err.message);
      return [];
    }),
    fetchUserProfile(),
  ]);
  const repoCounts = repos.length || userProfile
    ? countRepos(repos, hasAuth, userProfile)
    : null;
  const repoStats = repos.length ? buildRepoStats(repos) : null;

  const [blogPosts, activity, languages, languageTotals] = await Promise.all([
    fetchText(BLOG_FEED).then(parseAtomFeed).catch(() => []),
    fetchActivity(),
    repos.length ? fetchLanguagesByRecency(repos) : Promise.resolve([]),
    repos.length ? fetchLanguageTotals(repos) : Promise.resolve([]),
  ]);

  const recentCommits = activity.recent_commits.length
    ? activity.recent_commits
    : (previous?.recent_commits ?? []);
  let commitStats = activity.commit_stats.sample_size
    ? activity.commit_stats
    : (previous?.commit_stats?.sample_size ? previous.commit_stats : null);
  if (!commitStats?.sample_size && recentCommits.length) {
    commitStats = deriveCommitStats(recentCommits);
  }
  commitStats ??= { sample_size: 0 };
  if (!commitStats.hours_pt) {
    const derived = recentCommits.length
      ? deriveCommitStats(recentCommits)
      : { hours_pt: Array(24).fill(0), days_pt: Array(7).fill(0) };
    commitStats.hours_pt = derived.hours_pt;
    commitStats.days_pt = derived.days_pt;
  }

  const profileStats = userProfile
    ? {
        followers: userProfile.followers,
        following: userProfile.following,
        member_since: userProfile.created_at?.slice(0, 10) ?? null,
      }
    : null;

  const snapshot = {
    synced_at: new Date().toISOString(),
    sync_auth: hasAuth ? 'pat' : 'public',
    repo_count: repoCounts?.total ?? previous?.repo_count ?? 0,
    repo_counts: repoCounts ?? previous?.repo_counts ?? { public: previous?.repo_count ?? 0, private: null },
    repo_stats: repoStats ?? previous?.repo_stats ?? null,
    profile_stats: profileStats ?? previous?.profile_stats ?? null,
    recent_posts: blogPosts.length ? blogPosts.slice(0, 6) : (previous?.recent_posts ?? []),
    recent_commits: recentCommits,
    commit_stats: commitStats,
    languages_by_recency: languages.length
      ? languages
      : (previous?.languages_by_recency ?? []),
    language_totals: languageTotals.length
      ? languageTotals
      : (previous?.language_totals ?? []),
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
    `<p><sub><a href="${verifyUrl}">verify readme</a> · synced ${formatSyncedPacific(snapshot.synced_at)} · feed updates on push + daily</sub></p>`,
  );

  writeFileSync(readmePath, readme);
  console.log('Profile sync complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
