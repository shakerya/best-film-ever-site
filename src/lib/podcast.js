import { XMLParser } from "fast-xml-parser";

function toArray(x) {
  if (!x) return [];
  return Array.isArray(x) ? x : [x];
}

function stripHtml(html) {
  if (!html) return "";
  return String(html)
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function makeSlug(rawTitle) {
  const title = String(rawTitle ?? "").trim();
  if (!title) return "episode";
  return title
    .toLowerCase()
    .replace(/&amp;/g, "and")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function pickAudioUrl(item) {
  // Standard: <enclosure url="...">
  const enclosure = item?.enclosure;
  if (enclosure?.["@_url"]) return enclosure["@_url"];

  // Sometimes: array
  for (const e of toArray(item?.enclosure)) {
    if (e?.["@_url"]) return e["@_url"];
  }

  // Sometimes: media:content
  const media = item?.["media:content"];
  if (media?.["@_url"]) return media["@_url"];
  for (const m of toArray(media)) {
    if (m?.["@_url"]) return m["@_url"];
  }

  return "";
}

function normalizeHttps(url) {
  const u = String(url ?? "").trim();
  if (!u) return "";
  if (u.startsWith("http://")) return "https://" + u.slice("http://".length);
  return u;
}

export async function getEpisodesFromRss() {
  const rssUrl = process.env.PODCAST_RSS_URL;
  if (!rssUrl) throw new Error("Missing PODCAST_RSS_URL in .env.local");

  // KEY: no-store prevents Next from trying (and failing) to cache a >2MB RSS response
  const res = await fetch(rssUrl, { cache: "no-store" });
  if (!res.ok) throw new Error(`RSS fetch failed: ${res.status} ${res.statusText}`);

  const xml = await res.text();

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
  });

  const data = parser.parse(xml);
  const channel = data?.rss?.channel;
  const items = toArray(channel?.item);

  const episodes = items
    .map((item) => {
      const title = String(item?.title ?? "").trim();

      const descriptionHtml =
        item?.["content:encoded"] ?? item?.description ?? item?.["itunes:summary"] ?? "";

      const pubDateRaw = String(item?.pubDate ?? "");
      const pubDate = pubDateRaw ? new Date(pubDateRaw) : null;
      const isoDate = pubDate && !isNaN(pubDate.getTime()) ? pubDate.toISOString() : "";

      const audioUrl = normalizeHttps(pickAudioUrl(item));

      const duration = String(item?.["itunes:duration"] ?? "").trim();

      return {
        guid: String(item?.guid?.["#text"] ?? item?.guid ?? ""),
        title,
        slug: makeSlug(title),
        pubDate: pubDateRaw,
        isoDate,
        descriptionHtml: String(descriptionHtml ?? ""),
        descriptionText: stripHtml(descriptionHtml),
        audioUrl,
        duration,
      };
    })
    .filter((ep) => ep.title);

  // newest first
  episodes.sort((a, b) => (b.isoDate || "").localeCompare(a.isoDate || ""));

  return episodes;
}
