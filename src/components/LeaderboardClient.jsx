"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { HOSTS } from "@/lib/hosts";

export default function LeaderboardClient({ items = [] }) {
  const [mode, setMode] = useState("overall"); // overall | splits | patrons
  const [hostFilter, setHostFilter] = useState("all");

  const filtered = useMemo(() => {
    let list = items.slice();
    if (hostFilter !== "all") {
      list = list.filter((ep) => ep.hosts?.[hostFilter] !== undefined);
    }
    if (mode === "splits") {
      list = list
        .filter((ep) => ep.patronDelta !== null)
        .sort((a, b) => Math.abs(b.patronDelta) - Math.abs(a.patronDelta));
    } else if (mode === "patrons") {
      list = list
        .filter(
          (ep) =>
            ep.fifthSeatAvg !== null &&
            ep.fifthSeatAvg !== undefined &&
            Number.isFinite(Number(ep.fifthSeatAvg))
        )
        .sort((a, b) => b.fifthSeatAvg - a.fifthSeatAvg);
    } else {
      list.sort((a, b) => b.combinedScore - a.combinedScore || b.epNum - a.epNum);
    }
    return list;
  }, [items, mode, hostFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {[
            { key: "overall", label: "🏆 Official Combined Score" },
            { key: "splits", label: "⚡ Biggest Host vs. Patron Splits" },
            { key: "patrons", label: "🪑 Highest Fifth-Seat Scores" },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setMode(tab.key)}
              className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                mode === tab.key
                  ? "bg-white text-zinc-950"
                  : "bg-white/5 text-white/80 ring-1 ring-white/10 hover:bg-white/10"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-white/50 mr-1">Host:</span>
          <button
            type="button"
            onClick={() => setHostFilter("all")}
            className={`rounded-full px-3 py-1 text-xs transition ${
              hostFilter === "all"
                ? "bg-emerald-400 text-zinc-950 font-semibold"
                : "bg-white/5 text-white/75 hover:bg-white/10"
            }`}
          >
            All
          </button>
          {HOSTS.map((h) => (
            <button
              key={h.key}
              type="button"
              onClick={() => setHostFilter(h.key)}
              className={`rounded-full px-3 py-1 text-xs transition ${
                hostFilter === h.key
                  ? "bg-emerald-400 text-zinc-950 font-semibold"
                  : "bg-white/5 text-white/75 hover:bg-white/10"
              }`}
            >
              {h.name}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl bg-white/5 ring-1 ring-white/10">
        <div className="divide-y divide-white/10">
          {filtered.map((ep, idx) => (
            <Link
              key={ep.epNum}
              href={`/episodes/${ep.slug}`}
              className="flex flex-col gap-4 p-5 hover:bg-white/5 transition sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-sm font-bold text-white">
                  #{mode === "overall" && hostFilter === "all" ? ep.rank : idx + 1}
                </div>

                {ep.posterUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={ep.posterUrl}
                    alt={ep.filmTitle || ep.title}
                    className="h-16 w-11 shrink-0 rounded-xl object-cover ring-1 ring-white/15"
                  />
                ) : null}

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-white/55">
                    <span>EP {ep.epNum}</span>
                    {ep.pickNote ? <span>• {ep.pickNote}</span> : null}
                  </div>
                  <div className="truncate text-lg font-semibold text-white">
                    {ep.filmTitle || ep.title}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
                    {Object.entries(ep.hosts || {}).map(([hk, val]) => (
                      <span
                        key={hk}
                        className="rounded-lg bg-black/40 px-2 py-0.5 text-white/80 ring-1 ring-white/10 capitalize"
                      >
                        {hk}: <strong>{val}</strong>
                      </span>
                    ))}
                    {(ep.guests || []).map((g) => (
                      <span
                        key={g.name}
                        className="rounded-lg bg-indigo-500/15 px-2 py-0.5 text-indigo-200 ring-1 ring-indigo-400/25"
                      >
                        {g.name}: <strong>{g.score}</strong>
                      </span>
                    ))}
                    {ep.fifthSeatAvg !== null && ep.fifthSeatAvg !== undefined ? (
                      <span className="rounded-lg bg-emerald-500/15 px-2 py-0.5 text-emerald-200 ring-1 ring-emerald-400/30">
                        🪑 5th Seat: <strong>{ep.fifthSeatAvg}</strong> ({ep.fifthSeatCount})
                      </span>
                    ) : (
                      <span className="rounded-lg bg-white/5 px-2 py-0.5 text-white/40">
                        🪑 No 5th Seat
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 shrink-0 self-end sm:self-center">
                {ep.patronDelta !== null ? (
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wider text-white/45">
                      Patron vs Host
                    </div>
                    <div
                      className={`text-xs font-bold ${
                        ep.patronDelta > 0
                          ? "text-emerald-300"
                          : ep.patronDelta < 0
                            ? "text-rose-300"
                            : "text-white/70"
                      }`}
                    >
                      {ep.patronDelta > 0 ? `+${ep.patronDelta}` : ep.patronDelta}
                    </div>
                  </div>
                ) : null}

                <div className="rounded-2xl bg-emerald-400/15 px-4 py-2 text-right ring-1 ring-emerald-400/35">
                  <div className="text-[10px] uppercase tracking-wider text-emerald-300">
                    Official BFE
                  </div>
                  <div className="text-xl font-black text-white">
                    {ep.combinedScore.toFixed(2)}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
