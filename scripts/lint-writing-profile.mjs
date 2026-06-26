#!/usr/bin/env node
/**
 * Lints human prose blocks in README.md against the 97115104 writing profile.
 * Emits generated/style-attestation.json and generated/style-attestation.svg.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const GENERATED = join(ROOT, 'generated');

const FORBIDDEN_PATTERNS = [
  { id: 'em_dash_unicode', label: 'Em dash (unicode)', re: /\u2014/g },
  { id: 'em_dash_latex', label: 'Em dash (---)', re: /(?<!\\)---(?!-)/g },
  { id: 'rather_than', label: '"rather than"', re: /\brather than\b/gi },
  { id: 'not_but', label: '"not X but Y"', re: /\bit is not .+ but .+\b/gi },
  { id: 'leverage', label: 'Forbidden lexicon: leverage', re: /\bleverage\b/gi },
  { id: 'robust', label: 'Forbidden lexicon: robust', re: /\brobust(ly)?\b/gi },
  { id: 'delve', label: 'Forbidden lexicon: delve', re: /\bdelve\b/gi },
  { id: 'moreover', label: 'Forbidden lexicon: moreover', re: /\bmoreover\b/gi },
  { id: 'furthermore', label: 'Forbidden lexicon: furthermore', re: /\bfurthermore\b/gi },
  { id: 'seamless', label: 'Forbidden lexicon: seamless', re: /\bseamless(ly)?\b/gi },
  { id: 'comprehensive', label: 'Forbidden lexicon: comprehensive', re: /\bcomprehensive\b/gi },
  { id: 'holistic', label: 'Forbidden lexicon: holistic', re: /\bholistic\b/gi },
  { id: 'navigate_metaphor', label: 'Forbidden lexicon: navigate', re: /\bnavigate\b/gi },
  { id: 'game_changer', label: 'Forbidden lexicon: game-changer', re: /\bgame[- ]changer\b/gi },
  { id: 'disrupt', label: 'Forbidden lexicon: disrupt', re: /\bdisrupt(ive|ion)?\b/gi },
  { id: 'unprecedented', label: 'Forbidden lexicon: unprecedented', re: /\bunprecedented\b/gi },
  { id: 'transformative', label: 'Forbidden lexicon: transformative', re: /\btransformative\b/gi },
];

function extractHumanProse(readme) {
  const re = /profile-sync:human-prose-start\s*\n?([\s\S]*?)\s*profile-sync:human-prose-end/;
  const m = readme.match(re);
  return m ? m[1].trim() : '';
}

function stripMarkdown(text) {
  return text
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[#*_`>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitParagraphs(text) {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function splitSentences(paragraph) {
  return paragraph
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function wordCount(sentence) {
  return sentence.split(/\s+/).filter(Boolean).length;
}

export function lintWritingProfile(readmePath = join(ROOT, 'README.md')) {
  const readme = readFileSync(readmePath, 'utf8');
  const proseBlock = extractHumanProse(readme);
  const prose = stripMarkdown(proseBlock);
  const paragraphs = splitParagraphs(proseBlock.replace(/<!--[\s\S]*?-->/g, '').trim());

  const violations = [];

  for (const { id, label, re } of FORBIDDEN_PATTERNS) {
    const matches = prose.match(re);
    if (matches?.length) {
      violations.push({ id, label, count: matches.length, samples: matches.slice(0, 3) });
    }
  }

  const paragraphChecks = paragraphs.map((p, idx) => {
    const sentences = splitSentences(stripMarkdown(p));
    return {
      index: idx + 1,
      sentenceCount: sentences.length,
      singleSentence: sentences.length === 1,
      ok: sentences.length >= 2 || p.startsWith('>'),
    };
  });

  const singleSentenceParagraphs = paragraphChecks.filter((p) => p.singleSentence && !p.ok);
  if (singleSentenceParagraphs.length) {
    violations.push({
      id: 'single_sentence_paragraph',
      label: 'Single-sentence body paragraph',
      count: singleSentenceParagraphs.length,
      samples: singleSentenceParagraphs.map((p) => `paragraph ${p.index}`),
    });
  }

  const allSentences = paragraphs.flatMap((p) => splitSentences(stripMarkdown(p)));
  const lengths = allSentences.map(wordCount);
  const avgLength =
    lengths.length === 0 ? 0 : lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const lengthOk = avgLength >= 18 && avgLength <= 55;

  if (!lengthOk && lengths.length > 0) {
    violations.push({
      id: 'sentence_length_band',
      label: `Average sentence length ${avgLength.toFixed(1)} (target 18-55 for profile prose)`,
      count: 1,
      samples: [`avg=${avgLength.toFixed(1)}`],
    });
  }

  const categories = [
    {
      id: 'forbidden_patterns',
      label: 'Forbidden patterns and lexicon',
      pass: !violations.some((v) => FORBIDDEN_PATTERNS.some((f) => f.id === v.id)),
    },
    {
      id: 'paragraph_architecture',
      label: 'Paragraph architecture',
      pass: singleSentenceParagraphs.length === 0,
    },
    {
      id: 'sentence_rhythm',
      label: 'Sentence rhythm',
      pass: lengthOk || lengths.length === 0,
    },
  ];

  const pass = categories.every((c) => c.pass);

  return {
    pass,
    checkedAt: new Date().toISOString(),
    avgSentenceLength: Number(avgLength.toFixed(1)),
    sentenceCount: allSentences.length,
    paragraphCount: paragraphs.length,
    categories,
    violations,
  };
}

export function renderStyleAttestationSvg(result) {
  const w = 520;
  const h = 140 + result.categories.length * 28;
  const statusColor = result.pass ? '#2d6a4f' : '#9b2226';
  const statusLabel = result.pass ? 'PASS' : 'FAIL';

  const rows = result.categories
    .map((c, i) => {
      const y = 88 + i * 28;
      const mark = c.pass ? 'PASS' : 'FAIL';
      const color = c.pass ? '#40916c' : '#ae2012';
      return `<text x="24" y="${y}" fill="${color}" font-family="ui-monospace,monospace" font-size="13">${mark}: ${escapeXml(c.label)}</text>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Writing profile style attestation ${statusLabel}">
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
  <rect class="bg" width="${w}" height="${h}" rx="8" stroke="#40916c" stroke-width="2"/>
  <text class="title" x="24" y="32" font-family="Georgia,serif" font-size="16" font-weight="600">Writing Profile Compliance</text>
  <text class="sub" x="24" y="54" font-family="ui-monospace,monospace" font-size="11">97115104-writing-profile · avg ${result.avgSentenceLength} words/sentence</text>
  <rect x="380" y="16" width="116" height="32" rx="6" fill="${statusColor}"/>
  <text x="438" y="38" text-anchor="middle" fill="#fff" font-family="ui-monospace,monospace" font-size="14" font-weight="700">${statusLabel}</text>
  ${rows}
  <text class="sub" x="24" y="${h - 16}" font-family="ui-monospace,monospace" font-size="10">${escapeXml(result.checkedAt.slice(0, 19))}Z</text>
</svg>`;
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function writeStyleAttestation(readmePath) {
  mkdirSync(GENERATED, { recursive: true });
  const result = lintWritingProfile(readmePath);
  writeFileSync(join(GENERATED, 'style-attestation.json'), JSON.stringify(result, null, 2));
  writeFileSync(join(GENERATED, 'style-attestation.svg'), renderStyleAttestationSvg(result));
  return result;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = writeStyleAttestation();
  console.log(result.pass ? 'Style attestation: PASS' : 'Style attestation: FAIL');
  if (!result.pass) {
    for (const v of result.violations) console.log(`  - ${v.label}: ${v.count}`);
    process.exit(1);
  }
}
