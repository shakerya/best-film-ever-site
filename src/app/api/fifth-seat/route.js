// src/app/api/fifth-seat/route.js
import { NextResponse } from "next/server";
import {
  readBfeState,
  writeBfeState,
  computeFifthSeatSummary,
  getPatronContributorLeaderboard,
  forwardToGoogleSheetWebhook,
} from "@/lib/bfeStore";
import { hasPatronCookie } from "@/lib/patronAuth";

export async function GET() {
  const state = await readBfeState();
  const summaries = {};
  for (const s of state.schedule) {
    summaries[s.id] = computeFifthSeatSummary(state.fifthSeats?.[s.id] || []);
  }
  return NextResponse.json({
    ok: true,
    schedule: state.schedule,
    summaries,
    contributors: await getPatronContributorLeaderboard(state),
  });
}

export async function POST(req) {
  if (!(await hasPatronCookie())) {
    return NextResponse.json(
      {
        ok: false,
        error: "BFE Patron access required. Unlock via the Magic Link on patreon.com/BFE first!",
      },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    if (body?.website) {
      return NextResponse.json({ ok: true });
    }

    const filmId = String(body?.filmId || "").trim();
    const name = String(body?.name || "").trim().slice(0, 80);
    const score = Number.parseInt(String(body?.score ?? ""), 10);
    const thoughts = String(body?.thoughts || "").trim().slice(0, 2000);
    const hostQuestion = String(body?.hostQuestion || "").trim().slice(0, 500);

    if (!filmId) {
      return NextResponse.json({ ok: false, error: "Missing film ID." }, { status: 400 });
    }
    if (!name) {
      return NextResponse.json({ ok: false, error: "Please enter your name." }, { status: 400 });
    }
    if (!Number.isInteger(score) || score < 1 || score > 10) {
      return NextResponse.json(
        { ok: false, error: "Please choose an integer score from 1 to 10." },
        { status: 400 }
      );
    }

    const entry = {
      id: `5th-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      score,
      thoughts,
      hostQuestion,
      source: "site",
      readOnAir: false,
      createdAt: new Date().toISOString(),
    };

    let filmTitle = filmId;
    const nextState = await writeBfeState(
      (draft) => {
        const film = draft.schedule.find((s) => s.id === filmId);
        if (film) filmTitle = film.title;
        if (!draft.fifthSeats[filmId]) draft.fifthSeats[filmId] = [];
        const existingIdx = draft.fifthSeats[filmId].findIndex(
          (e) => e.name.toLowerCase() === name.toLowerCase() && e.source === "site"
        );
        if (existingIdx >= 0) {
          draft.fifthSeats[filmId][existingIdx] = {
            ...draft.fifthSeats[filmId][existingIdx],
            score,
            thoughts,
            hostQuestion,
            updatedAt: entry.createdAt,
          };
        } else {
          draft.fifthSeats[filmId].push(entry);
        }
        return draft;
      },
      { type: "fifth_seat", filmId, name, score, thoughts, hostQuestion }
    );

    await forwardToGoogleSheetWebhook("fifth_seat_submission", {
      filmId,
      filmTitle,
      ...entry,
    });

    const summary = computeFifthSeatSummary(nextState.fifthSeats?.[filmId] || []);
    const contributors = await getPatronContributorLeaderboard(nextState);
    const myRank = contributors.find((c) => c.name.toLowerCase() === name.toLowerCase()) || null;

    return NextResponse.json({
      ok: true,
      count: summary.count,
      myContributorProfile: myRank,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Failed saving Fifth-Seat submission." },
      { status: 500 }
    );
  }
}
