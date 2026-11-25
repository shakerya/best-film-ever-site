"use client";

import { useAudioPlayer } from "./AudioPlayerProvider";

export default function EpisodePlayButton({ title, slug, audioUrl, posterUrl }) {
  const player = useAudioPlayer();
  if (!audioUrl || !player) return null;

  const isCurrent = player.track?.audioUrl === audioUrl;
  const isPlaying = isCurrent && player.playing;

  return (
    <button
      type="button"
      onClick={() => player.playEpisode({ title, slug, audioUrl, posterUrl })}
      className="inline-flex items-center gap-2 rounded-2xl bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-emerald-300 transition"
    >
      <span>{isPlaying ? "⏸ Pause Mini-Player" : "▶ Play While Browsing"}</span>
    </button>
  );
}
