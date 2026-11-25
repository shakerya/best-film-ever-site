// src/app/fifth-seat/page.js
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  readBfeState,
  buildGoogleFormLink,
  computeFifthSeatSummary,
  computeBeetrootSummary,
  getPatronContributorLeaderboard,
  BFE_LINKS,
} from "@/lib/bfeStore";
import { hasPatronCookie } from "@/lib/patronAuth";
import { getMovieByIdCached, tmdbImageUrl } from "@/lib/tmdb";
import FifthSeatInteractive from "@/components/FifthSeatInteractive";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "The Fifth Seat & Beetroot Poll",
  description:
    "Cast your vote in this week's Best Film Ever Beetroot Metric poll or unlock Patron Fifth-Seat rankings.",
};

export default async function FifthSeatPage({ searchParams }) {
  const sp = await searchParams;

  // Support 1-click Magic Link directly on /fifth-seat?key=... -> sets 1-year cookie & strips key from URL
  const incomingKey = String(sp?.key || "").trim();
  if (incomingKey) {
    redirect(`/api/patron/unlock?key=${encodeURIComponent(incomingKey)}&next=/fifth-seat`);
  }

  const unlockFailed = sp?.unlock === "invalid";
  const isPatron = await hasPatronCookie();
  const requestedFilmId = String(sp?.film || "").trim();

  const state = readBfeState();
  const fullSchedule = state.schedule || [];

  // Non-patrons only see the current open film + already-aired closed episodes (future "upcoming" monthly picks stay gated!)
  const visibleSchedule = isPatron
    ? fullSchedule
    : fullSchedule.filter((s) => s.status !== "upcoming");

  const activeFilm =
    visibleSchedule.find((s) => s.id === requestedFilmId) ||
    visibleSchedule.find((s) => s.status === "open") ||
    visibleSchedule[0];

  const enrichedSchedule = await Promise.all(
    visibleSchedule.map(async (item) => {
      const details = item.tmdbId
        ? await getMovieByIdCached(item.tmdbId).catch(() => null)
        : null;
      return {
        ...item,
        posterUrl: details?.poster_path ? tmdbImageUrl(details.poster_path, "w500") : "",
        backdropUrl: details?.backdrop_path ? tmdbImageUrl(details.backdrop_path, "w1280") : "",
        overview: details?.overview || "",
        fifthSummary: computeFifthSeatSummary(state.fifthSeats?.[item.id] || []),
        beetSummary: computeBeetrootSummary(state.beetroot?.[item.id]),
        googleFormLink: isPatron ? buildGoogleFormLink(item, state.evergreenGoogleForm) : null,
      };
    })
  );

  const spotlight =
    enrichedSchedule.find((s) => s.id === activeFilm?.id) || enrichedSchedule[0] || null;
  const contributors = getPatronContributorLeaderboard();

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      {spotlight?.backdropUrl ? (
        <div className="pointer-events-none fixed inset-0 -z-10">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-20 blur-[2px]"
            style={{ backgroundImage: `url(${spotlight.backdropUrl})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/70 via-zinc-950/90 to-zinc-950" />
        </div>
      ) : null}

      <div className="mx-auto max-w-6xl px-6 pb-20 pt-8">
        {spotlight ? (
          <section className="rounded-3xl bg-white/5 p-6 md:p-8 ring-1 ring-white/10">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-[220px_1fr]">
              <div className="shrink-0">
                <div className="overflow-hidden rounded-3xl bg-zinc-900 ring-1 ring-white/15 shadow-2xl">
                  {spotlight.posterUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={spotlight.posterUrl}
                      alt={spotlight.title}
                      className="w-full aspect-[2/3] object-cover"
                    />
                  ) : (
                    <div className="aspect-[2/3] bg-zinc-800" />
                  )}
                </div>
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-400/30">
                    {spotlight.status === "open" ? "🎬 THIS WEEK ON BFE" : "PAST SLATE"}
                  </span>
                  {spotlight.episodeNum ? (
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/80">
                      Episode {spotlight.episodeNum}
                    </span>
                  ) : null}
                  {spotlight.pickNote ? (
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/80">
                      {spotlight.pickNote}
                    </span>
                  ) : null}
                </div>

                <h1 className="mt-3 text-4xl md:text-5xl font-bold leading-tight">
                  {spotlight.title}{" "}
                  {spotlight.year ? (
                    <span className="text-white/55 font-normal">({spotlight.year})</span>
                  ) : null}
                </h1>

                {spotlight.overview ? (
                  <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/75">
                    {spotlight.overview}
                  </p>
                ) : null}

                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-black/35 p-3.5 ring-1 ring-white/10">
                    <div className="text-[11px] uppercase tracking-wider text-white/50">
                      How the 5th Seat Works
                    </div>
                    <div className="mt-1 text-sm font-semibold text-emerald-300">
                      Equals 1 Full Host Chair
                    </div>
                    <div className="mt-0.5 text-xs text-white/60">
                      BFE Patrons average into one equal co-host vote.
                    </div>
                  </div>

                  <div className="rounded-2xl bg-black/35 p-3.5 ring-1 ring-white/10">
                    <div className="text-[11px] uppercase tracking-wider text-white/50">
                      Patron Turnout
                    </div>
                    <div className="mt-1 text-sm font-semibold text-white">
                      {spotlight.fifthSummary.count} Fifth-Seat
                      {spotlight.fifthSummary.count === 1 ? "" : "s"}
                    </div>
                    <div className="mt-0.5 text-xs text-white/60">
                      {spotlight.status === "closed" && spotlight.fifthSummary.average !== null
                        ? `Official Avg: ${spotlight.fifthSummary.average}/10`
                        : "Score revealed on Tuesday’s pod!"}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-black/35 p-3.5 ring-1 ring-white/10">
                    <div className="text-[11px] uppercase tracking-wider text-white/50">
                      🥬 Beetroot Metric
                    </div>
                    <div className="mt-1 text-sm font-semibold text-fuchsia-300">
                      {spotlight.beetSummary.beetrootPct !== null
                        ? `${spotlight.beetSummary.beetrootPct}% Fresh`
                        : "Vote Open"}
                    </div>
                    <div className="mt-0.5 text-xs text-white/60">
                      {spotlight.beetSummary.total} public listener votes
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8">
              <FifthSeatInteractive
                key={`${spotlight.id}-${isPatron ? "p" : "g"}`}
                film={spotlight}
                isPatron={isPatron}
                unlockFailed={unlockFailed}
                googleFormLink={spotlight.googleFormLink}
                initialFifthSeatCount={spotlight.fifthSummary.count}
                initialBeetroot={spotlight.beetSummary}
              />
            </div>
          </section>
        ) : null}

        {/* Slate + Contributor Standings */}
        <div className="mt-12 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_340px]">
          <section>
            <div className="flex items-baseline justify-between">
              <h2 className="text-xl font-semibold text-white">
                {isPatron ? "Monthly Patron Fifth-Seat Slate" : "Recent & Active Fifth-Seat Films"}
              </h2>
              {!isPatron ? (
                <span className="text-xs text-emerald-300">
                  🔒 Full advance slate unlocked for Patrons
                </span>
              ) : null}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {enrichedSchedule.map((item) => {
                const isSelected = item.id === spotlight?.id;
                return (
                  <Link
                    key={item.id}
                    href={`/fifth-seat?film=${encodeURIComponent(item.id)}`}
                    className={`flex gap-4 rounded-3xl p-4 transition ${
                      isSelected
                        ? "bg-emerald-500/10 ring-2 ring-emerald-400/60"
                        : "bg-white/5 ring-1 ring-white/10 hover:bg-white/10"
                    }`}
                  >
                    <div className="w-16 shrink-0 overflow-hidden rounded-xl bg-zinc-900 aspect-[2/3]">
                      {item.posterUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.posterUrl}
                          alt={item.title}
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-[11px]">
                        <span
                          className={`rounded-full px-2 py-0.5 font-semibold ${
                            item.status === "open"
                              ? "bg-emerald-400/20 text-emerald-300"
                              : "bg-white/10 text-white/65"
                          }`}
                        >
                          {item.status === "open" ? "OPEN NOW" : `EP ${item.episodeNum || ""}`}
                        </span>
                        <span className="text-white/50">{item.episodeDate}</span>
                      </div>
                      <div className="mt-1 truncate text-base font-semibold text-white">
                        {item.title}
                      </div>
                      {item.pickNote ? (
                        <div className="mt-0.5 truncate text-xs text-white/60">{item.pickNote}</div>
                      ) : null}
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/70">
                        <span>🪑 {item.fifthSummary.count} in</span>
                        {item.beetSummary.beetrootPct !== null ? (
                          <span>• 🥬 {item.beetSummary.beetrootPct}%</span>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>

          <aside className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10 h-fit">
            <div className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
              🏆 Gamified Standings
            </div>
            <h2 className="mt-1 text-lg font-semibold text-white">Fifth-Seat Hall of Honor</h2>
            <p className="mt-1 text-xs text-white/60">
              Active BFE Patrons ranked by Fifth-Seat appearances logged since Episode 311.
            </p>

            <div className="mt-4 space-y-2.5">
              {contributors.slice(0, 10).map((c, idx) => (
                <div
                  key={c.name}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-black/30 px-3.5 py-2.5 ring-1 ring-white/10"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white">
                      <span className="text-white/45 mr-1.5">#{idx + 1}</span>
                      {c.name}
                    </div>
                    <div className="text-[11px] text-emerald-300/90">{c.tierBadge}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold text-white">{c.submissions}x</div>
                    {c.avgScoreGiven !== null ? (
                      <div className="text-[11px] text-white/50">avg {c.avgScoreGiven}/10</div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            <a
              href={BFE_LINKS.patreon}
              target="_blank"
              rel="noreferrer"
              className="mt-5 block w-full rounded-2xl bg-white/10 py-2.5 text-center text-xs font-semibold text-white ring-1 ring-white/15 hover:bg-white/15 transition"
            >
              Join BFE on Patreon to Climb the Table →
            </a>
          </aside>
        </div>
      </div>
    </main>
  );
}
