#!/usr/bin/env node
/**
 * scripts/sync-episodes.mjs
 *
 * Resilient BFE Podcast Archive Sync & Ep 1–300 Backfill Pipeline
 */

import { execFile } from "node:child_process";
import dns from "node:dns";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import zlib from "node:zlib";
import { XMLParser } from "fast-xml-parser";

const execFileAsync = promisify(execFile);
const LOCAL_WHISPER_BIN =
  process.env.WHISPER_BIN || "/Users/aashrey/.gemini/antigravity/scratch/whisper-engine/main";
const LOCAL_WHISPER_MODEL =
  process.env.WHISPER_MODEL ||
  "/Users/aashrey/.gemini/antigravity/scratch/whisper-engine/models/ggml-base.en.bin";
const DEFAULT_PODCAST_RSS_URL = "https://feed.podbean.com/bestfilmever/feed.xml";

try {
  dns.setDefaultResultOrder("ipv4first");
} catch {
  // ignore
}

const ROOT = process.cwd();
const ENV_LOCAL = path.join(ROOT, ".env.local");
const CORPUS_GZ = path.join(ROOT, "src/data/transcriptCorpus.json.gz");
const SYNCED_DIR = path.join(ROOT, "src/data/synced-transcripts");
const LOCAL_TXT_ARCHIVE = "/Users/aashrey/.gemini/antigravity/scratch/bfe-transcripts/txt";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchRetry(url, options = {}, { retries = 4, timeoutMs = 180000 } = {}) {
  let lastErr = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      return res;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      if (attempt < retries) {
        const waitMs = 1500 * Math.pow(2, attempt);
        console.warn(`  [Retry ${attempt + 1}/${retries}] ${err?.message} — waiting ${waitMs}ms`);
        await sleep(waitMs);
      }
    }
  }
  throw lastErr;
}

function loadEnvLocal() {
  if (!fs.existsSync(ENV_LOCAL)) return;
  for (const line of fs.readFileSync(ENV_LOCAL, "utf-8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const idx = trimmed.indexOf("=");
    const k = trimmed.slice(0, idx).trim();
    const v = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[k]) process.env[k] = v;
  }
}

function makeSlug(rawTitle) {
  return String(rawTitle || "")
    .trim()
    .toLowerCase()
    .replace(/&amp;/g, "and")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseEpNum(title) {
  const m = String(title || "")
    .trim()
    .match(/^(?:episode|ep\.?)\s*(\d{1,4})\s*[-:–—]/i);
  return m ? Number(m[1]) : null;
}

function parseDurationSec(raw) {
  const s = String(raw || "").trim();
  if (!s) return 0;
  if (/^\d+$/.test(s)) return Number(s);
  const parts = s.split(":").map(Number);
  if (parts.some((n) => !Number.isFinite(n))) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

function chunkTranscript(text, wordsPerChunk = 420, overlap = 60) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const chunks = [];
  const step = Math.max(1, wordsPerChunk - overlap);
  for (let start = 0; start < words.length; start += step) {
    const end = Math.min(words.length, start + wordsPerChunk);
    const pct = Math.round((start / Math.max(1, words.length)) * 100);
    const sec =
      pct < 12
        ? "Intro, Patreon Shoutouts & GIF of the Week"
        : pct < 26
          ? "Morning Report & Host Banter"
          : pct < 68
            ? "Film Deep Dive & Scene Breakdown"
            : pct < 86
              ? "Endgame (Money Money Money, Age Game & Categories)"
              : "Good/Bad/Ebes, Fifth-Seat & Final Verdicts";
    chunks.push({ p: pct, s: sec, t: words.slice(start, end).join(" ") });
    if (end >= words.length) break;
  }
  return chunks;
}

export function getIndexedSlugsAndEpNums() {
  const slugs = new Set();
  const epNums = new Set();

  if (fs.existsSync(CORPUS_GZ)) {
    const parsed = JSON.parse(zlib.gunzipSync(fs.readFileSync(CORPUS_GZ)).toString("utf-8"));
    for (const ep of parsed.episodes || []) {
      if (ep.slug) slugs.add(ep.slug);
      if (ep.epNum) epNums.add(Number(ep.epNum));
    }
  }
  if (fs.existsSync(SYNCED_DIR)) {
    for (const f of fs.readdirSync(SYNCED_DIR)) {
      if (!f.endsWith(".json")) continue;
      try {
        const ep = JSON.parse(fs.readFileSync(path.join(SYNCED_DIR, f), "utf-8"));
        if (ep.slug) slugs.add(ep.slug);
        if (ep.epNum) epNums.add(Number(ep.epNum));
      } catch {
        // ignore
      }
    }
  }
  return { slugs, epNums };
}

export async function fetchRssEpisodes() {
  const rssUrl = process.env.PODCAST_RSS_URL || DEFAULT_PODCAST_RSS_URL;
  const res = await fetchRetry(rssUrl, {}, { retries: 3, timeoutMs: 30000 });
  if (!res.ok) throw new Error(`RSS fetch failed: ${res.status}`);
  const xml = await res.text();
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
  const data = parser.parse(xml);
  const items = data?.rss?.channel?.item || [];
  const arr = Array.isArray(items) ? items : [items];

  return arr.map((it) => {
    const title = String(it?.title || "").trim();
    const epNum = parseEpNum(title);
    const enc = Array.isArray(it?.enclosure) ? it.enclosure[0] : it?.enclosure;
    const audioUrl = String(enc?.["@_url"] || "").replace(/^http:\/\//, "https://");
    const durationSec = parseDurationSec(it?.["itunes:duration"]);
    return {
      title,
      slug: makeSlug(title),
      epNum,
      isFull: epNum !== null,
      pubDate: String(it?.pubDate || ""),
      audioUrl,
      durationSec,
    };
  });
}

async function transcribePartWithGemini(sliceBuf, displayName, geminiKey) {
  const startRes = await fetchRetry(
    "https://generativelanguage.googleapis.com/upload/v1beta/files",
    {
      method: "POST",
      headers: {
        "x-goog-api-key": geminiKey,
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": String(sliceBuf.length),
        "X-Goog-Upload-Header-Content-Type": "audio/mpeg",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ file: { display_name: displayName } }),
    },
    { retries: 3, timeoutMs: 60000 }
  );
  if (!startRes.ok) {
    throw new Error(`Gemini upload init failed (${startRes.status}): ${await startRes.text()}`);
  }
  const uploadUrl = startRes.headers.get("x-goog-upload-url");
  if (!uploadUrl) throw new Error("Missing x-goog-upload-url header from Gemini File API");

  const upRes = await fetchRetry(
    uploadUrl,
    {
      method: "POST",
      headers: {
        "Content-Length": String(sliceBuf.length),
        "X-Goog-Upload-Offset": "0",
        "X-Goog-Upload-Command": "upload, finalize",
      },
      body: sliceBuf,
    },
    { retries: 3, timeoutMs: 240000 }
  );
  if (!upRes.ok) {
    throw new Error(`Gemini byte upload failed (${upRes.status}): ${await upRes.text()}`);
  }
  let fileInfo = (await upRes.json())?.file;

  try {
    while (fileInfo?.state === "PROCESSING") {
      await sleep(3000);
      const pollRes = await fetchRetry(
        `https://generativelanguage.googleapis.com/v1beta/${fileInfo.name}`,
        { headers: { "x-goog-api-key": geminiKey } },
        { retries: 3, timeoutMs: 30000 }
      );
      if (pollRes.ok) fileInfo = await pollRes.json();
      else break;
    }

    const models = process.env.GEMINI_MODEL
      ? [process.env.GEMINI_MODEL]
      : [
          "gemini-3.6-flash",
          "gemini-3.5-flash",
          "gemini-3.5-flash-lite",
          "gemini-3.8-flash",
          "gemini-3.7-flash",
        ];

    let genData = null;
    let lastErr = "";
    for (const geminiModel of models) {
      // Allow rate-limit backoff retries per model
      for (let r = 0; r < 3; r++) {
        const genRes = await fetchRetry(
          `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": geminiKey,
            },
            body: JSON.stringify({
              contents: [
                {
                  role: "user",
                  parts: [
                    {
                      fileData: {
                        mimeType: "audio/mpeg",
                        fileUri: fileInfo.uri,
                      },
                    },
                    {
                      text: "Transcribe this podcast audio segment word-for-word in English as plain text, one sentence or speaker turn per line. Do not summarize or omit sections.",
                    },
                  ],
                },
              ],
              generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 65536,
              },
            }),
          },
          { retries: 2, timeoutMs: 360000 }
        );
        if (genRes.ok) {
          genData = await genRes.json();
          break;
        }
        const errBody = await genRes.text();
        lastErr = `${geminiModel} (${genRes.status}): ${errBody.slice(0, 240)}`;
        if (genRes.status === 429) {
          console.warn(`  [Rate limit on ${geminiModel}] Waiting 35s before trying next/retry...`);
          await sleep(35000);
          continue;
        }
        break;
      }
      if (genData) break;
    }

    if (!genData) {
      throw new Error(`Gemini transcribe failed: ${lastErr}`);
    }

    return (
      genData?.candidates?.[0]?.content?.parts
        ?.map((p) => p.text || "")
        .join("")
        .trim() || ""
    );
  } finally {
    if (fileInfo?.name) {
      await fetchRetry(
        `https://generativelanguage.googleapis.com/v1beta/${fileInfo.name}`,
        { method: "DELETE", headers: { "x-goog-api-key": geminiKey } },
        { retries: 1, timeoutMs: 15000 }
      ).catch(() => {});
    }
  }
}

async function transcribeWithLocalMetalWhisper(buf, slug) {
  const tmpId = `${slug.slice(0, 48)}_${Date.now()}`;
  const mp3Path = path.join(os.tmpdir(), `${tmpId}.mp3`);
  const wavPath = path.join(os.tmpdir(), `${tmpId}.wav`);
  const outPrefix = path.join(os.tmpdir(), `${tmpId}_out`);
  const outTxtPath = `${outPrefix}.txt`;

  try {
    fs.writeFileSync(mp3Path, buf);
    const t0 = Date.now();
    if (fs.existsSync("/usr/bin/afconvert")) {
      console.log("  [Local M3 Metal] Decoding MP3 -> 16kHz WAV via macOS CoreAudio (afconvert)...");
      await execFileAsync("/usr/bin/afconvert", [
        "-f",
        "WAVE",
        "-d",
        "LEI16@16000",
        "-c",
        "1",
        mp3Path,
        wavPath,
      ]);
    } else {
      console.log("  [Whisper CLI] Decoding MP3 -> 16kHz WAV via ffmpeg...");
      await execFileAsync("ffmpeg", [
        "-y",
        "-i",
        mp3Path,
        "-ar",
        "16000",
        "-ac",
        "1",
        "-c:a",
        "pcm_s16le",
        wavPath,
      ]);
    }
    // Free MP3 immediately so temp disk footprint stays minimal
    fs.unlinkSync(mp3Path);

    const threads = String(Math.max(4, Math.min(8, os.cpus()?.length || 4)));
    console.log(`  [Whisper CLI] Running whisper.cpp (${threads} threads)...`);
    await execFileAsync(
      LOCAL_WHISPER_BIN,
      [
        "-m",
        LOCAL_WHISPER_MODEL,
        "-f",
        wavPath,
        "-l",
        "en",
        "-nt",
        "-otxt",
        "-of",
        outPrefix,
        "-t",
        threads,
      ],
      { maxBuffer: 64 * 1024 * 1024 }
    );

    const text = fs.readFileSync(outTxtPath, "utf-8");
    const cleaned = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .join("\n");
    const elapsedSec = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`  [Whisper CLI] Transcribed in ${elapsedSec}s!`);
    return cleaned;
  } finally {
    for (const f of [mp3Path, wavPath, outTxtPath]) {
      try {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      } catch {
        // ignore cleanup error
      }
    }
  }
}

async function transcribeMp3Buffer(buf, filename) {
  // Priority 1: Local whisper.cpp (Apple Metal on macOS or cached CPU binary in GitHub Actions)
  if (fs.existsSync(LOCAL_WHISPER_BIN) && fs.existsSync(LOCAL_WHISPER_MODEL)) {
    return transcribeWithLocalMetalWhisper(buf, filename);
  }

  const groqKey = process.env.GROQ_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!groqKey && !openaiKey && !geminiKey) {
    throw new Error(
      "Add GEMINI_API_KEY, GROQ_API_KEY, or OPENAI_API_KEY in .env.local to transcribe audio."
    );
  }

  if (!groqKey && !openaiKey && geminiKey) {
    // ~32MB slices (~30-35 min of podcast audio each -> ~6,500 words -> well under 65k token cap!)
    const GEMINI_SLICE = 32 * 1024 * 1024;
    const parts = [];
    for (let offset = 0; offset < buf.length; offset += GEMINI_SLICE) {
      parts.push(buf.subarray(offset, Math.min(buf.length, offset + GEMINI_SLICE)));
    }
    const texts = [];
    for (let i = 0; i < parts.length; i++) {
      const t0 = Date.now();
      console.log(
        `  [Gemini Audio] Part ${i + 1}/${parts.length} (${(parts[i].length / (1024 * 1024)).toFixed(1)} MB)...`
      );
      const t = await transcribePartWithGemini(parts[i], `${filename}_p${i + 1}`, geminiKey);
      const sec = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`  [Gemini Audio] Part ${i + 1}/${parts.length} done in ${sec}s (${t.split(/\s+/).length} words)`);
      texts.push(t);
    }
    return texts.join("\n");
  }

  const endpoint = groqKey
    ? "https://api.groq.com/openai/v1/audio/transcriptions"
    : "https://api.openai.com/v1/audio/transcriptions";
  const apiKey = groqKey || openaiKey;
  const model = groqKey ? "whisper-large-v3-turbo" : "whisper-1";

  const MAX_SLICE = 22 * 1024 * 1024;
  const parts = [];
  for (let offset = 0; offset < buf.length; offset += MAX_SLICE) {
    parts.push(buf.subarray(offset, Math.min(buf.length, offset + MAX_SLICE)));
  }

  const texts = [];
  for (let i = 0; i < parts.length; i++) {
    const form = new FormData();
    form.append("file", new Blob([parts[i]], { type: "audio/mpeg" }), `${filename}_part${i + 1}.mp3`);
    form.append("model", model);
    form.append("language", "en");
    form.append("response_format", "text");

    const res = await fetchRetry(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    if (!res.ok) {
      const errTxt = await res.text().catch(() => "");
      throw new Error(`Transcription API ${res.status}: ${errTxt}`);
    }
    texts.push((await res.text()).trim());
  }

  return texts.join("\n");
}

export async function runSync({
  statusOnly = false,
  backfillFull = false,
  limit = 5,
  latestCount = 0,
  audioDir = "",
} = {}) {
  loadEnvLocal();
  const rssEpisodes = await fetchRssEpisodes();
  const { slugs, epNums } = getIndexedSlugsAndEpNums();

  const isIndexed = (ep) =>
    slugs.has(ep.slug) || (ep.epNum !== null && epNums.has(Number(ep.epNum)));

  const missing = rssEpisodes.filter((ep) => !isIndexed(ep) && ep.audioUrl);
  const missingFull = missing.filter((ep) => ep.isFull);
  const totalMissingHours =
    Math.round((missing.reduce((s, e) => s + (e.durationSec || 0), 0) / 3600) * 10) / 10;
  const fullMissingHours =
    Math.round((missingFull.reduce((s, e) => s + (e.durationSec || 0), 0) / 3600) * 10) / 10;

  console.log("=== Best Film Ever Archive Sync Status ===");
  console.log(`Total RSS Episodes:       ${rssEpisodes.length}`);
  console.log(`Already Indexed:          ${rssEpisodes.length - missing.length}`);
  console.log(
    `Missing Total:            ${missing.length} episodes (~${totalMissingHours} audio hrs)`
  );
  console.log(
    `Missing Full Reviews:     ${missingFull.length} episodes (~${fullMissingHours} audio hrs)`
  );

  if (statusOnly) return { completed: 0, remaining: missing.length };

  const queue =
    latestCount > 0
      ? rssEpisodes.slice(0, latestCount).filter((ep) => !isIndexed(ep) && ep.audioUrl)
      : backfillFull
        ? missingFull.slice(0, limit)
        : missing.slice(0, limit);

  if (!queue.length) {
    console.log("Nothing new to transcribe in selected range — library is up to date!");
    return { completed: 0, remaining: 0 };
  }

  fs.mkdirSync(SYNCED_DIR, { recursive: true });
  if (audioDir) fs.mkdirSync(audioDir, { recursive: true });

  let completed = 0;
  for (const ep of queue) {
    console.log(`\n[Sync] Downloading audio: ${ep.title} ...`);
    const audioRes = await fetchRetry(ep.audioUrl, {}, { retries: 4, timeoutMs: 300000 });
    if (!audioRes.ok) {
      console.error(`  Failed downloading audio (${audioRes.status}), skipping.`);
      continue;
    }
    const buf = Buffer.from(await audioRes.arrayBuffer());
    if (audioDir) {
      fs.writeFileSync(path.join(audioDir, `${ep.slug}.mp3`), buf);
    }

    console.log(
      `[Sync] Transcribing ${(buf.length / (1024 * 1024)).toFixed(1)} MB MP3 for ${ep.title} ...`
    );
    const transcript = await transcribeMp3Buffer(buf, ep.slug);
    const words = transcript.split(/\s+/).filter(Boolean).length;
    const record = {
      epNum: ep.epNum,
      isFull: ep.isFull,
      title: ep.title,
      slug: ep.slug,
      pubDate: ep.pubDate,
      audioUrl: ep.audioUrl,
      words,
      chunks: chunkTranscript(transcript),
    };

    const outPath = path.join(SYNCED_DIR, `${ep.slug}.json`);
    fs.writeFileSync(outPath, JSON.stringify(record, null, 2), "utf-8");

    // Also mirror as downloadable .txt into local scratch archive if directory exists
    try {
      if (fs.existsSync(LOCAL_TXT_ARCHIVE)) {
        const prefix = ep.epNum ? `ep${String(ep.epNum).padStart(3, "0")}` : "extra";
        const txtPath = path.join(LOCAL_TXT_ARCHIVE, `${prefix}_${ep.slug}.txt`);
        const header = `Title: ${ep.title}\nPublished: ${ep.pubDate}\nAudio: ${ep.audioUrl}\n${"=".repeat(72)}\n\n`;
        fs.writeFileSync(txtPath, header + transcript + "\n", "utf-8");
      }
    } catch {
      // ignore optional mirror error
    }

    completed += 1;
    console.log(`[Sync] ✅ Saved ${outPath} (${words.toLocaleString()} words)`);
  }

  return { completed, remaining: missing.length - completed };
}

// Run as CLI if invoked directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const statusOnly = args.includes("--status") || args.length === 0;
  const backfillFull = args.includes("--backfill-full");
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx >= 0 ? Number(args[limitIdx + 1] || 5) : 5;
  const latestIdx = args.indexOf("--latest");
  const latestCount = latestIdx >= 0 ? Number(args[latestIdx + 1] || 3) : 0;
  const audioDirIdx = args.indexOf("--audio-dir");
  const audioDir = audioDirIdx >= 0 ? args[audioDirIdx + 1] : "";

  runSync({ statusOnly, backfillFull, limit, latestCount, audioDir }).catch((err) => {
    console.error("[Sync Error]", err?.message || err);
    process.exit(1);
  });
}
