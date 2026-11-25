// src/app/api/gif/route.js
import { NextResponse } from "next/server";
import {
  readBfeState,
  writeBfeState,
  normalizeGifKey,
  forwardToGoogleSheetWebhook,
} from "@/lib/bfeStore";

const FALLBACK_STARTER_GIFS = [
  {
    title: "Anchorman Cannonball",
    url: "https://media.giphy.com/media/l2Je4YMcwUymua0rC/giphy.gif",
  },
  {
    title: "Pirate Ship Cannon Fire",
    url: "https://media.giphy.com/media/7khTD5qvP0bFm/giphy.gif",
  },
  {
    title: "Dog Pool Cannonball Jump",
    url: "https://media.giphy.com/media/3o6Zt481isNVuQI1l6/giphy.gif",
  },
  {
    title: "Celebration Fireworks Cannon",
    url: "https://media.giphy.com/media/peAFQfg7Ol6IE/giphy.gif",
  },
  {
    title: "Scorsese Absolute Cinema",
    url: "https://media.giphy.com/media/TFIoWBxZp2EKM/giphy.gif",
  },
  {
    title: "Bill the Butcher Hat Tip",
    url: "https://media.giphy.com/media/vnOQdGt1IlnsDpZWJk/giphy.gif",
  },
];

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const q = String(searchParams.get("q") || "").trim();

  if (q) {
    const apiKey = process.env.GIPHY_API_KEY || "";
    if (apiKey) {
      try {
        const res = await fetch(
          `https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(
            apiKey
          )}&q=${encodeURIComponent(q)}&limit=12&rating=pg-13`,
          { cache: "no-store" }
        );
        if (res.ok) {
          const data = await res.json();
          const results = (data?.data || []).map((g) => ({
            id: g.id,
            title: g.title || q,
            url: g.images?.downsized_medium?.url || g.images?.original?.url || "",
          })).filter((g) => g.url);
          return NextResponse.json({ ok: true, results, provider: "giphy" });
        }
      } catch {
        // fall through to curated starter pack
      }
    }

    const lower = q.toLowerCase();
    const filtered = FALLBACK_STARTER_GIFS.filter((g) =>
      g.title.toLowerCase().includes(lower)
    );
    return NextResponse.json({
      ok: true,
      results: filtered.length ? filtered : FALLBACK_STARTER_GIFS,
      provider: "starter",
    });
  }

  const state = readBfeState();
  return NextResponse.json({ ok: true, rounds: state.gifRounds || [] });
}

export async function POST(req) {
  try {
    const body = await req.json();
    if (body?.website) return NextResponse.json({ ok: true });

    const action = String(body?.action || "submit");

    // Verify random word without spoilers
    if (action === "unlock") {
      const roundId = String(body?.roundId || "").trim();
      const guess = String(body?.word || "").trim().toLowerCase();
      const state = readBfeState();
      const round = (state.gifRounds || []).find((r) => r.id === roundId);
      if (!round) {
        return NextResponse.json({ ok: false, error: "Round not found." }, { status: 404 });
      }
      const target = String(round.randomWord || "").trim().toLowerCase();
      if (guess !== target) {
        return NextResponse.json(
          {
            ok: false,
            error: "Not quite! Listen to the start of the Endgame for this week’s Random Word.",
          },
          { status: 400 }
        );
      }
      return NextResponse.json({ ok: true, unlockedWord: round.randomWord });
    }

    const roundId = String(body?.roundId || "").trim();
    const word = String(body?.word || "").trim();
    const name = String(body?.name || "").trim().slice(0, 80);
    const handle = String(body?.handle || "").trim().slice(0, 50);
    const gifUrl = String(body?.gifUrl || "").trim();
    const caption = String(body?.caption || "").trim().slice(0, 200);

    if (!roundId || !name || !gifUrl) {
      return NextResponse.json(
        { ok: false, error: "Please enter your name and pick or paste a GIF." },
        { status: 400 }
      );
    }
    if (!/^https?:\/\//i.test(gifUrl)) {
      return NextResponse.json(
        { ok: false, error: "GIF URL must start with https://" },
        { status: 400 }
      );
    }

    const state = readBfeState();
    const round = (state.gifRounds || []).find((r) => r.id === roundId);
    if (!round) {
      return NextResponse.json({ ok: false, error: "Round not found." }, { status: 404 });
    }

    if (word.toLowerCase() !== String(round.randomWord || "").trim().toLowerCase()) {
      return NextResponse.json(
        { ok: false, error: "Secret Random Word doesn't match this episode!" },
        { status: 400 }
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
          error: `Duplicate GIF blocked! ${dup.name} already claimed that exact GIF — pick a different one so you don’t get disqualified on air!`,
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
    writeBfeState((draft) => {
      const targetRound = draft.gifRounds.find((r) => r.id === roundId);
      if (targetRound) {
        targetRound.entries = [...(targetRound.entries || []), newEntry];
        updatedRound = targetRound;
      }
      return draft;
    });

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
