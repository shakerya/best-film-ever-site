// src/app/api/admin/route.js
import { NextResponse } from "next/server";
import {
  readBfeState,
  writeBfeState,
  computeFifthSeatSummary,
  computeBeetrootSummary,
  buildGoogleFormLink,
  buildFullBackupCsv,
  hasCloudKv,
  GOOGLE_BACKUP_SHEET_URL,
} from "@/lib/bfeStore";
import { searchMovie } from "@/lib/tmdb";
import { getExpectedPatronKey } from "@/lib/patronAuth";

function verifyAdmin(req) {
  const expected = process.env.ADMIN_PASSCODE || "bfe-vault";
  const provided =
    String(req.headers.get("x-bfe-passcode") || "").trim() ||
    String(new URL(req.url).searchParams.get("key") || "").trim();
  return provided === expected;
}

export async function GET(req) {
  if (!verifyAdmin(req)) {
    return NextResponse.json({ ok: false, error: "Invalid admin passcode." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);

  if (searchParams.get("export") === "csv") {
    const state = await readBfeState({ fresh: true });
    const csv = buildFullBackupCsv(state);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="bfe-submissions-backup-${new Date()
          .toISOString()
          .slice(0, 10)}.csv"`,
      },
    });
  }

  const tmdbQuery = String(searchParams.get("tmdbQuery") || "").trim();
  if (tmdbQuery) {
    const results = await searchMovie(tmdbQuery).catch(() => []);
    return NextResponse.json({
      ok: true,
      movies: results.slice(0, 6).map((m) => ({
        id: m.id,
        title: m.title,
        year: m.release_date ? String(m.release_date).slice(0, 4) : "",
        posterPath: m.poster_path || "",
      })),
    });
  }

  const state = await readBfeState({ fresh: true });
  const detailedSchedule = state.schedule.map((s) => ({
    ...s,
    fifthSummary: computeFifthSeatSummary(state.fifthSeats?.[s.id] || []),
    beetSummary: computeBeetrootSummary(state.beetroot?.[s.id]),
    googleFormLink: buildGoogleFormLink(s, state.evergreenGoogleForm),
  }));

  return NextResponse.json({
    ok: true,
    cloudKvActive: hasCloudKv(),
    googleSheetUrl: GOOGLE_BACKUP_SHEET_URL,
    patronAccessKey: getExpectedPatronKey(),
    evergreenGoogleForm: state.evergreenGoogleForm,
    schedule: detailedSchedule,
    gifRounds: state.gifRounds || [],
  });
}

export async function POST(req) {
  if (!verifyAdmin(req)) {
    return NextResponse.json({ ok: false, error: "Invalid admin passcode." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const action = String(body?.action || "");

    if (action === "toggle_read") {
      const { filmId, entryId } = body;
      await writeBfeState(
        (draft) => {
          const list = draft.fifthSeats?.[filmId] || [];
          const target = list.find((e) => e.id === entryId);
          if (target) target.readOnAir = !target.readOnAir;
          return draft;
        },
        { type: "toggle_read", filmId, entryId }
      );
      return NextResponse.json({ ok: true });
    }

    if (action === "crown_gif") {
      const { roundId, entryId } = body;
      await writeBfeState(
        (draft) => {
          const round = (draft.gifRounds || []).find((r) => r.id === roundId);
          if (round) round.winnerEntryId = entryId;
          return draft;
        },
        { type: "crown_gif", roundId, entryId }
      );
      return NextResponse.json({ ok: true });
    }

    if (action === "set_gif_thread") {
      const roundId = String(body?.roundId || "").trim();
      const threadTweetUrl = String(body?.threadTweetUrl || "").trim();
      await writeBfeState(
        (draft) => {
          const round = (draft.gifRounds || []).find((r) => r.id === roundId);
          if (round) round.threadTweetUrl = threadTweetUrl;
          return draft;
        },
        { type: "set_gif_thread", roundId, threadTweetUrl }
      );
      return NextResponse.json({ ok: true });
    }

    if (action === "save_evergreen_form") {
      const baseUrl = String(body?.baseUrl || "").trim();
      const filmEntryId = String(body?.filmEntryId || "").trim();
      await writeBfeState(
        (draft) => {
          draft.evergreenGoogleForm = { baseUrl, filmEntryId };
          return draft;
        },
        { type: "save_evergreen_form" }
      );
      return NextResponse.json({ ok: true });
    }

    if (action === "upsert_schedule") {
      const film = body?.film || {};
      const id =
        String(film.id || "").trim() ||
        `sched-${Date.now()}-${String(film.title || "film")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")}`;

      await writeBfeState(
        (draft) => {
          if (film.makePrimaryOpen) {
            for (const s of draft.schedule) {
              if (s.status === "open") s.status = "closed";
            }
          }
          const entry = {
            id,
            title: String(film.title || "").trim(),
            year: String(film.year || "").trim(),
            tmdbId: film.tmdbId ? Number(film.tmdbId) : null,
            episodeNum: film.episodeNum ? Number(film.episodeNum) : null,
            episodeDate: String(film.episodeDate || "").trim(),
            cutoffIso: String(film.cutoffIso || "").trim(),
            pickNote: String(film.pickNote || "").trim(),
            googleFormUrl: String(film.googleFormUrl || "").trim(),
            status: film.status || "open",
          };
          const idx = draft.schedule.findIndex((s) => s.id === id);
          if (idx >= 0) draft.schedule[idx] = entry;
          else draft.schedule.unshift(entry);

          if (film.randomWord && entry.episodeNum) {
            const roundId = `ep-${entry.episodeNum}-${String(film.randomWord)
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")}`;
            const existingRound = draft.gifRounds.find((r) => r.epNum === entry.episodeNum);
            if (existingRound) {
              existingRound.randomWord = String(film.randomWord).trim();
              existingRound.filmTitle = entry.title;
            } else {
              draft.gifRounds.unshift({
                id: roundId,
                epNum: entry.episodeNum,
                filmTitle: entry.title,
                randomWord: String(film.randomWord).trim(),
                hint: `Announced in Episode ${entry.episodeNum} Endgame.`,
                status: "open",
                winnerEntryId: null,
                entries: [],
              });
            }
          }
          return draft;
        },
        { type: "upsert_schedule", title: film.title, episodeNum: film.episodeNum }
      );
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Admin update failed." },
      { status: 500 }
    );
  }
}
