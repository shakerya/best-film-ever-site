// src/app/api/beetroot/route.js
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  writeBfeState,
  computeBeetrootSummary,
  buildVoterFingerprints,
  findExistingBeetrootBallot,
  tallyBeetrootBallots,
  forwardToGoogleSheetWebhook,
} from "@/lib/bfeStore";

const VALID_CHOICES = new Set(["great", "good", "ok", "poor"]);
export const VOTER_COOKIE_NAME = "bfe_voter_token";

function extractClientIp(req) {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "";
}

export async function POST(req) {
  try {
    const body = await req.json();
    if (body?.website) {
      return NextResponse.json({ ok: true });
    }

    const filmId = String(body?.filmId || "").trim();
    const choice = String(body?.choice || "").trim().toLowerCase();
    const name = String(body?.name || "").trim().slice(0, 60);
    const comment = String(body?.comment || "").trim().slice(0, 400);

    if (!filmId || !VALID_CHOICES.has(choice)) {
      return NextResponse.json(
        { ok: false, error: "Pick Great, Good, OK, or Poor." },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    let voterToken = cookieStore.get(VOTER_COOKIE_NAME)?.value || "";
    const mintedNewToken = !voterToken;
    if (!voterToken) {
      voterToken = crypto.randomUUID();
    }

    const ip = extractClientIp(req);
    const userAgent = req.headers.get("user-agent") || "";
    const { cookieHash, deviceHash } = buildVoterFingerprints({
      voterToken,
      ip,
      userAgent,
    });

    let filmTitle = filmId;
    let isClosed = false;
    let alreadySameChoice = false;
    let switchedFrom = "";

    const nextState = await writeBfeState(
      (draft) => {
        const film = draft.schedule.find((s) => s.id === filmId);
        if (film) {
          filmTitle = film.title;
          if (film.status === "closed") {
            isClosed = true;
            return draft;
          }
        }

        if (!draft.beetroot[filmId]) {
          draft.beetroot[filmId] = {
            great: 0,
            good: 0,
            ok: 0,
            poor: 0,
            ballots: {},
            comments: [],
          };
        }

        const bucket = draft.beetroot[filmId];
        if (!bucket.ballots || typeof bucket.ballots !== "object") {
          bucket.ballots = {};
        }

        const existing = findExistingBeetrootBallot(bucket, { cookieHash, deviceHash });
        const voterKey = existing?.voterKey || cookieHash || deviceHash || `anon_${Date.now()}`;

        if (existing) {
          if (existing.choice === choice) {
            alreadySameChoice = true;
          } else {
            switchedFrom = existing.choice;
          }
        }

        bucket.ballots[voterKey] = {
          choice,
          deviceHash: deviceHash || undefined,
          updatedAt: new Date().toISOString(),
        };

        // Recompute canonical counts directly from unique voter ballots so duplicates are impossible
        const counts = tallyBeetrootBallots(bucket.ballots);
        bucket.great = counts.great;
        bucket.good = counts.good;
        bucket.ok = counts.ok;
        bucket.poor = counts.poor;

        if (comment) {
          const filtered = (bucket.comments || []).filter((c) => c.voterKey !== voterKey);
          bucket.comments = [
            {
              id: `beet-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              voterKey,
              name: name || "Fledgling Fandom Listener",
              choice,
              comment,
              createdAt: new Date().toISOString(),
            },
            ...filtered,
          ].slice(0, 50);
        } else if (switchedFrom && Array.isArray(bucket.comments)) {
          // Keep badge on any prior comment in sync if the listener changed their vote
          bucket.comments = bucket.comments.map((c) =>
            c.voterKey === voterKey ? { ...c, choice } : c
          );
        }

        return draft;
      },
      { type: "beetroot", filmId, choice, name, hasComment: Boolean(comment) }
    );

    if (isClosed) {
      return NextResponse.json(
        { ok: false, error: "This episode's Beetroot Metric poll has closed." },
        { status: 400 }
      );
    }

    if (!alreadySameChoice || comment) {
      await forwardToGoogleSheetWebhook("beetroot_vote", {
        filmId,
        filmTitle,
        choice,
        switchedFrom,
        name,
        comment,
      });
    }

    const rawSummary = computeBeetrootSummary(nextState.beetroot[filmId]);
    // Strip internal voterKey before returning public comments to client
    const summary = {
      ...rawSummary,
      comments: (rawSummary.comments || []).map(({ voterKey: _vk, ...rest }) => rest),
    };

    const res = NextResponse.json({
      ok: true,
      choice,
      alreadySameChoice,
      switchedFrom: switchedFrom || null,
      summary,
    });

    if (mintedNewToken || cookieStore.get(VOTER_COOKIE_NAME)?.value !== voterToken) {
      res.cookies.set(VOTER_COOKIE_NAME, voterToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      });
    }

    return res;
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Failed recording Beetroot vote." },
      { status: 500 }
    );
  }
}
