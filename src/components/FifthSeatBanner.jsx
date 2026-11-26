// src/components/FifthSeatBanner.jsx
import Link from "next/link";

function formatCutoffLabel(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diffMs = d.getTime() - Date.now();
  const formatted = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(d);

  if (diffMs <= 0) return `Cutoff passed (${formatted})`;
  const hrs = Math.floor(diffMs / 3600000);
  const days = Math.floor(hrs / 24);
  const remHrs = hrs % 24;
  return days > 0
    ? `Recording ${formatted} (${days}d ${remHrs}h left)`
    : `Recording ${formatted} (${Math.max(1, hrs)}h left)`;
}

export default function FifthSeatBanner({
  film,
  posterUrl,
  backdropUrl = "",
  isPatron = false,
  fifthSeatCount = 0,
  beetrootSummary = null,
  googleFormLink = null,
}) {
  if (!film) return null;

  const cutoffLabel = formatCutoffLabel(film.cutoffIso);
  const hasBeetVotes = beetrootSummary?.beetrootPct !== null && (beetrootSummary?.total || 0) > 0;
  const eyebrow = [
    "Up Next",
    film.episodeNum ? `EP ${film.episodeNum}` : "",
    hasBeetVotes ? `${beetrootSummary.beetrootPct}% Beetroot` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-zinc-900/70 ring-1 ring-white/[0.10] shadow-[0_20px_50px_rgba(0,0,0,0.45)]">
      {backdropUrl ? (
        <div className="pointer-events-none absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={backdropUrl}
            alt=""
            className="h-full w-full object-cover opacity-20"
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/95 via-zinc-950/85 to-zinc-950/65" />
        </div>
      ) : null}

      <div className="relative flex flex-col gap-4 p-4 sm:p-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start sm:items-center gap-3.5 sm:gap-5 min-w-0">
          {posterUrl ? (
            <Link href="/fifth-seat" className="shrink-0 group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={posterUrl}
                alt={film.title}
                className="h-24 w-16 sm:h-28 sm:w-[76px] rounded-xl sm:rounded-2xl object-cover ring-1 ring-white/20 shadow-xl group-hover:scale-[1.02] transition"
              />
            </Link>
          ) : null}

          <div className="min-w-0 flex-1">
            <div className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-300/95">
              {eyebrow}
            </div>

            <h2 className="mt-1 text-xl sm:text-3xl font-semibold tracking-tight leading-snug text-white">
              {film.title}{" "}
              {film.year ? <span className="font-normal text-zinc-400">({film.year})</span> : null}
            </h2>

            {film.pickNote ? (
              <div className="mt-1 text-xs text-zinc-300 line-clamp-1">{film.pickNote}</div>
            ) : null}

            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] sm:text-xs text-zinc-400">
              {cutoffLabel ? <span>{cutoffLabel}</span> : null}
              {fifthSeatCount > 0 ? (
                <span className="rounded-full bg-amber-300/10 px-2 py-0.5 text-[11px] font-medium text-amber-300 ring-1 ring-amber-300/25">
                  {fifthSeatCount} Fifth-Seat{fifthSeatCount === 1 ? "" : "s"} in
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Link
            href="/fifth-seat"
            className="inline-flex items-center justify-center rounded-full bg-white px-4 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-semibold text-zinc-950 hover:bg-zinc-200 transition"
          >
            {isPatron ? "Submit Fifth-Seat →" : "Vote in Poll / Fifth-Seat →"}
          </Link>

          {isPatron && googleFormLink?.url ? (
            <a
              href={googleFormLink.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-full bg-white/[0.07] px-3.5 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-medium text-white ring-1 ring-white/15 hover:bg-white/[0.12] transition"
              title="Submit using Google Forms"
            >
              Google Form ↗
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}
