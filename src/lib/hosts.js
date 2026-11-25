// src/lib/hosts.js

export const HOSTS = [
  { key: "ian", name: "Ian", image: "/hosts/Ian.png" },
  { key: "liam", name: "Liam", image: "/hosts/Liam.png" },
  { key: "megan", name: "Megan", image: "/hosts/Megan.png" },
  { key: "kevin", name: "Kevin", image: "/hosts/Kevin.png" },
  { key: "georgia", name: "Georgia", image: "/hosts/Georgia.png" },
];

const BY_KEY = new Map(HOSTS.map((h) => [h.key, h]));

const ALIASES = [
  { key: "ian", patterns: ["ian"] },
  { key: "liam", patterns: ["liam"] },
  { key: "megan", patterns: ["megan", "meg", "megs"] },
  { key: "kevin", patterns: ["kevin", "kev", "kev-dog", "kevdog"] },
  { key: "georgia", patterns: ["georgia"] },
];

// Guard common celebrity/place collisions when falling back to general intro sentences
const NON_HOST_COLLISIONS = [
  /\bliam\s+(?:neeson|hemsworth|cunningham|gallagher|aikman)\b/gi,
  /\bkevin\s+(?:spacey|bacon|costner|kline|smith|hart|pollak|corrigan|dunn|mccarthy|feige|james)\b/gi,
  /\bmeg\s+(?:ryan|tilly|foster|donnelly)\b/gi,
  /\bmegan\s+(?:fox|mullally)\b/gi,
  /\bian\s+(?:mckellen|holm|fleming|mcshane|mcdiarmid|ziring)\b/gi,
  /\b(?:in|of|from|to|across|state of|atlanta,?)\s+georgia\b/gi,
];

const ABSENCE_SENTENCE_RE =
  /\b(?:isn't with us|is not with us|aren't with us|are not with us|not with us|is off\b|are off\b|takes? the week off|taking the week off|away this week|sitting this one out|sat this one out|had other plans|make other plans|couldn't make it|wanted to join|trapped in|had even less patience|took one look|refusing to answer)\b/i;

function normalizeText(s) {
  let out = String(s || "")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;|&apos;|[’‘]/g, "'")
    .replace(/&quot;|[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim();

  for (const re of NON_HOST_COLLISIONS) {
    out = out.replace(re, " ");
  }
  return out;
}

function stripAbsentParentheticals(s) {
  return s.replace(/\(([^)]*)\)/g, (_full, inner) => {
    const trimmed = String(inner || "").trim();
    if (/^(?:w\/|with\b|feat\.?\b|joined by\b)/i.test(trimmed)) {
      return ` ${trimmed} `;
    }
    return " ";
  });
}

function hasWord(haystackLower, wordLower) {
  const escaped = wordLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(^|[^a-z])${escaped}([^a-z]|$)`, "i");
  return re.test(haystackLower);
}

function matchAliases(text) {
  const lower = String(text || "").toLowerCase();
  const found = new Set();
  for (const a of ALIASES) {
    for (const p of a.patterns) {
      if (hasWord(lower, p)) {
        found.add(a.key);
        break;
      }
    }
  }
  return HOSTS.map((h) => h.key).filter((k) => found.has(k));
}

/**
 * Accurately extracts which BFE hosts actually appeared on an episode from its
 * RSS title + description without false positives from Ian's "X isn't with us
 * this week" running gag, parenthetical absence jokes, or actor names.
 */
export function parseEpisodeHosts(title, descriptionText = "") {
  const cleanTitle = normalizeText(title);
  const cleanDesc = stripAbsentParentheticals(normalizeText(descriptionText));
  const head = cleanDesc.slice(0, 950);

  // 1) Explicit "solo mission ... Ian takes the lead"
  if (/\bsolo mission\b/i.test(head) && /\bian\b/i.test(head)) {
    return ["ian"];
  }

  const rollCallSnippets = [cleanTitle];

  // 2) Imperative "Join <Hosts>..." or "Catch <Hosts>..." at sentence/clause start
  const joinRe = /(?:^|[.!?""\n:;—–-]\s*)(?:Join|Catch)\s+([^.!?\n]{3,240})/gi;
  let m;
  while ((m = joinRe.exec(head)) !== null) {
    let clause = m[1];
    // Ignore "Catch more from..." promo lines
    if (/^more\s+(?:of|from)\b/i.test(clause.trim())) continue;
    clause = clause.split(
      /\b(?:as we|as they|as he|for our|for a|for the|to discuss|to review|to break|to talk|around the|while we|where we|who are|in our)\b/i
    )[0];
    rollCallSnippets.push(clause);
  }

  // 3) See It or Skip It?: "this time Ian is joined by Kev and Megs..." / "this time Ian and Liam..."
  const thisTimeMatch = head.match(
    /\bthis time\s+([^.!?\n]{3,160}?)(?=\s+\b(?:as they|as we|to tackle|are tackling|are trading|are here|taking on|is taking on|swing|head|set sail|leap|dive|click|dust)\b|[.!?\n])/i
  );
  if (thisTimeMatch) {
    rollCallSnippets.push(thisTimeMatch[1]);
  }

  // 4) Reel Roundtable / Fantasy Draft roll calls ("We've got your BFE favourites - Ian, Liam, and KevDog")
  const roundtableMatch = head.match(
    /\bReel Roundtable[^.!?\n]*[.!]\s*([^.!?\n]{3,160}?)(?=\s+\b(?:look back|revisit|discuss|break down|take on|debate|sit down|gather)\b|[.!?\n])/i
  );
  if (roundtableMatch) {
    rollCallSnippets.push(roundtableMatch[1]);
  }
  const weveGotMatch = head.match(
    /\bWe've got[^.!?\n]{0,60}?[-–:]\s*([^.!?\n]{3,140}?)(?=\s*,?\s*\b(?:drafting|discussing|reviewing|breaking|talking)\b|[.!?\n])/i
  );
  if (weveGotMatch) {
    rollCallSnippets.push(weveGotMatch[1]);
  }

  // 5) Late Endgame joiner ("joins Liam later for the Endgame")
  const endgameJoin = head.match(/([^.!?\n]{0,70})\bjoins\b([^.!?\n]{0,50})\bfor the endgame/i);
  if (endgameJoin) {
    rollCallSnippets.push(endgameJoin[0]);
  }

  if (rollCallSnippets.length > 1) {
    const matched = matchAliases(rollCallSnippets.join(" | "));
    if (matched.length > 0) return matched;
  }

  // 6) Fallback for older/special episodes: check opening 2 non-absence, non-question sentences
  const openingSentences = head
    .slice(0, 480)
    .split(/(?<=[.!?])\s+/)
    .filter((s) => !s.trim().endsWith("?") && !ABSENCE_SENTENCE_RE.test(s));

  const fallbackMatched = matchAliases(`${cleanTitle} | ${openingSentences.slice(0, 2).join(" ")}`);
  if (fallbackMatched.length > 0) return fallbackMatched;

  // 7) First-person BFE specials (e.g. Media Madness hosted by Ian with BFE patrons)
  if (/\b(?:media madness|joined by some of our friends of the podcast)\b/i.test(head)) {
    return ["ian"];
  }

  return [];
}

// Legacy alias kept for compatibility
export function parseHostKeysFromText(text) {
  return parseEpisodeHosts("", text);
}

export function hostsForKeys(keys) {
  const list = Array.isArray(keys) ? keys : [];
  const uniq = new Set(list.map((k) => String(k || "").toLowerCase()).filter(Boolean));
  return HOSTS.filter((h) => uniq.has(h.key)).map((h) => BY_KEY.get(h.key) || h);
}
