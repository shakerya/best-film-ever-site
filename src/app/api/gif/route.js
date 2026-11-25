// src/app/api/gif/route.js
import { NextResponse } from "next/server";
import {
  readBfeState,
  writeBfeState,
  forwardToGoogleSheetWebhook,
} from "@/lib/bfeStore";
import { coerceDirectGifUrl, normalizeGifKey } from "@/lib/bfeShared";

function normalizeSecretWord(w) {
  return String(w || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function wordsMatch(guessRaw, targetRaw) {
  const g = normalizeSecretWord(guessRaw);
  const t = normalizeSecretWord(targetRaw);
  if (!g || !t) return false;
  if (g === t) return true;
  // Tolerate simple singular/plural ("cannonballs" vs "cannonball")
  if (g === `${t}s` || `${g}s` === t) return true;
  return false;
}

async function searchLiveTenorGifs(query, limit = 18) {
  const slug = encodeURIComponent(query.trim().toLowerCase().replace(/\s+/g, "-"));
  const res = await fetch(`https://tenor.com/search/${slug}-gifs`, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
    },
    cache: "no-store",
  });

  if (!res.ok) return [];
  const html = await res.text();
  const matches = html.matchAll(/https:\/\/media\d*\.tenor\.com\/[^\s"<>\\]+\.gif/gi);

  const byKey = new Map();
  for (const m of matches) {
    const url = m[0];
    const key = normalizeGifKey(url);
    if (!key) continue;

    // Prefer fast medium-grid AAAAM preview if both AAAAC and AAAAM appear, or keep first seen
    const existing = byKey.get(key);
    if (!existing || (existing.url.includes("AAAAC/") && url.includes("AAAAM/"))) {
      const slugPart = url.split("/").pop()?.replace(/\.gif$/i, "") || query;
      const title = slugPart.replace(/-/g, " ").trim();
      byKey.set(key, {
        id: key,
        title: title || query,
        url,
      });
    }
    if (byKey.size >= limit) break;
  }

  return Array.from(byKey.values());
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const q = String(searchParams.get("q") || "").trim();

  if (q) {
    // 1) Optional Giphy API key if configured
    const giphyKey = process.env.GIPHY_API_KEY || "";
    if (giphyKey) {
      try {
        const res = await fetch(
          `https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(
            giphyKey
          )}&q=${encodeURIComponent(q)}&limit=18&rating=pg-13`,
          { cache: "no-store" }
        );
        if (res.ok) {
          const data = await res.json();
          const results = (data?.data || [])
            .map((g) => ({
              id: g.id,
              title: g.title || q,
              url: g.images?.downsized_medium?.url || g.images?.original?.url || "",
            }))
            .filter((g) => g.url);
          if (results.length > 0) {
            return NextResponse.json({ ok: true, results, provider: "giphy" });
          }
        }
      } catch {
        // fall through to live Tenor search
      }
    }

    // 2) Live Tenor GIF search (works out-of-the-box for any search query)
    try {
      const tenorResults = await searchLiveTenorGifs(q, 18);
      return NextResponse.json({
        ok: true,
        results: tenorResults,
        provider: "tenor",
      });
    } catch (e) {
      return NextResponse.json(
        { ok: false, results: [], error: e?.message || "GIF search unavailable." },
        { status: 502 }
      );
    }
  }

  // Redact active secret word on public GET
  const state = await readBfeState();
  const safeRounds = (state.gifRounds || []).map((r) =>
    r.status === "open"
      ? {
          id: r.id,
          epNum: r.epNum,
          filmTitle: r.filmTitle,
          hint: r.hint,
          status: r.status,
          entryCount: (r.entries || []).length,
        }
      : r
  );
  return NextResponse.json({ ok: true, rounds: safeRounds });
}

export async function POST(req) {
  try {
    const body = await req.json();
    if (body?.website) return NextResponse.json({ ok: true });

    const action = String(body?.action || "submit");

    if (action === "unlock") {
      const roundId = String(body?.roundId || "").trim();
      const guess = String(body?.word || "").trim();
      const state = await readBfeState({ fresh: true });
      const round = (state.gifRounds || []).find((r) => r.id === roundId);
      if (!round) {
        return NextResponse.json({ ok: false, error: "Round not found." }, { status: 404 });
      }
      if (!wordsMatch(guess, round.randomWord)) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Not quite — listen to the start of the Endgame segment for this week’s Random Word.",
          },
          { status: 400 }
        );
      }
      return NextResponse.json({
        ok: true,
        unlockedWord: round.randomWord,
        entries: round.entries || [],
        threadTweetUrl: round.threadTweetUrl || "",
      });
    }

    const roundId = String(body?.roundId || "").trim();
    const word = String(body?.word || "").trim();
    const name = String(body?.name || "").trim().slice(0, 80);
    const handle = String(body?.handle || "").trim().slice(0, 50);
    const gifUrl = coerceDirectGifUrl(body?.gifUrl);
    const caption = String(body?.caption || "").trim().slice(0, 200);

    if (!roundId || !name || !gifUrl) {
      return NextResponse.json(
        { ok: false, error: "Please enter your name and select or paste a GIF." },
        { status: 400 }
      );
    }
    if (!/^https?:\/\//i.test(gifUrl)) {
      return NextResponse.json(
        { ok: false, error: "GIF URL must start with https://" },
        { status: 400 }
      );
    }

    const state = await readBfeState({ fresh: true });
    const round = (state.gifRounds || []).find((r) => r.id === roundId);
    if (!round) {
      return NextResponse.json({ ok: false, error: "Round not found." }, { status: 404 });
    }

    if (!wordsMatch(word, round.randomWord)) {
      return NextResponse.json(
        { ok: false, error: "Unlock the arena with this episode’s Random Word first." },
        { status: 403 }
      );
    }

    const incomingKey = normalizeGifKey(gifUrl);
    const dup = (round.entries || []).find(
      (existing) => normalizeGifKey(existing.gifUrl) === incomingKey
    );
    if (dup) {
      return NextResponse.json(
        {
          ok: false,
          duplicate: true,
          error: `Duplicate GIF blocked: ${dup.name} already claimed that exact GIF. Pick another so you don’t get disqualified on air!`,
        },
        { status: 409 }
      );
    }

    const newEntry = {
      id: `gif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      handle,
      gifUrl,
      caption,
      createdAt: new Date().toISOString(),
    };

    let updatedRound = null;
    await writeBfeState(
      (draft) => {
        const targetRound = draft.gifRounds.find((r) => r.id === roundId);
        if (targetRound) {
          targetRound.entries = [...(targetRound.entries || []), newEntry];
          updatedRound = targetRound;
        }
        return draft;
      },
      { type: "gif_entry", roundId, name, handle, gifUrl, caption }
    );

    await forwardToGoogleSheetWebhook("gif_entry", {
      roundId,
      filmTitle: round.filmTitle,
      randomWord: round.randomWord,
      ...newEntry,
    });

    return NextResponse.json({
      ok: true,
      entry: newEntry,
      entries: updatedRound?.entries || [],
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Failed saving GIF entry." },
      { status: 500 }
    );
  }
}
