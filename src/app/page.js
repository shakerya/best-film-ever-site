import Link from "next/link";
import { getEpisodesFromRss } from "../lib/podcast";

// IMPORTANT: keep this a literal number (Next segment config)
export const revalidate = 3600; // 1 hour

const PAGE_SIZE = 30;

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function decodeEntities(s) {
  if (!s) return "";
  return String(s)
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function prettyDate(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(d);
  } catch {
    return "";
  }
}

function titleToMovieQuery(rawTitle) {
  let t = decodeEntities(String(rawTitle ?? "")).trim();
  if (!t) return "";

  // Strip common prefixes
  t = t.replace(/^episode\s*\d+\s*[-:]\s*/i, "");
  t = t.replace(/^see it or skip it\?\s*[-:]\s*/i, "");
  t = t.replace(/^ringside roundtable\s*[-:]\s*/i, "");
  t = t.replace(/^bonus\s*[-:]\s*/i, "");

  // Remove parenthetical clutter at end
  t = t.replace(/\s*\([^)]*\)\s*$/g, "").trim();

  // If it's clearly not a movie episode, bail
  const lower = t.toLowerCase();
  if (
    !t ||
    lower.includes("patreon") ||
    lower.includes("draft") ||
    lower.includes("mailbag") ||
    lower.includes("q&a") ||
    lower.includes("rankings") ||
    lower.includes("roundtable")
  ) {
    return "";
  }

  return t;
}

function tmdbPosterUrl(posterPath, size = "w500") {
  if (!posterPath) return "";
  return `https://image.tmdb.org/t/p/${size}${posterPath}`;
}

async function tmdbSearchFirstMovie(query) {
  const key = process.env.TMDB_API_KEY;
  if (!key) return null;

  const url =
    `https://api.themoviedb.org/3/search/movie?` +
    new URLSearchParams({
      api_key: key,
      query,
      include_adult: "false",
      language: "en-US",
      page: "1",
    });

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;

  const data = await res.json();
  const first = data?.results?.[0];
  if (!first?.id) return null;

  return {
    tmdbId: String(first.id),
    movieTitle: first.title || query,
    year: (first.release_date || "").slice(0, 4),
    posterUrl: tmdbPosterUrl(first.poster_path),
  };
}

function letterboxdFromTmdbId(tmdbId) {
  if (!tmdbId) return "";
  return `https://letterboxd.com/tmdb/${tmdbId}`;
}

function PosterTile({ ep, movie }) {
  const epTitle = decodeEntities(ep.title);
  const displayTitle = movie?.movieTitle ? movie.movieTitle : titleToMovieQuery(epTitle) || epTitle;

  const sub = [prettyDate(ep.isoDate), ep.duration ? `• ${ep.duration}` : ""].filter(Boolean).join(" ");

  const posterUrl =
    movie?.posterUrl ||
    ep.posterUrl ||
    ep.movie?.posterUrl ||
    ep.tmdb?.posterUrl ||
    ep.imageUrl ||
    "";

  return (
    <Link
      href={`/episodes/${ep.slug}`}
      className="group block rounded-3xl overflow-hidden bg-zinc-900/40 ring-1 ring-white/10 hover:ring-white/20 transition"
    >
      <div className="relative aspect-[2/3]">
        {posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={posterUrl}
            alt={displayTitle}
            className="h-full w-full object-cover group-hover:scale-[1.02] transition duration-300"
            loading="lazy"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-zinc-800 to-zinc-950" />
        )}

        {/* Readability overlay */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

        <div className="absolute bottom-0 left-0 right-0 p-4">
          <div className="text-xs text-white/70">{sub}</div>
          <div className="mt-1 line-clamp-2 text-base font-semibold leading-snug text-white">
            {displayTitle}
          </div>
        </div>
      </div>
    </Link>
  );
}

function FeaturedCard({ ep, movie }) {
  const epTitle = decodeEntities(ep.title);
  const displayTitle = movie?.movieTitle ? movie.movieTitle : titleToMovieQuery(epTitle) || epTitle;

  const posterUrl = movie?.posterUrl || ep.posterUrl || ep.movie?.posterUrl || ep.tmdb?.posterUrl || ep.imageUrl || "";

  const meta = [
    prettyDate(ep.isoDate),
    movie?.year ? `• ${movie.year}` : "",
    ep.duration ? `• ${ep.duration}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const excerpt = decodeEntities(ep.descriptionText || "").slice(0, 150);

  return (
    <Link
      href={`/episodes/${ep.slug}`}
      className="group flex gap-4 rounded-3xl bg-zinc-900/40 ring-1 ring-white/10 hover:ring-white/20 transition overflow-hidden"
    >
      <div className="w-[92px] shrink-0">
        <div className="aspect-[2/3]">
          {posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={posterUrl}
              alt={displayTitle}
              className="h-full w-full object-cover group-hover:scale-[1.02] transition duration-300"
              loading="lazy"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-zinc-800 to-zinc-950" />
          )}
        </div>
      </div>

      <div className="min-w-0 py-4 pr-4">
        <div className="text-xs text-white/70">{meta}</div>
        <div className="mt-1 line-clamp-2 text-lg font-semibold text-white">{displayTitle}</div>
        {excerpt ? <div className="mt-2 line-clamp-2 text-sm text-white/70">{excerpt}…</div> : null}
        <div className="mt-3 inline-flex items-center gap-2 text-xs text-white/70">
          {movie?.tmdbId ? (
            <>
              <span className="rounded-full bg-white/10 px-2 py-1">TMDB</span>
              <span className="rounded-full bg-white/10 px-2 py-1">Letterboxd</span>
            </>
          ) : (
            <span className="rounded-full bg-white/10 px-2 py-1">Episode</span>
          )}
        </div>
      </div>
    </Link>
  );
}

export default async function Home({ searchParams }) {
  const q = String(searchParams?.q ?? "").trim();
  const pageRaw = Number.parseInt(String(searchParams?.p ?? "1"), 10);
  const page = Number.isFinite(pageRaw) ? pageRaw : 1;

  const all = await getEpisodesFromRss();

  const filtered = q
    ? all.filter((ep) => {
        const hay = `${decodeEntities(ep.title)} ${decodeEntities(ep.descriptionText || "")}`.toLowerCase();
        return hay.includes(q.toLowerCase());
      })
    : all;

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const p = clamp(page, 1, totalPages);

  // Featured = latest 3 (after filtering)
  const featured = filtered.slice(0, 3);

  // Grid page slice
  const start = (p - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);

  // TMDB lookups only for what we render (featured + current page)
  const tmdbCache = new Map();
  async function movieForEpisode(ep) {
    const query = titleToMovieQuery(ep.title);
    if (!query) return null;
    if (tmdbCache.has(query)) return tmdbCache.get(query);
    const promise = tmdbSearchFirstMovie(query);
    tmdbCache.set(query, promise);
    return promise;
  }

  const featuredMovies = await Promise.all(featured.map(movieForEpisode));
  const pageMovies = await Promise.all(pageItems.map(movieForEpisode));

  // Map by episode slug for easy access
  const featuredBySlug = new Map(featured.map((ep, i) => [ep.slug, featuredMovies[i] || null]));
  const pageBySlug = new Map(pageItems.map((ep, i) => [ep.slug, pageMovies[i] || null]));

  const rssUrl = process.env.PODCAST_RSS_URL || "";

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      {/* Background polish */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(900px_circle_at_20%_0%,rgba(255,255,255,0.08),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(900px_circle_at_80%_20%,rgba(59,130,246,0.10),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(700px_circle_at_50%_110%,rgba(244,63,94,0.08),transparent_55%)]" />
      </div>

      <div className="mx-auto max-w-6xl px-6 pb-16 pt-10">
        <header className="flex flex-col gap-6">
          <div className="flex items-start justify-between gap-6">
            <div>
              <div className="text-xs tracking-[0.25em] text-white/60">UNOFFICIAL FAN INDEX</div>
              <h1 className="mt-2 text-5xl font-semibold leading-none">Best Film Ever</h1>
              <p className="mt-3 max-w-2xl text-white/70">
                Browse episodes like a movie library — posters first, details when you click in.
              </p>
            </div>

            <div className="hidden md:flex items-center gap-2">
              {rssUrl ? (
                <a
                  className="rounded-full bg-white/10 px-3 py-2 text-sm text-white/80 hover:bg-white/15 transition"
                  href={rssUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  RSS feed
                </a>
              ) : null}

              <a
                className="rounded-full bg-white/10 px-3 py-2 text-sm text-white/80 hover:bg-white/15 transition"
                href="?p=1"
              >
                Latest
              </a>
            </div>
          </div>

          {/* Search + count */}
          <div className="flex flex-col gap-2">
            <form className="flex items-center gap-2" action="/" method="get">
              <input
                name="q"
                defaultValue={q}
                placeholder="Search episodes (movie title or notes)…"
                className="w-full rounded-2xl bg-white/5 px-4 py-3 text-base text-white placeholder:text-white/35 ring-1 ring-white/10 focus:outline-none focus:ring-white/25"
              />
              <input type="hidden" name="p" value="1" />
              <button
                type="submit"
                className="rounded-2xl bg-white text-zinc-950 px-4 py-3 text-base font-medium hover:bg-white/90 transition"
              >
                Search
              </button>
            </form>

            <div className="text-sm text-white/60">
              Showing <span className="text-white/85">{filtered.length}</span> episodes
              {q ? (
                <>
                  {" "}
                  for <span className="text-white/85">“{q}”</span>
                </>
              ) : null}
            </div>
          </div>
        </header>

        {/* Featured */}
        <section className="mt-10">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold text-white">Featured</h2>
            <div className="text-sm text-white/50">Newest first</div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            {featured.map((ep) => (
              <FeaturedCard key={ep.guid || ep.slug} ep={ep} movie={featuredBySlug.get(ep.slug)} />
            ))}
          </div>
        </section>

        {/* Browse */}
        <section className="mt-12">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold text-white">Browse</h2>
            <div className="text-sm text-white/50">
              Page <span className="text-white/80">{p}</span> of{" "}
              <span className="text-white/80">{totalPages}</span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
            {pageItems.map((ep) => (
              <PosterTile key={ep.guid || ep.slug} ep={ep} movie={pageBySlug.get(ep.slug)} />
            ))}
          </div>

          {/* Pagination */}
          <div className="mt-10 flex items-center justify-between">
            <div className="text-sm text-white/60">
              Showing <span className="text-white/80">{start + 1}</span>–{" "}
              <span className="text-white/80">{Math.min(start + PAGE_SIZE, total)}</span> of{" "}
              <span className="text-white/80">{total}</span>
            </div>

            <div className="flex gap-2">
              <Link
                className={`rounded-full px-4 py-2 text-sm ring-1 ring-white/10 transition ${
                  p <= 1 ? "pointer-events-none text-white/30" : "text-white/80 hover:bg-white/10"
                }`}
                href={`/?q=${encodeURIComponent(q)}&p=${p - 1}`}
              >
                Prev
              </Link>
              <Link
                className={`rounded-full px-4 py-2 text-sm ring-1 ring-white/10 transition ${
                  p >= totalPages ? "pointer-events-none text-white/30" : "text-white/80 hover:bg-white/10"
                }`}
                href={`/?q=${encodeURIComponent(q)}&p=${p + 1}`}
              >
                Next
              </Link>
            </div>
          </div>

          {/* Tiny helper note */}
          <div className="mt-8 text-xs text-white/40">
            Posters are fetched from TMDB based on the movie name in the episode title. Episode pages are the “detail
            view” (audio, Letterboxd/TMDB, notes, and more).
          </div>
        </section>
      </div>
    </main>
  );
}
