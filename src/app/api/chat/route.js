// src/app/api/chat/route.js
import dns from "node:dns";
import { NextResponse } from "next/server";
import { searchTranscripts, getArchiveStats } from "@/lib/transcriptSearch";
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

async function generateGroundedAnswer(question, sources, leaderboardTop) {
  const contextBlocks = sources
    .map(
      (s, i) =>
        `[Source ${i + 1} | ${s.title} | ${s.section} (~${s.pct}% into episode)]\n${s.text}`
    )
    .join("\n\n");

  const scoreTableSummary = leaderboardTop
    .slice(0, 20)
    .map(
      (ep) =>
        `Ep ${ep.epNum} (${ep.filmTitle || ep.title}): Combined=${ep.combinedScore}/10, Hosts=${JSON.stringify(
          ep.hosts || {}
        )}, FifthSeatAvg=${ep.fifthSeatAvg ?? "none"} (${ep.fifthSeatCount || 0} patrons), RandomWord=${
          ep.randomWord || "—"
        }`
    )
    .join("\n");

  const systemPrompt = `You are the Best Film Ever (BFE) Podcast Archive Assistant — an expert on hosts Ian, Liam, Megan ("Megs"), Kevin ("Kev"), Georgia, and BFF Patreon guests.
Answer the user's question accurately and conversationally using ONLY the retrieved episode transcript excerpts and verified scorecard summary below.
Always cite specific episode numbers and film titles (e.g., "In Episode 358 - Gangs of New York..."). If an older episode hasn't been backfilled into the transcript index yet, say so clearly rather than guessing.

VERIFIED RECENT SCORECARDS:
${scoreTableSummary}

RETRIEVED TRANSCRIPT EXCERPTS:
${contextBlocks || "(No direct lexical matches found in indexed transcripts.)"}`;

  // 1) Google Gemini (GEMINI_API_KEY via x-goog-api-key header with IPv4 + retry + model fallback)
  if (process.env.GEMINI_API_KEY) {
    const candidates = process.env.GEMINI_MODEL
      ? [process.env.GEMINI_MODEL]
      : [
          "gemini-3.6-flash",
          "gemini-3.5-flash",
          "gemini-3.5-flash-lite",
          "gemini-3.8-flash",
          "gemini-3.7-flash",
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
              contents: [{ role: "user", parts: [{ text: question }] }],
              generationConfig: { temperature: 0.25 },
            }),
          },
          { retries: 1, timeoutMs: 25000 }
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

  // 4) Graceful direct-transcript fallback (never throws a 500 error!)
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
    if (!question) {
      return NextResponse.json({ ok: false, error: "Ask a question first." }, { status: 400 });
    }

    const sources = searchTranscripts(question, { topK: 8 });
    const leaderboard = await getAllRankedLeaderboardItems();
    const { answer, model } = await generateGroundedAnswer(question, sources, leaderboard);

    return NextResponse.json({
      ok: true,
      answer,
      model,
      sources: sources.slice(0, 6),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Failed querying BFE archive." },
      { status: 500 }
    );
  }
}
