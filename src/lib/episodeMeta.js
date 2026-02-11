// src/lib/episodeMeta.js

function normalizeSpace(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

// Things that strongly indicate "not a full movie review".
// (We keep this conservative.)
const DISQUALIFY_KEYWORDS = [
  "see it or skip it",
  "siosi",
  "ringside roundtable",
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

// If the remainder *starts* with these, it's definitely not a full review.
// (Hard guardrail)
const STARTS_WITH_NON_REVIEW = [
  "see it or skip it",
  "siosi",
  "ringside roundtable",
  "mailbag",
  "draft",
  "roundtable",
  "interview",
];

/**
 * Remove ONE trailing parenthetical group, but keep (YYYY).
 * Examples:
 *  - "Scream (Bonus Halloween Episode)" -> "Scream"
 *  - "Heat (1995)" -> "Heat (1995)"  (kept)
 */
function stripTrailingNonYearParensOnce(s) {
  const t = normalizeSpace(s);
  if (!t) return "";
  return t.replace(/\s*\((?!\d{4}\)).*?\)\s*$/g, "").trim();
}

function looksLikeNonFullReviewRemainder(remainder) {
  const rRaw = normalizeSpace(remainder);
  const r = rRaw.toLowerCase();
  if (!r) return true;

  // Hard-block if remainder begins with known non-review formats
  if (STARTS_WITH_NON_REVIEW.some((p) => r.startsWith(p))) return true;

  // Important nuance:
  // Many legit movie reviews have trailing notes like "(Bonus Halloween Episode)".
  // So we evaluate disqualifiers on the "main" part with that trailing parens removed.
  const main = stripTrailingNonYearParensOnce(rRaw).toLowerCase();

  // If stripping parens leaves nothing, treat as non-review
  if (!main) return true;

  // If the main part contains strong non-review signals, disqualify.
  // (This keeps "Episode 36 - Scream (Bonus ...)" allowed because main="Scream")
  return DISQUALIFY_KEYWORDS.some((k) => main.includes(k));
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
