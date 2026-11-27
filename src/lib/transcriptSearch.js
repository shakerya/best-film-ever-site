// src/lib/transcriptSearch.js
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import episodeTmdbMap from "@/data/episodeTmdbMap.json";

const CORPUS_GZ_PATH = path.join(process.cwd(), "src/data/transcriptCorpus.json.gz");
const EXTRA_TRANSCRIPTS_DIR = path.join(process.cwd(), "src/data/synced-transcripts");

const STOPWORDS = new Set([
  "the", "and", "for", "that", "this", "with", "you", "are", "was", "were", "have", "has",
  "had", "not", "but", "what", "when", "where", "who", "why", "how", "from", "they", "them",
  "their", "there", "about", "into", "out", "just", "like", "did", "does", "say", "said",
  "talk", "talked", "episode", "episodes", "movie", "movies", "film", "films", "best", "ever",
  "bfe", "podcast", "pod", "tell", "give", "gave", "can", "could", "would", "should", "think",
  "thought", "thoughts", "guys", "hosts", "host", "review", "reviewed",
]);

// Single-word movie titles that collide with everyday English words unless capitalized/quoted
const AMBIGUOUS_SINGLE_WORD_TITLES = new Set([
  "it", "up", "us", "her", "big", "saw", "heat", "crash", "hook", "mask", "cars", "elf",
  "ted", "argo", "dune", "life", "snatch", "speed", "seven", "se7en", "drive", "taken",
  "signs", "twins", "ghost", "alien", "rocky", "fargo", "blade", "clerks", "scream",
]);

let cachedIndex = null;
let cachedSyncedCount = -1;
let cachedStats = null;
let cachedStatsSyncedCount = -1;
let cachedCatalogMatchers = null;

function getSyncedFileCount() {
  try {
    if (!fs.existsSync(EXTRA_TRANSCRIPTS_DIR)) return 0;
    return fs.readdirSync(EXTRA_TRANSCRIPTS_DIR).filter((f) => f.endsWith(".json")).length;
  } catch {
    return 0;
  }
}

function normTitle(str) {
  return String(str || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’‘`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getCatalogMatchers() {
  if (cachedCatalogMatchers) return cachedCatalogMatchers;
  const list = [];
  for (const [epKey, item] of Object.entries(episodeTmdbMap || {})) {
    const epNum = Number(epKey);
    const title = String(item?.title || "").trim();
    if (!epNum || !title) continue;
    const norm = normTitle(title);
    if (!norm) continue;
    const words = norm.split(" ").filter(Boolean);
    // Also strip leading "the " for titles >= 2 non-article words (e.g. "The Departed" -> "departed" if >= 7 chars, "The Shawshank Redemption" -> "shawshank redemption")
    const strippedThe = norm.startsWith("the ") ? norm.slice(4).trim() : "";
    const variants = [norm];
    if (
      strippedThe &&
      (strippedThe.includes(" ") || (strippedThe.length >= 7 && !AMBIGUOUS_SINGLE_WORD_TITLES.has(strippedThe)))
    ) {
      variants.push(strippedThe);
    }
    list.push({
      epNum,
      title,
      year: item?.year || "",
      norm,
      wordCount: words.length,
      variants,
    });
  }
  // Match longest titles first so "Batman Returns" matches before "Batman"
  list.sort((a, b) => b.norm.length - a.norm.length);
  cachedCatalogMatchers = list;
  return cachedCatalogMatchers;
}

export function detectCatalogEpisodesInText(rawText, { maxMatches = 3 } = {}) {
  const raw = String(rawText || "");
  const norm = normTitle(raw);
  if (!norm) return [];

  const matched = new Map();

  // 1) Explicit episode numbers ("ep 113", "episode 358", "#83")
  const epRegex = /\b(?:episode|ep\.?)\s*(\d{1,3})\b|#(\d{1,3})\b/gi;
  let m;
  while ((m = epRegex.exec(raw)) !== null) {
    const num = Number(m[1] || m[2]);
    const entry = episodeTmdbMap[String(num)];
    if (num && entry) {
      matched.set(num, { epNum: num, title: entry.title, year: entry.year || "" });
    }
  }

  // 2) Canonical movie title match against all 358 reviewed films
  let consumedNorm = ` ${norm} `;
  for (const item of getCatalogMatchers()) {
    if (matched.size >= maxMatches) break;
    if (matched.has(item.epNum)) continue;

    for (const v of item.variants) {
      const isSingleWord = !v.includes(" ");
      if (isSingleWord) {
        if (v === "300") {
          if (!/(?:["'“”]\s*300\s*["'“”]|(?:\bmovie|\bfilm|\bepisode|\breview|\bin|\bon)\s+300\b)/i.test(raw)) {
            continue;
          }
        } else if (v.length < 4) {
          // Very short titles ("Up", "It", "Us", "Her", "Big", "Saw", "Elf", "Ted") require quotes or capitalized title context
          const capTitle = escapeRegex(item.title);
          const strictRe = new RegExp(
            `(?:["'“”]${capTitle}["'“”]|\\b(?:in|on|for|about|review(?:ed)?|watch(?:ed)?|give|gave|score(?:d)?)\\s+${capTitle}\\b)`,
          );
          if (!strictRe.test(raw)) continue;
        } else if (AMBIGUOUS_SINGLE_WORD_TITLES.has(v)) {
          const capTitle = escapeRegex(item.title);
          const semiStrictRe = new RegExp(
            `(?:["'“”]${capTitle}["'“”]|\\b${capTitle}\\b)`
          );
          if (!semiStrictRe.test(raw)) continue;
        }
      }

      const re = new RegExp(`\\b${escapeRegex(v)}\\b`, "i");
      if (re.test(consumedNorm)) {
        matched.set(item.epNum, { epNum: item.epNum, title: item.title, year: item.year });
        // Blank out matched span so substring titles don't double-match
        consumedNorm = consumedNorm.replace(re, " ");
        break;
      }
    }
  }

  return Array.from(matched.values()).slice(0, maxMatches);
}

function readAllTranscriptEpisodesRaw() {
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
  return episodes;
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

  const episodes = readAllTranscriptEpisodesRaw();

  // Build inverted document frequency stats across chunks for fast BM25 scoring
  const df = new Map();
  const docs = [];
  const docsByEpNum = new Map();

  for (const ep of episodes) {
    const titleLower = String(ep.title || "").toLowerCase();
    const titleTokens = new Set(tokenize(ep.title));
    const epDocs = [];
    const totalChunks = (ep.chunks || []).length;

    for (let idx = 0; idx < totalChunks; idx++) {
      const ch = ep.chunks[idx];
      const toks = tokenize(ch.t);
      const tf = new Map();
      for (const tok of toks) {
        tf.set(tok, (tf.get(tok) || 0) + 1);
      }
      for (const tok of tf.keys()) {
        df.set(tok, (df.get(tok) || 0) + 1);
      }
      const docObj = {
        docId: `${ep.slug}#${idx}`,
        chunkIdx: idx,
        totalChunks,
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
      };
      docs.push(docObj);
      epDocs.push(docObj);
    }

    if (ep.epNum) {
      docsByEpNum.set(Number(ep.epNum), epDocs);
    }
  }

  const avgLen = docs.length
    ? docs.reduce((s, d) => s + d.len, 0) / docs.length
    : 350;

  const indexedEpNums = new Set(docsByEpNum.keys());

  cachedIndex = {
    episodeCount: episodes.length,
    fullReviewCount: episodes.filter((e) => e.isFull).length,
    extrasCount: episodes.filter((e) => !e.isFull).length,
    totalWords: episodes.reduce((s, e) => s + (e.words || 0), 0),
    chunkCount: docs.length,
    indexedEpNums,
    docsByEpNum,
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
  const currentSynced = getSyncedFileCount();
  if (cachedStats && cachedStatsSyncedCount === currentSynced) {
    return cachedStats;
  }
  if (cachedIndex && cachedSyncedCount === currentSynced) {
    const epNums = cachedIndex.episodesMeta.map((e) => e.epNum).filter(Boolean);
    cachedStats = {
      episodeCount: cachedIndex.episodeCount,
      fullReviewCount: cachedIndex.fullReviewCount,
      extrasCount: cachedIndex.extrasCount,
      totalWords: cachedIndex.totalWords,
      chunkCount: cachedIndex.chunkCount,
      minEpNum: epNums.length ? Math.min(...epNums) : null,
      maxEpNum: epNums.length ? Math.max(...epNums) : null,
    };
    cachedStatsSyncedCount = currentSynced;
    return cachedStats;
  }

  // Lightweight metadata pass (skips expensive BM25 tokenization across 25,000+ chunks)
  const episodes = readAllTranscriptEpisodesRaw();
  const epNums = [];
  let fullReviewCount = 0;
  let extrasCount = 0;
  let totalWords = 0;
  let chunkCount = 0;

  for (const ep of episodes) {
    if (ep.isFull) fullReviewCount += 1;
    else extrasCount += 1;
    if (ep.epNum) epNums.push(ep.epNum);
    totalWords += ep.words || 0;
    chunkCount += Array.isArray(ep.chunks) ? ep.chunks.length : 0;
  }

  cachedStats = {
    episodeCount: episodes.length,
    fullReviewCount,
    extrasCount,
    totalWords,
    chunkCount,
    minEpNum: epNums.length ? Math.min(...epNums) : null,
    maxEpNum: epNums.length ? Math.max(...epNums) : null,
  };
  cachedStatsSyncedCount = currentSynced;
  return cachedStats;
}

export function getCatalogSummaryForPrompt() {
  const idx = loadCorpus();
  const entries = Object.entries(episodeTmdbMap || {})
    .map(([k, v]) => ({ epNum: Number(k), title: v.title, year: v.year || "" }))
    .sort((a, b) => b.epNum - a.epNum);

  return entries
    .map((e) => {
      const status = idx.indexedEpNums.has(e.epNum) ? "✓" : "⏳";
      return `Ep ${e.epNum}: ${e.title}${e.year ? ` (${e.year})` : ""} [${status}]`;
    })
    .join(" | ");
}

export function searchTranscripts(rawQuery, { topK = 14, recentContextText = "" } = {}) {
  const idx = loadCorpus();
  const qLower = String(rawQuery || "").toLowerCase().trim();
  if (!qLower) return { sources: [], targetEpisodes: [], unindexedTargets: [] };

  // Detect targeted movie(s) from the question first; if none in current question (e.g. "what score did Liam give it?"),
  // fall back to movies mentioned in the immediately preceding chat turn!
  let detectedCatalog = detectCatalogEpisodesInText(rawQuery, { maxMatches: 3 });
  if (detectedCatalog.length === 0 && recentContextText) {
    detectedCatalog = detectCatalogEpisodesInText(recentContextText, { maxMatches: 2 });
  }

  const indexedTargets = detectedCatalog.filter((t) => idx.indexedEpNums.has(t.epNum));
  const unindexedTargets = detectedCatalog.filter((t) => !idx.indexedEpNums.has(t.epNum));
  const targetEpSet = new Set(indexedTargets.map((t) => t.epNum));

  const combinedQueryForTokens =
    detectedCatalog.length > 0 && !detectCatalogEpisodesInText(rawQuery).length
      ? `${rawQuery} ${detectedCatalog.map((d) => d.title).join(" ")}`
      : rawQuery;
  const qTokens = tokenize(combinedQueryForTokens);

  // Detect segment intent boosts
  const wantsScoreOrVerdict =
    /\b(score|scores|rating|ratings|ranked|out of 10|ten|fifth seat|5th seat|patreon|beetroot|verdict|verdicts|like|liked|hate|hated|favorite|favourite|overall|summary|opinion|opinions|say|said)\b/i.test(
      qLower
    );
  const wantsEndgame =
    /\b(age game|box office|money|budget|random word|gif|oscar|oscars|ebes|ebert|cast|trivia)\b/i.test(
      qLower
    );
  const wantsHostsOrGuest = /\b(guest|who was on|hosts|panel|joined|lineup|bff)\b/i.test(qLower);

  const N = idx.docs.length || 1;
  const k1 = 1.5;
  const b = 0.75;

  const scored = [];
  for (const doc of idx.docs) {
    let score = 0;
    const isTargetedEp = doc.epNum && targetEpSet.has(Number(doc.epNum));

    if (isTargetedEp) {
      score += 26;
    }

    // Boost when query tokens match the episode's movie title
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

    if (wantsScoreOrVerdict && doc.pct >= 80) score *= 1.45;
    if (wantsEndgame && doc.pct >= 62) score *= 1.3;
    if (wantsHostsOrGuest && doc.chunkIdx <= 1) score *= 1.5;

    // Exact multi-word phrase boost
    if (qTokens.length >= 2) {
      const textLower = doc.text.toLowerCase();
      const phrase = qTokens.slice(0, 3).join(" ");
      if (phrase.length >= 6 && textLower.includes(phrase)) {
        score += 7;
      }
    }

    scored.push({ doc, score });
  }

  scored.sort((a, b) => b.score - a.score);

  const pickedDocs = [];
  const pickedIds = new Set();

  const pushDoc = (doc, scoreVal) => {
    if (!doc || pickedIds.has(doc.docId)) return;
    pickedIds.add(doc.docId);
    pickedDocs.push({ doc, score: scoreVal });
  };

  // Pin key structural segments for targeted episode(s) so host lineup + final scores/verdicts are NEVER missed!
  if (indexedTargets.length > 0) {
    const perTargetBudget = indexedTargets.length === 1 ? 10 : 6;
    for (const t of indexedTargets) {
      const epDocs = idx.docsByEpNum.get(t.epNum) || [];
      if (!epDocs.length) continue;

      // 1) Opening roll-call chunk (identifies exact hosts & guest voices on the episode)
      pushDoc(epDocs[0], 99);

      // 2) Final Endgame / Verdict chunks (last 3 chunks ~85-100% where hosts give out-of-10 scores & final thoughts)
      const tailStart = Math.max(1, epDocs.length - 3);
      for (let i = tailStart; i < epDocs.length; i++) {
        pushDoc(epDocs[i], 98 - (epDocs.length - i));
      }

      // 3) Top query-specific BM25 chunks from within this targeted episode
      let addedMid = 0;
      for (const item of scored) {
        if (item.doc.epNum !== t.epNum) continue;
        if (pickedIds.has(item.doc.docId)) continue;
        pushDoc(item.doc, item.score);
        addedMid += 1;
        if (addedMid >= Math.max(2, perTargetBudget - 4)) break;
      }
    }
  }

  // Fill remaining slots with top diverse matches across the archive
  const perEpCount = new Map();
  for (const p of pickedDocs) {
    perEpCount.set(p.doc.slug, (perEpCount.get(p.doc.slug) || 0) + 1);
  }
  const maxPerUntargetedEp = indexedTargets.length > 0 ? 2 : 4;

  for (const item of scored) {
    if (pickedDocs.length >= topK) break;
    if (pickedIds.has(item.doc.docId)) continue;
    const key = item.doc.slug;
    const isTarget = item.doc.epNum && targetEpSet.has(Number(item.doc.epNum));
    const limit = isTarget ? 10 : maxPerUntargetedEp;
    const c = perEpCount.get(key) || 0;
    if (c >= limit) continue;
    perEpCount.set(key, c + 1);
    pushDoc(item.doc, item.score);
  }

  // Sort picked chunks grouped cleanly by episode and chronological position inside each episode
  const sources = pickedDocs.slice(0, topK).map(({ doc, score }) => ({
    epNum: doc.epNum,
    title: doc.title,
    slug: doc.slug,
    section: doc.section,
    pct: doc.pct,
    score: Math.round(score * 100) / 100,
    text: doc.text,
  }));

  return {
    sources,
    targetEpisodes: indexedTargets,
    unindexedTargets,
  };
}
