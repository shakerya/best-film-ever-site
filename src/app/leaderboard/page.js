// src/app/leaderboard/page.js
import { getAllRankedLeaderboardItems } from "@/lib/bfeStore";
import { resolveEpisodeMovieCached, tmdbImageUrl } from "@/lib/tmdb";
import LeaderboardClient from "@/components/LeaderboardClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "All-Time BFE Leaderboard",
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
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-400/30">
            🏆 THE MASTER TABLE
          </div>
          <h1 className="mt-3 text-4xl md:text-5xl font-bold text-white">
            Best Film Ever Leaderboard
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-white/70">
            Ranked using BFE’s unweighted equal-chair formula: every host/guest chair counts once,
            and the <strong className="text-white">Patron Fifth-Seat average</strong> counts as one
            full equal chair. Seeded from verified recent episode transcripts and ready to import
            Ian’s full 358-film Master Spreadsheet!
          </p>
        </div>

        <LeaderboardClient items={enriched} />
      </div>
    </main>
  );
}
