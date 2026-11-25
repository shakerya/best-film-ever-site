// src/lib/bfeShared.js
// Client-safe constants & pure helpers (no Node fs imports)

export const BFE_LINKS = {
  patreon: "https://www.patreon.com/cw/BFE",
  podbean: "https://bestfilmever.podbean.com/",
  apple: "https://podcasts.apple.com/gb/podcast/best-film-ever/id1508926029",
  spotify: "https://open.spotify.com/show/211kE9cGEsEm",
  xProfile: "https://x.com/bestfilmeverpod",
  xGroupChat: "https://x.com/i/chat/g1480184450503913473",
};

export function normalizeGifKey(url) {
  const s = String(url || "").trim().toLowerCase();
  if (!s) return "";
  const giphyMatch =
    s.match(/media\.giphy\.com\/media\/([^/?#]+)/) ||
    s.match(/giphy\.com\/gifs\/(?:.*-)?([a-z0-9]+)$/i);
  if (giphyMatch) return `giphy:${giphyMatch[1].toLowerCase()}`;
  return s.replace(/^https?:\/\//, "").replace(/[?#].*$/, "");
}
