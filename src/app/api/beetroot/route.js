// src/app/api/beetroot/route.js
import { NextResponse } from "next/server";
import {
  writeBfeState,
  computeBeetrootSummary,
  forwardToGoogleSheetWebhook,
} from "@/lib/bfeStore";

const VALID_CHOICES = new Set(["great", "good", "ok", "poor"]);

export async function POST(req) {
  try {
    const body = await req.json();
    if (body?.website) {
      return NextResponse.json({ ok: true });
    }

    const filmId = String(body?.filmId || "").trim();
    const choice = String(body?.choice || "").trim().toLowerCase();
    const prevChoice = String(body?.prevChoice || "").trim().toLowerCase();
    const name = String(body?.name || "").trim().slice(0, 60);
    const comment = String(body?.comment || "").trim().slice(0, 400);

    if (!filmId || !VALID_CHOICES.has(choice)) {
      return NextResponse.json(
        { ok: false, error: "Pick Great, Good, OK, or Poor." },
        { status: 400 }
      );
    }

    let filmTitle = filmId;
    const nextState = await writeBfeState(
      (draft) => {
        const film = draft.schedule.find((s) => s.id === filmId);
        if (film) filmTitle = film.title;
        if (!draft.beetroot[filmId]) {
          draft.beetroot[filmId] = { great: 0, good: 0, ok: 0, poor: 0, comments: [] };
        }
        const bucket = draft.beetroot[filmId];
        if (VALID_CHOICES.has(prevChoice) && prevChoice !== choice && bucket[prevChoice] > 0) {
          bucket[prevChoice] -= 1;
        }
        if (prevChoice !== choice) {
          bucket[choice] = Number(bucket[choice] || 0) + 1;
        }

        if (comment) {
          bucket.comments = [
            {
              id: `beet-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              name: name || "Fledgling Fandom Listener",
              choice,
              comment,
              createdAt: new Date().toISOString(),
            },
            ...(bucket.comments || []),
          ].slice(0, 50);
        }
        return draft;
      },
      { type: "beetroot", filmId, choice, prevChoice, name, comment }
    );

    await forwardToGoogleSheetWebhook("beetroot_vote", {
      filmId,
      filmTitle,
      choice,
      name,
      comment,
    });

    const summary = computeBeetrootSummary(nextState.beetroot[filmId]);
    return NextResponse.json({ ok: true, summary });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Failed recording Beetroot vote." },
      { status: 500 }
    );
  }
}
