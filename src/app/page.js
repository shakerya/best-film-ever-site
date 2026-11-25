// src/app/page.js

import Link from "next/link";
import { getEpisodesFromRss } from "../lib/podcast";
import {
  tmdbImageUrl,
  resolveEpisodeMovieCached,
  getMovieByIdCached,
} from "../lib/tmdb";
import { getEpisodeNumberIfFullReview, stripLeadingEpisodeNumber } from "../lib/episodeMeta";
import { HOSTS, hostsForKeys } from "../lib/hosts";
import {
  readBfeState,
  buildGoogleFormLink,
  computeFifthSeatSummary,
  computeBeetrootSummary,
  getMergedEpisodeDataWithState,
} from "../lib/bfeStore";
import { hasPatronCookie } from "../lib/patronAuth";
import FifthSeatBanner from "../components/FifthSeatBanner";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;
const HOMEPAGE_TMDB_MIN_SCORE = 62;

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

function normalizeSort(raw) {
  const s = String(raw || "newest").trim().toLowerCase();
  if (s === "oldest") return "oldest";
  if (s === "score" || s === "top") return "score";
  return "newest";
}

function buildHref({ q, filter, host, sort, p }) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (filter && filter !== "all") params.set("filter", filter);
  if (host && host !== "all") params.set("host", host);
  if (sort && sort !== "newest") params.set("sort", sort);
  if (p && String(p) !== "1") params.set("p", String(p));
  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}

function HostRow({ keys, max = 4, variant = "chip" }) {
  const list = Array.isArray(keys) ? keys.filter(Boolean) : [];
  if (!list.length) return null;

  const hosts = hostsForKeys(list);
  if (!hosts.length) return null;

  if (variant === "compact") {
    return (
      <div className="mt-2 flex items-center gap-2">
        <div className="flex -space-x-1.5">
          {hosts.slice(0, max).map((h) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={h.key}
              src={h.image}
              alt={h.name}
              title={h.name}
              className="h-6 w-6 rounded-full object-cover ring-2 ring-zinc-950"
              loading="lazy"
            />
          ))}
        </div>
        <div className="truncate text-[11px] text-zinc-300/80">
          {hosts
            .slice(0, max)
            .map((h) => h.name)
            .join(" · ")}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      {hosts.slice(0, max).map((h) => (
        <div
          key={h.key}
          className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2.5 py-0.5 ring-1 ring-white/[0.08]"
          title={h.name}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={h.image}
            alt={h.name}
            className="h-5 w-5 rounded-full object-cover"
            loading="lazy"
          />
          <span className="text-[11px] font-medium text-zinc-200">{h.name}</span>
        </div>
      ))}
    </div>
  );
}

function PosterTile({ ep, resolved, scoreMeta }) {
  const epTitle = decodeEntities(ep.title);
  const epNum = getEpisodeNumberIfFullReview(epTitle);

  const displayTitle =
    resolved?.movie?.title || (epNum ? stripLeadingEpisodeNumber(epTitle) : epTitle);

  const subParts = [
    epNum ? `EP ${epNum}` : "",
    prettyDateStable(ep.isoDate),
    ep.durationPretty ? `· ${ep.durationPretty}` : "",
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
    <Link
      href={`/episodes/${ep.slug}`}
      className="group block overflow-hidden rounded-2xl bg-zinc-900/50 ring-1 ring-white/[0.08] hover:ring-white/25 hover:-translate-y-0.5 transition duration-200"
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

        {scoreMeta?.combinedScore ? (
          <div className="absolute top-2.5 right-2.5 flex items-center gap-1 rounded-full bg-zinc-950/80 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300 ring-1 ring-white/15 backdrop-blur-md">
            <span>★ {scoreMeta.combinedScore.toFixed(2)}</span>
          </div>
        ) : null}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/15 to-transparent" />

        <div className="absolute bottom-0 left-0 right-0 p-3.5">
          <div className="text-[11px] text-zinc-400">{sub}</div>
          <div className="mt-0.5 line-clamp-2 text-[15px] font-semibold leading-snug text-white">
            {displayTitle}
          </div>
          <HostRow keys={ep.hostKeys} max={3} variant="compact" />
        </div>
      </div>
    </Link>
  );
}

function FeaturedCard({ ep, resolved, scoreMeta }) {
  const epTitle = decodeEntities(ep.title);
  const epNum = getEpisodeNumberIfFullReview(epTitle);

  const displayTitle =
    resolved?.movie?.title || (epNum ? stripLeadingEpisodeNumber(epTitle) : epTitle);

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
    year ? `· ${year}` : "",
    ep.durationPretty ? `· ${ep.durationPretty}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const excerpt = decodeEntities(ep.descriptionText || "").slice(0, 135);

  return (
    <Link
      href={`/episodes/${ep.slug}`}
      className="group flex gap-4 overflow-hidden rounded-2xl bg-zinc-900/50 ring-1 ring-white/[0.08] hover:bg-zinc-900/80 hover:ring-white/20 transition"
    >
      <div className="w-[100px] shrink-0">
        <div className="h-full aspect-[2/3]">
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

      <div className="flex flex-col justify-between min-w-0 py-3.5 pr-4">
        <div>
          <div className="flex items-center gap-2 text-[11px] text-zinc-400">
            <span>{meta}</span>
          </div>
          <div className="mt-1 line-clamp-1 text-base font-semibold tracking-tight text-white">
            {displayTitle}
          </div>
          {excerpt ? (
            <div className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-zinc-400">
              {excerpt}…
            </div>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <HostRow keys={ep.hostKeys} max={3} variant="compact" />
          {scoreMeta?.combinedScore ? (
            <span className="rounded-full bg-amber-300/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300 ring-1 ring-amber-300/25">
              ★ {scoreMeta.combinedScore.toFixed(2)}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

export default async function Home({ searchParams }) {
  const sp = await searchParams;

  const q = String(sp?.q ?? "").trim();
  const pageRaw = Number.parseInt(String(sp?.p ?? "1"), 10);
  const page = Number.isFinite(pageRaw) ? pageRaw : 1;

  const filter = normalizeFilter(sp?.filter ?? sp?.f ?? "all");
  const host = String(sp?.host ?? "all").trim().toLowerCase();
  const sort = normalizeSort(sp?.sort ?? "newest");

  const [all, state, isPatron] = await Promise.all([
    getEpisodesFromRss(),
    readBfeState(),
    hasPatronCookie(),
  ]);

  const activeScheduled =
    state.schedule?.find((s) => s.status === "open") || state.schedule?.[0] || null;
  let bannerPosterUrl = "";
  let bannerBackdropUrl = "";
  if (activeScheduled?.tmdbId) {
    const mDetails = await getMovieByIdCached(activeScheduled.tmdbId).catch(() => null);
    bannerPosterUrl = mDetails?.poster_path ? tmdbImageUrl(mDetails.poster_path, "w342") : "";
    bannerBackdropUrl = mDetails?.backdrop_path
      ? tmdbImageUrl(mDetails.backdrop_path, "w1280")
      : "";
  }
  const activeFifthSummary = activeScheduled
    ? computeFifthSeatSummary(state.fifthSeats?.[activeScheduled.id] || [])
    : null;
  const activeBeetSummary = activeScheduled
    ? computeBeetrootSummary(state.beetroot?.[activeScheduled.id])
    : null;
  const activeFormLink = activeScheduled
    ? buildGoogleFormLink(activeScheduled, state.evergreenGoogleForm)
    : null;

  const scoreByEpNum = new Map();
  for (const ep of all) {
    const num = getEpisodeNumberIfFullReview(ep.title);
    if (num) {
      const m = getMergedEpisodeDataWithState(num, state);
      if (m) scoreByEpNum.set(num, m);
    }
  }

  let working =
    filter === "full"
      ? all.filter((ep) => getEpisodeNumberIfFullReview(ep.title) !== null)
      : filter === "extras"
        ? all.filter((ep) => getEpisodeNumberIfFullReview(ep.title) === null)
        : all.slice();

  if (host && host !== "all") {
    working = working.filter((ep) => Array.isArray(ep.hostKeys) && ep.hostKeys.includes(host));
  }

  if (q) {
    const qLower = q.toLowerCase();
    working = working.filter((ep) => {
      const hay = `${decodeEntities(ep.title)} ${decodeEntities(ep.descriptionText || "")}`.toLowerCase();
      return hay.includes(qLower);
    });
  }

  if (sort === "oldest") {
    working.sort((a, b) => (a.isoDate || "").localeCompare(b.isoDate || ""));
  } else if (sort === "score") {
    working.sort((a, b) => {
      const na = getEpisodeNumberIfFullReview(a.title);
      const nb = getEpisodeNumberIfFullReview(b.title);
      const sa = (na && scoreByEpNum.get(na)?.combinedScore) || -1;
      const sb = (nb && scoreByEpNum.get(nb)?.combinedScore) || -1;
      return sb - sa || (b.isoDate || "").localeCompare(a.isoDate || "");
    });
  }

  const total = working.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const p = clamp(page, 1, totalPages);

  const featured = all.slice(0, 3);
  const start = (p - 1) * PAGE_SIZE;
  const pageItems = working.slice(start, start + PAGE_SIZE);

  const tmdbCache = new Map();
  async function resolvedForEpisode(ep) {
    const epNum = getEpisodeNumberIfFullReview(ep.title);
    if (!epNum) return null;
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

  const [featuredResolved, pageResolved] = await Promise.all([
    Promise.all(featured.map(resolvedForEpisode)),
    Promise.all(pageItems.map(resolvedForEpisode)),
  ]);

  const featuredBySlug = new Map(featured.map((ep, i) => [ep.slug, featuredResolved[i] || null]));
  const pageBySlug = new Map(pageItems.map((ep, i) => [ep.slug, pageResolved[i] || null]));

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(1000px_circle_at_15%_0%,rgba(255,255,255,0.05),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(800px_circle_at_85%_10%,rgba(251,191,36,0.04),transparent_50%)]" />
      </div>

      <div className="mx-auto max-w-7xl px-6 pb-20 pt-8">
        {/* Up Next Spotlight */}
        {activeScheduled ? (
          <FifthSeatBanner
            film={activeScheduled}
            posterUrl={bannerPosterUrl}
            backdropUrl={bannerBackdropUrl}
            isPatron={isPatron}
            fifthSeatCount={activeFifthSummary?.count || 0}
            beetrootSummary={activeBeetSummary}
            googleFormLink={activeFormLink}
          />
        ) : null}

        {/* Latest Releases */}
        {!q && host === "all" && filter === "all" && sort === "newest" && p === 1 ? (
          <section className="mt-10">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-white">Latest Episodes</h2>
              </div>
              <Link
                href="/gif"
                className="text-xs font-medium text-zinc-400 hover:text-amber-300 transition"
              >
                Play Episode 358’s #BFERandomWord GIF Game →
              </Link>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
              {featured.map((ep) => {
                const num = getEpisodeNumberIfFullReview(ep.title);
                return (
                  <FeaturedCard
                    key={ep.guid || ep.slug}
                    ep={ep}
                    resolved={featuredBySlug.get(ep.slug)}
                    scoreMeta={num ? scoreByEpNum.get(num) : null}
                  />
                );
              })}
            </div>
          </section>
        ) : null}

        {/* Search & Clean Segmented Filter Toolbar */}
        <section className="mt-12">
          <div className="rounded-2xl bg-zinc-900/55 p-4 ring-1 ring-white/[0.08] space-y-4">
            <form className="flex items-center gap-2.5" action="/" method="get">
              <input
                name="q"
                defaultValue={q}
                placeholder={`Search ${all.length} episodes by movie title, actor, or show notes…`}
                className="w-full rounded-xl bg-zinc-950/80 px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 ring-1 ring-white/[0.08] focus:outline-none focus:ring-white/25"
              />
              <input type="hidden" name="p" value="1" />
              <input type="hidden" name="filter" value={filter} />
              {host !== "all" ? <input type="hidden" name="host" value={host} /> : null}
              {sort !== "newest" ? <input type="hidden" name="sort" value={sort} /> : null}
              <button
                type="submit"
                className="shrink-0 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-zinc-200 transition"
              >
                Search
              </button>
              {q ? (
                <Link
                  href={buildHref({ q: "", filter, host, sort, p: 1 })}
                  className="shrink-0 rounded-xl bg-white/[0.06] px-3.5 py-2.5 text-xs font-medium text-zinc-300 hover:bg-white/10"
                >
                  Clear
                </Link>
              ) : null}
            </form>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                {/* Segmented Type Control */}
                <div className="inline-flex items-center rounded-full bg-zinc-950 p-1 ring-1 ring-white/[0.08]">
                  {[
                    ["all", "All"],
                    ["full", "Full Reviews"],
                    ["extras", "Extras"],
                  ].map(([val, lbl]) => (
                    <Link
                      key={val}
                      href={buildHref({ q, filter: val, host, sort, p: 1 })}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                        filter === val
                          ? "bg-white text-zinc-950 font-semibold"
                          : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      {lbl}
                    </Link>
                  ))}
                </div>

                {/* Clean Host Strip */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <Link
                    href={buildHref({ q, filter, host: "all", sort, p: 1 })}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                      host === "all"
                        ? "bg-white/15 text-white ring-1 ring-white/30"
                        : "text-zinc-400 ring-1 ring-white/[0.06] hover:bg-white/[0.06] hover:text-white"
                    }`}
                  >
                    All Hosts
                  </Link>
                  {HOSTS.map((h) => (
                    <Link
                      key={h.key}
                      href={buildHref({ q, filter, host: h.key, sort, p: 1 })}
                      className={`inline-flex items-center gap-1.5 rounded-full pl-1.5 pr-2.5 py-1 text-xs font-medium transition ${
                        host === h.key
                          ? "bg-white/15 text-white ring-1 ring-white/35"
                          : "text-zinc-400 ring-1 ring-white/[0.06] hover:bg-white/[0.06] hover:text-white"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={h.image}
                        alt={h.name}
                        className="h-4 w-4 rounded-full object-cover"
                      />
                      {h.name}
                    </Link>
                  ))}
                </div>
              </div>

              {/* Segmented Sort Control */}
              <div className="inline-flex items-center rounded-full bg-zinc-950 p-1 ring-1 ring-white/[0.08]">
                {[
                  ["newest", "Newest"],
                  ["oldest", "Oldest"],
                  ["score", "Top Rated"],
                ].map(([sVal, sLbl]) => (
                  <Link
                    key={sVal}
                    href={buildHref({ q, filter, host, sort: sVal, p: 1 })}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                      sort === sVal
                        ? "bg-white text-zinc-950 font-semibold"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    {sLbl}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Poster Grid Header */}
          <div className="mt-8 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold tracking-tight text-white">
              Episode Library{" "}
              <span className="ml-1.5 text-sm font-normal text-zinc-500">({total})</span>
            </h2>
            <div className="text-xs text-zinc-500">
              Page <span className="text-zinc-300">{p}</span> of{" "}
              <span className="text-zinc-300">{totalPages}</span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
            {pageItems.map((ep) => {
              const num = getEpisodeNumberIfFullReview(ep.title);
              return (
                <PosterTile
                  key={ep.guid || ep.slug}
                  ep={ep}
                  resolved={pageBySlug.get(ep.slug)}
                  scoreMeta={num ? scoreByEpNum.get(num) : null}
                />
              );
            })}
          </div>

          {/* Pagination */}
          <div className="mt-10 flex items-center justify-between border-t border-white/[0.08] pt-6">
            <div className="text-xs text-zinc-500">
              Showing <span className="text-zinc-300">{total ? start + 1 : 0}</span>–
              <span className="text-zinc-300">{Math.min(start + PAGE_SIZE, total)}</span> of{" "}
              <span className="text-zinc-300">{total}</span>
            </div>

            <div className="flex gap-2">
              <Link
                className={`rounded-full px-4 py-2 text-xs font-medium ring-1 ring-white/10 transition ${
                  p <= 1 ? "pointer-events-none text-zinc-600" : "text-zinc-300 hover:bg-white/10"
                }`}
                href={buildHref({ q, filter, host, sort, p: p - 1 })}
              >
                ← Previous
              </Link>
              <Link
                className={`rounded-full px-4 py-2 text-xs font-medium ring-1 ring-white/10 transition ${
                  p >= totalPages
                    ? "pointer-events-none text-zinc-600"
                    : "text-zinc-300 hover:bg-white/10"
                }`}
                href={buildHref({ q, filter, host, sort, p: p + 1 })}
              >
                Next →
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
