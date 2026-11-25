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
  getMergedEpisodeDataByNumber,
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
        <div className="flex -space-x-2">
          {hosts.slice(0, max).map((h) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={h.key}
              src={h.image}
              alt={h.name}
              title={h.name}
              className="h-7 w-7 rounded-full object-cover ring-2 ring-black/60"
              loading="lazy"
            />
          ))}
        </div>
        <div className="text-xs text-white/70">
          {hosts
            .slice(0, max)
            .map((h) => h.name)
            .join(" • ")}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {hosts.slice(0, max).map((h) => (
        <div
          key={h.key}
          className="inline-flex items-center gap-2 rounded-full bg-white/10 px-2.5 py-1 ring-1 ring-white/10"
          title={h.name}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={h.image}
            alt={h.name}
            className="h-6 w-6 rounded-full object-cover ring-1 ring-white/15"
            loading="lazy"
          />
          <span className="text-xs font-medium text-white/85">{h.name}</span>
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
    <Link
      href={`/episodes/${ep.slug}`}
      className="group block rounded-3xl overflow-hidden bg-zinc-900/40 ring-1 ring-white/10 hover:ring-white/25 transition"
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

        {/* Top-right Official Score Pill */}
        {scoreMeta?.combinedScore ? (
          <div className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-black/75 px-2.5 py-1 text-xs font-bold text-emerald-300 ring-1 ring-emerald-400/35 backdrop-blur">
            <span>★ {scoreMeta.combinedScore.toFixed(2)}</span>
          </div>
        ) : null}

        {/* Readability overlay */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />

        <div className="absolute bottom-0 left-0 right-0 p-4">
          <div className="text-xs text-white/70">{sub}</div>
          <div className="mt-1 line-clamp-2 text-base font-semibold leading-snug text-white">
            {displayTitle}
          </div>

          <div className="mt-2">
            <HostRow keys={ep.hostKeys} max={3} variant="compact" />
          </div>
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
    year ? `• ${year}` : "",
    ep.durationPretty ? `• ${ep.durationPretty}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const excerpt = decodeEntities(ep.descriptionText || "").slice(0, 150);

  return (
    <Link
      href={`/episodes/${ep.slug}`}
      className="group flex gap-4 rounded-3xl bg-zinc-900/40 ring-1 ring-white/10 hover:ring-white/25 transition overflow-hidden"
    >
      <div className="w-[96px] shrink-0">
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

        <HostRow keys={ep.hostKeys} max={5} variant="chip" />

        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-white/80">
          {scoreMeta?.combinedScore ? (
            <span className="rounded-full bg-emerald-400/20 px-2.5 py-0.5 font-semibold text-emerald-300 ring-1 ring-emerald-400/30">
              ★ {scoreMeta.combinedScore.toFixed(2)} BFE
            </span>
          ) : null}
          {scoreMeta?.fifthSeatAvg ? (
            <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-white/85">
              🪑 5th Seat {scoreMeta.fifthSeatAvg}
            </span>
          ) : null}
          {scoreMeta?.randomWord ? (
            <span className="rounded-full bg-amber-400/15 px-2.5 py-0.5 text-amber-200">
              🎬 GIF Game
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
    Promise.resolve(readBfeState()),
    hasPatronCookie(),
  ]);

  // Active Fifth-Seat spotlight data
  const activeScheduled =
    state.schedule?.find((s) => s.status === "open") || state.schedule?.[0] || null;
  let bannerPosterUrl = "";
  if (activeScheduled?.tmdbId) {
    const mDetails = await getMovieByIdCached(activeScheduled.tmdbId).catch(() => null);
    bannerPosterUrl = mDetails?.poster_path ? tmdbImageUrl(mDetails.poster_path, "w342") : "";
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

  // Score metadata map by episode number
  const scoreByEpNum = new Map();
  for (const ep of all) {
    const num = getEpisodeNumberIfFullReview(ep.title);
    if (num) {
      const m = getMergedEpisodeDataByNumber(num);
      if (m) scoreByEpNum.set(num, m);
    }
  }

  // 1) Filter bucket
  let working =
    filter === "full"
      ? all.filter((ep) => getEpisodeNumberIfFullReview(ep.title) !== null)
      : filter === "extras"
        ? all.filter((ep) => getEpisodeNumberIfFullReview(ep.title) === null)
        : all.slice();

  // 2) Host filter
  if (host && host !== "all") {
    working = working.filter((ep) => Array.isArray(ep.hostKeys) && ep.hostKeys.includes(host));
  }

  // 3) Search filter
  if (q) {
    const qLower = q.toLowerCase();
    working = working.filter((ep) => {
      const hay = `${decodeEntities(ep.title)} ${decodeEntities(ep.descriptionText || "")}`.toLowerCase();
      return hay.includes(qLower);
    });
  }

  // 4) Sort
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

  const tabBase = "rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-white/10 transition";
  const tabActive = "bg-white text-zinc-950 font-semibold ring-white/0";
  const tabInactive = "text-white/80 hover:bg-white/10";

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(900px_circle_at_20%_0%,rgba(255,255,255,0.08),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(900px_circle_at_80%_20%,rgba(59,130,246,0.10),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(700px_circle_at_50%_110%,rgba(244,63,94,0.08),transparent_55%)]" />
      </div>

      <div className="mx-auto max-w-7xl px-6 pb-16 pt-8">
        <header className="flex flex-col gap-5">
          <div>
            <h1 className="text-4xl md:text-5xl font-semibold leading-none">Best Film Ever</h1>
            <p className="mt-2.5 max-w-2xl text-sm md:text-base text-white/70">
              Browse {all.length}+ episodes like a movie library — rate upcoming films in the Fifth
              Seat, vote in the Beetroot Metric poll, and play along in the Endgame.
            </p>
          </div>

          {/* Up Next Fifth-Seat & Beetroot Spotlight */}
          {activeScheduled ? (
            <FifthSeatBanner
              film={activeScheduled}
              posterUrl={bannerPosterUrl}
              isPatron={isPatron}
              fifthSeatCount={activeFifthSummary?.count || 0}
              beetrootSummary={activeBeetSummary}
              googleFormLink={activeFormLink}
            />
          ) : null}

          {/* Search + Filters */}
          <div className="mt-2 flex flex-col gap-3">
            <form className="flex items-center gap-2" action="/" method="get">
              <input
                name="q"
                defaultValue={q}
                placeholder="Search episodes (movie title, actor, or show notes)…"
                className="w-full rounded-2xl bg-white/5 px-4 py-3 text-sm md:text-base text-white placeholder:text-white/35 ring-1 ring-white/10 focus:outline-none focus:ring-white/25"
              />
              <input type="hidden" name="p" value="1" />
              <input type="hidden" name="filter" value={filter} />
              {host !== "all" ? <input type="hidden" name="host" value={host} /> : null}
              {sort !== "newest" ? <input type="hidden" name="sort" value={sort} /> : null}
              <button
                type="submit"
                className="rounded-2xl bg-white text-zinc-950 px-5 py-3 text-sm md:text-base font-semibold hover:bg-white/90 transition"
              >
                Search
              </button>
            </form>

            {/* Filter + Host + Sort Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              {/* Type Tabs */}
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  ["all", "All"],
                  ["full", "Full Reviews"],
                  ["extras", "Extras"],
                ].map(([val, lbl]) => (
                  <Link
                    key={val}
                    className={`${tabBase} ${filter === val ? tabActive : tabInactive}`}
                    href={buildHref({ q, filter: val, host, sort, p: 1 })}
                  >
                    {lbl}
                  </Link>
                ))}

                <span className="mx-1 text-white/20">|</span>

                {/* Host Pills */}
                <Link
                  href={buildHref({ q, filter, host: "all", sort, p: 1 })}
                  className={`${tabBase} ${host === "all" ? "bg-emerald-400 text-zinc-950 font-semibold ring-0" : tabInactive}`}
                >
                  All Hosts
                </Link>
                {HOSTS.map((h) => (
                  <Link
                    key={h.key}
                    href={buildHref({ q, filter, host: h.key, sort, p: 1 })}
                    className={`inline-flex items-center gap-1.5 ${tabBase} ${
                      host === h.key
                        ? "bg-emerald-400 text-zinc-950 font-semibold ring-0"
                        : tabInactive
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

              {/* Sort Pills */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-white/50">Sort:</span>
                {[
                  ["newest", "Newest"],
                  ["oldest", "Oldest"],
                  ["score", "Top Score"],
                ].map(([sVal, sLbl]) => (
                  <Link
                    key={sVal}
                    href={buildHref({ q, filter, host, sort: sVal, p: 1 })}
                    className={`${tabBase} ${sort === sVal ? tabActive : tabInactive}`}
                  >
                    {sLbl}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </header>

        {/* Featured Latest 3 */}
        {!q && host === "all" && sort === "newest" && p === 1 ? (
          <section className="mt-10">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold text-white">Latest Releases</h2>
              <Link href="/gif" className="text-xs text-amber-300 hover:underline">
                🎬 Play this week’s #BFERandomWord GIF Game →
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

        {/* Poster Library */}
        <section className="mt-12">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold text-white">
              Browse ({total} episode{total === 1 ? "" : "s"})
            </h2>
            <div className="text-sm text-white/50">
              Page <span className="text-white/80">{p}</span> of{" "}
              <span className="text-white/80">{totalPages}</span>
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
          <div className="mt-10 flex items-center justify-between">
            <div className="text-sm text-white/60">
              Showing <span className="text-white/80">{total ? start + 1 : 0}</span>–{" "}
              <span className="text-white/80">{Math.min(start + PAGE_SIZE, total)}</span> of{" "}
              <span className="text-white/80">{total}</span>
            </div>

            <div className="flex gap-2">
              <Link
                className={`rounded-full px-4 py-2 text-sm ring-1 ring-white/10 transition ${
                  p <= 1 ? "pointer-events-none text-white/30" : "text-white/80 hover:bg-white/10"
                }`}
                href={buildHref({ q, filter, host, sort, p: p - 1 })}
              >
                Prev
              </Link>
              <Link
                className={`rounded-full px-4 py-2 text-sm ring-1 ring-white/10 transition ${
                  p >= totalPages
                    ? "pointer-events-none text-white/30"
                    : "text-white/80 hover:bg-white/10"
                }`}
                href={buildHref({ q, filter, host, sort, p: p + 1 })}
              >
                Next
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
