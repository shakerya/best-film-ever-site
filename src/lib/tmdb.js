// src/lib/tmdb.js

const TMDB_BASE = "https://api.themoviedb.org/3";

function requireKey() {
  const key = process.env.TMDB_API_KEY;
  if (!key) throw new Error("Missing TMDB_API_KEY in environment variables");
  return key;
}

function toQuery(params) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params || {})) {
    if (v === undefined || v === null || v === "") continue;
    q.set(k, String(v));
  }
  return q.toString();
}

async function tmdbFetch(path, params = {}, fetchOptions = {}) {
  const api_key = requireKey();

  const qs = toQuery({
    api_key,
    language: "en-US",
    include_adult: "false",
    ...params,
  });

  const url = `${TMDB_BASE}${path}?${qs}`;

  const { cache = "force-cache", next } = fetchOptions || {};
  const res = await fetch(url, next ? { cache, next } : { cache });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`TMDB ${res.status} ${res.statusText} for ${path}. ${text}`.trim());
  }

  return res.json();
}

function pickDirector(crew = []) {
  // Prefer exact Director credit; fall back to "Directing" dept.
  const director = crew.find((c) => c.job === "Director");
  if (director) return director;

  const directing = crew.find((c) => c.department === "Directing");
  return directing || null;
}

function topCast(cast = [], n = 8) {
  return cast
    .slice()
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
    .slice(0, n);
}

export function tmdbImageUrl(path, size = "w500") {
  if (!path) return "";
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

export async function searchMovie(query, { year } = {}) {
  const data = await tmdbFetch(
    "/search/movie",
    { query, year },
    { cache: "no-store" } // searches should not be cached aggressively
  );
  return Array.isArray(data?.results) ? data.results : [];
}

// Cached variant for SSR pages that revalidate
export async function searchMovieCached(query, { year, revalidate = 86400 } = {}) {
  const data = await tmdbFetch(
    "/search/movie",
    { query, year },
    { cache: "force-cache", next: { revalidate } }
  );
  return Array.isArray(data?.results) ? data.results : [];
}

export async function getMovieDetails(movieId) {
  return tmdbFetch(`/movie/${movieId}`, {}, { cache: "force-cache" });
}

export async function getMovieCredits(movieId) {
  return tmdbFetch(`/movie/${movieId}/credits`, {}, { cache: "force-cache" });
}

export async function getMovieImages(movieId) {
  // Backdrops/posters to make the page look premium
  return tmdbFetch(
    `/movie/${movieId}/images`,
    { include_image_language: "en,null" },
    { cache: "force-cache" }
  );
}

export async function getMovieBundle(movieId) {
  const [details, credits, images] = await Promise.all([
    getMovieDetails(movieId),
    getMovieCredits(movieId),
    getMovieImages(movieId),
  ]);

  const director = pickDirector(credits?.crew || []);
  const cast = topCast(credits?.cast || [], 10);

  return {
    details,
    director,
    cast,
    images,
  };
}

/* -----------------------------
   Episode title → TMDB matching
-------------------------------- */

function stripDiacritics(s) {
  try {
    return s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  } catch {
    return s;
  }
}

function normalizeTitle(s) {
  return stripDiacritics(String(s || ""))
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(the|a|an)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractYear(raw) {
  const s = String(raw || "");
  const m = s.match(/\((19|20)\d{2}\)/) || s.match(/\b(19|20)\d{2}\b/);
  if (!m) return "";
  const y = m[0].replace(/[()]/g, "");
  return /^\d{4}$/.test(y) ? y : "";
}

function stripEpisodePrefixes(raw) {
  let t = String(raw || "").trim();

  // Common prefixes / formats
  t = t
    .replace(/^episode\s*\d+\s*[-:–—]\s*/i, "")
    .replace(/^ep\.?\s*\d+\s*[-:–—]\s*/i, "")
    .replace(/^see it or skip it\??\s*[-:–—]\s*/i, "")
    .replace(/^ringside roundtable\s*[-:–—]\s*/i, "")
    .replace(/^bonus\s*[-:–—]\s*/i, "")
    .replace(/^patreon\s*[-:–—]\s*/i, "")
    .trim();

  return t;
}

function stripTrailingGuestParens(t) {
  // Remove trailing "(w/ ...)" or "(with ...)" etc, but keep "(YYYY)"
  return String(t || "")
    .replace(/\s*\((?!\d{4}\)).*?\)\s*$/g, "")
    .trim();
}

function likelyNonMovieEpisode(raw) {
  const n = normalizeTitle(raw);
  // Keep this conservative: only flags “likely” non-movie; we still attempt matching.
  const needles = [
    "mailbag",
    "roundtable",
    "draft",
    "rank",
    "ranking",
    "top",
    "best of",
    "year in review",
    "preview",
    "predictions",
    "oscars",
    "awards",
    "trailer",
    "interview",
    "q a",
    "q and a",
    "patreon",
    "bonus",
    "special",
  ];
  return needles.some((k) => n.includes(normalizeTitle(k)));
}

function tokenSet(norm) {
  return new Set(String(norm || "").split(" ").filter(Boolean));
}

function jaccard(a, b) {
  const A = tokenSet(a);
  const B = tokenSet(b);
  if (A.size === 0 || B.size === 0) return 0;

  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;

  const union = A.size + B.size - inter;
  return union ? inter / union : 0;
}

function scoreResult(candidateQuery, resultTitle, resultYear, desiredYear, result) {
  const qn = normalizeTitle(candidateQuery);
  const rn = normalizeTitle(resultTitle);

  let score = 0;

  // Title similarity (dominant)
  const jac = jaccard(qn, rn);
  score += jac * 60;

  if (rn === qn) score += 40;
  else if (rn.startsWith(qn) || qn.startsWith(rn)) score += 25;

  // Year alignment (helpful but not required)
  if (desiredYear && resultYear) {
    const diff = Math.abs(Number(resultYear) - Number(desiredYear));
    if (diff === 0) score += 20;
    else if (diff === 1) score += 10;
    else score -= Math.min(diff * 2, 20);
  }

  // Prefer more “real” movies
  const voteCount = Number(result?.vote_count || 0);
  const popularity = Number(result?.popularity || 0);
  score += Math.log10(voteCount + 1) * 3;
  score += Math.log10(popularity + 1);

  return score;
}

function buildCandidates(epTitle) {
  const raw = String(epTitle || "").trim();
  const year = extractYear(raw);

  let t = stripEpisodePrefixes(raw);
  t = stripTrailingGuestParens(t);

  // Remove any explicit year tag from the query itself
  t = t.replace(/\s*\((19|20)\d{2}\)\s*/g, " ").replace(/\s+/g, " ").trim();

  const candidates = [];

  if (t) candidates.push({ query: t, year });

  // Extra candidates: sometimes titles have "Movie Title: Subtitle"
  if (t.includes(":")) {
    const beforeColon = t.split(":")[0].trim();
    if (beforeColon && beforeColon.length >= 2) candidates.push({ query: beforeColon, year });
  }

  // Extra candidate: remove trailing “ - Live” style suffixes (only if spaced dash)
  if (t.includes(" - ")) {
    const first = t.split(" - ")[0].trim();
    if (first && first.length >= 2) candidates.push({ query: first, year });
  }
  if (t.includes(" – ")) {
    const first = t.split(" – ")[0].trim();
    if (first && first.length >= 2) candidates.push({ query: first, year });
  }

  // De-dupe by normalized query
  const seen = new Set();
  const uniq = [];
  for (const c of candidates) {
    const key = `${normalizeTitle(c.query)}|${c.year || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniq.push(c);
  }

  return { raw, year, cleanedTitle: t, candidates: uniq, isLikelyNonMovie: likelyNonMovieEpisode(raw) };
}

/**
 * Resolve an episode title to the best TMDB movie match (or null).
 * Returns:
 *  - null (no confident match)
 *  - { movieId, movie, guess, score }
 */
export async function resolveEpisodeMovie(epTitle) {
  const { candidates } = buildCandidates(epTitle);
  if (!candidates.length) return null;

  let best = null;

  for (const c of candidates) {
    // Try with year first (if present), then without year
    const attempts = c.year
      ? [{ query: c.query, year: c.year }, { query: c.query, year: "" }]
      : [{ query: c.query, year: "" }];

    for (const a of attempts) {
      const results = await searchMovie(a.query, { year: a.year || undefined });
      if (!results.length) continue;

      // Evaluate top few results only
      for (const r of results.slice(0, 7)) {
        const rYear = r?.release_date ? String(r.release_date).slice(0, 4) : "";
        const s = scoreResult(a.query, r?.title || "", rYear, c.year, r);

        if (!best || s > best.score) {
          best = { movieId: r.id, movie: r, guess: { query: a.query, year: c.year || "" }, score: s };
        }
      }
    }
  }

  // Threshold to avoid obviously wrong matches
  if (!best || best.score < 55) return null;

  return best;
}

/**
 * Cached resolver for SSR pages that revalidate.
 * Uses cached TMDB search results; adjustable minScore for stricter home tiles.
 */
export async function resolveEpisodeMovieCached(epTitle, { revalidate = 86400, minScore = 55 } = {}) {
  const { candidates } = buildCandidates(epTitle);
  if (!candidates.length) return null;

  let best = null;

  for (const c of candidates) {
    const attempts = c.year
      ? [{ query: c.query, year: c.year }, { query: c.query, year: "" }]
      : [{ query: c.query, year: "" }];

    for (const a of attempts) {
      const results = await searchMovieCached(a.query, { year: a.year || undefined, revalidate });
      if (!results.length) continue;

      for (const r of results.slice(0, 7)) {
        const rYear = r?.release_date ? String(r.release_date).slice(0, 4) : "";
        const s = scoreResult(a.query, r?.title || "", rYear, c.year, r);

        if (!best || s > best.score) {
          best = { movieId: r.id, movie: r, guess: { query: a.query, year: c.year || "" }, score: s };
        }
      }
    }
  }

  if (!best || best.score < minScore) return null;
  return best;
}
