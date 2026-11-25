"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { HOSTS } from "@/lib/hosts";

export default function LeaderboardClient({ items = [] }) {
  const [mode, setMode] = useState("overall");
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
        <div className="inline-flex flex-wrap gap-1 rounded-full bg-zinc-900 p-1 ring-1 ring-white/[0.08]">
          {[
            { key: "overall", label: "Official Combined Score" },
            { key: "splits", label: "Host vs. Patron Splits" },
            { key: "patrons", label: "Highest Fifth-Seat" },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setMode(tab.key)}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
                mode === tab.key
                  ? "bg-white text-zinc-950 font-semibold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setHostFilter("all")}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              hostFilter === "all"
                ? "bg-white/15 text-white ring-1 ring-white/30"
                : "text-zinc-400 ring-1 ring-white/[0.06] hover:text-white"
            }`}
          >
            All Hosts
          </button>
          {HOSTS.map((h) => (
            <button
              key={h.key}
              type="button"
              onClick={() => setHostFilter(h.key)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                hostFilter === h.key
                  ? "bg-white/15 text-white ring-1 ring-white/30"
                  : "text-zinc-400 ring-1 ring-white/[0.06] hover:text-white"
              }`}
            >
              {h.name}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl bg-zinc-900/55 ring-1 ring-white/[0.08]">
        <div className="divide-y divide-white/[0.06]">
          {filtered.map((ep, idx) => {
            const displayRank = mode === "overall" && hostFilter === "all" ? ep.rank : idx + 1;
            return (
              <Link
                key={ep.epNum}
                href={`/episodes/${ep.slug}`}
                className="flex flex-col gap-4 p-5 hover:bg-white/[0.03] transition sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold tabular-nums ${
                      displayRank <= 3
                        ? "bg-amber-300/15 text-amber-300 ring-1 ring-amber-300/35"
                        : "bg-zinc-950 text-zinc-400 ring-1 ring-white/[0.08]"
                    }`}
                  >
                    #{displayRank}
                  </div>

                  {ep.posterUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={ep.posterUrl}
                      alt={ep.filmTitle || ep.title}
                      className="h-16 w-11 shrink-0 rounded-lg object-cover ring-1 ring-white/15"
                    />
                  ) : null}

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                      <span>EP {ep.epNum}</span>
                      {ep.pickNote ? <span>· {ep.pickNote}</span> : null}
                    </div>
                    <div className="truncate text-base sm:text-lg font-semibold text-white">
                      {ep.filmTitle || ep.title}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
                      {Object.entries(ep.hosts || {}).map(([hk, val]) => (
                        <span
                          key={hk}
                          className="rounded-md bg-zinc-950 px-2 py-0.5 text-zinc-300 ring-1 ring-white/[0.08] capitalize tabular-nums"
                        >
                          {hk}: <strong className="text-white">{val}</strong>
                        </span>
                      ))}
                      {(ep.guests || []).map((g) => (
                        <span
                          key={g.name}
                          className="rounded-md bg-zinc-950 px-2 py-0.5 text-zinc-300 ring-1 ring-white/[0.08] tabular-nums"
                        >
                          {g.name}: <strong className="text-white">{g.score}</strong>
                        </span>
                      ))}
                      {ep.fifthSeatAvg !== null && ep.fifthSeatAvg !== undefined ? (
                        <span className="rounded-md bg-amber-300/10 px-2 py-0.5 text-amber-200 ring-1 ring-amber-300/25 tabular-nums">
                          5th Seat: <strong>{ep.fifthSeatAvg}</strong> ({ep.fifthSeatCount})
                        </span>
                      ) : (
                        <span className="rounded-md bg-white/[0.03] px-2 py-0.5 text-zinc-500">
                          No 5th Seat
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-5 shrink-0 self-end sm:self-center">
                  {ep.patronDelta !== null ? (
                    <div className="text-right tabular-nums">
                      <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                        Patron Δ
                      </div>
                      <div
                        className={`text-xs font-semibold ${
                          ep.patronDelta > 0
                            ? "text-emerald-300"
                            : ep.patronDelta < 0
                              ? "text-rose-300"
                              : "text-zinc-400"
                        }`}
                      >
                        {ep.patronDelta > 0 ? `+${ep.patronDelta}` : ep.patronDelta}
                      </div>
                    </div>
                  ) : null}

                  <div className="rounded-2xl bg-zinc-950 px-4 py-2 text-right ring-1 ring-white/10 tabular-nums">
                    <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                      Official BFE
                    </div>
                    <div className="text-xl font-bold text-amber-300">
                      ★ {ep.combinedScore.toFixed(2)}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
