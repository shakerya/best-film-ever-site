// src/app/leaderboard/page.js
import { getAllRankedLeaderboardItems } from "@/lib/bfeStore";
import { resolveEpisodeMovieCached, tmdbImageUrl } from "@/lib/tmdb";
import LeaderboardClient from "@/components/LeaderboardClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Leaderboard",
  description:
    "See how Best Film Ever's reviewed movies stack up by Official Combined Score (Host chairs + the Patron Fifth-Seat).",
};

export default async function LeaderboardPage() {
  const ranked = getAllRankedLeaderboardItems();

  const enriched = await Promise.all(
    ranked.map(async (ep) => {
      const resolved = await resolveEpisodeMovieCached(ep.title, {
        revalidate: 86400,
        minScore: 55,
      }).catch(() => null);
      return {
        ...ep,
        posterUrl: resolved?.movie?.poster_path
          ? tmdbImageUrl(resolved.movie.poster_path, "w342")
          : "",
      };
    })
  );

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-6xl px-6 pb-20 pt-8 space-y-8">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-300">
            The Master Table
          </div>
          <h1 className="mt-2 text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-white">
            Best Film Ever Leaderboard
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
            Ranked using BFE’s unweighted equal-chair formula: every host or guest seat counts once,
            and the <strong className="text-zinc-200 font-medium">Patron Fifth-Seat average</strong>{" "}
            counts as one full equal chair.
          </p>
        </div>

        <LeaderboardClient items={enriched} />
      </div>
    </main>
  );
}
