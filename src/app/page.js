// src/app/page.js
import Link from "next/link";
import { getEpisodesFromRss } from "@/lib/podcast";

export const revalidate = 3600; // 1 hour

function formatDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return "";
  }
}

export default async function Home() {
  const episodes = await getEpisodesFromRss();

  return (
    <main style={{ fontFamily: "system-ui, -apple-system, Arial", padding: 24, maxWidth: 980, margin: "0 auto" }}>
      <h1 style={{ fontSize: 56, margin: "20px 0 6px" }}>Best Film Ever</h1>
      <p style={{ opacity: 0.75, marginTop: 0 }}>Automatically pulled from the podcast RSS feed.</p>

      <hr style={{ opacity: 0.2, margin: "22px 0" }} />

      <h2 style={{ fontSize: 32, margin: "0 0 14px" }}>Episodes</h2>

      <div style={{ display: "grid", gap: 16 }}>
        {episodes.map((ep) => (
          <div
            key={ep.guid || ep.slug}
            style={{
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 18,
              padding: 18,
              background: "rgba(255,255,255,0.03)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "baseline" }}>
              <h3 style={{ margin: 0, fontSize: 24 }}>{ep.title}</h3>
            </div>

            <div style={{ opacity: 0.7, marginTop: 6 }}>Published: {formatDate(ep.publishedIso)}</div>

            {ep.descriptionText ? (
              <p style={{ opacity: 0.85, marginTop: 10, lineHeight: 1.5 }}>
                {ep.descriptionText.slice(0, 220)}
                {ep.descriptionText.length > 220 ? "…" : ""}
              </p>
            ) : null}

            <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
              <Link
                href={`/episodes/${ep.slug}`}
                style={{
                  display: "inline-block",
                  padding: "8px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.18)",
                  textDecoration: "none",
                }}
              >
                Episode page →
              </Link>

              {ep.enclosureUrl ? (
                <audio controls preload="none" style={{ width: "100%", maxWidth: 720 }}>
                  <source src={ep.enclosureUrl} />
                </audio>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
