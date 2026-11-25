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
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(d);

  if (diffMs <= 0) return `Recording cutoff passed (${formatted})`;
  const hrs = Math.floor(diffMs / 3600000);
  const days = Math.floor(hrs / 24);
  const remHrs = hrs % 24;
  return days > 0
    ? `Closes in ${days}d ${remHrs}h • ${formatted}`
    : `Closes in ${Math.max(1, hrs)}h • ${formatted}`;
}

export default function FifthSeatBanner({
  film,
  posterUrl,
  isPatron = false,
  fifthSeatCount = 0,
  beetrootSummary = null,
  googleFormLink = null,
}) {
  if (!film) return null;

  const cutoffLabel = formatCutoffLabel(film.cutoffIso);

  return (
    <section className="mt-6 relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-950/60 via-zinc-900/80 to-rose-950/40 p-5 md:p-6 ring-1 ring-emerald-400/25 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-4 md:items-center">
          {posterUrl ? (
            <Link href="/fifth-seat" className="shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={posterUrl}
                alt={film.title}
                className="h-24 w-16 rounded-2xl object-cover ring-1 ring-white/20 shadow-lg hover:scale-[1.03] transition"
              />
            </Link>
          ) : null}

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-400/30">
                🪑 THIS WEEK ON BFE
              </span>
              {film.pickNote ? (
                <span className="inline-flex items-center rounded-full bg-white/10 px-2.5 py-1 text-xs text-white/80 ring-1 ring-white/10">
                  {film.pickNote}
                </span>
              ) : null}
              {beetrootSummary?.beetrootPct !== null && beetrootSummary?.total > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-fuchsia-500/15 px-2.5 py-1 text-xs font-semibold text-fuchsia-200 ring-1 ring-fuchsia-400/30">
                  🥬 {beetrootSummary.beetrootPct}% Beetroot ({beetrootSummary.total} votes)
                </span>
              ) : null}
            </div>

            <h2 className="mt-2 text-2xl md:text-3xl font-semibold text-white">
              {film.title}{" "}
              {film.year ? <span className="text-white/55 font-normal">({film.year})</span> : null}
            </h2>

            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/70">
              {cutoffLabel ? <span>⏳ {cutoffLabel}</span> : null}
              <span>•</span>
              <span className="text-emerald-300/90 font-medium">
                {fifthSeatCount > 0
                  ? `${fifthSeatCount} Patron Fifth-Seat${fifthSeatCount === 1 ? "" : "s"} in`
                  : "Patrons: Fifth-Seat open now"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <Link
            href="/fifth-seat"
            className="inline-flex items-center justify-center rounded-2xl bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-emerald-300 transition"
          >
            {isPatron ? "🪑 Submit Fifth-Seat →" : "🥬 Vote in Poll / Patron 5th Seat →"}
          </Link>

          {isPatron && googleFormLink?.url ? (
            <a
              href={googleFormLink.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-2xl bg-white/10 px-4 py-2.5 text-sm font-medium text-white ring-1 ring-white/15 hover:bg-white/15 transition"
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
