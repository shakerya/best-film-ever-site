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

async function tmdbFetch(path, params = {}, { cache = "force-cache" } = {}) {
  const api_key = requireKey();

  const qs = toQuery({
    api_key,
    language: "en-US",
    include_adult: "false",
    ...params,
  });

  const url = `${TMDB_BASE}${path}?${qs}`;

  const res = await fetch(url, { cache });

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

export async function getMovieDetails(movieId) {
  return tmdbFetch(`/movie/${movieId}`, {}, { cache: "force-cache" });
}

export async function getMovieCredits(movieId) {
  return tmdbFetch(`/movie/${movieId}/credits`, {}, { cache: "force-cache" });
}

export async function getMovieImages(movieId) {
  // Backdrops/posters to make the page look premium
  return tmdbFetch(`/movie/${movieId}/images`, { include_image_language: "en,null" }, { cache: "force-cache" });
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
