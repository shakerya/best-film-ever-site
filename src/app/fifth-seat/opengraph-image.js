// src/app/fifth-seat/opengraph-image.js
import { ImageResponse } from "next/og";
import { readBfeState, computeBeetrootSummary } from "@/lib/bfeStore";
import { getMovieByIdCached, tmdbImageUrl } from "@/lib/tmdb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const state = await readBfeState();
  const active =
    state.schedule.find((s) => s.status === "open") || state.schedule[0] || {
      title: "Little Shop of Horrors",
      year: "1986",
      tmdbId: 10776,
      pickNote: "Best Film Ever Podcast",
    };

  let posterUrl = "";
  if (active.tmdbId) {
    const details = await getMovieByIdCached(active.tmdbId).catch(() => null);
    posterUrl = details?.poster_path ? tmdbImageUrl(details.poster_path, "w500") : "";
  }

  const beet = computeBeetrootSummary(state.beetroot?.[active.id]);
  const fullTitle = active.year ? `${active.title} (${active.year})` : String(active.title || "");
  const statusPill =
    beet.beetrootPct !== null && beet.total > 0
      ? `${beet.beetrootPct}% Beetroot Metric`
      : `Episode ${active.episodeNum || ""} • Vote Open`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "stretch",
          justifyContent: "space-between",
          padding: "48px 56px",
          background: "linear-gradient(135deg, #09090b 0%, #18181b 60%, #27272a 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        {posterUrl ? (
          <div
            style={{
              display: "flex",
              width: "340px",
              height: "510px",
              borderRadius: "24px",
              overflow: "hidden",
              border: "2px solid rgba(255,255,255,0.16)",
              marginRight: "48px",
              flexShrink: 0,
            }}
          >
            <img
              src={posterUrl}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
        ) : null}

        <div
          style={{
            display: "flex",
            flex: 1,
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "8px 0",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "#e11d48",
                  borderRadius: "10px",
                  padding: "6px 12px",
                  fontSize: 20,
                  fontWeight: 900,
                }}
              >
                BFE
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: 20,
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  color: "#fcd34d",
                }}
              >
                BEST FILM EVER • #BFEPOLL
              </div>
            </div>

            <div
              style={{
                display: "flex",
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.16)",
                borderRadius: "999px",
                padding: "8px 18px",
                fontSize: 18,
                fontWeight: 600,
                color: "#e4e4e7",
              }}
            >
              {statusPill}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 24, color: "#a1a1aa", marginBottom: 10 }}>
              Put out a fleece — what’s your verdict on:
            </div>
            <div style={{ display: "flex", fontSize: 58, fontWeight: 800, lineHeight: 1.06 }}>
              {fullTitle}
            </div>
            <div style={{ display: "flex", fontSize: 22, color: "#d4d4d8", marginTop: 14 }}>
              {String(active.pickNote || "Cast your 1-tap Beetroot vote or Patron Fifth-Seat score")}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            <div style={{ display: "flex", gap: "12px" }}>
              {["Great Film", "Good Film", "OK Film", "Poor Film"].map((label) => (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    background: "rgba(255,255,255,0.09)",
                    border: "1px solid rgba(255,255,255,0.18)",
                    borderRadius: "14px",
                    padding: "12px 20px",
                    fontSize: 20,
                    fontWeight: 700,
                  }}
                >
                  {label}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", fontSize: 20, fontWeight: 600, color: "#fcd34d" }}>
              Vote now at bestfilmeverpod.fyi/fifth-seat →
            </div>
          </div>
        </div>
      </div>
    ),
    size
  );
}
