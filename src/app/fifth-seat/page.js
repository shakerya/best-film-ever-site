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
  title: "Fifth Seat & Beetroot Poll",
  description:
    "Cast your vote in this week's Best Film Ever Beetroot Metric poll or unlock Patron Fifth-Seat rankings.",
};

export default async function FifthSeatPage({ searchParams }) {
  const sp = await searchParams;

  const incomingKey = String(sp?.key || "").trim();
  if (incomingKey) {
    redirect(`/api/patron/unlock?key=${encodeURIComponent(incomingKey)}&next=/fifth-seat`);
  }

  const unlockFailed = sp?.unlock === "invalid";
  const isPatron = await hasPatronCookie();
  const requestedFilmId = String(sp?.film || "").trim();

  const state = readBfeState();
  const fullSchedule = state.schedule || [];

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
            className="absolute inset-0 bg-cover bg-center opacity-15 blur-[2px]"
            style={{ backgroundImage: `url(${spotlight.backdropUrl})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/75 via-zinc-950/90 to-zinc-950" />
        </div>
      ) : null}

      <div className="mx-auto max-w-6xl px-6 pb-20 pt-8">
        {spotlight ? (
          <section className="rounded-3xl bg-zinc-900/60 p-6 md:p-8 ring-1 ring-white/[0.08]">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-[200px_1fr]">
              <div className="shrink-0">
                <div className="overflow-hidden rounded-2xl bg-zinc-900 ring-1 ring-white/15 shadow-2xl">
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
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-amber-300">
                  <span>
                    {spotlight.status === "open" ? "Up Next on Best Film Ever" : "Past Episode Slate"}
                  </span>
                  {spotlight.episodeNum ? (
                    <>
                      <span className="text-white/25">•</span>
                      <span className="text-zinc-300">Episode {spotlight.episodeNum}</span>
                    </>
                  ) : null}
                  {spotlight.episodeDate ? (
                    <>
                      <span className="text-white/25">•</span>
                      <span className="text-zinc-400">{spotlight.episodeDate}</span>
                    </>
                  ) : null}
                </div>

                <h1 className="mt-2 text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-white">
                  {spotlight.title}{" "}
                  {spotlight.year ? (
                    <span className="font-normal text-zinc-400">({spotlight.year})</span>
                  ) : null}
                </h1>

                {spotlight.pickNote ? (
                  <div className="mt-1.5 text-sm font-medium text-zinc-300">
                    {spotlight.pickNote}
                  </div>
                ) : null}

                {spotlight.overview ? (
                  <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-400">
                    {spotlight.overview}
                  </p>
                ) : null}

                <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-zinc-950/70 p-4 ring-1 ring-white/[0.08]">
                    <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                      Fifth-Seat Weight
                    </div>
                    <div className="mt-1 text-sm font-semibold text-white">
                      1 Full Co-Host Chair
                    </div>
                    <div className="mt-0.5 text-xs text-zinc-400">
                      Patron scores average into one equal seat.
                    </div>
                  </div>

                  <div className="rounded-2xl bg-zinc-950/70 p-4 ring-1 ring-white/[0.08]">
                    <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                      Patron Submissions
                    </div>
                    <div className="mt-1 text-sm font-semibold text-white">
                      {spotlight.fifthSummary.count === 0
                        ? "Open for Patrons"
                        : `${spotlight.fifthSummary.count} Fifth-Seat${
                            spotlight.fifthSummary.count === 1 ? "" : "s"
                          }`}
                    </div>
                    <div className="mt-0.5 text-xs text-zinc-400">
                      {spotlight.status === "closed" && spotlight.fifthSummary.average !== null
                        ? `Official Avg: ${spotlight.fifthSummary.average} / 10`
                        : "Revealed on Tuesday’s episode"}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-zinc-950/70 p-4 ring-1 ring-white/[0.08]">
                    <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                      Beetroot Metric
                    </div>
                    <div className="mt-1 text-sm font-semibold text-amber-300">
                      {spotlight.beetSummary.beetrootPct !== null && spotlight.beetSummary.total > 0
                        ? `${spotlight.beetSummary.beetrootPct}% Fresh`
                        : "Public Poll Open"}
                    </div>
                    <div className="mt-0.5 text-xs text-zinc-400">
                      {spotlight.beetSummary.total > 0
                        ? `${spotlight.beetSummary.total} listener vote${
                            spotlight.beetSummary.total === 1 ? "" : "s"
                          }`
                        : "Great + Good % (10+ votes to qualify)"}
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
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold tracking-tight text-white">
                {isPatron ? "Fifth-Seat Film Slate" : "Active & Recent Fifth-Seat Films"}
              </h2>
              {!isPatron ? (
                <span className="text-xs text-zinc-400">
                  Advance monthly slate unlocked for Patrons
                </span>
              ) : null}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              {enrichedSchedule.map((item) => {
                const isSelected = item.id === spotlight?.id;
                return (
                  <Link
                    key={item.id}
                    href={`/fifth-seat?film=${encodeURIComponent(item.id)}`}
                    className={`flex gap-4 rounded-2xl p-3.5 transition ${
                      isSelected
                        ? "bg-white/[0.09] ring-1 ring-white/35"
                        : "bg-zinc-900/50 ring-1 ring-white/[0.08] hover:bg-zinc-900/80 hover:ring-white/20"
                    }`}
                  >
                    <div className="w-14 shrink-0 overflow-hidden rounded-xl bg-zinc-900 aspect-[2/3]">
                      {item.posterUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.posterUrl}
                          alt={item.title}
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1 py-0.5">
                      <div className="flex items-center gap-2 text-[11px]">
                        <span
                          className={`rounded-full px-2 py-0.5 font-semibold ${
                            item.status === "open"
                              ? "bg-amber-300 text-zinc-950"
                              : "bg-white/10 text-zinc-300"
                          }`}
                        >
                          {item.status === "open" ? "OPEN" : `EP ${item.episodeNum || ""}`}
                        </span>
                        <span className="text-zinc-500">{item.episodeDate}</span>
                      </div>
                      <div className="mt-1 truncate text-[15px] font-semibold text-white">
                        {item.title}
                      </div>
                      {item.pickNote ? (
                        <div className="mt-0.5 truncate text-xs text-zinc-400">{item.pickNote}</div>
                      ) : null}
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                        <span>
                          {item.fifthSummary.count} Fifth-Seat
                          {item.fifthSummary.count === 1 ? "" : "s"}
                        </span>
                        {item.fifthSummary.average !== null && item.status === "closed" ? (
                          <span>· Avg {item.fifthSummary.average}/10</span>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>

          <aside className="rounded-3xl bg-zinc-900/60 p-6 ring-1 ring-white/[0.08] h-fit">
            <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-amber-300">
              Patron Contributors
            </div>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-white">
              Fifth-Seat Hall of Honor
            </h2>
            <p className="mt-1 text-xs text-zinc-400">
              Verified Fifth-Seat appearances logged from podcast transcripts since Episode 301.
            </p>

            <div className="mt-4 space-y-2">
              {contributors.slice(0, 10).map((c, idx) => (
                <div
                  key={c.name}
                  className="flex items-center justify-between gap-3 rounded-xl bg-zinc-950/70 px-3.5 py-2.5 ring-1 ring-white/[0.06]"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-white">
                      <span className="text-zinc-500 mr-2 tabular-nums">#{idx + 1}</span>
                      {c.name}
                    </div>
                    <div className="text-[11px] text-zinc-400">{c.tierBadge}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold text-amber-300 tabular-nums">
                      {c.submissions}×
                    </div>
                    {c.avgScoreGiven !== null ? (
                      <div className="text-[11px] text-zinc-500">avg {c.avgScoreGiven}</div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            <a
              href={BFE_LINKS.patreon}
              target="_blank"
              rel="noreferrer"
              className="mt-5 block w-full rounded-full bg-white py-2.5 text-center text-xs font-semibold text-zinc-950 hover:bg-zinc-200 transition"
            >
              Join BFE on Patreon →
            </a>
          </aside>
        </div>
      </div>
    </main>
  );
}
