import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getEpisodesFromRss } from "@/lib/podcast";
import { searchMovie, getMovieBundle, tmdbImageUrl } from "@/lib/tmdb";

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

// --- Episode title -> movie guess (fallback + search seed) ---
function extractMovieFromEpisodeTitle(epTitle) {
  const raw = String(epTitle || "").trim();
  if (!raw) return { title: "", year: "" };

  const yearMatch = raw.match(/\((19|20)\d{2}\)/);
  const year = yearMatch ? yearMatch[0].replace(/[()]/g, "") : "";

  let t = raw
    .replace(/^episode\s*\d+\s*[-:–—]\s*/i, "")
    .replace(/^see it or skip it\??\s*[-:–—]\s*/i, "")
    .replace(/^ringside roundtable\s*[-:–—]\s*/i, "")
    .replace(/^bonus\s*[-:–—]\s*/i, "")
    .replace(/^patreon\s*[-:–—]\s*/i, "")
    .trim();

  // Remove trailing guest parentheses, keep (YYYY)
  t = t.replace(/\s*\((?!\d{4}\)).*?\)\s*$/g, "").trim();

  // If there’s still a " - " suffix, keep the first chunk
  t = t.split(" - ")[0].trim();
  t = t.split(" – ")[0].trim();

  // Remove "(YYYY)" from the title text itself
  t = t.replace(/\s*\((19|20)\d{2}\)\s*/g, "").trim();

  return { title: t, year };
}

function looksLikeNonMovieEpisode(epTitle) {
  const t = String(epTitle || "").toLowerCase();
  const bad = [
    "patreon",
    "draft",
    "mailbag",
    "q&a",
    "q & a",
    "rankings",
    "roundtable",
    "fantasy football",
    "summer slam",
    "predictions",
    "preview",
    "award",
    "oscars",
    "golden globes",
    "wrap-up",
    "wrap up",
    "best of",
    "worst of",
    "special",
    "announcement",
  ];
  return bad.some((k) => t.includes(k));
}

// --- matching helpers (cheap + robust enough) ---
function normalizeTitle(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wordSet(s) {
  const n = normalizeTitle(s);
  if (!n) return new Set();
  return new Set(n.split(" ").filter(Boolean));
}

function jaccard(a, b) {
  const A = wordSet(a);
  const B = wordSet(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter += 1;
  const union = A.size + B.size - inter;
  return union ? inter / union : 0;
}

function buildCandidateQueries(title) {
  const raw = String(title || "").trim();
  if (!raw) return [];

  const variants = new Set();

  variants.add(raw);

  if (raw.includes(":")) variants.add(raw.split(":")[0].trim());

  if (raw.includes(" - ")) variants.add(raw.split(" - ")[0].trim());
  if (raw.includes(" – ")) variants.add(raw.split(" – ")[0].trim());

  if (/^the\s+/i.test(raw)) variants.add(raw.replace(/^the\s+/i, "").trim());

  variants.add(
    raw
      .replace(/[“”"]/g, "")
      .replace(/[!?]/g, "")
      .trim()
  );

  return Array.from(variants)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6);
}

async function findBestTmdbMatch({ title, year }) {
  if (!process.env.TMDB_API_KEY) return null;
  if (!title) return null;

  const candidateQueries = buildCandidateQueries(title);
  if (!candidateQueries.length) return null;

  const yr = year && /^\d{4}$/.test(year) ? year : "";

  let allResults = [];
  for (const q of candidateQueries) {
    try {
      const resultsYear = yr ? await searchMovie(q, { year: yr }) : [];
      const resultsNoYear = await searchMovie(q, {});
      allResults = allResults.concat(resultsYear || [], resultsNoYear || []);
    } catch {
      // ignore per-query failures
    }
  }

  const byId = new Map();
  for (const r of allResults) {
    if (!r?.id) continue;
    if (!byId.has(r.id)) byId.set(r.id, r);
  }

  const unique = Array.from(byId.values());
  if (!unique.length) return null;

  let best = null;
  let bestScore = -1;

  for (const r of unique.slice(0, 25)) {
    const sim = jaccard(title, r.title || r.original_title || "");
    const relYear = (r.release_date || "").slice(0, 4);
    const yearScore = yr && relYear ? (yr === relYear ? 0.25 : 0) : 0;

    const pop = Number(r.popularity || 0);
    const popScore = Number.isFinite(pop) ? Math.min(0.10, pop / 1000) : 0;

    const score = sim + yearScore + popScore;

    if (score > bestScore) {
      bestScore = score;
      best = r;
    }
  }

  const similarity = best ? jaccard(title, best.title || "") : 0;
  if (similarity < 0.28) return null;

  return best;
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
          <a className="text-xs text-white/60 hover:text-white/80 transition" href={personUrl} target="_blank" rel="noreferrer">
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

  const guess = extractMovieFromEpisodeTitle(ep.title);
  const shouldSkipTmdb = looksLikeNonMovieEpisode(ep.title) || !guess.title;

  let tmdbMatch = null;
  let bundle = null;

  if (!shouldSkipTmdb) {
    try {
      tmdbMatch = await findBestTmdbMatch({ title: guess.title, year: guess.year });
      if (tmdbMatch?.id) bundle = await getMovieBundle(tmdbMatch.id);
    } catch (e) {
      console.error("[TMDB] lookup failed:", e);
      tmdbMatch = null;
      bundle = null;
    }
  }

  const details = bundle?.details || null;
  const director = bundle?.director || null;
  const cast = Array.isArray(bundle?.cast) ? bundle.cast : [];
  const images = bundle?.images || null;

  const tmdbId = tmdbMatch?.id ? String(tmdbMatch.id) : "";
  const movieTitle = details?.title || tmdbMatch?.title || guess.title || "Episode";
  const year = details?.release_date ? String(details.release_date).slice(0, 4) : guess.year || "";
  const runtime = details?.runtime ? formatRuntime(details.runtime) : "";
  const directorName = director?.name || "";

  const genres = Array.isArray(details?.genres) ? details.genres : [];

  const posterPath = details?.poster_path || tmdbMatch?.poster_path || "";
  const backdropPath =
    details?.backdrop_path ||
    images?.backdrops?.[0]?.file_path ||
    tmdbMatch?.backdrop_path ||
    "";

  const posterUrl = posterPath ? tmdbImageUrl(posterPath, "w780") : "";
  const backdropUrl = backdropPath ? tmdbImageUrl(backdropPath, "w1280") : "";

  const letterboxdUrl = tmdbId
    ? `https://letterboxd.com/tmdb/${tmdbId}/`
    : guess.title
      ? `https://letterboxd.com/search/${encodeURIComponent(guess.title)}/`
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

        {/* HERO: backdrop + poster + title/meta/actions ONLY */}
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

                {!tmdbId ? (
                  <div className="mt-4 rounded-2xl bg-black/45 p-3 text-xs text-white/75 ring-1 ring-white/10">
                    <div className="font-semibold text-white/90">No TMDB match</div>
                    <div className="mt-1">
                      This episode doesn’t map cleanly to a specific movie on TMDB. Podcast audio + show notes still
                      work.
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Title + meta */}
              <div className="min-w-0">
                <div className="inline-flex items-center rounded-full bg-black/35 px-3 py-1 text-[11px] tracking-[0.25em] text-white/70 ring-1 ring-white/10">
                  MOVIE
                </div>

                <h1 className="mt-3 text-4xl md:text-6xl font-semibold leading-none">
                  {movieTitle}
                  {year ? <span className="text-white/60"> ({year})</span> : null}
                </h1>

                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/75">
                  {directorName ? <span>Directed by {directorName}</span> : null}
                  {runtime ? <span className="text-white/45">•</span> : null}
                  {runtime ? <span>{runtime}</span> : null}
                  {published ? <span className="text-white/45">•</span> : null}
                  {published ? <span>Published {published}</span> : null}
                  {ep.durationPretty ? <span className="text-white/45">•</span> : null}
                  {ep.durationPretty ? <span>Episode length {ep.durationPretty}</span> : null}
                </div>

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
                <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/80">
                  {details.overview}
                </p>
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
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
