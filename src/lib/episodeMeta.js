// src/lib/episodeMeta.js

function normalizeSpace(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

const DISQUALIFY_KEYWORDS = [
  // Non-full-review categories / formats
  "see it or skip it",
  "siosi",
  "ringside roundtable",
  "bonus",
  "patreon",
  "mailbag",
  "draft",
  "q&a",
  "q & a",
  "rankings",
  "roundtable",
  "interview",
  "trailer",
  "announcement",
  "special",
  "preview",
  "predictions",
  "oscars",
  "golden globes",
  "awards",
  "wrap-up",
  "wrap up",
  "best of",
  "worst of",
];

function looksLikeNonFullReviewRemainder(remainderLower) {
  const r = normalizeSpace(remainderLower).toLowerCase();
  if (!r) return true;

  // If the remainder itself starts with a known non-review prefix
  const starts = [
    "see it or skip it",
    "siosi",
    "ringside roundtable",
    "bonus",
    "patreon",
  ];
  if (starts.some((p) => r.startsWith(p))) return true;

  // If it contains strong non-review signals
  return DISQUALIFY_KEYWORDS.some((k) => r.includes(k));
}

/**
 * Conservative rule:
 * - Only return an episode number if title starts like:
 *   "Episode 315 - ..." or "Ep 315: ..." (dashes/colons ok)
 * - And the remainder does NOT look like a non-full-review episode.
 */
export function getEpisodeNumberIfFullReview(epTitle) {
  const raw = normalizeSpace(epTitle);
  if (!raw) return null;

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
