// src/lib/hosts.js

// Canonical host list + their local image paths (in /public/hosts)
export const HOSTS = [
  { key: "ian", name: "Ian", image: "/hosts/Ian.png" },
  { key: "liam", name: "Liam", image: "/hosts/Liam.png" },
  { key: "megan", name: "Megan", image: "/hosts/Megan.png" },
  { key: "kevin", name: "Kevin", image: "/hosts/Kevin.png" },
  { key: "georgia", name: "Georgia", image: "/hosts/Georgia.png" },
];

// Fast lookup by key
const BY_KEY = new Map(HOSTS.map((h) => [h.key, h]));

// Aliases to recognize in descriptions / titles
const ALIASES = [
  { key: "ian", patterns: ["ian"] },
  { key: "liam", patterns: ["liam"] },

  // Megan also goes by "meg"
  { key: "megan", patterns: ["megan", "meg", "megs"] },

  // Kevin also goes by "kev"
  { key: "kevin", patterns: ["kevin", "kev", "kev-dog"] },

  { key: "georgia", patterns: ["georgia"] },
];

function normalizeText(s) {
  return String(s || "")
    .replace(/\s+/g, " ")
    .replace(/[’']/g, "'")
    .trim();
}

function hasWord(haystackLower, wordLower) {
  // strict-ish boundary so we don’t match inside other words
  const re = new RegExp(`(^|[^a-z])${wordLower}([^a-z]|$)`, "i");
  return re.test(haystackLower);
}

/**
 * Parse host keys from arbitrary text (episode title/description).
 * Returns keys like: ["ian","liam"] in the order of HOSTS.
 */
export function parseHostKeysFromText(text) {
  const t = normalizeText(text);
  if (!t) return [];

  const lower = t.toLowerCase();
  const found = new Set();

  for (const a of ALIASES) {
    for (const p of a.patterns) {
      const pl = String(p).toLowerCase();
      if (!pl) continue;
      if (hasWord(lower, pl)) {
        found.add(a.key);
        break;
      }
    }
  }

  // Return in canonical display order
  return HOSTS.map((h) => h.key).filter((k) => found.has(k));
}

/**
 * Convert host keys to full host objects (name + image)
 */
export function hostsForKeys(keys) {
  const list = Array.isArray(keys) ? keys : [];
  const uniq = new Set(list.map((k) => String(k || "").toLowerCase()).filter(Boolean));

  return HOSTS.filter((h) => uniq.has(h.key)).map((h) => BY_KEY.get(h.key) || h);
}
