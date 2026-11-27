// src/app/api/chat/route.js
import dns from "node:dns";
import { NextResponse } from "next/server";
import {
  searchTranscripts,
  getArchiveStats,
  getCatalogSummaryForPrompt,
} from "@/lib/transcriptSearch";
import { getAllRankedLeaderboardItems } from "@/lib/bfeStore";

// Prevent macOS Node IPv6 DNS flakiness ("TypeError: fetch failed")
try {
  dns.setDefaultResultOrder("ipv4first");
} catch {
  // ignore
}

function checkAccess(req) {
  if (process.env.PUBLIC_PATRON_CHAT === "true") return true;
  const requiredCode =
    process.env.CHAT_PASSCODE || process.env.ADMIN_PASSCODE || "bfe-vault";
  const provided = String(req.headers.get("x-bfe-passcode") || "").trim();
  return provided === requiredCode;
}

async function fetchWithRetry(url, options = {}, { retries = 2, timeoutMs = 28000 } = {}) {
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
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }
    }
  }
  throw lastErr;
}

async function generateGroundedAnswer({
  question,
  history = [],
  sources = [],
  unindexedTargets = [],
  leaderboard = [],
  stats,
}) {
  const contextBlocks = sources
    .map(
      (s, i) =>
        `[Excerpt ${i + 1} | ${s.title} | ${s.section} (~${s.pct}% into episode)]\n${s.text}`
    )
    .join("\n\n");

  // Provide ALL verified structured scorecards (ranked #1 to #N) so top/bottom/host-score queries are 100% exact
  const scoreTableSummary = leaderboard
    .map((ep) => {
      const guestsStr = (ep.guests || []).length
        ? `, Guests=${ep.guests.map((g) => `${g.name}:${g.score}`).join(",")}`
        : "";
      const beetStr = ep.beetrootPct !== undefined ? `, Beetroot=${ep.beetrootPct}%` : "";
      return `#${ep.rank} Ep ${ep.epNum} (${ep.filmTitle || ep.title}): OfficialBFE=${ep.combinedScore}/10 | Hosts=${JSON.stringify(
        ep.hosts || {}
      )}${guestsStr} | 5thSeat=${ep.fifthSeatAvg ?? "none"} (${ep.fifthSeatCount || 0} patrons)${beetStr}${
        ep.randomWord ? ` | RandomWord=${ep.randomWord}` : ""
      }`;
    })
    .join("\n");

  const catalogLine = getCatalogSummaryForPrompt();

  const unindexedBanner = unindexedTargets.length
    ? `\nUNINDEXED EPISODE NOTE: The user asked about ${unindexedTargets
        .map((t) => `Episode ${t.epNum} — ${t.title} (${t.year})`)
        .join(
          ", "
        )}, which WAS officially reviewed by Best Film Ever, and its full audio transcript is currently in the final Ep 1–${
        (stats?.minEpNum || 83) - 1
      } transcription queue finishing now. Mention the exact episode number/year clearly and share any verified facts you have without inventing spoken quotes!\n`
    : "";

  const systemPrompt = `You are the Best Film Ever (BFE) Podcast Vault Assistant — a sharp, knowledgeable superfan and archivist for hosts Ian, Liam, Megan ("Megs"), Kevin ("Kev"), Georgia, and BFF Patreon guests.

HOW TO GIVE GREAT ANSWERS:
1. Be specific, vivid, and thorough: cite exact Episode numbers + Movie titles, quote or paraphrase memorable jokes/stories/arguments from the transcript excerpts, and break down individual host opinions & out-of-10 scores whenever available.
2. Speaker attribution tip: Transcripts come from audio speech-to-text without speaker tags, so infer who said what carefully from context (e.g. the opening roll-call at ~0% lists which hosts are on the episode, and Ian calls on each host by name during the ~85–100% Endgame score round!). If it isn't 100% clear which specific host spoke a line, say "one of the hosts noted..." rather than guessing the wrong person.
3. Master Catalog & Scorecards:
   - Below is the COMPLETE 358-episode BFE Master Film List (\`✓\` = full transcript indexed right now [${stats?.episodeCount || 290} episodes]; \`⏳\` = audio in final Ep 1–${(stats?.minEpNum || 83) - 1} transcription queue). Use this to answer "Have they ever reviewed X?", "Which Spielberg/90s/sequel films did they cover?", etc. with 100% accuracy.
   - Structured Official Scorecards below cover Episodes 301–358. For older transcribed episodes (Ep 83–300), read the hosts' out-of-10 scores directly from the ~85–100% Endgame transcript excerpts!
4. Never invent scores or quotes not grounded in the scorecards or excerpts below. Format cleanly with short paragraphs or bullet points so it's easy to scan.
${unindexedBanner}
COMPLETE 358-EPISODE BFE FILM CATALOG (✓ = transcribed, ⏳ = in final transcription queue):
${catalogLine}

VERIFIED OFFICIAL SCORECARDS (Episodes 301–358, Ranked High-to-Low):
${scoreTableSummary}

RETRIEVED TRANSCRIPT EXCERPTS FOR THIS QUERY:
${contextBlocks || "(No direct transcript passages matched — rely on the 358-Episode Catalog and Official Scorecards above.)"}`;

  // Format recent conversation history (up to last 6 messages) so follow-ups ("what did Liam give it?") work seamlessly
  const cleanHistory = Array.isArray(history)
    ? history
        .slice(-6)
        .filter((m) => m && (m.role === "user" || m.role === "assistant") && m.content)
    : [];

  // 1) Google Gemini (GEMINI_API_KEY)
  if (process.env.GEMINI_API_KEY) {
    const candidates = process.env.GEMINI_MODEL
      ? [process.env.GEMINI_MODEL]
      : ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-3-flash-preview", "gemini-3.5-flash-lite"];

    const geminiContents = [
      ...cleanHistory.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: String(m.content).slice(0, 2500) }],
      })),
      { role: "user", parts: [{ text: question }] },
    ];

    for (const geminiModel of candidates) {
      try {
        const res = await fetchWithRetry(
          `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": process.env.GEMINI_API_KEY,
            },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemPrompt }] },
              contents: geminiContents,
              generationConfig: { temperature: 0.25 },
            }),
          },
          { retries: 1, timeoutMs: 26000 }
        );

        if (res.ok) {
          const data = await res.json();
          const text = data?.candidates?.[0]?.content?.parts
            ?.map((p) => p.text || "")
            .join("")
            .trim();
          if (text) return { answer: text, model: geminiModel };
        }
        if (res.status !== 503 && res.status !== 429 && res.status !== 404) break;
      } catch (err) {
        console.warn(`[chat] ${geminiModel} fetch failed, trying next:`, err?.message);
      }
    }
  }

  // 2) Groq (GROQ_API_KEY)
  if (process.env.GROQ_API_KEY) {
    try {
      const res = await fetchWithRetry("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          temperature: 0.25,
          messages: [
            { role: "system", content: systemPrompt },
            ...cleanHistory.map((m) => ({
              role: m.role,
              content: String(m.content).slice(0, 2000),
            })),
            { role: "user", content: question },
          ],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const text = data?.choices?.[0]?.message?.content?.trim();
        if (text) return { answer: text, model: "llama-3.3-70b-versatile" };
      }
    } catch (err) {
      console.warn("[chat] Groq fetch failed:", err?.message);
    }
  }

  // 3) OpenAI (OPENAI_API_KEY)
  if (process.env.OPENAI_API_KEY) {
    try {
      const res = await fetchWithRetry("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.25,
          messages: [
            { role: "system", content: systemPrompt },
            ...cleanHistory.map((m) => ({
              role: m.role,
              content: String(m.content).slice(0, 2000),
            })),
            { role: "user", content: question },
          ],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const text = data?.choices?.[0]?.message?.content?.trim();
        if (text) return { answer: text, model: "gpt-4o-mini" };
      }
    } catch (err) {
      console.warn("[chat] OpenAI fetch failed:", err?.message);
    }
  }

  // 4) Graceful direct-transcript fallback
  if (!sources.length) {
    return {
      answer:
        "I didn’t find an exact match in the currently indexed transcripts. Try another movie title, host name, or phrase!",
      model: "bm25-direct",
    };
  }

  const bullets = sources
    .slice(0, 4)
    .map(
      (s) =>
        `• **${s.title}** (*${s.section}*, ~${s.pct}% in): “${s.text.slice(0, 340).trim()}…”`
    )
    .join("\n\n");

  return {
    answer: `Here are the top matching passages directly from the BFE transcripts:\n\n${bullets}`,
    model: "bm25-direct",
  };
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    stats: getArchiveStats(),
    hasLlmKey: Boolean(
      process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY
    ),
    requiresPasscode: process.env.PUBLIC_PATRON_CHAT !== "true",
  });
}

export async function POST(req) {
  if (!checkAccess(req)) {
    return NextResponse.json(
      { ok: false, error: "Invalid vault passcode. Access restricted to owner preview." },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const question = String(body?.question || "").trim().slice(0, 600);
    const history = Array.isArray(body?.history) ? body.history.slice(-6) : [];
    if (!question) {
      return NextResponse.json({ ok: false, error: "Ask a question first." }, { status: 400 });
    }

    const recentContextText = history
      .slice(-2)
      .map((m) => m?.content || "")
      .join(" ");

    const stats = getArchiveStats();
    const { sources, unindexedTargets } = searchTranscripts(question, {
      topK: 15,
      recentContextText,
    });
    const leaderboard = await getAllRankedLeaderboardItems();
    const { answer, model } = await generateGroundedAnswer({
      question,
      history,
      sources,
      unindexedTargets,
      leaderboard,
      stats,
    });

    return NextResponse.json({
      ok: true,
      answer,
      model,
      sources: sources.slice(0, 8),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Failed querying BFE archive." },
      { status: 500 }
    );
  }
}
