"use client";

import Link from "next/link";
import { createContext, useContext, useRef, useState } from "react";

const AudioPlayerContext = createContext(null);

export function useAudioPlayer() {
  return useContext(AudioPlayerContext);
}

function fmtTime(sec) {
  const s = Math.floor(Number(sec || 0));
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  }
  return `${m}:${String(r).padStart(2, "0")}`;
}

export default function AudioPlayerProvider({ children }) {
  const audioRef = useRef(null);
  const [track, setTrack] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  function playEpisode(nextTrack) {
    if (!nextTrack?.audioUrl) return;
    if (track?.audioUrl === nextTrack.audioUrl && audioRef.current) {
      if (audioRef.current.paused) {
        audioRef.current.play().catch(() => {});
      } else {
        audioRef.current.pause();
      }
      return;
    }
    setTrack(nextTrack);
    setCurrentTime(0);
    setTimeout(() => {
      if (audioRef.current) {
        audioRef.current.load();
        audioRef.current.play().catch(() => {});
      }
    }, 30);
  }

  function skipBy(deltaSec) {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(
      0,
      Math.min(audioRef.current.duration || 0, audioRef.current.currentTime + deltaSec)
    );
  }

  function closePlayer() {
    if (audioRef.current) audioRef.current.pause();
    setPlaying(false);
    setTrack(null);
  }

  return (
    <AudioPlayerContext.Provider value={{ track, playing, playEpisode }}>
      {children}

      {track ? (
        <div className="fixed bottom-0 inset-x-0 z-50 border-t border-white/10 bg-zinc-950/95 backdrop-blur-2xl shadow-[0_-12px_40px_rgba(0,0,0,0.7)]">
          <audio
            ref={audioRef}
            src={track.audioUrl}
            preload="metadata"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
          />

          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-3 min-w-0">
              {track.posterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={track.posterUrl}
                  alt={track.title}
                  className="h-11 w-8 rounded-md object-cover ring-1 ring-white/15 shrink-0"
                />
              ) : null}
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-300">
                  Now Playing
                </div>
                <Link
                  href={`/episodes/${track.slug}`}
                  className="block truncate text-sm font-semibold text-white hover:underline max-w-[220px] sm:max-w-xs"
                >
                  {track.title}
                </Link>
              </div>
            </div>

            <div className="flex flex-1 items-center justify-center gap-3 max-w-xl">
              <button
                type="button"
                onClick={() => skipBy(-15)}
                className="rounded-full bg-white/[0.08] px-2.5 py-1 text-xs font-medium text-zinc-200 hover:bg-white/15"
              >
                -15s
              </button>

              <button
                type="button"
                onClick={() => playEpisode(track)}
                className="rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-zinc-200 transition"
              >
                {playing ? "Pause" : "Play"}
              </button>

              <button
                type="button"
                onClick={() => skipBy(30)}
                className="rounded-full bg-white/[0.08] px-2.5 py-1 text-xs font-medium text-zinc-200 hover:bg-white/15"
              >
                +30s
              </button>

              <div className="hidden sm:flex flex-1 items-center gap-2 text-xs text-zinc-400">
                <span className="w-12 text-right tabular-nums">{fmtTime(currentTime)}</span>
                <input
                  type="range"
                  min={0}
                  max={duration || 1}
                  value={currentTime}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setCurrentTime(val);
                    if (audioRef.current) audioRef.current.currentTime = val;
                  }}
                  className="flex-1 accent-white cursor-pointer"
                />
                <span className="w-12 tabular-nums">{fmtTime(duration)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={closePlayer}
              className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs text-zinc-400 hover:bg-white/10 hover:text-white"
              title="Close mini-player"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </AudioPlayerContext.Provider>
  );
}
