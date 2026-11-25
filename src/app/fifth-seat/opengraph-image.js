// src/app/fifth-seat/opengraph-image.js
import { ImageResponse } from "next/og";
import { readBfeState, computeBeetrootSummary } from "@/lib/bfeStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const state = readBfeState();
  const active =
    state.schedule.find((s) => s.status === "open") || state.schedule[0] || {
      title: "This Week's Film",
      year: "",
      pickNote: "Best Film Ever Podcast",
    };
  const beet = computeBeetrootSummary(state.beetroot?.[active.id]);
  const fullTitle = active.year ? `${active.title} (${active.year})` : String(active.title || "");
  const beetLabel =
    beet.beetrootPct !== null ? `${beet.beetrootPct}% Beetroot Metric` : "Vote Now";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "56px 64px",
          background: "linear-gradient(135deg, #09090b 0%, #064e3b 55%, #4c0519 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              background: "rgba(52, 211, 153, 0.18)",
              border: "1px solid rgba(52, 211, 153, 0.45)",
              borderRadius: "999px",
              padding: "10px 22px",
              fontSize: 22,
              fontWeight: 700,
              color: "#6ee7b7",
            }}
          >
            BEST FILM EVER • WEEKLY #BFEPOLL & FIFTH-SEAT
          </div>
          <div
            style={{
              display: "flex",
              background: "rgba(232, 121, 249, 0.2)",
              border: "1px solid rgba(232, 121, 249, 0.45)",
              borderRadius: "999px",
              padding: "10px 22px",
              fontSize: 22,
              fontWeight: 700,
              color: "#f5d0fe",
            }}
          >
            {beetLabel}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 28, color: "rgba(255,255,255,0.72)", marginBottom: 10 }}>
            We’re recording this week on:
          </div>
          <div style={{ display: "flex", fontSize: 74, fontWeight: 800, lineHeight: 1.05 }}>
            {fullTitle}
          </div>
          <div style={{ display: "flex", fontSize: 26, color: "#a7f3d0", marginTop: 14 }}>
            {String(active.pickNote || "Cast your Patron 1–10 Fifth-Seat or vote below!")}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: "16px" }}>
            {["Great Film", "Good Film", "OK Film", "Poor Film"].map((label) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  background: "rgba(255,255,255,0.12)",
                  border: "1px solid rgba(255,255,255,0.22)",
                  borderRadius: "18px",
                  padding: "14px 24px",
                  fontSize: 24,
                  fontWeight: 700,
                }}
              >
                {label}
              </div>
            ))}
          </div>

          <div style={{ display: "flex", fontSize: 24, fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>
            bestfilmeverpod.fyi/fifth-seat
          </div>
        </div>
      </div>
    ),
    size
  );
}
