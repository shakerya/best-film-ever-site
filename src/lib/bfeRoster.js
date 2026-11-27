// src/lib/bfeRoster.js
// Canonical Best Film Ever Host, BFF Guest & Patreon Roster + Whisper speech-to-text phonetic catch rules.

export const PATRON_NICKNAME_LORE = [
  "Aashrey — Patreon backer since Ep 247 & creator of the BFE companion site/Letterboxd chronology (Whisper variants: Ashray, Ashre, Ashree, Oshre, Aashri, Asher, Ashra, Ash Ray)",
  "Ariannah ('Ariannah Who Loves BFE the Most™', from Nova Scotia, Canada)",
  "Shai Bergerfroind ('The Shy Guy', head of the BFE Clint Eastwood Appreciation Society & BFF guest)",
  "James DeGuzman ('JDG' / 'Horseshoe Boy', BFF guest from Toronto/Canada)",
  "Hermes Auslander ('Podcast brother from an alien mother', frequent BFF guest)",
  "Juleen (frequent BFF guest & Fifth-Seat regular)",
  "Synthia (BFF guest & Fifth-Seat regular)",
  "Reverend Bruce ('Our man of the cloth', from Boston, BFF guest & Fifth-Seat regular)",
  "Richard ('Our resident curmudgeon')",
  "Nate the Great (shares birthday weekend with Aashrey)",
  "Andy Dixon ('Great Scott, it's Andy Dixon!')",
  "Ryan Kuketz ('The cool cat himself')",
  "Dirk Diggler ('Dirk, whose friends call him Diggler')",
  "Cheesy ('Cheesy with a fish on a bike' — weekly pun handle variant)",
  "Dwayne Smith ('Say it with me: Dwayne Smith!' — Poet Laureate / OG of the BFE)",
  "Norfolk Domus ('Dom', Fifth-Seat & Fantasy Football regular)",
  "John Humphrey's Right Foot ('Mr. Foote' / 'Or his left')",
  "Timmy Tim Tim ('Timmy!')",
  "Paul Komoroski (Fifth-Seat & tournament regular)",
  "Chris Peterson & Lena Oberholzer & Randall 'What's Your Handle' Silva",
  "Stu ('Stu from the SWO / Stu World Order Podcast')",
  "Youth Hostelling with Chris Eubank (legendary Alan Partridge-inspired Patreon handle)",
];

// Ordered rules mapping mangled Whisper / nickname variants -> canonical Patron display name
const PATRON_NAME_RULES = [
  // Non-patron artifacts to strip when cleaning extracted voter lists
  [/^(?:ogre\s+ribeir|roger\s+ebert|peter\s+bradshaw|patreon|anonymous|blank|none|unknown)$/i, null],

  // Core Patreon & Fifth-Seat Roster
  [/^(?:a+sh(?:ray|rey|ree|ri|ra|re|er|era|erah|rafe)|ash\s+r[ae][yi]?|osh(?:re|ray|ree|ri|era)|ush[a-z]+)$/i, "Aashrey"],
  [/^ariann?ah?\b/i, "Ariannah"],
  [
    /^(?:shai\b|shy\b|shay\b|the\s+shy\s+guy|dirty\s+shy\s+guy|sleepy\s+shy|kashai|macheiburger|schuyberg|schreiberfroid|shyburger|shyberger|scheiburger)/i,
    "Shai Bergerfroind",
  ],
  [/^(?:jdg\b|jdj\b|james\s+de\s*gu[sz]m[ao]n?|horseshoe\s+boy)/i, "James DeGuzman"],
  [/^paul\s+k[ao]m[aeo]r[ao]w?ski/i, "Paul Komoroski"],
  [/^(?:norfolk|norford|vulfoc|dom\b|domus\b)/i, "Norfolk Domus"],
  [
    /^(?:john\s+(?:e\.?\s*h\.?\s*)?(?:humphrey|wright)|super\s+humphrey|john\s+sexual\s+tyrannosaurus|mr\.?\s*foote?\b|right\s+foot\b|foot\b)/i,
    "John Humphrey's Right Foot",
  ],
  [/^timmy\b/i, "Timmy Tim Tim"],
  [/^(?:cheesy|cheezy|sheezy)\b/i, "Cheesy"],
  [/^(?:dirk\b|ravishing\s+dirk|derek.*digl)/i, "Dirk Diggler"],
  [/^nate\b/i, "Nate the Great"],
  [/^(?:rev(?:erend)?\.?\s*bruce|bruce\b)/i, "Reverend Bruce"],
  [/^(?:resident\s+curmudgeon|retired\s+ritual|rich\s*shard|richard\b)/i, "Richard"],
  [/^(?:juleen|julene|julian\b|julie\s*15)/i, "Juleen"],
  [/^(?:hermes\b|herbie\b|herman\b)/i, "Hermes Auslander"],
  [/^(?:synthia|cynthia)\b/i, "Synthia"],
  [/^(?:dwayne|duane|joanne|twin)\s+smith/i, "Dwayne Smith"],
  [/^chris\s+p(?:eterson|\.?$)/i, "Chris Peterson"],
  [/^randall\s+silv(?:a|er)/i, "Randall Silva"],
  [/^(?:lena|leon|leonard)\s+oberholzer/i, "Lena Oberholzer"],
  [/^(?:ryan\s+k[uo]+[ck]+[ae]t?[sz]?|cool\s+cat\s+ryan)/i, "Ryan Kuketz"],
  [/^andy\s+dixon/i, "Andy Dixon"],
  [/^(?:stu\b|stew\b).*?(?:swo|world\s+order)?$/i, "Stu (SWO Podcast)"],
  [/^(?:kirsti|kirsty|kirsten)\b/i, "Kirsti"],
  [/^(?:katie\s+mccray|kate\s+mccray|katie\s+gray)/i, "Katie McCray"],
  [/^(?:carlo\b|movie\s+loo[tp]|movie\s+loose)/i, "Carlo (The Movie Loot)"],
  [/^(?:josh\s+g\b|josh\b.*next\s+fav)/i, "Josh G"],
  [/^(?:russell\s+osborne|russell\b)/i, "Russell Osborne"],
  [/^(?:anthony\s+davies|anthony\b)/i, "Anthony Davies"],
  [/^(?:shoot\s+the\s+flick)/i, "Shoot the Flick"],
  [/^(?:nostalgia\s+cast)/i, "Nostalgia Cast"],
  [/^(?:scriptic(?:al|le)|david\s+from\s+scriptic)/i, "Scripticle"],
  [/^(?:griff\b|grift\b|griffin\b)/i, "Griff (Paul & Griff Show)"],
  [/^(?:youth\s+hostel|you'?ve\s+host[ei]l).*eubank/i, "Youth Hostelling with Chris Eubank"],
];

export function canonicalizePatronName(rawName) {
  const clean = String(rawName || "").replace(/\s+/g, " ").trim();
  if (!clean) return null;
  for (const [re, target] of PATRON_NAME_RULES) {
    if (re.test(clean)) return target;
  }
  return clean;
}

// Multi-word phrase replacements applied BEFORE word splitting in transcript search
export const PHONETIC_PHRASE_REPLACEMENTS = [
  [/\bash\s+r(?:ay|ey|ee|e|a|i)\b/gi, "aashrey"],
  [/\b(?:the\s+)?shy\s+guy\b/gi, "shai"],
  [/\b(?:shy|shai|schuy|schei|machei)\s*b[eu]rg[ae]r?\s*fr[eo][iyu]n?[dt]?\b/gi, "shai"],
  [/\bpaul\s+k[ao]m[aeo]r[ao]w?ski\b/gi, "paul komoroski"],
  [/\b(?:norfolk|norford|vulfoc)\s+(?:domus|thomas|dalmas|domis|domins|vomus)\b/gi, "norfolk domus"],
  [/\b(?:john\s+humphrey'?s?\s+right\s+foot|john\s+e\.?\s*h\.?\s*wright|mr\.?\s*foote|super\s+humphrey)\b/gi, "humphrey foot"],
  [/\b(?:ryan\s+k[uo]+[ck]+[ae]t?[sz]?|cool\s+cat)\b/gi, "ryan kuketz"],
  [/\b(?:dwayne|duane|joanne)\s+smith\b/gi, "dwayne smith"],
  [/\b(?:lena|leon|leonard)\s+oberholzer\b/gi, "lena oberholzer"],
  [/\brandall\s+(?:what'?s\s+your\s+handle\s+)?silv(?:a|er)\b/gi, "randall silva"],
  [/\b(?:james\s+de\s*gu[sz]m[ao]n?|horseshoe\s+boy)\b/gi, "james deguzman"],
  [/\bresident\s+curmudgeon\b/gi, "richard"],
  [/\bman\s+of\s+the\s+cloth\b/gi, "reverend bruce"],
  [/\byouth\s+host[ei]l+ing\s+with\s+chris\s+eubank\b/gi, "chris eubank"],
  [/\byou'?ve\s+host[ei]l+ing?\s+with\s+chris\s+eubank\b/gi, "chris eubank"],
];

// Single-token phonetic map applied to every indexed & queried token in transcriptSearch.js
export const PHONETIC_TOKEN_ALIASES = new Map([
  // Aashrey
  ["aashrey", "aashrey"],
  ["ashray", "aashrey"],
  ["ashrey", "aashrey"],
  ["ashre", "aashrey"],
  ["ashree", "aashrey"],
  ["aashri", "aashrey"],
  ["oshre", "aashrey"],
  ["oshray", "aashrey"],
  ["oshree", "aashrey"],
  ["ashra", "aashrey"],
  ["asher", "aashrey"],
  ["ashera", "aashrey"],
  ["asherah", "aashrey"],
  ["oshera", "aashrey"],
  ["ashrafe", "aashrey"],

  // Hosts
  ["megs", "megan"],
  ["megan", "megan"],
  ["kev", "kevin"],
  ["kevdog", "kevin"],
  ["kevin", "kevin"],

  // Patrons & BFFs
  ["ariana", "ariannah"],
  ["arianna", "ariannah"],
  ["ariannah", "ariannah"],
  ["shy", "shai"],
  ["shay", "shai"],
  ["shai", "shai"],
  ["kashai", "shai"],
  ["bergerfroind", "shai"],
  ["bergefroind", "shai"],
  ["shyberger", "shai"],
  ["shyburger", "shai"],
  ["schuyberg", "shai"],
  ["schreiberfroid", "shai"],
  ["macheiburger", "shai"],
  ["jdg", "deguzman"],
  ["jdj", "deguzman"],
  ["deguzman", "deguzman"],
  ["degusman", "deguzman"],
  ["deguzma", "deguzman"],
  ["komoroski", "komoroski"],
  ["komarowski", "komoroski"],
  ["kamaroski", "komoroski"],
  ["komeroski", "komoroski"],
  ["cheesy", "cheesy"],
  ["cheezy", "cheesy"],
  ["sheezy", "cheesy"],
  ["juleen", "juleen"],
  ["julene", "juleen"],
  ["julian", "juleen"],
  ["synthia", "synthia"],
  ["cynthia", "synthia"],
  ["hermes", "hermes"],
  ["herbie", "hermes"],
  ["kirsti", "kirsti"],
  ["kirsty", "kirsti"],
  ["kirsten", "kirsti"],
  ["kuketz", "kuketz"],
  ["kukets", "kuketz"],
  ["kookas", "kuketz"],
  ["cookets", "kuketz"],
  ["cookett", "kuketz"],
  ["cucats", "kuketz"],
  ["diggler", "dirk"],
  ["digler", "dirk"],
  ["digla", "dirk"],
  ["dirk", "dirk"],
  ["domus", "domus"],
  ["dalmas", "domus"],
  ["domis", "domus"],
  ["vomus", "domus"],
  ["foote", "humphrey"],
]);
