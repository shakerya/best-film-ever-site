// src/app/gif/page.js
import { readBfeState } from "@/lib/bfeStore";
import GifArenaClient from "@/components/GifArenaClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "GIF of the Week (#BFERandomWord)",
  description:
    "Play Best Film Ever's weekly #BFERandomWord GIF of the Week game — unlock with the episode's secret Endgame word, avoid duplicate GIFs, and compete for the crown!",
};

export default async function GifGamePage() {
  const state = await readBfeState();
  const rounds = state.gifRounds || [];
  const rawActive = rounds.find((r) => r.status === "open") || rounds[0] || null;
  const pastRounds = rounds.filter((r) => r.id !== rawActive?.id);

  // Redact secret randomWord & entries on initial server render so listeners MUST know the word to unlock
  const safeActiveRound = rawActive
    ? {
        id: rawActive.id,
        epNum: rawActive.epNum,
        filmTitle: rawActive.filmTitle,
        hint: rawActive.hint || "",
        closesIso: rawActive.closesIso || "",
        status: rawActive.status || "open",
        threadTweetUrl: rawActive.threadTweetUrl || "",
        entryCount: Array.isArray(rawActive.entries) ? rawActive.entries.length : 0,
      }
    : null;

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-6xl px-6 pb-20 pt-8">
        <GifArenaClient activeRound={safeActiveRound} pastRounds={pastRounds} />
      </div>
    </main>
  );
}
