// src/lib/tmdb.js
import episodeTmdbMap from "@/data/episodeTmdbMap.json";
import { getEpisodeNumberIfFullReview } from "@/lib/episodeMeta";

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
  const ageGameCast = await buildAgeGameCast(details, cast.slice(0, 5)).catch(() => []);

  return {
    details,
    director,
    cast,
    images,
    ageGameCast,
  };
}

export async function getMovieByIdCached(movieId) {
  if (!movieId) return null;
  return tmdbFetch(
    `/movie/${movieId}`,
    {},
    { cache: "force-cache", next: { revalidate: 86400 } }
  );
}

export async function getMovieWatchProviders(movieId) {
  if (!movieId) return { US: null, GB: null };
  const data = await tmdbFetch(
    `/movie/${movieId}/watch/providers`,
    {},
    { cache: "force-cache", next: { revalidate: 43200 } }
  );
  const results = data?.results || {};
  const mapList = (arr = [], max = 4) =>
    arr.slice(0, max).map((p) => ({
      id: p.provider_id,
      name: p.provider_name,
      logoUrl: p.logo_path ? tmdbImageUrl(p.logo_path, "w92") : "",
    }));
  const pickRegion = (r) => {
    if (!r) return null;
    const stream = mapList([...(r.flatrate || []), ...(r.free || [])], 5);
    const rent = mapList(r.rent || [], 3);
    if (!stream.length && !rent.length) return null;
    return {
      link: r.link || "",
      stream,
      rent,
    };
  };
  return {
    US: pickRegion(results.US),
    GB: pickRegion(results.GB),
  };
}

export async function getPersonDetailsCached(personId) {
  if (!personId) return null;
  return tmdbFetch(
    `/person/${personId}`,
    {},
    { cache: "force-cache", next: { revalidate: 604800 } }
  );
}

function calculateAgeAtRelease(birthdayIso, releaseDateIso) {
  if (!birthdayIso || !releaseDateIso) return null;
  const b = new Date(birthdayIso);
  const r = new Date(releaseDateIso);
  if (Number.isNaN(b.getTime()) || Number.isNaN(r.getTime())) return null;
  let age = r.getUTCFullYear() - b.getUTCFullYear();
  const mDiff = r.getUTCMonth() - b.getUTCMonth();
  if (mDiff < 0 || (mDiff === 0 && r.getUTCDate() < b.getUTCDate())) {
    age -= 1;
  }
  return age > 0 && age < 110 ? age : null;
}

export async function buildAgeGameCast(details, castSlice = []) {
  const releaseDate = details?.release_date;
  if (!releaseDate || !Array.isArray(castSlice) || !castSlice.length) return [];

  const people = await Promise.all(
    castSlice.map((c) => getPersonDetailsCached(c.id).catch(() => null))
  );

  const items = [];
  for (let i = 0; i < castSlice.length; i++) {
    const c = castSlice[i];
    const p = people[i];
    const age = calculateAgeAtRelease(p?.birthday, releaseDate);
    if (age === null) continue;
    items.push({
      id: c.id,
      name: c.name,
      character: c.character || "",
      profileUrl: c.profile_path ? tmdbImageUrl(c.profile_path, "w342") : "",
      ageAtRelease: age,
      birthday: p.birthday,
    });
  }
  return items;
}

/* -----------------------------
   Episode title → TMDB matching
-------------------------------- */

function decodeEntities(s) {
  return String(s || "")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&#8217;|&#8216;/gi, "'")
    .replace(/&#8211;|&#8212;/gi, "-")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function stripDiacritics(s) {
  try {
    return s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  } catch {
    return s;
  }
}

// Preserves leading/inner articles ("The Batman" !== "Batman", "The Mask" !== "Mask")
function exactNormalizeTitle(s) {
  return stripDiacritics(decodeEntities(String(s || "")))
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\+/g, " plus ")
    .replace(/['’‘`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function looseNormalizeTitle(s) {
  return exactNormalizeTitle(s)
    .replace(/\b(the|a|an)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getVerifiedEpisodeTmdb(epTitleOrNum) {
  const epNum =
    typeof epTitleOrNum === "number"
      ? epTitleOrNum
      : /^\d+$/.test(String(epTitleOrNum || "").trim())
        ? Number(epTitleOrNum)
        : getEpisodeNumberIfFullReview(epTitleOrNum);

  if (!epNum) return null;
  const entry = episodeTmdbMap[String(epNum)];
  if (!entry || !entry.tmdbId) return null;

  return {
    movieId: Number(entry.tmdbId),
    movie: {
      id: Number(entry.tmdbId),
      title: entry.title,
      release_date: entry.year ? `${entry.year}-01-01` : "",
      poster_path: entry.posterPath || "",
      backdrop_path: entry.backdropPath || "",
    },
    guess: {
      query: entry.title,
      year: entry.year || "",
    },
    score: 999,
    verified: true,
  };
}

function extractExplicitYear(raw) {
  const s = decodeEntities(String(raw || ""));
  const m = s.match(/\(((?:19|20)\d{2})\)/);
  return m ? m[1] : "";
}

function extractYearsFromDescription(desc) {
  const matches = decodeEntities(String(desc || "")).match(/\b(19\d{2}|20[0-3]\d)\b/g) || [];
  return new Set(matches);
}

function stripEpisodePrefixes(raw) {
  let t = decodeEntities(String(raw || "")).replace(/\s+/g, " ").trim();

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

function cleanEpisodeMovieTitle(tRaw) {
  let t = String(tRaw || "").replace(/\*+$/, "").trim();
  let prev = "";
  while (t !== prev) {
    prev = t;
    t = t
      .replace(/\s*\((?!(?:19|20)\d{2}\))[^()]*\)\s*$/g, "")
      .replace(/\s*\[[^\]]*\]\s*$/g, "")
      .replace(
        /\s+[-–—]\s*(?:feat\.?|featuring|with|w\/|bonus|special|live\b|updated\b|warning\b|audience\b).*$/i,
        ""
      )
      .replace(/\s+(?:&|and)\s+(?:remembering\b|bfe\b).*$/i, "")
      .replace(/\*+$/, "")
      .trim();
  }
  return t;
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

function scoreResult(candidateQuery, resultTitle, resultYear, desiredYear, result, descYears) {
  const qExact = exactNormalizeTitle(candidateQuery);
  const rExact = exactNormalizeTitle(resultTitle);
  const rOrigExact = exactNormalizeTitle(result?.original_title || "");
  const qLoose = looseNormalizeTitle(candidateQuery);
  const rLoose = looseNormalizeTitle(resultTitle);

  let score = 0;

  if (rExact === qExact || (rOrigExact && rOrigExact === qExact)) {
    score += 100;
  } else if (qLoose && rLoose === qLoose) {
    // Lower than exact match so "Mask" prefers "Mask" over "The Mask" and "Batman" prefers "Batman" over "The Batman"
    score += 72;
  } else {
    score += jaccard(qExact, rExact) * 65;
    if (rExact.startsWith(qExact) || qExact.startsWith(rExact)) score += 18;
  }

  // Explicit year in title
  if (desiredYear && resultYear) {
    const diff = Math.abs(Number(resultYear) - Number(desiredYear));
    if (diff === 0) score += 40;
    else if (diff === 1) score += 20; // Festival vs wide theatrical year (e.g. Crash 2004/2005)
    else score -= Math.min(diff * 3, 35);
  }

  // Release year mentioned in podcast show notes disambiguates remakes (e.g. The Karate Kid 1984 vs 2010)
  if (resultYear && descYears && descYears.has(resultYear)) {
    score += 30;
  }

  // Prefer established theatrical releases over 0-vote shorts with colliding titles
  const voteCount = Number(result?.vote_count || 0);
  const popularity = Number(result?.popularity || 0);
  score += Math.log10(voteCount + 1) * 4;
  score += Math.log10(popularity + 1);
  if (voteCount < 15) score -= 25;

  return score;
}

function buildCandidates(epTitle) {
  const raw = decodeEntities(String(epTitle || "")).trim();
  const year = extractExplicitYear(raw);

  let t = stripEpisodePrefixes(raw);
  t = cleanEpisodeMovieTitle(t);

  // Remove any explicit year tag from the query itself
  t = t.replace(/\s*\((?:19|20)\d{2}\)\s*/g, " ").replace(/\s+/g, " ").trim();

  const candidates = [];
  if (t) candidates.push({ query: t, year });

  // Note: NEVER split on ":" (splitting "Star Wars: Revenge of the Sith" or "Robin Hood: Prince of Thieves"
  // into "Star Wars" or "Robin Hood" falsely matches the parent franchise's first film!)
  if (t.includes(" / ")) {
    const first = t.split(" / ")[0].trim();
    if (first && first.length >= 2) candidates.push({ query: first, year });
  }

  const seen = new Set();
  const uniq = [];
  for (const c of candidates) {
    const key = `${exactNormalizeTitle(c.query)}|${c.year || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniq.push(c);
  }

  return { raw, year, cleanedTitle: t, candidates: uniq };
}

/**
 * Resolve an episode title to the best TMDB movie match (or null).
 */
export async function resolveEpisodeMovie(
  epTitle,
  { epNum, tmdbId, descriptionText = "", minScore = 55 } = {}
) {
  if (tmdbId) {
    const m = await getMovieDetails(tmdbId).catch(() => null);
    if (m?.id) {
      const yr = m.release_date ? String(m.release_date).slice(0, 4) : "";
      return { movieId: m.id, movie: m, guess: { query: m.title, year: yr }, score: 999, verified: true };
    }
  }

  const verified = getVerifiedEpisodeTmdb(epNum || epTitle);
  if (verified) return verified;

  const { candidates } = buildCandidates(epTitle);
  if (!candidates.length) return null;
  const descYears = extractYearsFromDescription(descriptionText);

  let best = null;

  for (const c of candidates) {
    const attempts = c.year
      ? [{ query: c.query, year: c.year }, { query: c.query, year: "" }]
      : [{ query: c.query, year: "" }];

    for (const a of attempts) {
      const results = await searchMovie(a.query, { year: a.year || undefined });
      if (!results.length) continue;

      for (const r of results.slice(0, 10)) {
        const rYear = r?.release_date ? String(r.release_date).slice(0, 4) : "";
        const s = scoreResult(a.query, r?.title || "", rYear, c.year, r, descYears);

        if (!best || s > best.score) {
          best = { movieId: r.id, movie: r, guess: { query: a.query, year: c.year || "" }, score: s };
        }
      }
    }
  }

  if (!best || best.score < minScore) return null;
  return best;
}

/**
 * Cached resolver for SSR pages that revalidate.
 * Checks the verified 358-episode map (0ms, zero API calls) before falling back to live TMDB search for Ep 359+.
 */
export async function resolveEpisodeMovieCached(
  epTitle,
  { epNum, tmdbId, descriptionText = "", revalidate = 86400, minScore = 55 } = {}
) {
  const verified = getVerifiedEpisodeTmdb(epNum || epTitle);
  if (verified) return verified;

  if (tmdbId) {
    const m = await getMovieByIdCached(tmdbId).catch(() => null);
    if (m?.id) {
      const yr = m.release_date ? String(m.release_date).slice(0, 4) : "";
      return { movieId: m.id, movie: m, guess: { query: m.title, year: yr }, score: 999, verified: true };
    }
  }

  const { candidates } = buildCandidates(epTitle);
  if (!candidates.length) return null;
  const descYears = extractYearsFromDescription(descriptionText);

  let best = null;

  for (const c of candidates) {
    const attempts = c.year
      ? [{ query: c.query, year: c.year }, { query: c.query, year: "" }]
      : [{ query: c.query, year: "" }];

    for (const a of attempts) {
      const results = await searchMovieCached(a.query, { year: a.year || undefined, revalidate });
      if (!results.length) continue;

      for (const r of results.slice(0, 10)) {
        const rYear = r?.release_date ? String(r.release_date).slice(0, 4) : "";
        const s = scoreResult(a.query, r?.title || "", rYear, c.year, r, descYears);

        if (!best || s > best.score) {
          best = { movieId: r.id, movie: r, guess: { query: a.query, year: c.year || "" }, score: s };
        }
      }
    }
  }

  if (!best || best.score < minScore) return null;
  return best;
}
