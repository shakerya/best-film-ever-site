import Link from "next/link";
import { getEpisodesFromRss } from "../lib/podcast";
import { tmdbImageUrl, resolveEpisodeMovieCached } from "../lib/tmdb";
import { getEpisodeNumberIfFullReview, stripLeadingEpisodeNumber } from "../lib/episodeMeta";

// IMPORTANT: keep this a literal number (Next segment config)
export const revalidate = 3600; // 1 hour

const PAGE_SIZE = 30;
const HOMEPAGE_TMDB_MIN_SCORE = 62; // stricter than detail page to avoid wrong posters

const PATREON_URL = "https://www.patreon.com/c/BFE/posts?vanity=BFE";

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

function prettyDateStable(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(d);
  } catch {
    return "";
  }
}

function posterUrlFromResolved(resolved) {
  const posterPath = resolved?.movie?.poster_path || "";
  return posterPath ? tmdbImageUrl(posterPath, "w500") : "";
}

function normalizeFilter(raw) {
  const f = String(raw || "all").trim().toLowerCase();
  if (f === "full" || f === "full-reviews" || f === "fullreviews") return "full";
  if (f === "extras" || f === "extra" || f === "other") return "extras";
  return "all";
}

function buildHref({ q, filter, p }) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (filter && filter !== "all") params.set("filter", filter);
  if (p && String(p) !== "1") params.set("p", String(p));
  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}

function PosterTile({ ep, resolved }) {
  const epTitle = decodeEntities(ep.title);
  const epNum = getEpisodeNumberIfFullReview(epTitle);

  const displayTitle = resolved?.movie?.title || (epNum ? stripLeadingEpisodeNumber(epTitle) : epTitle);

  const subParts = [
    epNum ? `EP ${epNum}` : "",
    prettyDateStable(ep.isoDate),
    ep.durationPretty ? `• ${ep.durationPretty}` : "",
  ].filter(Boolean);

  const sub = subParts.join(" ");

  const posterUrl =
    posterUrlFromResolved(resolved) ||
    ep.posterUrl ||
    ep.movie?.posterUrl ||
    ep.tmdb?.posterUrl ||
    ep.imageUrl ||
    ep.image ||
    "";

  return (
    <Link href={`/episodes/${ep.slug}`} className="group block">
      {/* gradient “frame” */}
      <div className="rounded-[28px] bg-gradient-to-br from-white/18 via-white/8 to-transparent p-[1px] transition-transform duration-300 group-hover:-translate-y-1">
        {/* glass card */}
        <div className="relative overflow-hidden rounded-[27px] bg-white/[0.04] ring-1 ring-white/10 shadow-[0_18px_60px_rgba(0,0,0,0.55)] transition-shadow duration-300 group-hover:shadow-[0_28px_90px_rgba(0,0,0,0.70)]">
          <div className="relative aspect-[2/3]">
            {posterUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={posterUrl}
                alt={displayTitle}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                loading="lazy"
              />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-zinc-800 to-zinc-950" />
            )}

            {/* glossy sheen */}
            <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
              <div className="absolute -left-1/3 -top-1/3 h-[65%] w-[65%] rotate-12 bg-white/10 blur-2xl" />
            </div>

            {/* Readability overlay */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />

            <div className="absolute bottom-0 left-0 right-0 p-4">
              <div className="text-xs text-white/70">{sub}</div>
              <div className="mt-1 line-clamp-2 text-base font-semibold leading-snug text-white">
                {displayTitle}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function FeaturedCard({ ep, resolved }) {
  const epTitle = decodeEntities(ep.title);
  const epNum = getEpisodeNumberIfFullReview(epTitle);

  const displayTitle = resolved?.movie?.title || (epNum ? stripLeadingEpisodeNumber(epTitle) : epTitle);

  const posterUrl =
    posterUrlFromResolved(resolved) ||
    ep.posterUrl ||
    ep.movie?.posterUrl ||
    ep.tmdb?.posterUrl ||
    ep.image ||
    "";

  const year = resolved?.movie?.release_date ? String(resolved.movie.release_date).slice(0, 4) : "";

  const meta = [
    epNum ? `EP ${epNum}` : "",
    prettyDateStable(ep.isoDate),
    year ? `• ${year}` : "",
    ep.durationPretty ? `• ${ep.durationPretty}` : "",
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
          {resolved?.movieId ? (
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
  // Next 16: searchParams can be a Promise in some cases
  const sp = await searchParams;

  const q = String(sp?.q ?? "").trim();
  const pageRaw = Number.parseInt(String(sp?.p ?? "1"), 10);
  const page = Number.isFinite(pageRaw) ? pageRaw : 1;

  const filter = normalizeFilter(sp?.filter ?? sp?.f ?? "all");

  const all = await getEpisodesFromRss();

  // 1) Filter bucket
  const bucketed =
    filter === "full"
      ? all.filter((ep) => getEpisodeNumberIfFullReview(ep.title) !== null)
      : filter === "extras"
        ? all.filter((ep) => getEpisodeNumberIfFullReview(ep.title) === null)
        : all;

  // 2) Search filter (applied after bucket)
  const filtered = q
    ? bucketed.filter((ep) => {
        const hay = `${decodeEntities(ep.title)} ${decodeEntities(ep.descriptionText || "")}`.toLowerCase();
        return hay.includes(q.toLowerCase());
      })
    : bucketed;

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const p = clamp(page, 1, totalPages);

  // Featured = latest 3 (after filtering)
  const featured = filtered.slice(0, 3);

  // Grid page slice
  const start = (p - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);

  // TMDB lookups only for full-review episodes we render
  const tmdbCache = new Map();

  async function resolvedForEpisode(ep) {
    const epNum = getEpisodeNumberIfFullReview(ep.title);
    if (!epNum) return null; // guardrail: do not force non-review episodes into random posters

    const key = String(ep.title || "").trim();
    if (!key) return null;

    if (tmdbCache.has(key)) return tmdbCache.get(key);

    const promise = resolveEpisodeMovieCached(ep.title, {
      revalidate: 86400,
      minScore: HOMEPAGE_TMDB_MIN_SCORE,
    });

    tmdbCache.set(key, promise);
    return promise;
  }

  const featuredResolved = await Promise.all(featured.map(resolvedForEpisode));
  const pageResolved = await Promise.all(pageItems.map(resolvedForEpisode));

  // Map by episode slug for easy access
  const featuredBySlug = new Map(featured.map((ep, i) => [ep.slug, featuredResolved[i] || null]));
  const pageBySlug = new Map(pageItems.map((ep, i) => [ep.slug, pageResolved[i] || null]));

  const rssUrl = process.env.PODCAST_RSS_URL || "";

  // shared class for the Patreon button
  const patreonBtnClass =
    "rounded-full bg-white/10 px-3 py-2 text-sm font-medium text-white/90 ring-1 ring-white/15 hover:bg-white/15 hover:ring-white/25 transition";

  const tabBase = "rounded-full px-3 py-2 text-sm ring-1 ring-white/10 transition";
  const tabActive = "bg-white text-zinc-950 ring-white/0";
  const tabInactive = "text-white/80 hover:bg-white/10";

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      {/* Background polish */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(900px_circle_at_20%_0%,rgba(255,255,255,0.08),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(900px_circle_at_80%_20%,rgba(59,130,246,0.10),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(700px_circle_at_50%_110%,rgba(244,63,94,0.08),transparent_55%)]" />
      </div>

      <div className="mx-auto max-w-7xl px-6 pb-16 pt-10">
        <header className="flex flex-col gap-6">
          <div className="flex items-start justify-between gap-6">
            <div>
              <h1 className="mt-2 text-5xl font-semibold leading-none">Best Film Ever</h1>
              <p className="mt-3 max-w-2xl text-white/70">
                Browse episodes like a movie library — posters first, details when you click in.
              </p>

              {/* Mobile actions */}
              <div className="mt-5 flex flex-wrap items-center gap-2 md:hidden">
                <a
                  className={patreonBtnClass}
                  href={PATREON_URL}
                  target="_blank"
                  rel="noreferrer"
                  title="Support Best Film Ever on Patreon"
                >
                  Support on Patreon
                </a>

                <a
                  className="rounded-full bg-white/10 px-3 py-2 text-sm text-white/80 hover:bg-white/15 transition"
                  href="?p=1"
                >
                  Latest
                </a>

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
              </div>
            </div>

            {/* Desktop actions */}
            <div className="hidden md:flex items-center gap-2">
              <a
                className={patreonBtnClass}
                href={PATREON_URL}
                target="_blank"
                rel="noreferrer"
                title="Support Best Film Ever on Patreon"
              >
                Support on Patreon
              </a>

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
          <div className="flex flex-col gap-3">
            <form className="flex items-center gap-2" action="/" method="get">
              <input
                name="q"
                defaultValue={q}
                placeholder="Search episodes (movie title or notes)…"
                className="w-full rounded-2xl bg-white/5 px-4 py-3 text-base text-white placeholder:text-white/35 ring-1 ring-white/10 focus:outline-none focus:ring-white/25"
              />
              <input type="hidden" name="p" value="1" />
              <input type="hidden" name="filter" value={filter} />
              <button
                type="submit"
                className="rounded-2xl bg-white text-zinc-950 px-4 py-3 text-base font-medium hover:bg-white/90 transition"
              >
                Search
              </button>
            </form>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-white/60">
                Showing <span className="text-white/85">{filtered.length}</span> episodes
                {q ? (
                  <>
                    {" "}
                    for <span className="text-white/85">“{q}”</span>
                  </>
                ) : null}
              </div>

              {/* Filter tabs */}
              <div className="flex items-center gap-2">
                <Link className={`${tabBase} ${filter === "all" ? tabActive : tabInactive}`} href={buildHref({ q, filter: "all", p: 1 })}>
                  All
                </Link>
                <Link className={`${tabBase} ${filter === "full" ? tabActive : tabInactive}`} href={buildHref({ q, filter: "full", p: 1 })}>
                  Full Reviews
                </Link>
                <Link className={`${tabBase} ${filter === "extras" ? tabActive : tabInactive}`} href={buildHref({ q, filter: "extras", p: 1 })}>
                  Extras
                </Link>
              </div>
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
              <FeaturedCard key={ep.guid || ep.slug} ep={ep} resolved={featuredBySlug.get(ep.slug)} />
            ))}
          </div>
        </section>

        {/* Browse */}
        <section className="mt-12">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold text-white">Browse</h2>
            <div className="text-sm text-white/50">
              Page <span className="text-white/80">{p}</span> of <span className="text-white/80">{totalPages}</span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
            {pageItems.map((ep) => (
              <PosterTile key={ep.guid || ep.slug} ep={ep} resolved={pageBySlug.get(ep.slug)} />
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
                href={buildHref({ q, filter, p: p - 1 })}
              >
                Prev
              </Link>
              <Link
                className={`rounded-full px-4 py-2 text-sm ring-1 ring-white/10 transition ${
                  p >= totalPages ? "pointer-events-none text-white/30" : "text-white/80 hover:bg-white/10"
                }`}
                href={buildHref({ q, filter, p: p + 1 })}
              >
                Next
              </Link>
            </div>
          </div>

          <div className="mt-8 text-xs text-white/40">
            Posters are fetched from TMDB for full-review episodes only. If a match is uncertain, the tile falls back to
            the episode’s RSS image.
          </div>
        </section>
      </div>
    </main>
  );
}
