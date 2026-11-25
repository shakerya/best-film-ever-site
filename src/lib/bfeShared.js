// src/lib/bfeShared.js
// Client-safe constants & pure helpers (no Node fs imports)

export const BFE_LINKS = {
  patreon: "https://www.patreon.com/cw/BFE",
  podbean: "https://bestfilmever.podbean.com/",
  apple: "https://podcasts.apple.com/gb/podcast/best-film-ever/id1508926029",
  spotify: "https://open.spotify.com/show/211kE9cGEsEm",
  xProfile: "https://x.com/bestfilmeverpod",
  xGroupChat: "https://x.com/i/chat/g1480184450503913473",
  xGifThreadSearch:
    "https://x.com/search?q=from%3Abestfilmeverpod%20%23BFERandomWord&src=typed_query&f=live",
};

/**
 * Converts common Giphy page URLs into direct .gif image URLs if pasted by users,
 * and cleans whitespace.
 */
export function coerceDirectGifUrl(rawUrl) {
  const s = String(rawUrl || "").trim();
  if (!s) return "";
  const giphyPage = s.match(/^https?:\/\/(?:www\.)?giphy\.com\/gifs\/(?:.*-)?([a-zA-Z0-9]+)\/?(?:\?.*)?$/);
  if (giphyPage) {
    return `https://media.giphy.com/media/${giphyPage[1]}/giphy.gif`;
  }
  return s;
}

/**
 * Produces a canonical deduplication key across Giphy and Tenor CDN variants
 * (e.g. Tenor's AAAAC vs AAAAM suffixes share the same 11-char base ID).
 */
export function normalizeGifKey(url) {
  const s = String(url || "").trim();
  if (!s) return "";

  const giphyMatch =
    s.match(/media\d*\.giphy\.com\/media\/(?:v1\.[^/]+\/)?([^/?#]+)/i) ||
    s.match(/giphy\.com\/gifs\/(?:.*-)?([a-z0-9]+)$/i);
  if (giphyMatch) return `giphy:${giphyMatch[1].toLowerCase()}`;

  const tenorMatch = s.match(
    /media\d*\.tenor\.com\/(?:m\/)?([A-Za-z0-9_-]{8,}?)(?:AAAA[A-Za-z0-9])?\/([^/?#]+)/i
  );
  if (tenorMatch) {
    return `tenor:${tenorMatch[1].toLowerCase()}`;
  }

  return s.toLowerCase().replace(/^https?:\/\//, "").replace(/[?#].*$/, "");
}

export function extractXStatusId(url) {
  const m = String(url || "").match(/(?:x\.com|twitter\.com)\/[^/]+\/status\/(\d{10,25})/i);
  return m ? m[1] : "";
}
