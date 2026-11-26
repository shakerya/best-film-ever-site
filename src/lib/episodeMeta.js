// src/lib/episodeMeta.js

function decodeBasicEntities(s) {
  return String(s || "")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&#8217;|&#8216;/gi, "'")
    .replace(/&#8211;|&#8212;/gi, "-");
}

function normalizeSpace(s) {
  return decodeBasicEntities(s).replace(/\s+/g, " ").trim();
}

// Explicit unnumbered full-review titles in the RSS feed (e.g. Ep 121 had its "Episode 121 -" prefix omitted)
const UNNUMBERED_FULL_REVIEWS = {
  "austin powers: international man of mystery": 121,
};

// Non-review show franchises / formats
const NON_REVIEW_FORMATS = [
  "see it or skip it",
  "siosi",
  "ringside roundtable",
  "reel roundtable",
  "rumble roundtable",
  "mailbag",
  "mail bag",
  "mail call",
  "quiz night",
  "media madness",
  "watchalong",
  "watch along",
  "cleared for takeoff",
  "fun sized films",
  "three act structure",
  "who do you think you are",
  "keeping it loki",
  "dancing in the moon knight",
  "dancing it the moon knight",
  "hawkguys",
  "falcon & the weekly soldier",
  "friends of the podcast",
  "cinematic council",
  "off-script",
];

function stripAllTrailingNotes(s) {
  let t = normalizeSpace(s).replace(/\*+$/, "").trim();
  let prev = "";
  while (t !== prev) {
    prev = t;
    t = t
      .replace(/\s*\((?!(?:19|20)\d{2}\))[^()]*\)\s*$/g, "")
      .replace(/\s*\[[^\]]*\]\s*$/g, "")
      .trim();
  }
  return t;
}

function looksLikeNonFullReviewRemainder(remainder) {
  const rRaw = normalizeSpace(remainder);
  const r = rRaw.toLowerCase();
  if (!r) return true;

  if (NON_REVIEW_FORMATS.some((p) => r.startsWith(p))) return true;

  const main = stripAllTrailingNotes(rRaw).toLowerCase();
  if (!main) return true;

  return NON_REVIEW_FORMATS.some((k) => main.includes(k));
}

/**
 * Returns the canonical Episode Number (1..N) if epTitle is a full movie review, or null for Extras.
 */
export function getEpisodeNumberIfFullReview(epTitle) {
  const raw = normalizeSpace(epTitle);
  if (!raw) return null;

  const unnumberedMatch = UNNUMBERED_FULL_REVIEWS[raw.toLowerCase()];
  if (unnumberedMatch) return unnumberedMatch;

  const m = raw.match(/^(episode|ep\.?)\s*(\d{1,4})\s*[-:–—]\s*/i);
  if (!m) return null;

  const num = Number(m[2]);
  if (!Number.isFinite(num) || num <= 0) return null;

  const remainder = raw.slice(m[0].length);
  if (looksLikeNonFullReviewRemainder(remainder)) return null;

  return num;
}

export function isFullReviewEpisode(epTitle) {
  return getEpisodeNumberIfFullReview(epTitle) !== null;
}

export function stripLeadingEpisodeNumber(epTitle) {
  const raw = normalizeSpace(epTitle);
  if (!raw) return "";

  return raw.replace(/^(episode|ep\.?)\s*\d{1,4}\s*[-:–—]\s*/i, "").trim();
}
