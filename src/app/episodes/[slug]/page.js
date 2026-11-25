import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getEpisodesFromRss } from "@/lib/podcast";
import { resolveEpisodeMovieCached, getMovieBundle, tmdbImageUrl } from "@/lib/tmdb";
import { getEpisodeNumberIfFullReview, stripLeadingEpisodeNumber } from "@/lib/episodeMeta";
import { hostsForKeys } from "@/lib/hosts";
import { getMergedEpisodeDataByNumber, BFE_LINKS } from "@/lib/bfeStore";
import EpisodePlayButton from "@/components/EpisodePlayButton";
import BfeEndgameGames from "@/components/BfeEndgameGames";

export const dynamic = "force-dynamic";

function formatDateStable(isoOrPubDate) {
  if (!isoOrPubDate) return "";
  const d = new Date(isoOrPubDate);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

function formatRuntime(mins) {
  const m = Number(mins);
  if (!Number.isFinite(m) || m <= 0) return "";
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h <= 0) return `${r}m`;
  if (r === 0) return `${h}h`;
  return `${h}h ${r}m`;
}

function GenreChip({ children }) {
  return (
    <span className="inline-flex items-center rounded-full bg-white/[0.08] px-3 py-1 text-xs text-zinc-200 ring-1 ring-white/10">
      {children}
    </span>
  );
}

function ButtonPrimary({ href, children, title }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      title={title}
      className="inline-flex items-center justify-center rounded-full bg-white px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-zinc-200 transition"
    >
      {children}
    </a>
  );
}

function ButtonGhost({ href, children, title }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      title={title}
      className="inline-flex items-center justify-center rounded-full bg-white/[0.08] px-4 py-2 text-xs font-medium text-white ring-1 ring-white/15 hover:bg-white/15 transition"
    >
      {children}
    </a>
  );
}

function HostStrip({ hostKeys }) {
  const keys = Array.isArray(hostKeys) ? hostKeys : [];
  if (!keys.length) return null;

  const hosts = hostsForKeys(keys);
  if (!hosts.length) return null;

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      {hosts.slice(0, 6).map((h) => (
        <div
          key={h.key}
          className="inline-flex items-center gap-2 rounded-full bg-black/45 px-2.5 py-1 ring-1 ring-white/10"
          title={h.name}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={h.image}
            alt={h.name}
            className="h-6 w-6 rounded-full object-cover"
            loading="lazy"
          />
          <span className="text-xs font-medium text-zinc-200">{h.name}</span>
        </div>
      ))}
    </div>
  );
}

function CastStripItem({ person }) {
  const img = person?.profile_path ? tmdbImageUrl(person.profile_path, "w342") : "";
  const name = person?.name || "";
  const character = person?.character || "";

  return (
    <div className="flex w-[230px] shrink-0 items-center gap-3.5 rounded-2xl bg-zinc-950/60 p-3.5 ring-1 ring-white/[0.08]">
      <div className="h-14 w-14 overflow-hidden rounded-2xl bg-zinc-800 ring-1 ring-white/10 shrink-0">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt={name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-zinc-500">
            {name ? name.slice(0, 1).toUpperCase() : "?"}
          </div>
        )}
      </div>

      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-white">{name}</div>
        {character ? (
          <div className="mt-0.5 line-clamp-2 text-xs text-zinc-400">{character}</div>
        ) : (
          <div className="mt-0.5 text-xs text-zinc-500">Cast</div>
        )}
      </div>
    </div>
  );
}

function DirectorCard({ director }) {
  if (!director) return null;

  const name = director?.name || "";
  const img = director?.profile_path ? tmdbImageUrl(director.profile_path, "w342") : "";
  const personUrl = director?.id ? `https://www.themoviedb.org/person/${director.id}` : "";

  return (
    <section className="rounded-3xl bg-zinc-900/60 p-6 ring-1 ring-white/[0.08]">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-base font-semibold text-white">Director</h2>
        {personUrl ? (
          <a
            className="text-xs text-zinc-400 hover:text-white transition"
            href={personUrl}
            target="_blank"
            rel="noreferrer"
          >
            TMDB →
          </a>
        ) : null}
      </div>

      <div className="mt-4 flex items-center gap-4">
        <div className="h-16 w-16 overflow-hidden rounded-2xl bg-zinc-800 ring-1 ring-white/10 shrink-0">
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img} alt={name} className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-zinc-500">
              {name ? name.slice(0, 1).toUpperCase() : "?"}
            </div>
          )}
        </div>

        <div>
          <div className="text-base font-semibold text-white">{name}</div>
          <div className="mt-0.5 text-xs text-zinc-400">Director</div>
        </div>
      </div>
    </section>
  );
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const episodes = await getEpisodesFromRss();
  const ep = episodes.find((e) => e.slug === slug);

  if (!ep) return { title: "Episode not found" };

  return {
    title: ep.title,
    description: (ep.descriptionText || "").slice(0, 160),
  };
}

export default async function EpisodePage({ params }) {
  const { slug } = await params;

  const episodes = await getEpisodesFromRss();
  const ep = episodes.find((e) => e.slug === slug);
  if (!ep) notFound();

  const epNum = getEpisodeNumberIfFullReview(ep.title);
  const isFullReview = epNum !== null;
  const bfeScorecard = epNum ? await getMergedEpisodeDataByNumber(epNum) : null;

  let resolved = null;
  let bundle = null;

  if (isFullReview) {
    try {
      resolved = await resolveEpisodeMovieCached(ep.title, { revalidate: 86400, minScore: 55 });
      if (resolved?.movieId) bundle = await getMovieBundle(resolved.movieId);
    } catch (e) {
      console.error("[TMDB] lookup failed:", e);
      resolved = null;
      bundle = null;
    }
  }

  const details = bundle?.details || null;
  const director = bundle?.director || null;
  const cast = Array.isArray(bundle?.cast) ? bundle.cast : [];
  const images = bundle?.images || null;
  const ageGameCast = Array.isArray(bundle?.ageGameCast) ? bundle.ageGameCast : [];

  const tmdbId = resolved?.movieId ? String(resolved.movieId) : "";
  const fallbackTitle = isFullReview ? stripLeadingEpisodeNumber(ep.title) : ep.title;

  const movieTitle = details?.title || resolved?.movie?.title || fallbackTitle || "Episode";

  const year = details?.release_date
    ? String(details.release_date).slice(0, 4)
    : resolved?.movie?.release_date
      ? String(resolved.movie.release_date).slice(0, 4)
      : "";

  const runtime = details?.runtime ? formatRuntime(details.runtime) : "";
  const directorName = director?.name || "";
  const genres = Array.isArray(details?.genres) ? details.genres : [];

  const posterPath = details?.poster_path || resolved?.movie?.poster_path || "";
  const backdropPath =
    details?.backdrop_path ||
    images?.backdrops?.[0]?.file_path ||
    resolved?.movie?.backdrop_path ||
    "";

  const posterUrl = posterPath ? tmdbImageUrl(posterPath, "w780") : "";
  const backdropUrl = backdropPath ? tmdbImageUrl(backdropPath, "w1280") : "";

  const letterboxdUrl = tmdbId
    ? `https://letterboxd.com/tmdb/${tmdbId}/`
    : movieTitle
      ? `https://letterboxd.com/search/${encodeURIComponent(movieTitle)}/`
      : "https://letterboxd.com/";

  const tmdbUrl = tmdbId ? `https://www.themoviedb.org/movie/${tmdbId}` : "";
  const published = formatDateStable(ep.isoDate || ep.pubDate);

  const notesPreview = (ep.descriptionText || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 320);

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="pointer-events-none fixed inset-0 -z-10">
        {backdropUrl ? (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-20 blur-[2px] scale-[1.02]"
            style={{ backgroundImage: `url(${backdropUrl})` }}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 to-zinc-950" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/75 via-zinc-950/90 to-zinc-950" />
      </div>

      <div className="mx-auto max-w-6xl px-6 pb-16 pt-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <Link href="/" className="text-xs font-medium text-zinc-400 hover:text-white transition">
            ← Back to Library
          </Link>
          <Link
            href="/leaderboard"
            className="text-xs font-medium text-zinc-400 hover:text-amber-300 transition"
          >
            View All-Time Leaderboard →
          </Link>
        </div>

        {/* HERO */}
        <section className="relative overflow-hidden rounded-3xl ring-1 ring-white/[0.10]">
          {backdropUrl ? (
            <div className="absolute inset-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={backdropUrl} alt="" className="h-full w-full object-cover" loading="eager" />
              <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/60 to-black/90" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-black/30" />
            </div>
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 to-zinc-950" />
          )}

          <div className="relative p-6 md:p-8">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-[220px_1fr] md:gap-10 items-start">
              <div className="shrink-0">
                <div className="overflow-hidden rounded-2xl bg-black/30 ring-1 ring-white/15 shadow-[0_20px_60px_rgba(0,0,0,0.55)]">
                  {posterUrl ? (
                    <Image
                      src={posterUrl}
                      alt={`${movieTitle} poster`}
                      width={480}
                      height={720}
                      className="h-auto w-full object-cover"
                      priority={false}
                    />
                  ) : (
                    <div className="aspect-[2/3] bg-gradient-to-br from-zinc-800 to-zinc-950" />
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <ButtonPrimary href={letterboxdUrl} title="Open on Letterboxd">
                    Letterboxd ↗
                  </ButtonPrimary>
                  {tmdbUrl ? (
                    <ButtonGhost href={tmdbUrl} title="Open on TMDB">
                      TMDB ↗
                    </ButtonGhost>
                  ) : null}
                </div>
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-black/45 px-3 py-1 text-[11px] font-medium tracking-[0.2em] text-zinc-300 ring-1 ring-white/10">
                    {tmdbId ? "FILM REVIEW" : "EPISODE"}
                  </span>
                  {bfeScorecard?.combinedScore ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-300/15 px-3 py-1 text-xs font-semibold text-amber-300 ring-1 ring-amber-300/35">
                      ★ {bfeScorecard.combinedScore.toFixed(2)} / 10 Official BFE
                    </span>
                  ) : null}
                  {bfeScorecard?.beetrootPct !== undefined ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-zinc-200 ring-1 ring-white/15">
                      {bfeScorecard.beetrootPct}% Beetroot Metric
                    </span>
                  ) : null}
                </div>

                <h1 className="mt-3 text-4xl md:text-5xl font-semibold tracking-tight leading-tight">
                  {movieTitle}
                  {year ? <span className="font-normal text-zinc-400"> ({year})</span> : null}
                </h1>

                <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-zinc-300">
                  {epNum ? <span>Episode {epNum}</span> : null}
                  {epNum ? <span className="text-white/30">·</span> : null}
                  {directorName ? <span>Directed by {directorName}</span> : null}
                  {runtime ? <span className="text-white/30">·</span> : null}
                  {runtime ? <span>{runtime}</span> : null}
                  {published ? <span className="text-white/30">·</span> : null}
                  {published ? <span>{published}</span> : null}
                  {ep.durationPretty ? <span className="text-white/30">·</span> : null}
                  {ep.durationPretty ? <span>{ep.durationPretty} pod</span> : null}
                </div>

                <HostStrip hostKeys={ep.hostKeys} />

                {tmdbId && genres.length ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {genres.map((g) => (
                      <GenreChip key={g.id || g.name}>{g.name}</GenreChip>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        {/* Official BFE Scorecard + Patron Fifth-Seat Breakdown */}
        {bfeScorecard && (bfeScorecard.combinedScore || bfeScorecard.fifthSeatCount !== undefined) ? (
          <section className="mt-6 rounded-3xl bg-zinc-900/60 p-6 ring-1 ring-white/[0.08]">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-300">
                  Official Episode Scorecard
                </div>
                <h2 className="mt-1 text-lg font-semibold text-white">
                  Host Verdicts & The Patron Fifth-Seat
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {bfeScorecard.randomWord ? (
                  <Link
                    href="/gif"
                    className="rounded-full bg-white/[0.08] px-4 py-2 text-xs font-medium text-white ring-1 ring-white/15 hover:bg-white/15 transition"
                  >
                    Play #BFERandomWord GIF Game →
                  </Link>
                ) : null}
                <Link
                  href="/fifth-seat"
                  className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-zinc-200 transition"
                >
                  Rate Upcoming Film →
                </Link>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
              {Object.entries(bfeScorecard.hosts || {}).map(([hk, val]) => (
                <div
                  key={hk}
                  className="rounded-2xl bg-zinc-950/75 p-3.5 text-center ring-1 ring-white/[0.08]"
                >
                  <div className="text-xs capitalize text-zinc-400">{hk}</div>
                  <div className="mt-1 text-2xl font-semibold text-white tabular-nums">{val}</div>
                </div>
              ))}

              {(bfeScorecard.guests || []).map((g) => (
                <div
                  key={g.name}
                  className="rounded-2xl bg-zinc-950/75 p-3.5 text-center ring-1 ring-white/[0.08]"
                >
                  <div className="truncate text-xs text-zinc-400">{g.name}</div>
                  <div className="mt-1 text-2xl font-semibold text-white tabular-nums">
                    {g.score}
                  </div>
                </div>
              ))}

              <div className="rounded-2xl bg-zinc-950/75 p-3.5 text-center ring-1 ring-amber-300/25">
                <div className="text-xs font-medium text-amber-300">5th Seat</div>
                <div className="mt-1 text-2xl font-semibold text-white tabular-nums">
                  {bfeScorecard.fifthSeatAvg ?? "—"}
                </div>
                <div className="text-[10px] text-zinc-500">
                  {bfeScorecard.fifthSeatCount || 0} patron
                  {bfeScorecard.fifthSeatCount === 1 ? "" : "s"}
                </div>
              </div>

              {bfeScorecard.combinedScore ? (
                <div className="rounded-2xl bg-amber-300 text-zinc-950 p-3.5 text-center">
                  <div className="text-[11px] font-bold uppercase tracking-wider">Official BFE</div>
                  <div className="mt-1 text-2xl font-black tabular-nums">
                    {bfeScorecard.combinedScore.toFixed(2)}
                  </div>
                </div>
              ) : null}
            </div>

            {bfeScorecard.fifthSeatVoters?.length ? (
              <div className="mt-5 border-t border-white/[0.08] pt-4">
                <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                  Patrons in the Fifth Seat on This Episode
                </div>
                <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {bfeScorecard.fifthSeatVoters.map((v) => (
                    <div
                      key={v.name}
                      className="rounded-xl bg-zinc-950/70 px-4 py-3 text-xs ring-1 ring-white/[0.06]"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white">{v.name}</span>
                        <span className="font-semibold text-amber-300 tabular-nums">
                          {v.score}/10
                        </span>
                      </div>
                      {v.quote ? (
                        <p className="mt-1.5 text-zinc-400 leading-relaxed">“{v.quote}”</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {/* Cast strip */}
        {tmdbId && cast.length ? (
          <section className="mt-6 rounded-3xl bg-zinc-900/60 p-5 ring-1 ring-white/[0.08]">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-base font-semibold text-white">Top Cast</h2>
              <div className="text-xs text-zinc-500">Scroll →</div>
            </div>

            <div className="mt-4 flex snap-x snap-mandatory gap-3.5 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {cast.slice(0, 12).map((p) => (
                <CastStripItem key={p.credit_id || `${p.id}-${p.cast_id || ""}`} person={p} />
              ))}
            </div>
          </section>
        ) : null}

        {/* BODY */}
        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_340px]">
          <section className="space-y-6">
            {ep.audioUrl ? (
              <div className="rounded-3xl bg-zinc-900/60 p-6 ring-1 ring-white/[0.08]">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                      Audio
                    </div>
                    <h2 className="mt-0.5 text-base font-semibold text-white">Listen to Episode</h2>
                  </div>
                  <EpisodePlayButton
                    title={ep.title}
                    slug={ep.slug}
                    audioUrl={ep.audioUrl}
                    posterUrl={posterUrl}
                  />
                </div>
                <div className="mt-4">
                  <audio controls preload="metadata" src={ep.audioUrl} className="w-full" />
                </div>
              </div>
            ) : null}

            {isFullReview ? (
              <BfeEndgameGames
                movieTitle={movieTitle}
                releaseYear={year}
                ageGameCast={ageGameCast}
                budget={details?.budget || 0}
                revenue={details?.revenue || 0}
              />
            ) : null}

            {tmdbId && details?.overview ? (
              <div className="rounded-3xl bg-zinc-900/60 p-6 ring-1 ring-white/[0.08]">
                <h2 className="text-base font-semibold text-white">Synopsis</h2>
                <p className="mt-2.5 max-w-3xl text-sm leading-relaxed text-zinc-300">
                  {details.overview}
                </p>
              </div>
            ) : null}

            <div className="rounded-3xl bg-zinc-900/60 p-6 ring-1 ring-white/[0.08]">
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="text-base font-semibold text-white">Show Notes</h2>
              </div>

              {notesPreview ? (
                <p className="mt-2.5 text-sm text-zinc-300 leading-relaxed">
                  {notesPreview}
                  {(ep.descriptionText || "").length > notesPreview.length ? "…" : ""}
                </p>
              ) : (
                <p className="mt-2.5 text-sm text-zinc-500">No show notes.</p>
              )}

              <details className="mt-4 rounded-2xl bg-zinc-950/70 ring-1 ring-white/[0.08] p-4">
                <summary className="cursor-pointer select-none text-xs font-semibold text-zinc-200">
                  Read full show notes
                </summary>

                <div
                  id="full-notes"
                  className="prose prose-invert mt-4 max-w-none text-sm prose-a:text-amber-300 prose-a:underline hover:prose-a:no-underline"
                  style={{ lineHeight: 1.65 }}
                  dangerouslySetInnerHTML={{ __html: ep.descriptionHtml || "" }}
                />
              </details>
            </div>
          </section>

          <aside className="space-y-6">
            {tmdbId && director ? <DirectorCard director={director} /> : null}

            <section className="rounded-3xl bg-zinc-900/60 p-6 ring-1 ring-white/[0.08]">
              <h2 className="text-base font-semibold text-white">Join the Fifth Seat</h2>
              <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                BFE Patrons vote on upcoming films, submit Fifth-Seat rankings (counting as one
                equal co-host chair), and unlock the advance film slate.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <a
                  href={BFE_LINKS.patreon}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-full bg-amber-300 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-amber-200 transition"
                >
                  Join Patreon ↗
                </a>
                <Link
                  href="/fifth-seat"
                  className="inline-flex items-center justify-center rounded-full bg-white/[0.08] px-4 py-2 text-xs font-medium text-white ring-1 ring-white/15 hover:bg-white/15 transition"
                >
                  This Week’s Film
                </Link>
              </div>
            </section>

            <section className="rounded-3xl bg-zinc-900/60 p-6 ring-1 ring-white/[0.08]">
              <h2 className="text-base font-semibold text-white">Details</h2>

              <div className="mt-4 space-y-2.5 text-xs text-zinc-400">
                <div className="flex items-center justify-between gap-3">
                  <div>Episode #</div>
                  <div className="text-zinc-200">{epNum ? String(epNum) : "—"}</div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div>Director</div>
                  <div className="text-zinc-200">{directorName || "—"}</div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div>Runtime</div>
                  <div className="text-zinc-200">{runtime || "—"}</div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div>Release year</div>
                  <div className="text-zinc-200">{year || "—"}</div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div>Published</div>
                  <div className="text-zinc-200">{published || "—"}</div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div>Episode length</div>
                  <div className="text-zinc-200">{ep.durationPretty || "—"}</div>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
