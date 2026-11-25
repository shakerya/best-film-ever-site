// src/app/gif/page.js
import { readBfeState } from "@/lib/bfeStore";
import GifArenaClient from "@/components/GifArenaClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "GIF of the Week (#BFERandomWord)",
  description:
    "Play Best Film Ever's weekly #BFERandomWord GIF of the Week game — unlock with the episode's secret Endgame word, avoid duplicate GIFs, and compete for the crown!",
};

export default function GifGamePage() {
  const state = readBfeState();
  const rounds = state.gifRounds || [];
  const activeRound = rounds.find((r) => r.status === "open") || rounds[0] || null;
  const pastRounds = rounds.filter((r) => r.id !== activeRound?.id);

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-6xl px-6 pb-20 pt-8">
        <GifArenaClient activeRound={activeRound} pastRounds={pastRounds} />
      </div>
    </main>
  );
}
