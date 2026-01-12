import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getEpisodesFromRss } from "@/lib/podcast";

export const revalidate = 3600; // 1 hour

function formatDate(isoOrPubDate) {
  if (!isoOrPubDate) return "";
  const d = new Date(isoOrPubDate);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString();
}

/**
 * Extract movie title (and optional year) ONLY from the episode title.
 * Examples:
 *  - "Episode 312 - For Colored Girls (w/ ...)" -> "For Colored Girls"
 *  - "Episode 101: The Fugitive" -> "The Fugitive"
 *  - "See It or Skip It? - The Holiday (2006)" -> "The Holiday", year=2006
 */
function extractMovieFromEpisodeTitle(epTitle) {
  const raw = String(epTitle || "").trim();
  if (!raw) return { title: "", year: "" };

  // Grab year if present anywhere in the title
  const yearMatch = raw.match(/\((19|20)\d{2}\)/);
  const year = yearMatch ? yearMatch[0].replace(/[()]/g, "") : "";

  // Remove common prefixes
  let t = raw
    .replace(/^episode\s*\d+\s*[-:–—]\s*/i, "")
    .replace(/^see it or skip it\??\s*[-:–—]\s*/i, "")
    .replace(/^ringside roundtable\s*[-:–—]\s*/i, "")
    .trim();

  // Remove trailing guest parentheses: "Movie (w/ ...)" -> "Movie"
  // But keep "(YYYY)" if that's the year
  t = t.replace(/\s*\((?!\d{4}\)).*?\)\s*$/g, "").trim();

  // If there's still a " - " suffix, keep the first chunk as movie
  t = t.split(" - ")[0].trim();
  t = t.split(" – ")[0].trim();

  // Remove "(YYYY)" from the title text itself so TMDB query is clean
  t = t.replace(/\s*\((19|20)\d{2}\)\s*/g, "").trim();

  return { title: t, year };
}

async function fetchTmdbMovie({ title, year }) {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey || !title) return null;

  const base = "https://api.themoviedb.org/3/search/movie";
  const q = encodeURIComponent(title);

  // Try year first (if we have it), then without year
  const urls = [
    `${base}?api_key=${apiKey}&query=${q}&include_adult=false&language=en-US${year ? `&year=${encodeURIComponent(year)}` : ""}`,
    `${base}?api_key=${apiKey}&query=${q}&include_adult=false&language=en-US`,
  ];

  for (const url of urls) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) continue;

    const data = await res.json();
    const first = data?.results?.[0];
    if (!first) continue;

    return {
      id: first.id,
      title: first.title,
      release_date: first.release_date,
      poster_path: first.poster_path,
      backdrop_path: first.backdrop_path,
      overview: first.overview,
    };
  }

  console.log(`[TMDB] No results for "${title}"${year ? ` (${year})` : ""}`);
  return null;
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const episodes = await getEpisodesFromRss();
  const ep = episodes.find((e) => e.slug === slug);

  if (!ep) return { title: "Episode not found - Best Film Ever" };

  return {
    title: `${ep.title} - Best Film Ever`,
    description: (ep.descriptionText || "").slice(0, 160),
  };
}

export default async function EpisodePage({ params }) {
  const { slug } = await params;

  const episodes = await getEpisodesFromRss();
  const ep = episodes.find((e) => e.slug === slug);

  if (!ep) notFound();

  // Movie guess ONLY from episode title
  const movieGuess = extractMovieFromEpisodeTitle(ep.title);

  // TMDB lookup
  const tmdb = await fetchTmdbMovie(movieGuess);

  // Poster
  const posterUrl = tmdb?.poster_path
    ? `https://image.tmdb.org/t/p/w780${tmdb.poster_path}`
    : null;

  // Direct Letterboxd link when TMDB succeeded
  const letterboxdUrl = tmdb?.id
    ? `https://letterboxd.com/tmdb/${tmdb.id}/`
    : movieGuess.title
      ? `https://letterboxd.com/search/${encodeURIComponent(movieGuess.title)}/`
      : "https://letterboxd.com/";

  return (
    <main
      style={{
        fontFamily: "system-ui, -apple-system, Arial",
        padding: 24,
        maxWidth: 1100,
        margin: "0 auto",
      }}
    >
      <div style={{ marginBottom: 16 }}>
        <Link href="/" style={{ textDecoration: "none", opacity: 0.8 }}>
          ← Back to episodes
        </Link>
      </div>

      <h1 style={{ fontSize: 48, lineHeight: 1.05, margin: "12px 0 8px" }}>
        {ep.title}
      </h1>

      <div style={{ opacity: 0.75, marginBottom: 10 }}>
        Published: {formatDate(ep.isoDate || ep.pubDate)}
        {ep.duration ? ` • Duration: ${ep.duration}` : ""}
      </div>

      {ep.audioUrl ? (
        <audio
          controls
          preload="metadata"
          src={ep.audioUrl}
          style={{ width: "100%", margin: "12px 0 18px" }}
        />
      ) : null}

      <hr style={{ opacity: 0.2, margin: "18px 0" }} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "320px 1fr",
          gap: 24,
          alignItems: "start",
        }}
      >
        <section>
          <h3 style={{ margin: "0 0 12px", opacity: 0.9 }}>Movie</h3>

          <div
            style={{
              width: 300,
              height: 450,
              borderRadius: 14,
              border: "1px solid rgba(0,0,0,0.12)",
              background: "rgba(0,0,0,0.03)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            {posterUrl ? (
              <Image
                src={posterUrl}
                alt={tmdb?.title || movieGuess.title || "Movie poster"}
                width={300}
                height={450}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <div style={{ opacity: 0.6, fontSize: 14 }}>No poster found</div>
            )}
          </div>

          <div style={{ marginTop: 12, fontWeight: 700 }}>
            {tmdb?.title || movieGuess.title || "Unknown movie"}
            {tmdb?.release_date
              ? ` (${tmdb.release_date.slice(0, 4)})`
              : movieGuess.year
                ? ` (${movieGuess.year})`
                : ""}
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
            <a
              href={letterboxdUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "inline-block",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid rgba(0,0,0,0.15)",
                textDecoration: "none",
              }}
            >
              Open on Letterboxd →
            </a>

            {tmdb?.id ? (
              <a
                href={`https://www.themoviedb.org/movie/${tmdb.id}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "inline-block",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.15)",
                  textDecoration: "none",
                  opacity: 0.9,
                }}
              >
                TMDB →
              </a>
            ) : null}
          </div>

          <div style={{ marginTop: 10, opacity: 0.7, fontSize: 12 }}>
            {tmdb?.id
              ? "Letterboxd link is direct via TMDB ID."
              : "Letterboxd link is a search fallback (TMDB didn’t resolve the movie)."}
          </div>
        </section>

        <section>
          <h3 style={{ margin: "0 0 12px", opacity: 0.9 }}>Show notes</h3>

          {/* Show HTML notes nicely (prevents &amp; looking ugly) */}
          <div
            style={{ lineHeight: 1.65, opacity: 0.92 }}
            dangerouslySetInnerHTML={{ __html: ep.descriptionHtml || "" }}
          />
        </section>
      </div>
    </main>
  );
}
