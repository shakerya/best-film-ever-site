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
    <div className="space-y-4 sm:space-y-6">
      <div className="space-y-2.5 sm:space-y-0 sm:flex sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
        {/* Single-row scrollable segmented tabs (never wraps into 2 rows inside pill) */}
        <div className="flex items-center gap-1 overflow-x-auto rounded-full bg-zinc-900 p-1 ring-1 ring-white/[0.08] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {[
            { key: "overall", label: "Combined Score" },
            { key: "splits", label: "Host vs. Patron" },
            { key: "patrons", label: "Top 5th Seat" },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setMode(tab.key)}
              className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                mode === tab.key
                  ? "bg-white text-zinc-950 font-semibold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Single-row scrollable host filter pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onClick={() => setHostFilter("all")}
            className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition ${
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
              className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition ${
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

      <div className="overflow-hidden rounded-2xl sm:rounded-3xl bg-zinc-900/55 ring-1 ring-white/[0.08]">
        <div className="divide-y divide-white/[0.06]">
          {filtered.map((ep, idx) => {
            const displayRank = mode === "overall" && hostFilter === "all" ? ep.rank : idx + 1;
            const subLine = [`EP ${ep.epNum}`, ep.pickNote || ""].filter(Boolean).join(" · ");

            return (
              <Link
                key={ep.epNum}
                href={`/episodes/${ep.slug}`}
                className="block p-4 sm:p-5 hover:bg-white/[0.03] transition"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold tabular-nums ${
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
                        className="h-14 w-10 sm:h-16 sm:w-11 shrink-0 rounded-lg object-cover ring-1 ring-white/15"
                      />
                    ) : null}

                    <div className="min-w-0">
                      <div className="truncate text-[11px] sm:text-xs text-zinc-500">{subLine}</div>
                      <div className="truncate text-[15px] sm:text-lg font-semibold text-white">
                        {ep.filmTitle || ep.title}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {ep.patronDelta !== null ? (
                      <div className="hidden sm:block text-right tabular-nums">
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

                    <div className="rounded-xl sm:rounded-2xl bg-zinc-950 px-3 py-1.5 sm:px-4 sm:py-2 text-right ring-1 ring-white/10 tabular-nums">
                      <div className="text-[9px] sm:text-[10px] uppercase tracking-wider text-zinc-500">
                        BFE
                      </div>
                      <div className="text-base sm:text-xl font-bold text-amber-300">
                        ★ {ep.combinedScore.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Full-width score breakdown chips underneath (no cramped bottom-left void!) */}
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px] sm:text-xs">
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
                  ) : null}
                  {ep.patronDelta !== null ? (
                    <span
                      className={`sm:hidden rounded-md bg-zinc-950 px-2 py-0.5 ring-1 ring-white/[0.06] tabular-nums font-medium ${
                        ep.patronDelta > 0
                          ? "text-emerald-300"
                          : ep.patronDelta < 0
                            ? "text-rose-300"
                            : "text-zinc-400"
                      }`}
                    >
                      Δ {ep.patronDelta > 0 ? `+${ep.patronDelta}` : ep.patronDelta}
                    </span>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
