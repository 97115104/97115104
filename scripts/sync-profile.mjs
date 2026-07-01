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
const HERO_ART = join(ROOT, 'assets', 'hero-art.png');

const GITHUB_USER = '97115104';
const ATTEST_BASE = 'https://attest.97115104.com';
const BLOG_FEED = 'https://blog.97115104.com/feed.xml';
const BLOG_BOOKS = 'https://blog.97115104.com/books/books.json';
const FEED_BLOG_LIMIT = 6;
const FEED_COMMIT_LIMIT = 13;
const FEED_COMMIT_FETCH_LIMIT = 50;
const FEED_REPO_LIMIT = 3;
const FEED_COMMITS_PER_REPO = 3;
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

function loadHeroArtDataUri() {
  if (!existsSync(HERO_ART)) return null;
  const buf = readFileSync(HERO_ART);
  const mime = buf[0] === 0xff && buf[1] === 0xd8 ? 'image/jpeg' : 'image/png';
  return `data:${mime};base64,${buf.toString('base64')}`;
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

async function fetchRecentCommits(repos, limit = FEED_COMMIT_FETCH_LIMIT) {
  const commits = [];
  const seen = new Set();

  const addCommit = (entry) => {
    const fullSha = entry.fullSha ?? entry.sha;
    if (!fullSha || seen.has(fullSha)) return false;
    seen.add(fullSha);
    commits.push({
      repo: entry.repo,
      message: entry.message,
      sha: fullSha.slice(0, 7),
      at: entry.at,
    });
    return commits.length >= limit;
  };

  const eventsUrl = hasUserAuth()
    ? 'https://api.github.com/user/events?per_page=100'
    : `https://api.github.com/users/${GITHUB_USER}/events/public?per_page=100`;

  try {
    const events = await fetchJson(eventsUrl, githubHeaders());
    const pushEvents = events.filter((e) => e.type === 'PushEvent');

    for (const event of pushEvents) {
      const repo = event.repo?.name?.replace(`${GITHUB_USER}/`, '') ?? '?';
      const payloadCommits = event.payload?.commits ?? [];
      if (payloadCommits.length) {
        for (const c of [...payloadCommits].reverse()) {
          if (addCommit({
            repo,
            message: (c.message ?? 'commit').split('\n')[0],
            fullSha: c.sha,
            at: event.created_at,
          })) return commits;
        }
        continue;
      }
      if (!event.payload?.head) continue;
      try {
        const repoFull = event.repo?.name ?? '';
        const detail = await fetchJson(
          `https://api.github.com/repos/${repoFull}/commits/${event.payload.head}`,
          githubHeaders(),
        );
        if (addCommit({
          repo,
          message: (detail.commit?.message ?? 'push').split('\n')[0],
          fullSha: event.payload.head,
          at: detail.commit?.author?.date ?? event.created_at,
        })) return commits;
      } catch {
        if (addCommit({
          repo,
          message: `push to ${event.payload.ref?.split('/').pop() ?? 'main'}`,
          fullSha: event.payload.head,
          at: event.created_at,
        })) return commits;
      }
    }
  } catch (err) {
    console.warn('GitHub events unavailable:', err.message);
  }

  if (commits.length >= limit || !repos.length) return commits;

  const sorted = [...repos].sort(
    (a, b) => new Date(b.pushed_at ?? 0) - new Date(a.pushed_at ?? 0),
  );
  for (const repo of sorted.slice(0, 12)) {
    try {
      const batch = await fetchJson(
        `https://api.github.com/repos/${repo.full_name}/commits?per_page=30`,
        githubHeaders(),
      );
      for (const c of batch) {
        if (addCommit({
          repo: repo.name,
          message: (c.commit?.message ?? 'commit').split('\n')[0],
          fullSha: c.sha,
          at: c.commit?.author?.date ?? c.commit?.committer?.date,
        })) {
          return commits.sort((a, b) => new Date(b.at) - new Date(a.at));
        }
      }
    } catch (err) {
      console.warn(`commits for ${repo.full_name}:`, err.message);
    }
  }

  return commits.sort((a, b) => new Date(b.at) - new Date(a.at));
}

async function fetchCommitsByRepo(repos) {
  const sorted = [...repos].sort(
    (a, b) => new Date(b.pushed_at ?? 0) - new Date(a.pushed_at ?? 0),
  );
  const groups = [];
  const flat = [];

  for (const repo of sorted) {
    try {
      const batch = await fetchJson(
        `https://api.github.com/repos/${repo.full_name}/commits?per_page=30`,
        githubHeaders(),
      );
      if (!batch.length) continue;
      const commits = batch.map((c) => ({
        sha: c.sha.slice(0, 7),
        message: (c.commit?.message ?? 'commit').split('\n')[0],
        at: c.commit?.author?.date ?? c.commit?.committer?.date,
      }));
      groups.push({ repo: repo.name, commits });
      for (const c of commits) {
        flat.push({ repo: repo.name, ...c });
      }
    } catch (err) {
      console.warn(`commits for ${repo.full_name}:`, err.message);
    }
  }

  return { groups, flat };
}

function groupCommitsByRepo(commits) {
  const order = [];
  const groups = new Map();
  for (const c of commits) {
    if (!groups.has(c.repo)) {
      groups.set(c.repo, { repo: c.repo, commits: [] });
      order.push(c.repo);
    }
    groups.get(c.repo).commits.push({
      sha: c.sha,
      message: c.message,
      at: c.at,
    });
  }
  return order.map((repo) => groups.get(repo));
}

function trimCommitTree(groups) {
  return groups
    .slice(0, FEED_REPO_LIMIT)
    .map((g) => {
      const total = g.commits.length;
      const commits = g.commits.slice(0, FEED_COMMITS_PER_REPO);
      return {
        repo: g.repo,
        commits,
        more: Math.max(total - commits.length, 0),
      };
    })
    .filter((g) => g.commits.length);
}

function topCommitRepo(commits) {
  const counts = {};
  for (const c of commits) {
    counts[c.repo] = (counts[c.repo] ?? 0) + 1;
  }
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return top ? { name: top[0], count: top[1] } : null;
}

function buildCommitStats(commits) {
  if (!commits.length) return { sample_size: 0, commits_7d: 0, commits_30d: 0 };
  const derived = deriveCommitStats(commits);
  return {
    ...derived,
    commits_7d: commits.filter((c) => daysSince(c.at) <= 7).length,
    commits_30d: commits.filter((c) => daysSince(c.at) <= 30).length,
    top_commit_repo: topCommitRepo(commits),
  };
}

async function fetchActivity(repos = []) {
  if (repos.length) {
    const { groups, flat } = await fetchCommitsByRepo(repos);
    return {
      recent_commits: trimCommitTree(groups),
      commit_stats: buildCommitStats(flat),
    };
  }
  const raw = await fetchRecentCommits(repos);
  return {
    recent_commits: trimCommitTree(groupCommitsByRepo(raw)),
    commit_stats: buildCommitStats(raw),
  };
}

const BOOK_MONTHS = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function trimBook(book) {
  return {
    title: book.title ?? '',
    author: book.author ?? '',
    progress: book.progress ?? '',
    completedDate: book.completedDate ?? '',
    goodreadsUrl: book.goodreadsUrl ?? '',
    rating: book.rating ?? null,
  };
}

function completedDateSortKey(dateString) {
  if (!dateString) return 0;
  const match = dateString.trim().match(/^(\w+)\s+((?:19|20)\d{2})$/i);
  if (match) {
    const month = BOOK_MONTHS[match[1].toLowerCase()];
    const year = Number(match[2]);
    if (month != null) return year * 100 + month;
    return year * 100;
  }
  const year = dateString.match(/\b((?:19|20)\d{2})\b/);
  return year ? Number(year[1]) * 100 : 0;
}

function parseBooksData(data) {
  const currentlyReading = (data.currentlyReading ?? []).map(trimBook);
  const recentlyRead = [...(data.recentlyRead ?? [])]
    .map(trimBook)
    .sort((a, b) => {
      const keyA = completedDateSortKey(a.completedDate);
      const keyB = completedDateSortKey(b.completedDate);
      if (keyB !== keyA) return keyB - keyA;
      return a.title.localeCompare(b.title);
    });
  const lastRead = recentlyRead.find((b) => b.completedDate) ?? recentlyRead[0] ?? null;
  return { currently_reading: currentlyReading, last_read: lastRead };
}

async function fetchBooks() {
  try {
    const data = await fetchJson(BLOG_BOOKS);
    return parseBooksData(data);
  } catch (err) {
    console.warn('Blog books unavailable:', err.message);
    return null;
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

function renderLlmsBooks(books) {
  if (!books) return '- books unavailable';
  const lines = [];
  for (const book of (books.currently_reading ?? []).slice(0, 3)) {
    lines.push(`- reading: ${book.title} by ${book.author}${book.progress ? ` (${book.progress})` : ''}`);
  }
  if (books.last_read?.title) {
    const last = books.last_read;
    lines.push(`- last read: ${last.title} by ${last.author}${last.completedDate ? ` (${last.completedDate})` : ''}`);
  }
  return lines.length ? lines.join('\n') : '- none listed';
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

## reading (${snapshot.synced_at.slice(0, 10)})

${renderLlmsBooks(snapshot.books)}

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

function shouldPreservePatSnapshot(previous, hasAuth, repoCounts) {
  if (!previous || previous.sync_auth !== 'pat' || hasAuth) return false;
  const prevTotal = previous.repo_counts?.total ?? previous.repo_count ?? 0;
  const nextTotal = repoCounts?.total ?? 0;
  return nextTotal < prevTotal;
}

function preservePatSnapshot(snapshot, previous) {
  snapshot.sync_auth = previous.sync_auth;
  snapshot.repo_count = previous.repo_count;
  snapshot.repo_counts = previous.repo_counts;
  snapshot.repo_stats = previous.repo_stats;
  if (!snapshot.languages_by_recency?.length && previous.languages_by_recency?.length) {
    snapshot.languages_by_recency = previous.languages_by_recency;
  }
  if (!snapshot.language_totals?.length && previous.language_totals?.length) {
    snapshot.language_totals = previous.language_totals;
  }
  if (!snapshot.recent_commits?.length && previous.recent_commits?.length) {
    snapshot.recent_commits = previous.recent_commits;
  }
  if (!snapshot.commit_stats?.sample_size && previous.commit_stats?.sample_size) {
    snapshot.commit_stats = previous.commit_stats;
  }
  return snapshot;
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

  const [blogPosts, books, activity, languages, languageTotals] = await Promise.all([
    fetchText(BLOG_FEED).then(parseAtomFeed).catch(() => []),
    fetchBooks(),
    fetchActivity(repos),
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
    recent_posts: blogPosts.length ? blogPosts.slice(0, FEED_BLOG_LIMIT) : (previous?.recent_posts ?? []),
    books: books ?? previous?.books ?? null,
    recent_commits: recentCommits,
    commit_stats: commitStats,
    languages_by_recency: languages.length
      ? languages
      : (previous?.languages_by_recency ?? []),
    language_totals: languageTotals.length
      ? languageTotals
      : (previous?.language_totals ?? []),
  };
  if (shouldPreservePatSnapshot(previous, hasAuth, repoCounts)) {
    console.log('Keeping PAT snapshot stats (public-only sync would downgrade repo data).');
    preservePatSnapshot(snapshot, previous);
  }
  writeFileSync(join(GENERATED, 'entity-snapshot.json'), JSON.stringify(snapshot, null, 2));

  const readmePath = join(ROOT, 'README.md');
  let readme = readFileSync(readmePath, 'utf8');
  const proseHash = hashContent(extractHumanProse(readme));

  console.log('Creating attestation…');
  const attestation = await createAttestation(readme, proseHash);
  writeFileSync(join(ATTESTATIONS, 'README.latest.json'), JSON.stringify(attestation, null, 2));

  writeFileSync(join(GENERATED, 'hero.svg'), renderHero(loadHeroArtDataUri()));
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
