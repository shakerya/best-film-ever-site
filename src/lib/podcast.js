import http from "node:http";
import https from "node:https";
import zlib from "node:zlib";
import { XMLParser } from "fast-xml-parser";
import seedEpisodes from "@/data/seedEpisodes.json";
import { getEpisodeNumberIfFullReview } from "@/lib/episodeMeta";
import { HOSTS, parseEpisodeHosts } from "@/lib/hosts";

const RSS_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes in-memory per Fluid instance
let cachedEpisodes = null;
let cachedEpisodesAt = 0;
let inflightRssPromise = null;

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

function fetchTextViaNodeHttp(urlString, timeoutMs = 15000, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn, val) => {
      if (settled) return;
      settled = true;
      fn(val);
    };

    let parsedUrl;
    try {
      parsedUrl = new URL(urlString);
    } catch (err) {
      return finish(reject, err);
    }

    const lib = parsedUrl.protocol === "http:" ? http : https;
    const req = lib.get(
      parsedUrl,
      {
        headers: {
          "User-Agent": "BestFilmEverSite/1.0 (+https://www.bestfilmeverpod.fyi)",
          Accept: "application/rss+xml, application/xml, text/xml, */*",
          "Accept-Encoding": "gzip, deflate",
        },
      },
      (res) => {
        const status = res.statusCode || 0;
        if ([301, 302, 303, 307, 308].includes(status) && res.headers.location) {
          clearTimeout(timer);
          res.resume();
          if (redirectsLeft <= 0) {
            return finish(reject, new Error("Too many RSS redirects"));
          }
          const nextUrl = new URL(res.headers.location, parsedUrl).toString();
          return fetchTextViaNodeHttp(nextUrl, timeoutMs, redirectsLeft - 1).then(
            (v) => finish(resolve, v),
            (e) => finish(reject, e)
          );
        }

        if (status < 200 || status >= 300) {
          clearTimeout(timer);
          res.resume();
          return finish(reject, new Error(`HTTP ${status} ${res.statusMessage || ""}`.trim()));
        }

        const encoding = String(res.headers["content-encoding"] || "").toLowerCase();
        let stream = res;
        if (encoding === "gzip" || encoding === "x-gzip") {
          stream = res.pipe(zlib.createGunzip());
        } else if (encoding === "deflate") {
          stream = res.pipe(zlib.createInflate());
        }

        const chunks = [];
        stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        stream.on("end", () => {
          clearTimeout(timer);
          finish(resolve, Buffer.concat(chunks).toString("utf-8"));
        });
        stream.on("error", (err) => {
          clearTimeout(timer);
          finish(reject, err);
        });
      }
    );

    const timer = setTimeout(() => {
      req.destroy(new Error("RSS request timed out"));
    }, timeoutMs);

    req.on("error", (err) => {
      clearTimeout(timer);
      finish(reject, err);
    });
  });
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

async function fetchAndParseEpisodesFromRss(rssUrl) {
  let xml;
  try {
    xml = await fetchTextViaNodeHttp(rssUrl, 15000);
  } catch (e) {
    if (isNetworkishError(e)) {
      await sleep(350);
      try {
        xml = await fetchTextViaNodeHttp(rssUrl, 15000);
      } catch (e2) {
        console.error("[RSS] fetch failed after retry:", e2);
        return cachedEpisodes || [];
      }
    } else {
      console.error("[RSS] unexpected fetch error:", e);
      return cachedEpisodes || [];
    }
  }

  if (!xml) {
    return cachedEpisodes || [];
  }

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

      const descriptionText = stripHtml(descriptionHtml);

      // Prefer transcript-verified host seats when available; otherwise parse opening roll-call
      const epNum = getEpisodeNumberIfFullReview(title);
      const seededHosts = epNum ? seedEpisodes[String(epNum)]?.hosts : null;
      const hostKeys =
        seededHosts && Object.keys(seededHosts).length > 0
          ? HOSTS.map((h) => h.key).filter((k) => seededHosts[k] !== undefined)
          : parseEpisodeHosts(title, descriptionText);

      return {
        guid: String(item?.guid?.["#text"] ?? item?.guid ?? ""),
        title,
        slug: makeSlug(title),
        pubDate: pubDateRaw,
        isoDate,
        descriptionHtml: String(descriptionHtml ?? ""),
        descriptionText,
        audioUrl,

        // Duration fields
        durationRaw,
        durationSeconds,
        durationPretty,

        // Used by homepage list UI
        image: imageUrl,
        posterUrl: imageUrl,

        hostKeys,
      };
    })
    .filter((ep) => ep.title);

  // newest first
  episodes.sort((a, b) => (b.isoDate || "").localeCompare(a.isoDate || ""));

  if (episodes.length > 0) {
    cachedEpisodes = episodes;
    cachedEpisodesAt = Date.now();
  }

  return episodes;
}

export async function getEpisodesFromRss({ forceFresh = false } = {}) {
  const rssUrlRaw = process.env.PODCAST_RSS_URL;
  if (!rssUrlRaw) throw new Error("Missing PODCAST_RSS_URL in .env.local");

  const now = Date.now();
  if (!forceFresh && cachedEpisodes && now - cachedEpisodesAt < RSS_CACHE_TTL_MS) {
    return cachedEpisodes;
  }

  if (!forceFresh && inflightRssPromise) {
    return inflightRssPromise;
  }

  const rssUrl = String(rssUrlRaw).replace(/^"|"$/g, "").trim();
  inflightRssPromise = fetchAndParseEpisodesFromRss(rssUrl).finally(() => {
    inflightRssPromise = null;
  });

  return inflightRssPromise;
}
