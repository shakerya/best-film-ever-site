// src/components/WatchProvidersRow.jsx

export default function WatchProvidersRow({ watchProviders, compact = false }) {
  const us = watchProviders?.US;
  const gb = watchProviders?.GB;

  if (!us && !gb) return null;

  const renderRegion = (flag, label, data) => {
    if (!data) return null;
    const providers = data.stream?.length ? data.stream : data.rent || [];
    const modeLabel = data.stream?.length ? "Stream" : "Rent";
    if (!providers.length) return null;

    return (
      <div className="inline-flex flex-wrap items-center gap-2 rounded-2xl bg-white/5 px-3 py-1.5 ring-1 ring-white/10">
        <span className="text-xs font-medium text-white/70">
          {flag} {label} <span className="text-white/45">({modeLabel})</span>:
        </span>
        <div className="flex items-center gap-1.5">
          {providers.slice(0, compact ? 3 : 5).map((p) => (
            <span
              key={p.id || p.name}
              title={p.name}
              className="inline-flex items-center gap-1.5 rounded-lg bg-black/40 px-2 py-0.5 text-xs text-white/90 ring-1 ring-white/10"
            >
              {p.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.logoUrl}
                  alt={p.name}
                  className="h-4 w-4 rounded object-cover"
                  loading="lazy"
                />
              ) : null}
              <span>{p.name}</span>
            </span>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {renderRegion("🇺🇸", "US", us)}
      {renderRegion("🇬🇧", "UK", gb)}
    </div>
  );
}
