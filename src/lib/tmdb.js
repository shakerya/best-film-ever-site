import "server-only";

const TMDB_BASE = "https://api.themoviedb.org/3";

function imgUrl(path, size = "w780") {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

export async function searchMovieOnTmdb({ title, year }) {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) throw new Error("Missing TMDB_API_KEY in .env.local");

  if (!title || typeof title !== "string") return null;

  const qs = new URLSearchParams({
    api_key: apiKey,
    query: title,
    include_adult: "false",
  });

  if (year) qs.set("year", String(year));

  const url = `${TMDB_BASE}/search/movie?${qs.toString()}`;

  const res = await fetch(url, {
    // cache for 1 day
    next: { revalidate: 60 * 60 * 24 },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`TMDB search failed: ${res.status} ${res.statusText} ${text}`);
  }

  const data = await res.json();
  const results = Array.isArray(data?.results) ? data.results : [];
  if (!results.length) return null;

  // Prefer a result that actually has a poster.
  const best =
    results.find((r) => r?.poster_path) ||
    results[0];

  return {
    tmdbId: best.id,
    tmdbTitle: best.title,
    releaseDate: best.release_date || null,
    posterUrl: imgUrl(best.poster_path, "w780"),
    backdropUrl: imgUrl(best.backdrop_path, "w1280"),
    tmdbUrl: best.id ? `https://www.themoviedb.org/movie/${best.id}` : null,
  };
}
