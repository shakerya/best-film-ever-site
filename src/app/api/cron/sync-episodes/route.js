// src/app/api/cron/sync-episodes/route.js
import { NextResponse } from "next/server";
import { getEpisodesFromRss } from "@/lib/podcast";
import { getArchiveStats } from "@/lib/transcriptSearch";

export async function GET(req) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization") || "";
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const episodes = await getEpisodesFromRss();
  const stats = getArchiveStats();
  const latest = episodes[0] || null;

  return NextResponse.json({
    ok: true,
    rssTotalEpisodes: episodes.length,
    indexedTranscriptCount: stats.episodeCount,
    latestRssEpisode: latest
      ? { title: latest.title, slug: latest.slug, isoDate: latest.isoDate }
      : null,
  });
}
