"use client";

import { useCallback, useEffect, useState } from "react";
import { BFE_LINKS } from "@/lib/bfeShared";

export default function AdminClient() {
  const [passcode, setPasscode] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      return localStorage.getItem("bfe_vault_passcode") || "";
    } catch {
      return "";
    }
  });
  const [authed, setAuthed] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("tweets"); // tweets | broadcast | schedule
  const [selectedFilmId, setSelectedFilmId] = useState("");
  const [copiedKey, setCopiedKey] = useState("");

  const [calcHosts, setCalcHosts] = useState({ ian: "", liam: "", megan: "", kevin: "", guest: "" });

  const [tmdbSearch, setTmdbSearch] = useState("");
  const [tmdbResults, setTmdbResults] = useState([]);
  const [newFilm, setNewFilm] = useState({
    title: "",
    year: "",
    tmdbId: "",
    episodeNum: "",
    episodeDate: "",
    cutoffIso: "",
    pickNote: "",
    googleFormUrl: "",
    randomWord: "",
    status: "open",
    makePrimaryOpen: true,
  });

  const [evergreenUrl, setEvergreenUrl] = useState("");
  const [evergreenEntryId, setEvergreenEntryId] = useState("");

  const loadAdminData = useCallback(
    async (code) => {
      setError("");
      const res = await fetch("/api/admin", {
        headers: { "x-bfe-passcode": code },
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setAuthed(false);
        setError(json.error || "Invalid passcode.");
        return;
      }
      setAuthed(true);
      setData(json);
      setEvergreenUrl(json.evergreenGoogleForm?.baseUrl || "");
      setEvergreenEntryId(json.evergreenGoogleForm?.filmEntryId || "entry.1000001");
      if (!selectedFilmId && json.schedule?.length) {
        const open = json.schedule.find((s) => s.status === "open") || json.schedule[0];
        setSelectedFilmId(open.id);
      }
      try {
        localStorage.setItem("bfe_vault_passcode", code);
      } catch {
        // ignore
      }
    },
    [selectedFilmId]
  );

  useEffect(() => {
    let saved = "";
    try {
      saved = localStorage.getItem("bfe_vault_passcode") || "";
    } catch {
      // ignore
    }
    if (!saved) return;
    let cancelled = false;
    fetch("/api/admin", { headers: { "x-bfe-passcode": saved } })
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (cancelled || !ok || !j?.ok) return;
        setAuthed(true);
        setData(j);
        setEvergreenUrl(j.evergreenGoogleForm?.baseUrl || "");
        setEvergreenEntryId(j.evergreenGoogleForm?.filmEntryId || "entry.1000001");
        if (j.schedule?.length) {
          const open = j.schedule.find((s) => s.status === "open") || j.schedule[0];
          setSelectedFilmId((prev) => prev || open.id);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggleRead(filmId, entryId) {
    await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-bfe-passcode": passcode },
      body: JSON.stringify({ action: "toggle_read", filmId, entryId }),
    });
    loadAdminData(passcode);
  }

  async function crownGif(roundId, entryId) {
    await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-bfe-passcode": passcode },
      body: JSON.stringify({ action: "crown_gif", roundId, entryId }),
    });
    loadAdminData(passcode);
  }

  async function searchTmdb() {
    if (!tmdbSearch.trim()) return;
    const res = await fetch(`/api/admin?tmdbQuery=${encodeURIComponent(tmdbSearch)}`, {
      headers: { "x-bfe-passcode": passcode },
    });
    const json = await res.json();
    if (json?.ok) setTmdbResults(json.movies || []);
  }

  async function handleSaveNewFilm(e) {
    e.preventDefault();
    if (!newFilm.title.trim()) return;
    await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-bfe-passcode": passcode },
      body: JSON.stringify({ action: "upsert_schedule", film: newFilm }),
    });
    setNewFilm({
      title: "",
      year: "",
      tmdbId: "",
      episodeNum: "",
      episodeDate: "",
      cutoffIso: "",
      pickNote: "",
      googleFormUrl: "",
      randomWord: "",
      status: "open",
      makePrimaryOpen: true,
    });
    setTmdbResults([]);
    loadAdminData(passcode);
  }

  async function handleSaveEvergreen(e) {
    e.preventDefault();
    await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-bfe-passcode": passcode },
      body: JSON.stringify({
        action: "save_evergreen_form",
        baseUrl: evergreenUrl,
        filmEntryId: evergreenEntryId,
      }),
    });
    loadAdminData(passcode);
  }

  function copyText(key, text) {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(""), 2200);
  }

  if (!authed) {
    return (
      <div className="mx-auto max-w-md rounded-3xl bg-zinc-900/60 p-6 ring-1 ring-white/[0.08]">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-300">
          Host & Producer Studio
        </div>
        <h1 className="mt-1 text-2xl font-semibold text-white">Unlock BFE Studio</h1>
        <p className="mt-1 text-xs text-zinc-400">
          Enter your studio passcode (default:{" "}
          <code className="rounded bg-zinc-950 px-1.5 py-0.5 text-amber-300">bfe-vault</code>).
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            loadAdminData(passcode);
          }}
          className="mt-4 space-y-3"
        >
          <input
            type="password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder="Passcode…"
            className="w-full rounded-xl bg-zinc-950 px-4 py-2.5 text-sm text-white ring-1 ring-white/10"
          />
          {error ? <div className="text-xs text-rose-300">{error}</div> : null}
          <button
            type="submit"
            className="w-full rounded-full bg-white py-2.5 text-sm font-semibold text-zinc-950 hover:bg-zinc-200 transition"
          >
            Open Studio →
          </button>
        </form>
      </div>
    );
  }

  const schedule = data?.schedule || [];
  const activeFilm = schedule.find((s) => s.id === selectedFilmId) || schedule[0];
  const latestAiredFilm = schedule.find((s) => s.status === "closed") || schedule[1] || activeFilm;
  const activeGifRound = (data?.gifRounds || [])[0] || null;
  const magicKey = data?.patronAccessKey || "flippityflop";
  const magicUrl = `https://www.bestfilmeverpod.fyi/fifth-seat?key=${magicKey}`;

  const enteredHostNums = Object.values(calcHosts)
    .map((v) => Number.parseFloat(v))
    .filter((n) => Number.isFinite(n) && n > 0);
  const fifthAvg = activeFilm?.fifthSummary?.average;
  const allChairs = [
    ...enteredHostNums,
    ...(fifthAvg !== null && fifthAvg !== undefined ? [Number(fifthAvg)] : []),
  ];
  const liveCombinedMean = allChairs.length
    ? (allChairs.reduce((a, b) => a + b, 0) / allChairs.length).toFixed(2)
    : null;

  const filmHashtag = activeFilm
    ? `#${activeFilm.title.replace(/[^a-zA-Z0-9]/g, "")}`
    : "#BestFilmEver";
  const filmWithYear = activeFilm
    ? activeFilm.year
      ? `${activeFilm.title} (${activeFilm.year})`
      : activeFilm.title
    : "this week's film";

  // 6 High-Engagement Templates tailored to Ian's exact weekly cadence & voice
  const socialTemplates = [
    {
      key: "beetroot_poll",
      badge: "PUBLIC X / TWITTER • REVIVES #BFEPOLL",
      title: "1. “Put Out a Fleece” — Weekly Beetroot Metric Tweet (with Movie Poster Card)",
      why: "Replaces text-only X polls (which X throttles to ~90 views) with an automatic movie-poster OpenGraph card that never expires after 24 hours.",
      xIntent: true,
      text: [
        `Put out a fleece! Next up on Best Film Ever we're tackling ${filmWithYear}.`,
        ``,
        `Where do you land for the Beetroot Metric — Great Film, Good Film, OK Film, or Poor Film?`,
        ``,
        `Cast a 1-tap vote & drop a 1-liner for Fledgling Fandom on the pod:`,
        `https://www.bestfilmeverpod.fyi/fifth-seat`,
        `#BFEPoll ${filmHashtag}`,
      ].join("\n"),
    },
    {
      key: "gif_thread",
      badge: "PUBLIC X / TWITTER • TUESDAY THREAD",
      title: `2. Official #BFERandomWord GIF of the Week Thread (${
        activeGifRound?.filmTitle || "Latest Episode"
      })`,
      why: "Zero typos, ready every Tuesday, and lets listeners check if a GIF is already claimed so nobody gets a duplicate DQ.",
      xIntent: true,
      text: [
        `Official #BFERandomWord GIF of the Week thread for Episode ${
          activeGifRound?.epNum || 358
        }: ${activeGifRound?.filmTitle || "Gangs of New York"}!`,
        ``,
        `Listen until the Endgame for this week's secret random word, then reply below with your best GIF — or enter in the arena (with duplicate-GIF protection!):`,
        `https://www.bestfilmeverpod.fyi/gif`,
      ].join("\n"),
    },
    {
      key: "tuesday_drop",
      badge: "PUBLIC X / TWITTER • TUESDAY EPISODE DROP",
      title: `3. New Episode Out Now + Beat the Hosts in the Endgame (${
        latestAiredFilm?.title || "Latest Episode"
      })`,
      why: "Drives listeners to play The Age Game & Money, Money, Money right alongside the episode.",
      xIntent: true,
      text: [
        `Episode ${latestAiredFilm?.episodeNum || 358} — ${
          latestAiredFilm?.title || "Gangs of New York"
        } is out now wherever you get your podcasts!`,
        ``,
        `Listen in, see how the Patron Fifth-Seat shook up the Official BFE Score, and try to beat us at the Age Game & Money, Money, Money before the Endgame:`,
        `https://www.bestfilmeverpod.fyi`,
        `We'll catch you on the flippity-flop.`,
      ].join("\n"),
    },
    {
      key: "patreon_post",
      badge: "PATREON POST • REACHES ALL 33 PATRONS",
      title: `4. Patreon Fifth-Seat Call (${filmWithYear})`,
      why: "Unlocks the ~10+ paying Patreon members who aren't in the X group chat using a 1-click Magic Link that remembers their browser for 1 year.",
      patreonLink: true,
      text: [
        `Fifth-Seats are open for Episode ${activeFilm?.episodeNum || 359}: ${filmWithYear}!`,
        activeFilm?.pickNote ? `(${activeFilm.pickNote})` : null,
        ``,
        `Remember: the Patron Fifth-Seat average counts as ONE full equal co-host chair in our Official BFE Score — even if you haven't rewatched it in years, memory scores and 1-sentence takes are always welcome!`,
        ``,
        `Tap your 1-click Patron Magic Link below (unlocks your browser for a year):`,
        magicUrl,
        activeFilm?.googleFormLink?.url
          ? `\nClassic Google Form option: ${activeFilm.googleFormLink.url}`
          : null,
      ]
        .filter(Boolean)
        .join("\n"),
    },
    {
      key: "x_group_midweek",
      badge: "BFE PATREON X GROUP CHAT • MIDWEEK",
      title: `5. X Group Chat Fifth-Seat Drop (${filmWithYear})`,
      why: "Clean single link for the 23-member X chat. Tip: rename the group header to 'BFE Patreon • bestfilmeverpod.fyi' so the link stays pinned at the top of everyone's phone!",
      xGroupLink: true,
      text: [
        `Fifth-Seats are open for next week's film: ${filmWithYear}!`,
        ``,
        `Drop your 1–10 score, thoughts & any question for us before Sunday's record:`,
        magicUrl,
      ].join("\n"),
    },
    {
      key: "sunday_last_call",
      badge: "BFE PATREON X GROUP CHAT • SUNDAY RECORDING MORNING",
      title: `6. Sunday “Last Call” Before Recording (${activeFilm?.title || "This Week"})`,
      why: "Replaces linkless 'Last call!' nudges so patrons can tap in a quick 1–10 score in 10 seconds from bed.",
      xGroupLink: true,
      text: [
        `Last call on Fifth-Seats for ${
          activeFilm?.title || "this week's film"
        } before we hit record in the Studio of Awesomeness! Even a quick 1–10 score gets your voice in the Fifth Chair:`,
        magicUrl,
      ].join("\n"),
    },
  ];

  return (
    <div className="space-y-8">
      {/* Studio Header & Segmented Tabs */}
      <div className="space-y-4 sm:space-y-0 sm:flex sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
        <div>
          <div className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-300">
            Studio of Awesomeness ·{" "}
            <span className={data?.cloudKvActive ? "text-emerald-300" : "text-zinc-400"}>
              {data?.cloudKvActive ? "Cloud DB Active" : "Local Memory"}
            </span>
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-semibold tracking-tight text-white">
            Ian & Georgia Producer Hub
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
            <a
              href={`/api/admin?export=csv&key=${encodeURIComponent(passcode)}`}
              className="rounded-full bg-white/[0.06] px-3 py-1 hover:text-white ring-1 ring-white/10 transition"
            >
              Download CSV Backup ↓
            </a>
            {data?.googleSheetUrl ? (
              <a
                href={data.googleSheetUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-white/[0.06] px-3 py-1 hover:text-white ring-1 ring-white/10 transition"
              >
                Google Sheet Backup ↗
              </a>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-3 sm:inline-flex items-center gap-1 rounded-full bg-zinc-900 p-1 ring-1 ring-white/[0.08]">
          {[
            ["tweets", "Post Kit", "Tweet & Post Kit"],
            ["broadcast", "Recording", "Recording Screen"],
            ["schedule", "Film Slate", "Film Slate"],
          ].map(([key, mobileLbl, desktopLbl]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`whitespace-nowrap text-center rounded-full px-2 sm:px-3.5 py-1.5 text-[11px] sm:text-xs font-medium transition ${
                tab === key
                  ? "bg-white text-zinc-950 font-semibold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <span className="sm:hidden">{mobileLbl}</span>
              <span className="hidden sm:inline">{desktopLbl}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Episode Selector Bar (horizontally scrollable on mobile) */}
      {tab !== "schedule" && schedule.length > 0 ? (
        <div className="flex items-center gap-2 overflow-x-auto rounded-2xl bg-zinc-900/55 p-2.5 ring-1 ring-white/[0.08] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <span className="shrink-0 px-1.5 text-xs text-zinc-400">Film:</span>
          {schedule.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSelectedFilmId(s.id)}
              className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition ${
                s.id === activeFilm?.id
                  ? "bg-amber-300 text-zinc-950 font-semibold"
                  : "bg-zinc-950 text-zinc-300 ring-1 ring-white/[0.08] hover:text-white"
              }`}
            >
              {s.title} {s.status === "open" ? "· UP NEXT" : `(EP ${s.episodeNum})`}
            </button>
          ))}
        </div>
      ) : null}

      {/* TAB 1: TWEET & PATREON ENGAGEMENT KIT */}
      {tab === "tweets" ? (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            {socialTemplates.map((tpl) => {
              const tweetComposerUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(
                tpl.text
              )}`;
              return (
                <div
                  key={tpl.key}
                  className="rounded-2xl bg-zinc-900/60 p-5 ring-1 ring-white/[0.08] space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-300">
                        {tpl.badge}
                      </div>
                      <h2 className="mt-0.5 text-sm sm:text-base font-semibold text-white">
                        {tpl.title}
                      </h2>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => copyText(tpl.key, tpl.text)}
                        className="rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-zinc-200 transition"
                      >
                        {copiedKey === tpl.key ? "Copied ✓" : "Copy Text"}
                      </button>

                      {tpl.xIntent ? (
                        <a
                          href={tweetComposerUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full bg-white/[0.08] px-3.5 py-1.5 text-xs font-medium text-white ring-1 ring-white/15 hover:bg-white/15 transition"
                        >
                          Open in X ↗
                        </a>
                      ) : null}

                      {tpl.patreonLink ? (
                        <a
                          href={BFE_LINKS.patreon}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full bg-white/[0.08] px-3.5 py-1.5 text-xs font-medium text-white ring-1 ring-white/15 hover:bg-white/15 transition"
                        >
                          Open Patreon ↗
                        </a>
                      ) : null}

                      {tpl.xGroupLink ? (
                        <a
                          href={BFE_LINKS.xGroupChat}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full bg-white/[0.08] px-3.5 py-1.5 text-xs font-medium text-white ring-1 ring-white/15 hover:bg-white/15 transition"
                        >
                          Open X Chat ↗
                        </a>
                      ) : null}
                    </div>
                  </div>

                  <p className="text-xs text-zinc-400">{tpl.why}</p>

                  <pre className="whitespace-pre-wrap rounded-xl bg-zinc-950 p-4 text-xs leading-relaxed text-zinc-200 ring-1 ring-white/[0.06] font-sans">
                    {tpl.text}
                  </pre>
                </div>
              );
            })}
          </div>

          {/* Live OpenGraph Social Card Preview + Quick Playbook */}
          <aside className="space-y-6 h-fit lg:sticky lg:top-20">
            <div className="rounded-3xl bg-zinc-900/60 p-5 ring-1 ring-white/[0.08] space-y-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-300">
                How It Looks on X / Twitter
              </div>
              <p className="text-xs text-zinc-400">
                Whenever you tweet{" "}
                <code className="text-zinc-200">bestfilmeverpod.fyi/fifth-seat</code>, X
                automatically turns it into this live poster post:
              </p>

              {/* Simulated X / Twitter Dark-Mode Timeline Post */}
              <div
                id="x-post-preview-card"
                className="rounded-2xl bg-black p-4 ring-1 ring-zinc-800 space-y-3"
              >
                <div className="flex items-start gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-600 text-xs font-black tracking-tight text-white ring-1 ring-white/15">
                    BFE
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="truncate font-bold text-white">Best Film Ever</span>
                      <span className="truncate text-zinc-500">@bestfilmeverpod · 2m</span>
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-zinc-100">
                      Put out a fleece! Next up on Best Film Ever we’re tackling{" "}
                      <strong>{filmWithYear}</strong>. Where do you land for the Beetroot Metric —
                      Great, Good, OK, or Poor?{" "}
                      <span className="text-sky-400">#BFEPoll {filmHashtag}</span>
                    </p>
                  </div>
                </div>

                <div className="relative overflow-hidden rounded-xl bg-zinc-950 ring-1 ring-zinc-800">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/fifth-seat/opengraph-image"
                    alt="Live X OpenGraph Card Preview"
                    className="w-full h-auto object-cover block"
                  />
                  <span className="absolute bottom-2 left-2 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-medium text-white ring-1 ring-white/10">
                    bestfilmeverpod.fyi
                  </span>
                </div>

                <div className="flex items-center justify-between px-1 text-[11px] text-zinc-500">
                  <span>From bestfilmeverpod.fyi</span>
                  <span>💬 6 · 🔁 9 · ❤️ 28</span>
                </div>
              </div>
            </div>

            <div className="rounded-3xl bg-zinc-900/60 p-5 ring-1 ring-white/[0.08] space-y-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
                3 One-Time Setup Wins for Ian
              </div>
              <ul className="space-y-2.5 text-xs text-zinc-300 leading-relaxed">
                <li>
                  <strong className="text-white">1. Pin in X Group Name:</strong> X encrypted chats
                  can’t pin messages — rename the group header to{" "}
                  <code className="rounded bg-zinc-950 px-1.5 py-0.5 text-amber-300">
                    BFE Patreon • bestfilmeverpod.fyi
                  </code>
                  .
                </li>
                <li>
                  <strong className="text-white">2. Pin 1 Post on Patreon:</strong> Pin Template #4
                  on Patreon once so the ~10+ non-X patrons always have the Magic Unlock Link.
                </li>
                <li>
                  <strong className="text-white">3. @bestfilmeverpod Bio Link:</strong> Point the X
                  profile website field to <code className="text-zinc-200">bestfilmeverpod.fyi</code>.
                </li>
              </ul>
            </div>
          </aside>
        </div>
      ) : null}

      {/* TAB 2: RECORDING-DAY BROADCAST SCREEN */}
      {tab === "broadcast" && activeFilm ? (
        <div className="space-y-8">
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-3xl bg-zinc-900/60 p-5 sm:p-6 ring-1 ring-white/[0.08] space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-white">
                  Combined Score Calculator ({activeFilm.title})
                </h2>
                <span className="shrink-0 whitespace-nowrap rounded-full bg-amber-300/15 px-3 py-1 text-xs font-semibold text-amber-300">
                  5th Seat Avg: {fifthAvg !== null ? `${fifthAvg}/10` : "No votes yet"}
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Enter host scores during the Endgame to compute the Official Combined BFE Score on
                air.
              </p>

              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {[
                  ["ian", "Ian"],
                  ["liam", "Liam"],
                  ["megan", "Megs"],
                  ["kevin", "Kev"],
                  ["guest", "Guest"],
                ].map(([key, label]) => (
                  <div key={key}>
                    <label className="block text-[11px] text-zinc-400 mb-1">{label}</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="10"
                      value={calcHosts[key]}
                      onChange={(e) =>
                        setCalcHosts((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                      placeholder="—"
                      className="w-full rounded-xl bg-zinc-950 px-2.5 py-2 text-center text-sm font-semibold text-white ring-1 ring-white/10"
                    />
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between rounded-2xl bg-zinc-950 px-4 py-3 ring-1 ring-amber-300/30">
                <span className="text-xs font-medium text-zinc-300">
                  Official Combined Score ({allChairs.length} equal chairs):
                </span>
                <span className="text-2xl font-bold text-amber-300 tabular-nums">
                  {liveCombinedMean ? `${liveCombinedMean} / 10` : "—"}
                </span>
              </div>
            </div>

            <div className="rounded-3xl bg-zinc-900/60 p-6 ring-1 ring-white/[0.08] space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-white">Beetroot Metric & Fandom</h2>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-zinc-200">
                  {activeFilm.beetSummary.beetrootPct !== null && activeFilm.beetSummary.total > 0
                    ? `${activeFilm.beetSummary.beetrootPct}% (${activeFilm.beetSummary.total} votes)`
                    : "0 votes yet"}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                {[
                  ["Great", activeFilm.beetSummary.great],
                  ["Good", activeFilm.beetSummary.good],
                  ["OK", activeFilm.beetSummary.ok],
                  ["Poor", activeFilm.beetSummary.poor],
                ].map(([lbl, cnt]) => (
                  <div
                    key={lbl}
                    className="rounded-xl bg-zinc-950 p-2.5 ring-1 ring-white/[0.08] tabular-nums"
                  >
                    <div className="text-zinc-500">{lbl}</div>
                    <div className="mt-0.5 text-base font-semibold text-white">{cnt}</div>
                  </div>
                ))}
              </div>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {(activeFilm.beetSummary.comments || []).map((c) => (
                  <div key={c.id} className="rounded-xl bg-zinc-950 px-3 py-2 text-xs">
                    <strong className="text-white">{c.name}:</strong>{" "}
                    <span className="text-zinc-300">{c.comment}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-3xl bg-zinc-900/60 p-6 ring-1 ring-white/[0.08]">
            <h2 className="text-base font-semibold text-white">
              Patron Fifth-Seats to Read On Air ({activeFilm.fifthSummary.count})
            </h2>
            <p className="mt-1 text-xs text-zinc-400">
              Tap “Mark Read” as you read each backer so nobody gets missed during the Endgame.
            </p>

            <div className="mt-4 space-y-3">
              {activeFilm.fifthSummary.entries.length === 0 ? (
                <div className="rounded-2xl bg-zinc-950 p-6 text-xs text-zinc-400 ring-1 ring-white/[0.06]">
                  No Fifth-Seats submitted yet for {activeFilm.title}. Grab Template #4 or #5 in the
                  Tweet & Patreon Kit tab to open voting.
                </div>
              ) : (
                activeFilm.fifthSummary.entries.map((entry) => (
                  <div
                    key={entry.id}
                    className={`rounded-2xl p-5 ring-1 transition ${
                      entry.readOnAir
                        ? "bg-zinc-950/40 ring-white/[0.05] opacity-55"
                        : "bg-zinc-950 ring-white/10"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="rounded-lg bg-amber-300 px-2.5 py-1 text-sm font-bold text-zinc-950 tabular-nums">
                          {entry.score}/10
                        </span>
                        <span className="text-base font-semibold text-white">{entry.name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleRead(activeFilm.id, entry.id)}
                        className={`rounded-full px-3.5 py-1 text-xs font-medium transition ${
                          entry.readOnAir
                            ? "bg-white/10 text-amber-300"
                            : "bg-white text-zinc-950 font-semibold hover:bg-zinc-200"
                        }`}
                      >
                        {entry.readOnAir ? "Read on Air ✓" : "Mark Read"}
                      </button>
                    </div>
                    {entry.thoughts ? (
                      <p className="mt-3 text-sm leading-relaxed text-zinc-200">
                        “{entry.thoughts}”
                      </p>
                    ) : (
                      <p className="mt-2 text-xs italic text-zinc-500">(Score-only submission)</p>
                    )}
                    {entry.hostQuestion ? (
                      <div className="mt-3 rounded-xl bg-amber-300/10 px-3.5 py-2 text-xs text-amber-200 ring-1 ring-amber-300/25">
                        <strong>Question for the Hosts:</strong> {entry.hostQuestion}
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </section>

          {activeGifRound ? (
            <section className="rounded-3xl bg-zinc-900/60 p-6 ring-1 ring-white/[0.08]">
              <h2 className="text-base font-semibold text-white">
                Judge GIF of the Week — {activeGifRound.filmTitle} (Word: “
                {activeGifRound.randomWord}”)
              </h2>
              {(activeGifRound.entries || []).length === 0 ? (
                <p className="mt-2 text-xs text-zinc-400">
                  No website GIF entries yet for “{activeGifRound.randomWord}”.
                </p>
              ) : (
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {(activeGifRound.entries || []).map((entry) => {
                    const isWinner = activeGifRound.winnerEntryId === entry.id;
                    return (
                      <div
                        key={entry.id}
                        className={`overflow-hidden rounded-2xl bg-zinc-950 ring-2 ${
                          isWinner ? "ring-amber-300" : "ring-white/10"
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={entry.gifUrl}
                          alt={entry.name}
                          className="h-40 w-full object-cover"
                        />
                        <div className="p-3.5 flex items-center justify-between gap-2">
                          <div>
                            <div className="text-sm font-semibold text-white">{entry.name}</div>
                            {entry.caption ? (
                              <div className="text-xs text-zinc-400">{entry.caption}</div>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            onClick={() => crownGif(activeGifRound.id, entry.id)}
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              isWinner
                                ? "bg-amber-300 text-zinc-950"
                                : "bg-white/10 text-white hover:bg-white/20"
                            }`}
                          >
                            {isWinner ? "Winner" : "Crown"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          ) : null}
        </div>
      ) : null}

      {/* TAB 3: SCHEDULE & GOOGLE FORM CONFIG */}
      {tab === "schedule" ? (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <section className="rounded-3xl bg-zinc-900/60 p-6 ring-1 ring-white/[0.08] space-y-4 h-fit">
            <h2 className="text-base font-semibold text-white">Add or Update Scheduled Film</h2>

            <div className="flex gap-2">
              <input
                type="text"
                value={tmdbSearch}
                onChange={(e) => setTmdbSearch(e.target.value)}
                placeholder="Search TMDB movie title…"
                className="flex-1 rounded-xl bg-zinc-950 px-3.5 py-2.5 text-xs text-white ring-1 ring-white/10"
              />
              <button
                type="button"
                onClick={searchTmdb}
                className="rounded-xl bg-white/[0.08] px-4 py-2.5 text-xs font-medium text-white hover:bg-white/15"
              >
                Search TMDB
              </button>
            </div>

            {tmdbResults.length ? (
              <div className="grid grid-cols-2 gap-2">
                {tmdbResults.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setNewFilm((prev) => ({
                        ...prev,
                        title: m.title,
                        year: m.year,
                        tmdbId: String(m.id),
                      }));
                      setTmdbResults([]);
                    }}
                    className="rounded-xl bg-zinc-950 p-2.5 text-left text-xs text-white ring-1 ring-white/10 hover:ring-amber-300"
                  >
                    <div className="font-semibold truncate">{m.title}</div>
                    <div className="text-zinc-500">
                      {m.year} · TMDB #{m.id}
                    </div>
                  </button>
                ))}
              </div>
            ) : null}

            <form onSubmit={handleSaveNewFilm} className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  value={newFilm.title}
                  onChange={(e) => setNewFilm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="Movie Title *"
                  className="col-span-2 rounded-xl bg-zinc-950 px-3.5 py-2.5 text-xs text-white ring-1 ring-white/10"
                />
                <input
                  type="text"
                  value={newFilm.year}
                  onChange={(e) => setNewFilm((p) => ({ ...p, year: e.target.value }))}
                  placeholder="Year"
                  className="rounded-xl bg-zinc-950 px-3.5 py-2.5 text-xs text-white ring-1 ring-white/10"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <input
                  type="number"
                  value={newFilm.episodeNum}
                  onChange={(e) => setNewFilm((p) => ({ ...p, episodeNum: e.target.value }))}
                  placeholder="Episode #"
                  className="rounded-xl bg-zinc-950 px-3.5 py-2.5 text-xs text-white ring-1 ring-white/10"
                />
                <input
                  type="number"
                  value={newFilm.tmdbId}
                  onChange={(e) => setNewFilm((p) => ({ ...p, tmdbId: e.target.value }))}
                  placeholder="TMDB ID"
                  className="rounded-xl bg-zinc-950 px-3.5 py-2.5 text-xs text-white ring-1 ring-white/10"
                />
                <input
                  type="date"
                  value={newFilm.episodeDate}
                  onChange={(e) => setNewFilm((p) => ({ ...p, episodeDate: e.target.value }))}
                  className="col-span-2 sm:col-span-1 rounded-xl bg-zinc-950 px-3.5 py-2.5 text-xs text-white ring-1 ring-white/10"
                />
              </div>

              <input
                type="text"
                value={newFilm.pickNote}
                onChange={(e) => setNewFilm((p) => ({ ...p, pickNote: e.target.value }))}
                placeholder="Pick note (e.g. Patron BFF Pick)"
                className="w-full rounded-xl bg-zinc-950 px-3.5 py-2.5 text-xs text-white ring-1 ring-white/10"
              />

              <input
                type="url"
                value={newFilm.googleFormUrl}
                onChange={(e) => setNewFilm((p) => ({ ...p, googleFormUrl: e.target.value }))}
                placeholder="Individual forms.gle URL (optional)"
                className="w-full rounded-xl bg-zinc-950 px-3.5 py-2.5 text-xs text-white ring-1 ring-white/10"
              />

              <input
                type="text"
                value={newFilm.randomWord}
                onChange={(e) => setNewFilm((p) => ({ ...p, randomWord: e.target.value }))}
                placeholder="Optional #BFERandomWord for GIF game"
                className="w-full rounded-xl bg-zinc-950 px-3.5 py-2.5 text-xs text-white ring-1 ring-white/10"
              />

              <button
                type="submit"
                className="w-full rounded-full bg-white py-2.5 text-xs font-semibold text-zinc-950 hover:bg-zinc-200 transition"
              >
                Save to Fifth-Seat Slate →
              </button>
            </form>
          </section>

          <section className="rounded-3xl bg-zinc-900/60 p-6 ring-1 ring-white/[0.08] space-y-4 h-fit">
            <h2 className="text-base font-semibold text-white">
              Optional: Single Evergreen Pre-Filled Google Form
            </h2>
            <p className="text-xs leading-relaxed text-zinc-400">
              Instead of duplicating 48 separate Google Forms a year, paste one master Google Form{" "}
              <code className="text-zinc-200">viewform</code> link and its Movie field{" "}
              <code className="text-zinc-200">entry.XXXX</code> ID. Every film on the site will
              automatically generate a pre-filled Google Form link.
            </p>
            <form onSubmit={handleSaveEvergreen} className="space-y-3">
              <input
                type="url"
                value={evergreenUrl}
                onChange={(e) => setEvergreenUrl(e.target.value)}
                placeholder="https://docs.google.com/forms/d/e/.../viewform"
                className="w-full rounded-xl bg-zinc-950 px-3.5 py-2.5 text-xs text-white ring-1 ring-white/10"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  value={evergreenEntryId}
                  onChange={(e) => setEvergreenEntryId(e.target.value)}
                  placeholder="entry.123456789"
                  className="flex-1 rounded-xl bg-zinc-950 px-3.5 py-2.5 text-xs text-white ring-1 ring-white/10"
                />
                <button
                  type="submit"
                  className="rounded-full bg-white px-5 py-2.5 text-xs font-semibold text-zinc-950 hover:bg-zinc-200 transition"
                >
                  Save Config
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
