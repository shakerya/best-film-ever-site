// src/lib/bfeStore.js
import fs from "node:fs";
import path from "node:path";
import seedEpisodes from "@/data/seedEpisodes.json";
import { BFE_LINKS, normalizeGifKey } from "./bfeShared";

export { BFE_LINKS, normalizeGifKey };

const STATE_FILE = path.join(process.cwd(), ".bfe-runtime-state.json");

const DEFAULT_SCHEDULE = [
  {
    id: "dec-2026-christmas-pick",
    title: "Die Hard",
    year: "1988",
    tmdbId: 562,
    episodeNum: 359,
    episodeDate: "2026-12-01",
    cutoffIso: "2026-11-29T18:00:00Z",
    pickNote: "December Kickoff • Theatrical Cut",
    googleFormUrl: "https://forms.gle/8xmrcSZ7XEuQVfhq5",
    status: "open", // "open" | "upcoming" | "closed"
  },
  {
    id: "nov-2026-gangs",
    title: "Gangs of New York",
    year: "2002",
    tmdbId: 3131,
    episodeNum: 358,
    episodeDate: "2026-11-24",
    cutoffIso: "2026-11-22T18:00:00Z",
    pickNote: "Scorsese Deep Dive • 2002",
    googleFormUrl: "https://forms.gle/8xmrcSZ7XEuQVfhq5",
    status: "closed",
  },
  {
    id: "nov-2026-fmj",
    title: "Full Metal Jacket",
    year: "1987",
    tmdbId: 600,
    episodeNum: 357,
    episodeDate: "2026-11-17",
    cutoffIso: "2026-11-15T18:00:00Z",
    pickNote: "Shai Bergerfroind's BFF Pick",
    googleFormUrl: "https://forms.gle/CHHgVuyCB9nZfXZ4A",
    status: "closed",
  },
  {
    id: "nov-2026-english-patient",
    title: "The English Patient",
    year: "1996",
    tmdbId: 409,
    episodeNum: 356,
    episodeDate: "2026-11-10",
    cutoffIso: "2026-11-08T18:00:00Z",
    pickNote: "Feat. Friend of the Podcasters: Jim",
    googleFormUrl: "https://forms.gle/czHpWFLecAsNRxbV9",
    status: "closed",
  },
  {
    id: "nov-2026-monsters-inc",
    title: "Monsters, Inc.",
    year: "2001",
    tmdbId: 585,
    episodeNum: 355,
    episodeDate: "2026-11-03",
    cutoffIso: "2026-11-01T18:00:00Z",
    pickNote: "25th Anniversary Pixar Special",
    googleFormUrl: "https://forms.gle/ziRqmYRTnAQuSMmE7",
    status: "closed",
  },
];

const DEFAULT_GIF_ROUNDS = [
  {
    id: "ep-358-cannonball",
    epNum: 358,
    filmTitle: "Gangs of New York",
    randomWord: "Cannonball",
    hint: "Dropped by Kev at the start of the Episode 358 Endgame.",
    closesIso: "2026-11-29T18:00:00Z",
    status: "open",
    winnerEntryId: null,
    entries: [
      {
        id: "seed-gif-358-1",
        name: "Ian (@bestfilmeverpod)",
        handle: "@bestfilmeverpod",
        gifUrl: "https://media.giphy.com/media/l2Je4YMcwUymua0rC/giphy.gif",
        caption: "Ron Burgundy hitting the pool!",
        createdAt: "2026-11-24T11:00:03Z",
        isHostStarter: true,
      },
    ],
  },
  {
    id: "ep-357-sniper",
    epNum: 357,
    filmTitle: "Full Metal Jacket",
    randomWord: "Sniper",
    hint: "Picked by Shai Bergerfroind in Episode 357.",
    closesIso: "2026-11-22T18:00:00Z",
    status: "closed",
    winnerEntryId: "seed-gif-357-ian",
    entries: [
      {
        id: "seed-gif-357-shai",
        name: "Shai Bergerfroind",
        handle: "@Bergershai",
        gifUrl: "https://media.giphy.com/media/W0EYYvXeYBm1O/giphy.gif",
        caption: "Cat sniper get down!",
        createdAt: "2026-11-17T12:15:00Z",
      },
      {
        id: "seed-gif-357-ian",
        name: "Ian (Host Winner 👑)",
        handle: "@bestfilmeverpod",
        gifUrl: "https://media.giphy.com/media/l0HlMPcbD4jdARjRC/giphy.gif",
        caption: "Robin Hood splitting the arrow dead center",
        createdAt: "2026-11-22T17:59:43Z",
      },
    ],
  },
];

const DEFAULT_BEETROOT = {
  "dec-2026-christmas-pick": {
    great: 9,
    good: 4,
    ok: 1,
    poor: 0,
    comments: [
      {
        id: "seed-beet-1",
        name: "Paul Komoroski",
        choice: "great",
        comment: "100% a Christmas movie and Alan Rickman is an all-time villain.",
        createdAt: "2026-11-25T08:00:00Z",
      },
    ],
  },
  "nov-2026-gangs": {
    great: 5,
    good: 9,
    ok: 3,
    poor: 1,
    comments: [
      {
        id: "seed-beet-2",
        name: "James DeGuzman",
        choice: "good",
        comment: "Bill the Butcher is a 10/10 character inside an 8/10 sprawl.",
        createdAt: "2026-11-21T16:00:00Z",
      },
    ],
  },
};

function buildInitialFifthSeats() {
  const byFilm = {
    "dec-2026-christmas-pick": [],
    "nov-2026-gangs": [
      {
        id: "seed-5th-358-1",
        name: "James DeGuzman",
        score: 8,
        thoughts: "Daniel Day-Lewis dominates every scene he's in.",
        hostQuestion: "Would Gangs of New York be a 10/10 as a 6-part HBO miniseries?",
        source: "transcript_seed",
        readOnAir: true,
        createdAt: "2026-11-21T19:00:00Z",
      },
      {
        id: "seed-5th-358-2",
        name: "Richard",
        score: 7,
        thoughts: "Great setting and villain, drags a bit in the middle.",
        hostQuestion: "",
        source: "transcript_seed",
        readOnAir: true,
        createdAt: "2026-11-21T20:00:00Z",
      },
      {
        id: "seed-5th-358-3",
        name: "Aashrey",
        score: 6,
        thoughts: "Ambitious Scorsese, uneven second half.",
        hostQuestion: "",
        source: "transcript_seed",
        readOnAir: true,
        createdAt: "2026-11-22T04:00:00Z",
      },
      {
        id: "seed-5th-358-4",
        name: "Shai Bergerfroind",
        score: 5,
        thoughts: "Wanted to love it way more than I did.",
        hostQuestion: "",
        source: "transcript_seed",
        readOnAir: true,
        createdAt: "2026-11-22T09:00:00Z",
      },
    ],
  };
  return byFilm;
}

function getDefaultState() {
  return {
    evergreenGoogleForm: {
      baseUrl: process.env.EVERGREEN_GOOGLE_FORM_URL || "",
      filmEntryId: process.env.EVERGREEN_FILM_ENTRY_ID || "entry.1000001",
    },
    schedule: DEFAULT_SCHEDULE,
    fifthSeats: buildInitialFifthSeats(),
    beetroot: DEFAULT_BEETROOT,
    gifRounds: DEFAULT_GIF_ROUNDS,
    episodeOverrides: {},
  };
}

let memoryState = null;

export function readBfeState() {
  if (memoryState) return memoryState;
  try {
    if (fs.existsSync(STATE_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
      memoryState = {
        ...getDefaultState(),
        ...parsed,
      };
      return memoryState;
    }
  } catch (e) {
    console.warn("[bfeStore] Failed reading state file, using defaults:", e?.message);
  }
  memoryState = getDefaultState();
  return memoryState;
}

export function writeBfeState(updater) {
  const current = readBfeState();
  const next = typeof updater === "function" ? updater(structuredClone(current)) : updater;
  memoryState = next;
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(next, null, 2), "utf-8");
  } catch (e) {
    // On read-only serverless filesystems without Google Sheet webhook, memoryState still serves warm lambdas
    console.warn("[bfeStore] Read-only fs, kept in memory:", e?.message);
  }
  return next;
}

export async function forwardToGoogleSheetWebhook(eventType, payload) {
  const webhook = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  if (!webhook) return { synced: false };
  try {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventType, payload, timestamp: new Date().toISOString() }),
    });
    return { synced: res.ok };
  } catch (e) {
    console.error("[bfeStore] Google Sheets webhook error:", e?.message);
    return { synced: false };
  }
}

/**
 * Builds a Pre-Filled Google Form URL when an evergreen Google Form is configured,
 * falling back cleanly to the film's individual forms.gle URL.
 */
export function buildGoogleFormLink(film, evergreenConfig = {}) {
  const base = String(evergreenConfig?.baseUrl || process.env.EVERGREEN_GOOGLE_FORM_URL || "").trim();
  const entryId = String(evergreenConfig?.filmEntryId || process.env.EVERGREEN_FILM_ENTRY_ID || "").trim();

  if (base && entryId && film?.title) {
    const u = new URL(base);
    u.searchParams.set("usp", "pp_url");
    const cleanEntry = entryId.startsWith("entry.") ? entryId : `entry.${entryId}`;
    u.searchParams.set(cleanEntry, film.year ? `${film.title} (${film.year})` : film.title);
    return {
      url: u.toString(),
      isPrefilledEvergreen: true,
    };
  }

  return {
    url: film?.googleFormUrl || "",
    isPrefilledEvergreen: false,
  };
}

export function computeBeetrootSummary(pollData) {
  const great = Number(pollData?.great || 0);
  const good = Number(pollData?.good || 0);
  const ok = Number(pollData?.ok || 0);
  const poor = Number(pollData?.poor || 0);
  const total = great + good + ok + poor;
  const pct = total > 0 ? Math.round(((great + good) / total) * 100) : null;
  return {
    great,
    good,
    ok,
    poor,
    total,
    beetrootPct: pct,
    qualifies: total >= 10,
    comments: Array.isArray(pollData?.comments) ? pollData.comments : [],
  };
}

export function computeFifthSeatSummary(entries = []) {
  const valid = (entries || []).filter((e) => Number.isFinite(Number(e.score)));
  if (!valid.length) {
    return { count: 0, average: null, entries: [] };
  }
  const sum = valid.reduce((acc, e) => acc + Number(e.score), 0);
  const avg = Math.round((sum / valid.length) * 100) / 100;
  return {
    count: valid.length,
    average: avg,
    entries: valid,
  };
}

/**
 * Computes Official Combined BFE Score using Ian's exact unweighted equal-seat formula:
 * mean(Host1, Host2, ..., Guest, FifthSeatAverage)
 */
export function computeCombinedEpisodeScore({ hosts = {}, guests = [], fifthSeatAvg = null }) {
  const seats = [];
  for (const val of Object.values(hosts || {})) {
    if (Number.isFinite(Number(val))) seats.push(Number(val));
  }
  for (const g of guests || []) {
    if (Number.isFinite(Number(g?.score))) seats.push(Number(g.score));
  }
  if (fifthSeatAvg !== null && fifthSeatAvg !== undefined && Number.isFinite(Number(fifthSeatAvg))) {
    seats.push(Number(fifthSeatAvg));
  }
  if (!seats.length) return null;
  const mean = seats.reduce((a, b) => a + b, 0) / seats.length;
  return Math.round(mean * 100) / 100;
}

export function getMergedEpisodeDataByNumber(epNum) {
  if (!epNum) return null;
  const state = readBfeState();
  const base = seedEpisodes[String(epNum)] || null;
  const override = state.episodeOverrides?.[String(epNum)] || null;

  // Also check if a scheduled item has live Fifth-Seat / Beetroot data for this episodeNum
  const sched = state.schedule.find((s) => Number(s.episodeNum) === Number(epNum));
  const liveFifth = sched ? computeFifthSeatSummary(state.fifthSeats?.[sched.id] || []) : null;
  const liveBeet = sched ? computeBeetrootSummary(state.beetroot?.[sched.id]) : null;

  if (!base && !override && !sched) return null;

  const merged = {
    ...(base || {}),
    ...(override || {}),
  };

  if (liveFifth && liveFifth.count > (merged.fifthSeatCount || 0)) {
    merged.fifthSeatCount = liveFifth.count;
    merged.fifthSeatAvg = liveFifth.average;
    merged.fifthSeatVoters = liveFifth.entries.map((e) => ({
      name: e.name,
      score: e.score,
      quote: e.thoughts,
    }));
  }

  if (liveBeet && liveBeet.total > 0 && merged.beetrootPct === undefined) {
    merged.beetrootPct = liveBeet.beetrootPct;
    merged.beetrootTotal = liveBeet.total;
  }

  if (merged.hosts || merged.guests) {
    merged.combinedScore = computeCombinedEpisodeScore({
      hosts: merged.hosts,
      guests: merged.guests,
      fifthSeatAvg: merged.fifthSeatAvg,
    });
  }

  return merged;
}

export function getAllRankedLeaderboardItems() {
  const state = readBfeState();
  const allNums = new Set([
    ...Object.keys(seedEpisodes),
    ...Object.keys(state.episodeOverrides || {}),
  ]);

  const items = [];
  for (const key of allNums) {
    const ep = getMergedEpisodeDataByNumber(Number(key));
    if (!ep || !Number.isFinite(Number(ep.combinedScore))) continue;

    const hostVals = [
      ...Object.values(ep.hosts || {}).map(Number),
      ...(ep.guests || []).map((g) => Number(g.score)),
    ].filter(Number.isFinite);
    const hostMean = hostVals.length
      ? Math.round((hostVals.reduce((a, b) => a + b, 0) / hostVals.length) * 100) / 100
      : null;
    const patronDelta =
      hostMean !== null &&
      ep.fifthSeatAvg !== null &&
      ep.fifthSeatAvg !== undefined &&
      Number.isFinite(Number(ep.fifthSeatAvg))
        ? Math.round((Number(ep.fifthSeatAvg) - hostMean) * 100) / 100
        : null;

    items.push({
      ...ep,
      hostMean,
      patronDelta,
    });
  }

  items.sort((a, b) => b.combinedScore - a.combinedScore || b.epNum - a.epNum);
  return items.map((item, idx) => ({
    ...item,
    rank: idx + 1,
  }));
}

export function getPatronContributorLeaderboard() {
  const counts = new Map();

  const bump = (rawName, score) => {
    const clean = String(rawName || "").trim();
    if (!clean) return;
    // Normalize common transcript variants
    const key = clean.toLowerCase().startsWith("paul")
      ? "Paul Komoroski"
      : clean.toLowerCase().startsWith("shai")
        ? "Shai Bergerfroind"
        : clean.toLowerCase().startsWith("ariann")
          ? "Ariannah"
          : clean.toLowerCase().startsWith("james")
            ? "James DeGuzman"
            : clean.toLowerCase().startsWith("dirk")
              ? "Dirk Diggler"
              : clean;

    const prev = counts.get(key) || { name: key, count: 0, sum: 0 };
    prev.count += 1;
    if (Number.isFinite(Number(score))) prev.sum += Number(score);
    counts.set(key, prev);
  };

  // Count from seedEpisodes (avoiding double-counting ep 358 which is also in default fifthSeats)
  const state = readBfeState();
  const seededEpNumsInLive = new Set(
    state.schedule
      .filter((s) => (state.fifthSeats?.[s.id] || []).length > 0)
      .map((s) => Number(s.episodeNum))
  );

  for (const ep of Object.values(seedEpisodes)) {
    if (seededEpNumsInLive.has(Number(ep.epNum))) continue;
    for (const v of ep.fifthSeatVoters || []) {
      bump(v.name, v.score);
    }
  }

  for (const list of Object.values(state.fifthSeats || {})) {
    for (const v of list || []) {
      bump(v.name, v.score);
    }
  }

  return Array.from(counts.values())
    .map((p) => ({
      name: p.name,
      submissions: p.count,
      avgScoreGiven: p.count ? Math.round((p.sum / p.count) * 10) / 10 : null,
      tierBadge:
        p.count >= 10
          ? "🏆 Iron Fifth-Seater"
          : p.count >= 3
            ? "🔥 Regular Critic"
            : "🪑 Fifth-Seat Backer",
    }))
    .sort((a, b) => b.submissions - a.submissions || a.name.localeCompare(b.name));
}
