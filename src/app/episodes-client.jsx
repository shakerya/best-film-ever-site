"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

function formatDate(isoOrPubDate) {
  if (!isoOrPubDate) return "";
  const d = new Date(isoOrPubDate);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function toHMS(secondsLike) {
  const n = Number(secondsLike);
  if (!Number.isFinite(n) || n <= 0) return "";
  const s = Math.floor(n);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${ss}s`;
}

function cleanSnippet(s) {
  return String(s || "")
    .replace(/<[^>]*>/g, "") // strip any HTML
    .replace(/\s+/g, " ")
    .trim();
}

export default function EpisodesClient({ episodes }) {
  const [q, setQ] = useState("");
  const [showSnippets, setShowSnippets] = useState(false);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return episodes;

    return episodes.filter((ep) => {
      const title = String(ep.title || "").toLowerCase();
      const desc = String(ep.descriptionText || "").toLowerCase();
      return title.includes(query) || desc.includes(query);
    });
  }, [episodes, q]);

  return (
    <section>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-zinc-50">
            Episodes{" "}
            <span className="ml-2 text-sm font-normal text-zinc-300/80">
              ({filtered.length})
            </span>
          </h2>
          <p className="mt-1 text-sm text-zinc-300/80">
            Poster-first list. Search works across title + notes.
          </p>
        </div>

        <div className="flex w-full flex-col gap-3 sm:w-[38rem] sm:flex-row sm:items-center sm:justify-end">
          <label className="flex items-center gap-2 text-xs text-zinc-300/80">
            <input
              type="checkbox"
              checked={showSnippets}
              onChange={(e) => setShowSnippets(e.target.checked)}
              className="h-4 w-4 accent-zinc-200"
            />
            Show note preview
          </label>

          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search episodes…"
            className="
              w-full rounded-2xl border border-white/10
              bg-white/10 px-5 py-3 text-sm text-zinc-50
              placeholder:text-zinc-300/50 outline-none
              backdrop-blur focus:border-white/20 focus:bg-white/15
            "
          />
        </div>
      </div>

      {/* LIST */}
      <div className="divide-y divide-white/10 overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur">
        {filtered.map((ep) => {
          const date = formatDate(ep.isoDate || ep.pubDate);
          const durationPretty =
            toHMS(ep.duration) || (ep.duration ? String(ep.duration) : "");
          const snippet = cleanSnippet(ep.descriptionText);

          // Optional fields if you already attach TMDB data to each ep:
          // ep.movie?.posterUrl, ep.movie?.title, ep.movie?.year
          const posterUrl =
            ep.posterUrl || ep.movie?.posterUrl || ep.image || null;

          return (
            <Link
              key={ep.slug}
              href={`/episodes/${ep.slug}`}
              className="group flex gap-4 p-4 hover:bg-white/5 sm:gap-5 sm:p-5"
            >
              {/* Poster */}
              <div className="shrink-0">
                <div
                  className="
                    h-[84px] w-[56px] overflow-hidden rounded-xl
                    border border-white/10 bg-white/5
                    shadow-sm
                  "
                >
                  {posterUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={posterUrl}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] text-zinc-400">
                      No poster
                    </div>
                  )}
                </div>
              </div>

              {/* Main */}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-base font-semibold text-zinc-50 sm:text-lg">
                      {ep.title}
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-300/80">
                      {date ? (
                        <span className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1">
                          {date}
                        </span>
                      ) : null}

                      {durationPretty ? (
                        <span className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1">
                          {durationPretty}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="shrink-0 rounded-2xl border border-white/10 bg-white/10 px-3 py-1.5 text-xs text-zinc-100 group-hover:bg-white/15">
                    Open →
                  </div>
                </div>

                {showSnippets && snippet ? (
                  <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-zinc-200/90">
                    {snippet}
                  </p>
                ) : null}
              </div>
            </Link>
          );
        })}

        {filtered.length === 0 ? (
          <div className="p-6 text-sm text-zinc-200">
            No matches. Try a different search.
          </div>
        ) : null}
      </div>
    </section>
  );
}
