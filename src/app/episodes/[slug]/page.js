import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getEpisodesFromRss } from "@/lib/podcast";
import { resolveEpisodeMovieCached, getMovieBundle, tmdbImageUrl } from "@/lib/tmdb";
import { getEpisodeNumberIfFullReview, stripLeadingEpisodeNumber } from "@/lib/episodeMeta";
import { hostsForKeys } from "@/lib/hosts";

export const revalidate = 3600; // 1 hour

// --- Formatting (SSR-safe) ---
function formatDateStable(isoOrPubDate) {
  if (!isoOrPubDate) return "";
  const d = new Date(isoOrPubDate);
  if (Number.isNaN(d.getTime())) return "";
  // Force stable timezone so SSR != client
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

// --- UI components ---
function GenreChip({ children }) {
  return (
    <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs text-white/90 ring-1 ring-white/10">
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
      className="inline-flex items-center justify-center rounded-2xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-300 transition"
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
      className="inline-flex items-center justify-center rounded-2xl bg-white/10 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/10 hover:bg-white/15 hover:ring-white/20 transition"
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
          className="inline-flex items-center gap-2 rounded-full bg-black/35 px-2.5 py-1 ring-1 ring-white/10"
          title={h.name}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={h.image}
            alt={h.name}
            className="h-7 w-7 rounded-full object-cover ring-1 ring-white/15"
            loading="lazy"
          />
          <span className="text-xs font-semibold text-white/90">{h.name}</span>
        </div>
      ))}
    </div>
  );
}

function CastStripItem({ person }) {
  // Bigger + higher-res headshots
  const img = person?.profile_path ? tmdbImageUrl(person.profile_path, "w342") : "";
  const name = person?.name || "";
  const character = person?.character || "";

  return (
    <div className="flex w-[240px] shrink-0 items-center gap-4 rounded-3xl bg-white/5 p-4 ring-1 ring-white/10">
      <div className="h-16 w-16 overflow-hidden rounded-3xl bg-white/10 ring-1 ring-white/10 shrink-0">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt={name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-white/60">
            {name ? name.slice(0, 1).toUpperCase() : "?"}
          </div>
        )}
      </div>

      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-white">{name}</div>
        {character ? (
          <div className="mt-1 line-clamp-2 text-xs text-white/65">{character}</div>
        ) : (
          <div className="mt-1 text-xs text-white/45">Cast</div>
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
    <section className="mt-6 rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-lg font-semibold text-white">Director</h2>
        {personUrl ? (
          <a
            className="text-xs text-white/60 hover:text-white/80 transition"
            href={personUrl}
            target="_blank"
            rel="noreferrer"
          >
            TMDB profile →
          </a>
        ) : null}
      </div>

      <div className="mt-4 flex items-center gap-5">
        <div className="h-20 w-20 overflow-hidden rounded-3xl bg-white/10 ring-1 ring-white/10 shrink-0">
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img} alt={name} className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-white/60">
              {name ? name.slice(0, 1).toUpperCase() : "?"}
            </div>
          )}
        </div>

        <div>
          <div className="text-base font-semibold text-white">{name}</div>
          <div className="mt-1 text-sm text-white/65">Director</div>
        </div>
      </div>
    </section>
  );
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

  const epNum = getEpisodeNumberIfFullReview(ep.title);
  const isFullReview = epNum !== null;

  let resolved = null;
  let bundle = null;

  // Guardrail: only attempt TMDB matching for full-review episodes
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

  const tmdbId = resolved?.movieId ? String(resolved.movieId) : "";
  const fallbackTitle = isFullReview ? stripLeadingEpisodeNumber(ep.title) : ep.title;

  const movieTitle = details?.title || resolved?.movie?.title || fallbackTitle || "Episode";

  const year =
    details?.release_date
      ? String(details.release_date).slice(0, 4)
      : resolved?.movie?.release_date
        ? String(resolved.movie.release_date).slice(0, 4)
        : "";

  const runtime = details?.runtime ? formatRuntime(details.runtime) : "";
  const directorName = director?.name || "";
  const genres = Array.isArray(details?.genres) ? details.genres : [];

  const posterPath = details?.poster_path || resolved?.movie?.poster_path || "";
  const backdropPath =
    details?.backdrop_path || images?.backdrops?.[0]?.file_path || resolved?.movie?.backdrop_path || "";

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
      {/* Subtle page background using backdrop */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        {backdropUrl ? (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-25 blur-[2px] scale-[1.02]"
            style={{ backgroundImage: `url(${backdropUrl})` }}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 to-zinc-950" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/70 via-zinc-950/85 to-zinc-950" />
        <div className="absolute inset-0 bg-[radial-gradient(900px_circle_at_20%_0%,rgba(255,255,255,0.06),transparent_60%)]" />
      </div>

      <div className="mx-auto max-w-6xl px-6 pb-16 pt-10">
        <div className="mb-6">
          <Link href="/" className="text-sm text-white/70 hover:text-white transition">
            ← Back to episodes
          </Link>
        </div>

        {/* HERO */}
        <section className="relative overflow-hidden rounded-3xl ring-1 ring-white/10">
          {backdropUrl ? (
            <div className="absolute inset-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={backdropUrl} alt="" className="h-full w-full object-cover" loading="eager" />
              <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/55 to-black/85" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/25" />
            </div>
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 to-zinc-950" />
          )}

          <div className="relative p-6 md:p-8">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-[240px_1fr] md:gap-10 items-start">
              {/* Poster + actions */}
              <div className="shrink-0">
                <div className="overflow-hidden rounded-3xl bg-black/30 ring-1 ring-white/15 shadow-[0_20px_60px_rgba(0,0,0,0.55)]">
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
                    Letterboxd →
                  </ButtonPrimary>
                  {tmdbUrl ? (
                    <ButtonGhost href={tmdbUrl} title="Open on TMDB">
                      TMDB →
                    </ButtonGhost>
                  ) : null}
                </div>

                {!tmdbId && isFullReview ? (
                  <div className="mt-4 rounded-2xl bg-black/45 p-3 text-xs text-white/75 ring-1 ring-white/10">
                    <div className="font-semibold text-white/90">No TMDB match</div>
                    <div className="mt-1">
                      This episode didn’t map cleanly to a specific movie on TMDB. Podcast audio + show notes still work.
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Title + meta */}
              <div className="min-w-0">
                <div className="inline-flex items-center rounded-full bg-black/35 px-3 py-1 text-[11px] tracking-[0.25em] text-white/70 ring-1 ring-white/10">
                  {tmdbId ? "MOVIE" : "EPISODE"}
                </div>

                <h1 className="mt-3 text-4xl md:text-6xl font-semibold leading-none">
                  {movieTitle}
                  {year ? <span className="text-white/60"> ({year})</span> : null}
                </h1>

                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/75">
                  {epNum ? <span>Episode {epNum}</span> : null}
                  {epNum ? <span className="text-white/45">•</span> : null}
                  {directorName ? <span>Directed by {directorName}</span> : null}
                  {runtime ? <span className="text-white/45">•</span> : null}
                  {runtime ? <span>{runtime}</span> : null}
                  {published ? <span className="text-white/45">•</span> : null}
                  {published ? <span>Published {published}</span> : null}
                  {ep.durationPretty ? <span className="text-white/45">•</span> : null}
                  {ep.durationPretty ? <span>Episode length {ep.durationPretty}</span> : null}
                </div>

                {/* HOSTS (new) */}
                <HostStrip hostKeys={ep.hostKeys} />

                <div className="mt-2 text-sm text-white/60">{ep.title}</div>

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

        {/* Cast strip */}
        {tmdbId && cast.length ? (
          <section className="mt-6 rounded-3xl bg-white/5 p-5 ring-1 ring-white/10">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-lg font-semibold text-white">Top cast</h2>
              <div className="text-xs text-white/55">scroll →</div>
            </div>

            <div className="mt-4 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {cast.slice(0, 12).map((p) => (
                <CastStripItem key={p.credit_id || `${p.id}-${p.cast_id || ""}`} person={p} />
              ))}
            </div>
          </section>
        ) : null}

        {/* Director callout */}
        {tmdbId && director ? <DirectorCard director={director} /> : null}

        {/* BODY */}
        <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
          {/* Main column */}
          <section className="space-y-8">
            {/* Play episode */}
            {ep.audioUrl ? (
              <div className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
                <div className="text-[11px] tracking-[0.25em] text-white/60">LISTEN</div>
                <h2 className="mt-2 text-lg font-semibold text-white">Play the episode</h2>
                <div className="mt-4">
                  <audio controls preload="metadata" src={ep.audioUrl} className="w-full" />
                </div>
              </div>
            ) : null}

            {/* Movie overview */}
            {tmdbId && details?.overview ? (
              <div className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
                <h2 className="text-lg font-semibold text-white">Overview</h2>
                <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/80">{details.overview}</p>
              </div>
            ) : null}

            {/* Show notes */}
            <div className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="text-lg font-semibold text-white">Show notes</h2>
                <a href="#full-notes" className="text-xs text-white/60 hover:text-white/80 transition">
                  jump ↓
                </a>
              </div>

              {notesPreview ? (
                <p className="mt-3 text-sm text-white/75 leading-relaxed">
                  {notesPreview}
                  {(ep.descriptionText || "").length > notesPreview.length ? "…" : ""}
                </p>
              ) : (
                <p className="mt-3 text-sm text-white/60 leading-relaxed">No show notes.</p>
              )}

              <details className="mt-4 rounded-2xl bg-black/20 ring-1 ring-white/10 p-4">
                <summary className="cursor-pointer select-none text-sm font-semibold text-white/90">
                  Read full show notes
                </summary>

                <div
                  id="full-notes"
                  className="prose prose-invert mt-4 max-w-none prose-a:text-white prose-a:underline hover:prose-a:no-underline"
                  style={{ lineHeight: 1.65 }}
                  dangerouslySetInnerHTML={{ __html: ep.descriptionHtml || "" }}
                />
              </details>
            </div>
          </section>

          {/* Sidebar */}
          <aside className="space-y-8">
            <section className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
              <h2 className="text-lg font-semibold text-white">Links</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                <ButtonPrimary href={letterboxdUrl} title="Open on Letterboxd">
                  Letterboxd →
                </ButtonPrimary>
                {tmdbUrl ? (
                  <ButtonGhost href={tmdbUrl} title="Open on TMDB">
                    TMDB →
                  </ButtonGhost>
                ) : null}
              </div>

              <div className="mt-4 text-xs text-white/60">
                {tmdbId ? "Letterboxd is a direct TMDB ID link." : "Letterboxd link is a search fallback (no TMDB match)."}
              </div>
            </section>

            <section className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
              <h2 className="text-lg font-semibold text-white">Details</h2>

              <div className="mt-4 space-y-3 text-sm text-white/75">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-white/60">Episode #</div>
                  <div className="text-white/85">{epNum ? String(epNum) : "—"}</div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="text-white/60">Director</div>
                  <div className="text-white/85">{directorName || "—"}</div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="text-white/60">Runtime</div>
                  <div className="text-white/85">{runtime || "—"}</div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="text-white/60">Release year</div>
                  <div className="text-white/85">{year || "—"}</div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="text-white/60">Published</div>
                  <div className="text-white/85">{published || "—"}</div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="text-white/60">Episode length</div>
                  <div className="text-white/85">{ep.durationPretty || "—"}</div>
                </div>

                {/* Hosts in sidebar too (optional but nice) */}
                {Array.isArray(ep.hostKeys) && ep.hostKeys.length ? (
                  <div className="pt-2">
                    <div className="text-white/60 text-sm mb-2">Hosts</div>
                    <HostStrip hostKeys={ep.hostKeys} />
                  </div>
                ) : null}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
