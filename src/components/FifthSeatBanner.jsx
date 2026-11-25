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

  if (diffMs <= 0) return `Recording cutoff passed (${formatted})`;
  const hrs = Math.floor(diffMs / 3600000);
  const days = Math.floor(hrs / 24);
  const remHrs = hrs % 24;
  return days > 0
    ? `Recording Sun, ${formatted} (${days}d ${remHrs}h left)`
    : `Recording Sun, ${formatted} (${Math.max(1, hrs)}h left)`;
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

  return (
    <section className="relative overflow-hidden rounded-3xl bg-zinc-900/70 ring-1 ring-white/[0.10] shadow-[0_24px_60px_rgba(0,0,0,0.5)]">
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

      <div className="relative flex flex-col gap-5 p-5 sm:p-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4 sm:gap-5 min-w-0">
          {posterUrl ? (
            <Link href="/fifth-seat" className="shrink-0 group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={posterUrl}
                alt={film.title}
                className="h-24 w-16 sm:h-28 sm:w-[76px] rounded-2xl object-cover ring-1 ring-white/20 shadow-xl group-hover:scale-[1.02] transition"
              />
            </Link>
          ) : null}

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-amber-300/90">
              <span>Up Next on the Pod</span>
              {film.episodeNum ? (
                <>
                  <span className="text-white/25">•</span>
                  <span className="text-zinc-300">Episode {film.episodeNum}</span>
                </>
              ) : null}
              {hasBeetVotes ? (
                <>
                  <span className="text-white/25">•</span>
                  <span className="text-zinc-200">
                    {beetrootSummary.beetrootPct}% Beetroot ({beetrootSummary.total})
                  </span>
                </>
              ) : null}
            </div>

            <h2 className="mt-1.5 text-2xl sm:text-3xl font-semibold tracking-tight text-white">
              {film.title}{" "}
              {film.year ? <span className="font-normal text-zinc-400">({film.year})</span> : null}
            </h2>

            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400">
              {film.pickNote ? <span className="text-zinc-300">{film.pickNote}</span> : null}
              {film.pickNote && cutoffLabel ? <span className="text-white/20">•</span> : null}
              {cutoffLabel ? <span>{cutoffLabel}</span> : null}
              {fifthSeatCount > 0 ? (
                <>
                  <span className="text-white/20">•</span>
                  <span className="text-amber-300 font-medium">
                    {fifthSeatCount} Patron Fifth-Seat{fifthSeatCount === 1 ? "" : "s"} submitted
                  </span>
                </>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <Link
            href="/fifth-seat"
            className="inline-flex items-center justify-center rounded-full bg-white px-5 py-2.5 text-xs sm:text-sm font-semibold text-zinc-950 hover:bg-zinc-200 transition"
          >
            {isPatron ? "Submit Fifth-Seat →" : "Vote in Poll / Fifth-Seat →"}
          </Link>

          {isPatron && googleFormLink?.url ? (
            <a
              href={googleFormLink.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-full bg-white/[0.07] px-4 py-2.5 text-xs sm:text-sm font-medium text-white ring-1 ring-white/15 hover:bg-white/[0.12] transition"
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
