// src/lib/transcriptSearch.js
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const CORPUS_GZ_PATH = path.join(process.cwd(), "src/data/transcriptCorpus.json.gz");
const EXTRA_TRANSCRIPTS_DIR = path.join(process.cwd(), "src/data/synced-transcripts");

const STOPWORDS = new Set([
  "the", "and", "for", "that", "this", "with", "you", "are", "was", "were", "have", "has",
  "had", "not", "but", "what", "when", "where", "who", "why", "how", "from", "they", "them",
  "their", "there", "about", "into", "out", "just", "like", "did", "does", "say", "said",
  "talk", "talked", "episode", "episodes", "movie", "movies", "film", "films", "best", "ever",
  "bfe", "podcast", "pod", "tell", "give", "gave", "can", "could", "would", "should",
]);

let cachedIndex = null;
let cachedSyncedCount = -1;

function getSyncedFileCount() {
  try {
    if (!fs.existsSync(EXTRA_TRANSCRIPTS_DIR)) return 0;
    return fs.readdirSync(EXTRA_TRANSCRIPTS_DIR).filter((f) => f.endsWith(".json")).length;
  } catch {
    return 0;
  }
}

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

function loadCorpus() {
  const currentSynced = getSyncedFileCount();
  if (cachedIndex && cachedSyncedCount === currentSynced) return cachedIndex;

  let episodes = [];
  if (fs.existsSync(CORPUS_GZ_PATH)) {
    const gzBuf = fs.readFileSync(CORPUS_GZ_PATH);
    const parsed = JSON.parse(zlib.gunzipSync(gzBuf).toString("utf-8"));
    episodes = Array.isArray(parsed?.episodes) ? parsed.episodes : [];
  }

  // Merge any newly synced/backfilled transcripts written by scripts/sync-episodes.mjs
  if (fs.existsSync(EXTRA_TRANSCRIPTS_DIR)) {
    const existingSlugs = new Set(episodes.map((e) => e.slug));
    for (const file of fs.readdirSync(EXTRA_TRANSCRIPTS_DIR)) {
      if (!file.endsWith(".json")) continue;
      try {
        const extraEp = JSON.parse(
          fs.readFileSync(path.join(EXTRA_TRANSCRIPTS_DIR, file), "utf-8")
        );
        if (extraEp?.slug && !existingSlugs.has(extraEp.slug)) {
          episodes.push(extraEp);
          existingSlugs.add(extraEp.slug);
        }
      } catch {
        // ignore malformed file
      }
    }
  }

  // Build inverted document frequency stats across chunks for fast BM25 scoring
  const df = new Map();
  const docs = [];

  for (const ep of episodes) {
    const titleLower = String(ep.title || "").toLowerCase();
    const titleTokens = new Set(tokenize(ep.title));
    for (let idx = 0; idx < (ep.chunks || []).length; idx++) {
      const ch = ep.chunks[idx];
      const toks = tokenize(ch.t);
      const tf = new Map();
      for (const tok of toks) {
        tf.set(tok, (tf.get(tok) || 0) + 1);
      }
      for (const tok of tf.keys()) {
        df.set(tok, (df.get(tok) || 0) + 1);
      }
      docs.push({
        epNum: ep.epNum,
        isFull: ep.isFull,
        title: ep.title,
        titleLower,
        titleTokens,
        slug: ep.slug,
        pcUrl: ep.pcUrl,
        words: ep.words,
        pct: ch.p,
        section: ch.s,
        text: ch.t,
        len: toks.length,
        tf,
      });
    }
  }

  const avgLen = docs.length
    ? docs.reduce((s, d) => s + d.len, 0) / docs.length
    : 350;

  cachedIndex = {
    episodeCount: episodes.length,
    fullReviewCount: episodes.filter((e) => e.isFull).length,
    extrasCount: episodes.filter((e) => !e.isFull).length,
    totalWords: episodes.reduce((s, e) => s + (e.words || 0), 0),
    chunkCount: docs.length,
    episodesMeta: episodes.map((e) => ({
      epNum: e.epNum,
      isFull: e.isFull,
      title: e.title,
      slug: e.slug,
      words: e.words,
    })),
    df,
    docs,
    avgLen,
  };

  cachedSyncedCount = currentSynced;
  return cachedIndex;
}

export function getArchiveStats() {
  const idx = loadCorpus();
  const epNums = idx.episodesMeta.map((e) => e.epNum).filter(Boolean);
  return {
    episodeCount: idx.episodeCount,
    fullReviewCount: idx.fullReviewCount,
    extrasCount: idx.extrasCount,
    totalWords: idx.totalWords,
    chunkCount: idx.chunkCount,
    minEpNum: epNums.length ? Math.min(...epNums) : null,
    maxEpNum: epNums.length ? Math.max(...epNums) : null,
  };
}

export function searchTranscripts(rawQuery, { topK = 10 } = {}) {
  const idx = loadCorpus();
  const qLower = String(rawQuery || "").toLowerCase().trim();
  if (!qLower) return [];

  const qTokens = tokenize(rawQuery);
  // Check if user mentioned a specific episode number ("ep 357", "episode 321", "#358")
  const epMatch = qLower.match(/(?:episode|ep\.?|#)\s*(\d{1,4})\b/);
  const targetEpNum = epMatch ? Number(epMatch[1]) : null;

  // Detect segment intent boosts
  const wantsScore = /\b(score|scores|rating|ratings|ranked|out of 10|fifth seat|5th seat|patreon|beetroot|verdict)\b/i.test(qLower);
  const wantsEndgame = /\b(age game|box office|money|budget|random word|gif|oscar|ebes|ebert|cast)\b/i.test(qLower);

  const N = idx.docs.length || 1;
  const k1 = 1.5;
  const b = 0.75;

  const scored = [];
  for (const doc of idx.docs) {
    let score = 0;

    if (targetEpNum !== null && doc.epNum === targetEpNum) {
      score += 18;
    }

    // Boost when query tokens match the episode's movie title!
    let titleHits = 0;
    for (const qt of qTokens) {
      if (doc.titleTokens.has(qt)) titleHits += 1;
    }
    if (titleHits > 0) {
      score += titleHits * 7.5;
    }

    // BM25 lexical match across transcript chunk
    for (const qt of qTokens) {
      const freq = doc.tf.get(qt) || 0;
      if (!freq) continue;
      const docFreq = idx.df.get(qt) || 1;
      const idf = Math.log(1 + (N - docFreq + 0.5) / (docFreq + 0.5));
      const tfNorm =
        (freq * (k1 + 1)) / (freq + k1 * (1 - b + b * (doc.len / idx.avgLen)));
      score += idf * tfNorm;
    }

    if (score <= 0) continue;

    if (wantsScore && doc.pct >= 78) score *= 1.35;
    if (wantsEndgame && doc.pct >= 62) score *= 1.25;

    // Exact multi-word phrase boost
    if (qTokens.length >= 2) {
      const textLower = doc.text.toLowerCase();
      const phrase = qTokens.slice(0, 3).join(" ");
      if (phrase.length >= 6 && textLower.includes(phrase)) {
        score += 6;
      }
    }

    scored.push({ doc, score });
  }

  scored.sort((a, b) => b.score - a.score);

  // Diversify slightly so one single chunk range doesn't crowd out other relevant episodes unless targeted
  const picked = [];
  const perEpCount = new Map();
  const maxPerEp = targetEpNum !== null ? 6 : 3;

  for (const item of scored) {
    const key = item.doc.slug;
    const c = perEpCount.get(key) || 0;
    if (c >= maxPerEp) continue;
    perEpCount.set(key, c + 1);
    picked.push({
      epNum: item.doc.epNum,
      title: item.doc.title,
      slug: item.doc.slug,
      section: item.doc.section,
      pct: item.doc.pct,
      score: Math.round(item.score * 100) / 100,
      text: item.doc.text,
    });
    if (picked.length >= topK) break;
  }

  return picked;
}
