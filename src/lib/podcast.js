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

function pickImageUrl(item, channel) {
  // 1) Episode-specific iTunes image: <itunes:image href="..."/>
  const itunesImg = item?.["itunes:image"];
  if (itunesImg?.["@_href"]) return itunesImg["@_href"];

  // 2) media:thumbnail url="..."
  const thumb = item?.["media:thumbnail"];
  if (thumb?.["@_url"]) return thumb["@_url"];
  for (const t of toArray(thumb)) {
    if (t?.["@_url"]) return t["@_url"];
  }

  // 3) media:content that is an image
  const media = item?.["media:content"];
  for (const m of toArray(media)) {
    const type = String(m?.["@_type"] ?? "");
    const url = m?.["@_url"];
    if (url && type.startsWith("image/")) return url;
  }

  // 4) RSS <image><url>...</url></image>
  const itemImageUrl = item?.image?.url;
  if (itemImageUrl) return itemImageUrl;

  // 5) Channel-level iTunes image fallback
  const chItunes = channel?.["itunes:image"];
  if (chItunes?.["@_href"]) return chItunes["@_href"];

  const chImageUrl = channel?.image?.url;
  if (chImageUrl) return chImageUrl;

  return "";
}

// ---- Duration parsing/formatting ----
// itunes:duration can be:
// - seconds as a number string: "12348"
// - "HH:MM:SS" or "H:MM:SS"
// - "MM:SS"
function parseItunesDurationToSeconds(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return 0;

  // Pure seconds
  if (/^\d+$/.test(s)) return Number(s) || 0;

  // Colon formats
  if (s.includes(":")) {
    const parts = s.split(":").map((p) => p.trim());
    if (parts.some((p) => p === "" || !/^\d+$/.test(p))) return 0;

    const nums = parts.map((p) => Number(p));
    if (nums.some((n) => !Number.isFinite(n))) return 0;

    if (nums.length === 2) {
      const [mm, ss] = nums;
      return mm * 60 + ss;
    }
    if (nums.length === 3) {
      const [hh, mm, ss] = nums;
      return hh * 3600 + mm * 60 + ss;
    }
  }

  return 0;
}

function formatDurationPretty(seconds) {
  const sec = Number(seconds);
  if (!Number.isFinite(sec) || sec <= 0) return "";

  const totalMinutes = Math.floor(sec / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;

  if (h <= 0) return `${m}m`;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

function isNetworkishError(err) {
  const msg = String(err?.message || "");
  const code = String(err?.cause?.code || err?.code || "");
  return (
    code === "ENOTFOUND" ||
    code === "EAI_AGAIN" ||
    code === "ECONNRESET" ||
    code === "ETIMEDOUT" ||
    msg.includes("fetch failed") ||
    msg.includes("ENOTFOUND") ||
    msg.includes("EAI_AGAIN") ||
    msg.includes("timed out") ||
    msg.includes("aborted")
  );
}

export async function getEpisodesFromRss() {
  const rssUrlRaw = process.env.PODCAST_RSS_URL;
  if (!rssUrlRaw) throw new Error("Missing PODCAST_RSS_URL in .env.local");

  const rssUrl = String(rssUrlRaw).replace(/^"|"$/g, "").trim();

  // no-store prevents Next from trying (and failing) to cache a >2MB RSS response
  // Add timeout + retry to avoid dev-only DNS hiccups taking down the whole page.
  let res;
  try {
    res = await fetchWithTimeout(rssUrl, { cache: "no-store" }, 15000);
  } catch (e) {
    if (isNetworkishError(e)) {
      // one short retry
      await sleep(350);
      try {
        res = await fetchWithTimeout(rssUrl, { cache: "no-store" }, 15000);
      } catch (e2) {
        console.error("[RSS] fetch failed after retry:", e2);
        return [];
      }
    } else {
      throw e;
    }
  }

  if (!res || !res.ok) {
    const status = res ? `${res.status} ${res.statusText}` : "no response";
    console.error("[RSS] fetch not ok:", status);
    return [];
  }

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

      const durationRaw = String(item?.["itunes:duration"] ?? "").trim();
      const durationSeconds = parseItunesDurationToSeconds(durationRaw);
      const durationPretty = formatDurationPretty(durationSeconds);

      const imageUrl = normalizeHttps(pickImageUrl(item, channel));

      return {
        guid: String(item?.guid?.["#text"] ?? item?.guid ?? ""),
        title,
        slug: makeSlug(title),
        pubDate: pubDateRaw,
        isoDate,
        descriptionHtml: String(descriptionHtml ?? ""),
        descriptionText: stripHtml(descriptionHtml),
        audioUrl,

        // Duration fields
        durationRaw,
        durationSeconds,
        durationPretty,

        // Used by homepage list UI
        image: imageUrl,
        posterUrl: imageUrl,
      };
    })
    .filter((ep) => ep.title);

  // newest first
  episodes.sort((a, b) => (b.isoDate || "").localeCompare(a.isoDate || ""));

  return episodes;
}
