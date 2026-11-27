// src/lib/bfeStore.js
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import seedEpisodes from "@/data/seedEpisodes.json";
import { BFE_LINKS, normalizeGifKey } from "./bfeShared";

export { BFE_LINKS, normalizeGifKey };

const STATE_FILE = path.join(process.cwd(), ".bfe-runtime-state.json");
const STATE_SCHEMA_VERSION = 2;
const REDIS_STATE_KEY = "bfe_state_v2";
const REDIS_AUDIT_KEY = "bfe_audit_log_v2";

export const GOOGLE_BACKUP_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1vIPXbt6KfSXeuYTkJHgUPgf2K8TNpwdzyCdgsKK6hxs/edit";

const DEFAULT_SCHEDULE = [
  {
    id: "dec-2026-little-shop",
    title: "Little Shop of Horrors",
    year: "1986",
    tmdbId: 10776,
    episodeNum: 359,
    episodeDate: "2026-12-01",
    cutoffIso: "2026-11-29T18:00:00Z",
    pickNote: "40th Anniversary Musical • feat. Special Guest Amy",
    googleFormUrl: "",
    status: "open",
  },
  {
    id: "nov-2026-gangs",
    title: "Gangs of New York",
    year: "2002",
    tmdbId: 3131,
    episodeNum: 358,
    episodeDate: "2026-11-24",
    cutoffIso: "2026-11-22T18:00:00Z",
    pickNote: "Kevin's Pick • Martin Scorsese",
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
    pickNote: "25th Anniversary Pixar Review",
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
    hint: "Chosen by Kev at the start of the Episode 358 Endgame.",
    closesIso: "2026-11-29T18:00:00Z",
    status: "open",
    winnerEntryId: null,
    entries: [],
  },
  {
    id: "ep-357-sniper",
    epNum: 357,
    filmTitle: "Full Metal Jacket",
    randomWord: "Sniper",
    hint: "Chosen by Shai Bergerfroind in Episode 357.",
    closesIso: "2026-11-22T18:00:00Z",
    status: "closed",
    winnerEntryId: "seed-gif-357-ian",
    entries: [
      {
        id: "seed-gif-357-shai",
        name: "Shai Bergerfroind",
        handle: "@Bergershai",
        gifUrl: "https://media.giphy.com/media/W0EYYvXeYBm1O/giphy.gif",
        caption: "Cat sniper — get down!",
        createdAt: "2026-11-17T12:15:00Z",
      },
      {
        id: "seed-gif-357-ian",
        name: "Ian (@bestfilmeverpod)",
        handle: "@bestfilmeverpod",
        gifUrl: "https://media.giphy.com/media/l0HlMPcbD4jdARjRC/giphy.gif",
        caption: "Disney's Robin Hood splitting the arrow (Episode 358 Winner)",
        createdAt: "2026-11-22T17:59:43Z",
      },
    ],
  },
];

const DEFAULT_BEETROOT = {};

function buildInitialFifthSeats() {
  return {
    "dec-2026-little-shop": [],
    "nov-2026-gangs": [
      {
        id: "seed-5th-358-1",
        name: "Richard",
        score: 7,
        thoughts:
          "One of my least favorite Scorseses. Diaz is a walking, talking anachronism. Daniel Day-Lewis blows everyone off the screen. Doesn't quite hang together.",
        hostQuestion: "",
        source: "transcript_verified",
        readOnAir: true,
        createdAt: "2026-11-21T19:00:00Z",
      },
      {
        id: "seed-5th-358-2",
        name: "Shai Bergerfroind",
        score: 5,
        thoughts:
          "Day-Lewis gives one of his best performances of all time, which is the only reason this film is watchable. Five self-removed eyeballs out of ten.",
        hostQuestion: "",
        source: "transcript_verified",
        readOnAir: true,
        createdAt: "2026-11-21T20:00:00Z",
      },
      {
        id: "seed-5th-358-3",
        name: "Aashrey",
        score: 6,
        thoughts:
          "Very promising in the first half, but Gangs of New York meanders through half-baked stories in the second. Daniel Day-Lewis stands out; Leo was all over the place.",
        hostQuestion: "",
        source: "transcript_verified",
        readOnAir: true,
        createdAt: "2026-11-22T04:00:00Z",
      },
      {
        id: "seed-5th-358-4",
        name: "James DeGuzman",
        score: 8,
        thoughts:
          "Probably my favorite Martin Scorsese film — not the best one, but my personal favorite. Eight 'it's raw!' steaks out of ten.",
        hostQuestion: "",
        source: "transcript_verified",
        readOnAir: true,
        createdAt: "2026-11-22T09:00:00Z",
      },
    ],
  };
}

export function getDefaultState() {
  return {
    schemaVersion: STATE_SCHEMA_VERSION,
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

function getKvConfig() {
  const url = String(
    process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || ""
  )
    .replace(/^"|"$/g, "")
    .replace(/\/+$/, "")
    .trim();
  const token = String(
    process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || ""
  )
    .replace(/^"|"$/g, "")
    .trim();
  return url && token ? { url, token } : null;
}

export function hasCloudKv() {
  return Boolean(getKvConfig());
}

let memoryState = null;
let memoryFetchedAt = 0;

async function fetchKvStateRaw(kv, { revalidate } = {}) {
  const fetchInit =
    typeof revalidate === "number"
      ? {
          headers: { Authorization: `Bearer ${kv.token}` },
          next: { revalidate },
        }
      : {
          headers: { Authorization: `Bearer ${kv.token}` },
          cache: "no-store",
        };
  const res = await fetch(`${kv.url}/get/${REDIS_STATE_KEY}`, fetchInit);
  if (!res.ok) {
    throw new Error(`Upstash GET failed: ${res.status}`);
  }
  const data = await res.json();
  if (!data?.result) return null;
  const parsed = typeof data.result === "string" ? JSON.parse(data.result) : data.result;
  if (parsed?.schemaVersion === STATE_SCHEMA_VERSION) {
    return {
      ...getDefaultState(),
      ...parsed,
    };
  }
  return null;
}

export async function readBfeState({ fresh = false, revalidate } = {}) {
  const now = Date.now();
  if (!fresh && memoryState && now - memoryFetchedAt < 5000) {
    return memoryState;
  }

  const kv = getKvConfig();
  if (kv) {
    try {
      const remote = await fetchKvStateRaw(kv, { revalidate });
      if (remote) {
        memoryState = remote;
        memoryFetchedAt = Date.now();
        return memoryState;
      }
      // Seed initial v2 state into Redis on first read (skip during static/ISR builds)
      const initial = getDefaultState();
      if (typeof revalidate !== "number") {
        await fetch(`${kv.url}/pipeline`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${kv.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify([["SET", REDIS_STATE_KEY, JSON.stringify(initial)]]),
          cache: "no-store",
        });
      }
      memoryState = initial;
      memoryFetchedAt = Date.now();
      return memoryState;
    } catch (e) {
      console.warn("[bfeStore] Cloud KV read failed, falling back:", e?.message);
    }
  }

  try {
    if (fs.existsSync(STATE_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
      if (parsed?.schemaVersion === STATE_SCHEMA_VERSION) {
        memoryState = {
          ...getDefaultState(),
          ...parsed,
        };
        memoryFetchedAt = Date.now();
        return memoryState;
      }
    }
  } catch (e) {
    console.warn("[bfeStore] Failed reading state file, using defaults:", e?.message);
  }

  memoryState = getDefaultState();
  memoryFetchedAt = Date.now();
  return memoryState;
}

export async function writeBfeState(updater, auditEvent = null) {
  const current = await readBfeState({ fresh: true });
  const next = typeof updater === "function" ? updater(structuredClone(current)) : updater;
  next.schemaVersion = STATE_SCHEMA_VERSION;
  next.updatedAt = new Date().toISOString();

  memoryState = next;
  memoryFetchedAt = Date.now();

  const kv = getKvConfig();
  if (kv) {
    try {
      const commands = [["SET", REDIS_STATE_KEY, JSON.stringify(next)]];
      if (auditEvent) {
        commands.push([
          "RPUSH",
          REDIS_AUDIT_KEY,
          JSON.stringify({ timestamp: next.updatedAt, ...auditEvent }),
        ]);
      }
      const res = await fetch(`${kv.url}/pipeline`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${kv.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(commands),
        cache: "no-store",
      });
      if (!res.ok) {
        console.error("[bfeStore] Cloud KV pipeline write status:", res.status);
      }
    } catch (e) {
      console.error("[bfeStore] Cloud KV write error:", e?.message);
    }
  }

  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(next, null, 2), "utf-8");
  } catch {
    // Ignore read-only fs on serverless
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

function csvEscape(val) {
  const s = String(val ?? "");
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function buildFullBackupCsv(state) {
  const rows = [
    [
      "Record Type",
      "Timestamp",
      "Episode #",
      "Film",
      "Contributor / Name",
      "Score / Choice",
      "Thoughts / Comment / Caption",
      "Host Question / GIF URL",
      "Read / Status",
    ],
  ];

  const filmById = new Map((state.schedule || []).map((s) => [s.id, s]));

  for (const [filmId, list] of Object.entries(state.fifthSeats || {})) {
    const f = filmById.get(filmId);
    for (const entry of list || []) {
      rows.push([
        "Fifth-Seat",
        entry.updatedAt || entry.createdAt || "",
        f?.episodeNum || "",
        f?.title || filmId,
        entry.name || "",
        entry.score ?? "",
        entry.thoughts || "",
        entry.hostQuestion || "",
        entry.readOnAir ? "Read on Air" : "Pending",
      ]);
    }
  }

  for (const [filmId, poll] of Object.entries(state.beetroot || {})) {
    const f = filmById.get(filmId);
    const summary = computeBeetrootSummary(poll);
    if (summary.total > 0) {
      rows.push([
        "Beetroot Summary",
        state.updatedAt || "",
        f?.episodeNum || "",
        f?.title || filmId,
        `${summary.total} votes`,
        `${summary.beetrootPct}% Beetroot`,
        `Great:${summary.great} Good:${summary.good} OK:${summary.ok} Poor:${summary.poor}`,
        "",
        summary.qualifies ? "Qualified" : "<10 votes",
      ]);
    }
    for (const c of summary.comments || []) {
      rows.push([
        "Beetroot Comment",
        c.createdAt || "",
        f?.episodeNum || "",
        f?.title || filmId,
        c.name || "",
        c.choice || "",
        c.comment || "",
        "",
        "",
      ]);
    }
  }

  for (const round of state.gifRounds || []) {
    for (const entry of round.entries || []) {
      rows.push([
        "GIF Entry",
        entry.createdAt || "",
        round.epNum || "",
        round.filmTitle || "",
        entry.handle ? `${entry.name} (${entry.handle})` : entry.name || "",
        round.randomWord || "",
        entry.caption || "",
        entry.gifUrl || "",
        round.winnerEntryId === entry.id ? "Winner" : round.status || "",
      ]);
    }
  }

  return rows.map((r) => r.map(csvEscape).join(",")).join("\n");
}

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

const VOTER_HASH_SALT = process.env.BFE_VOTER_SALT || "bfe-beetroot-ballot-v1";

function sha256Short(input) {
  return crypto
    .createHash("sha256")
    .update(`${VOTER_HASH_SALT}:${input}`)
    .digest("hex")
    .slice(0, 24);
}

/**
 * Normalizes OS/device family (ignoring browser engine differences like X-WebView vs Safari vs Chrome
 * or Incognito mode) so one physical device on one IP maps to one stable deviceHash, while different
 * devices in the same household (e.g. an iPhone and a Mac or Android on the same Wi-Fi) stay distinct.
 */
export function buildVoterFingerprints({ voterToken = "", ip = "", userAgent = "" } = {}) {
  const cleanToken = String(voterToken || "").trim();
  const cookieHash = cleanToken ? `tok_${sha256Short(cleanToken)}` : "";

  const cleanIp = String(ip || "")
    .split(",")[0]
    .trim();
  const ua = String(userAgent || "").toLowerCase();
  let deviceClass = "other";
  if (ua.includes("iphone")) deviceClass = "iphone";
  else if (ua.includes("ipad")) deviceClass = "ipad";
  else if (ua.includes("android")) deviceClass = "android";
  else if (ua.includes("macintosh") || ua.includes("mac os")) deviceClass = "mac";
  else if (ua.includes("windows")) deviceClass = "windows";
  else if (ua.includes("linux")) deviceClass = "linux";

  const deviceHash =
    cleanIp && cleanIp !== "unknown" ? `dev_${sha256Short(`${cleanIp}|${deviceClass}`)}` : "";

  return { cookieHash, deviceHash };
}

export function findExistingBeetrootBallot(pollData, { cookieHash = "", deviceHash = "" } = {}) {
  const ballots = pollData?.ballots;
  if (!ballots || typeof ballots !== "object") return null;

  if (cookieHash && ballots[cookieHash]) {
    const b = ballots[cookieHash];
    const choice = typeof b === "string" ? b : b?.choice;
    if (choice) return { voterKey: cookieHash, choice };
  }

  if (deviceHash) {
    if (ballots[deviceHash]) {
      const b = ballots[deviceHash];
      const choice = typeof b === "string" ? b : b?.choice;
      if (choice) return { voterKey: deviceHash, choice };
    }
    for (const [k, v] of Object.entries(ballots)) {
      if (v && typeof v === "object" && v.deviceHash && v.deviceHash === deviceHash && v.choice) {
        return { voterKey: k, choice: v.choice };
      }
    }
  }

  return null;
}

export function tallyBeetrootBallots(ballots = {}) {
  const counts = { great: 0, good: 0, ok: 0, poor: 0 };
  for (const val of Object.values(ballots || {})) {
    const c = typeof val === "string" ? val : val?.choice;
    if (c && Object.prototype.hasOwnProperty.call(counts, c)) {
      counts[c] += 1;
    }
  }
  return counts;
}

export function computeBeetrootSummary(pollData) {
  const hasBallots =
    pollData?.ballots &&
    typeof pollData.ballots === "object" &&
    Object.keys(pollData.ballots).length > 0;
  const tallied = hasBallots ? tallyBeetrootBallots(pollData.ballots) : null;

  const great = tallied ? tallied.great : Number(pollData?.great || 0);
  const good = tallied ? tallied.good : Number(pollData?.good || 0);
  const ok = tallied ? tallied.ok : Number(pollData?.ok || 0);
  const poor = tallied ? tallied.poor : Number(pollData?.poor || 0);
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

export function getMergedEpisodeDataWithState(epNum, state) {
  if (!epNum || !state) return null;
  const base = seedEpisodes[String(epNum)] || null;
  const override = state.episodeOverrides?.[String(epNum)] || null;

  const sched = state.schedule.find((s) => Number(s.episodeNum) === Number(epNum));
  const liveFifth = sched ? computeFifthSeatSummary(state.fifthSeats?.[sched.id] || []) : null;
  const liveBeet = sched ? computeBeetrootSummary(state.beetroot?.[sched.id]) : null;

  if (!base && !override && !sched) return null;

  const merged = {
    epNum: Number(epNum),
    title: sched?.title || base?.title || "",
    tmdbId: sched?.tmdbId || base?.tmdbId || null,
    ...(base || {}),
    ...(override || {}),
  };
  if (sched?.tmdbId && !merged.tmdbId) {
    merged.tmdbId = sched.tmdbId;
  }

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

export async function getMergedEpisodeDataByNumber(epNum, options = {}) {
  if (!epNum) return null;
  const state = await readBfeState(options);
  return getMergedEpisodeDataWithState(epNum, state);
}

export async function getAllRankedLeaderboardItems(providedState = null, options = {}) {
  const state = providedState || (await readBfeState(options));
  const allNums = new Set([
    ...Object.keys(seedEpisodes),
    ...Object.keys(state.episodeOverrides || {}),
  ]);

  const items = [];
  for (const key of allNums) {
    const ep = getMergedEpisodeDataWithState(Number(key), state);
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

export async function getPatronContributorLeaderboard(providedState = null) {
  const counts = new Map();

  const bump = (rawName, score) => {
    const clean = String(rawName || "").trim();
    if (!clean) return;
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

  const state = providedState || (await readBfeState());
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
          ? "Iron Fifth-Seater"
          : p.count >= 3
            ? "Regular Critic"
            : "Fifth-Seat Backer",
    }))
    .sort((a, b) => b.submissions - a.submissions || a.name.localeCompare(b.name));
}
