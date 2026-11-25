"use client";

import { useCallback, useEffect, useState } from "react";

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
  const [tab, setTab] = useState("broadcast"); // broadcast | schedule
  const [selectedFilmId, setSelectedFilmId] = useState("");
  const [copiedKey, setCopiedKey] = useState("");

  // Live on-air calculator host scores
  const [calcHosts, setCalcHosts] = useState({ ian: "", liam: "", megan: "", kevin: "", guest: "" });

  // Schedule form state
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

  const loadAdminData = useCallback(async (code) => {
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
  }, [selectedFilmId]);

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
      <div className="mx-auto max-w-md rounded-3xl bg-white/5 p-6 ring-1 ring-white/15">
        <h1 className="text-xl font-bold text-white">Ian & Producer Studio (/admin)</h1>
        <p className="mt-1 text-xs text-white/65">
          Enter `ADMIN_PASSCODE` (default in local dev:{" "}
          <code className="rounded bg-white/10 px-1.5 py-0.5 text-emerald-300">bfe-vault</code>).
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
            className="w-full rounded-2xl bg-black/50 px-4 py-3 text-sm text-white ring-1 ring-white/15"
          />
          {error ? <div className="text-xs text-rose-300">{error}</div> : null}
          <button
            type="submit"
            className="w-full rounded-2xl bg-emerald-400 py-3 text-sm font-semibold text-zinc-950 hover:bg-emerald-300 transition"
          >
            Open Studio →
          </button>
        </form>
      </div>
    );
  }

  const schedule = data?.schedule || [];
  const activeFilm = schedule.find((s) => s.id === selectedFilmId) || schedule[0];
  const activeGifRound = (data?.gifRounds || [])[0] || null;

  // Live combined score math
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

  // Ready-to-paste social copy templates
  const monthlyPostText = [
    "🎬 Upcoming Fifth-Seat Films on Best Film Ever!",
    "",
    ...schedule.slice(0, 4).map((s) => {
      const note = s.pickNote ? ` (${s.pickNote})` : "";
      const formPart = s.googleFormLink?.url ? `\n   Form: ${s.googleFormLink.url}` : "";
      return `• ${s.episodeDate || "Soon"} — ${s.title}${note}${formPart}`;
    }),
    "",
    "🔑 Patrons One-Click Magic Unlock Link (unlocks your browser for 1 year):",
    `https://www.bestfilmeverpod.fyi/fifth-seat?key=${data?.patronAccessKey || "flippityflop"}`,
  ].join("\n");

  const sundayLastCallText = activeFilm
    ? `⏳ Last call on Fifth-Seats for ${activeFilm.title} before we record! Tap your Magic Patron Link to drop your 1–10 score & thoughts: https://www.bestfilmeverpod.fyi/fifth-seat?key=${
        data?.patronAccessKey || "flippityflop"
      }${
        activeFilm.googleFormLink?.url ? ` (or direct Google Form: ${activeFilm.googleFormLink.url})` : ""
      }`
    : "";

  const wednesdayPollTweet = activeFilm
    ? `We're recording on #${activeFilm.title.replace(/[^a-zA-Z0-9]/g, "")} this week! Is it a Great Film, Good Film, OK Film, or Poor Film?\n\nCast your 1-tap vote for the Beetroot Metric & share your take for the pod 👇\nhttps://www.bestfilmeverpod.fyi/fifth-seat #BFEPoll #FilmTwitter`
    : "";

  const tuesdayGifTweet = activeGifRound
    ? `Official #BFERandomWord GIF of the Week thread for ${activeGifRound.filmTitle}! 🎬\n\nListen until the Endgame for this week's random word, reply below with your GIF, or play (with automatic duplicate-GIF protection!) at:\nhttps://www.bestfilmeverpod.fyi/gif`
    : "";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
            🎙️ STUDIO OF AWESOMENESS CONTROL PANEL
          </div>
          <h1 className="mt-1 text-3xl font-bold text-white">Ian & Georgia Producer Hub</h1>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTab("broadcast")}
            className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
              tab === "broadcast"
                ? "bg-emerald-400 text-zinc-950"
                : "bg-white/5 text-white/80 ring-1 ring-white/10"
            }`}
          >
            🎙️ Recording-Day Screen
          </button>
          <button
            type="button"
            onClick={() => setTab("schedule")}
            className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
              tab === "schedule"
                ? "bg-emerald-400 text-zinc-950"
                : "bg-white/5 text-white/80 ring-1 ring-white/10"
            }`}
          >
            📅 Monthly Slate & 1-Click Copy Kit
          </button>
        </div>
      </div>

      {tab === "broadcast" && activeFilm ? (
        <div className="space-y-8">
          {/* Film Selector */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-white/55 mr-1">Episode Slate:</span>
            {schedule.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedFilmId(s.id)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  s.id === activeFilm.id
                    ? "bg-white text-zinc-950"
                    : "bg-white/5 text-white/75 ring-1 ring-white/10 hover:bg-white/10"
                }`}
              >
                {s.title} ({s.fifthSummary.count})
              </button>
            ))}
          </div>

          {/* Live Combined Score Calculator + Beetroot Readout */}
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/15 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">
                  🪑 Fifth-Seat & Combined Score Calculator
                </h2>
                <span className="rounded-full bg-emerald-400/20 px-3 py-1 text-xs font-bold text-emerald-300">
                  5th Seat Avg: {fifthAvg !== null ? `${fifthAvg}/10` : "No votes yet"}
                </span>
              </div>
              <p className="text-xs text-white/60">
                Punch in the hosts’ scores during Sunday’s Fifth-Seat splice to read out the exact
                Official Combined BFE Score on air!
              </p>

              <div className="grid grid-cols-5 gap-2">
                {[
                  ["ian", "Ian"],
                  ["liam", "Liam"],
                  ["megan", "Megs"],
                  ["kevin", "Kev"],
                  ["guest", "Guest"],
                ].map(([key, label]) => (
                  <div key={key}>
                    <label className="block text-[11px] text-white/55 mb-1">{label}</label>
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
                      className="w-full rounded-xl bg-black/50 px-2.5 py-2 text-center text-sm font-bold text-white ring-1 ring-white/15"
                    />
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between rounded-2xl bg-emerald-500/15 px-4 py-3 ring-1 ring-emerald-400/30">
                <span className="text-xs font-semibold text-emerald-200">
                  Official Combined BFE Score ({allChairs.length} equal chairs):
                </span>
                <span className="text-2xl font-black text-white">
                  {liveCombinedMean ? `${liveCombinedMean} / 10` : "—"}
                </span>
              </div>
            </div>

            {/* Beetroot Metric On-Air Box */}
            <div className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/15 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">🥬 Beetroot Metric & Fandom</h2>
                <span className="rounded-full bg-fuchsia-400/20 px-3 py-1 text-xs font-bold text-fuchsia-200">
                  {activeFilm.beetSummary.beetrootPct !== null
                    ? `${activeFilm.beetSummary.beetrootPct}% Beetroot (${activeFilm.beetSummary.total} votes)`
                    : "0 votes"}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                {[
                  ["Great", activeFilm.beetSummary.great],
                  ["Good", activeFilm.beetSummary.good],
                  ["OK", activeFilm.beetSummary.ok],
                  ["Poor", activeFilm.beetSummary.poor],
                ].map(([lbl, cnt]) => (
                  <div key={lbl} className="rounded-xl bg-black/40 p-2.5 ring-1 ring-white/10">
                    <div className="text-white/55">{lbl}</div>
                    <div className="mt-0.5 text-base font-bold text-white">{cnt}</div>
                  </div>
                ))}
              </div>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {(activeFilm.beetSummary.comments || []).map((c) => (
                  <div key={c.id} className="rounded-xl bg-black/35 px-3 py-2 text-xs">
                    <strong className="text-white">{c.name}:</strong>{" "}
                    <span className="text-white/75">{c.comment}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Patron Fifth-Seat Read Cards */}
          <section className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/15">
            <h2 className="text-lg font-semibold text-white">
              🎙️ Patron Fifth-Seats to Read On Air ({activeFilm.fifthSummary.count})
            </h2>
            <p className="mt-1 text-xs text-white/60">
              Tap “Mark Read” as you read each backer so nobody ever gets skipped mid-episode!
            </p>

            <div className="mt-4 space-y-3">
              {activeFilm.fifthSummary.entries.length === 0 ? (
                <div className="rounded-2xl bg-black/35 p-6 text-sm text-white/60">
                  No Fifth-Seats submitted yet for {activeFilm.title}. Use the Sunday Last-Call copy
                  button in the Schedule tab!
                </div>
              ) : (
                activeFilm.fifthSummary.entries.map((entry) => (
                  <div
                    key={entry.id}
                    className={`rounded-2xl p-5 ring-1 transition ${
                      entry.readOnAir
                        ? "bg-black/25 ring-white/5 opacity-55"
                        : "bg-zinc-900/90 ring-white/15"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="rounded-xl bg-emerald-400 px-3 py-1 text-base font-black text-zinc-950">
                          {entry.score}/10
                        </span>
                        <span className="text-lg font-bold text-white">{entry.name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleRead(activeFilm.id, entry.id)}
                        className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
                          entry.readOnAir
                            ? "bg-emerald-500/20 text-emerald-300"
                            : "bg-white/10 text-white hover:bg-white/20"
                        }`}
                      >
                        {entry.readOnAir ? "✓ Read on Air" : "Mark Read"}
                      </button>
                    </div>
                    {entry.thoughts ? (
                      <p className="mt-3 text-base leading-relaxed text-white/90">
                        “{entry.thoughts}”
                      </p>
                    ) : (
                      <p className="mt-2 text-xs italic text-white/45">(Score-only submission)</p>
                    )}
                    {entry.hostQuestion ? (
                      <div className="mt-3 rounded-xl bg-amber-400/10 px-3.5 py-2 text-xs text-amber-200 ring-1 ring-amber-400/25">
                        <strong>Question for the Hosts:</strong> {entry.hostQuestion}
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </section>

          {/* GIF of the Week Judging Panel */}
          {activeGifRound ? (
            <section className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/15">
              <h2 className="text-lg font-semibold text-white">
                🎬 Judge GIF of the Week — {activeGifRound.filmTitle} (Word: “
                {activeGifRound.randomWord}”)
              </h2>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                {(activeGifRound.entries || []).map((entry) => {
                  const isWinner = activeGifRound.winnerEntryId === entry.id;
                  return (
                    <div
                      key={entry.id}
                      className={`overflow-hidden rounded-2xl bg-black/40 ring-2 ${
                        isWinner ? "ring-amber-400" : "ring-white/10"
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
                            <div className="text-xs text-white/60">{entry.caption}</div>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => crownGif(activeGifRound.id, entry.id)}
                          className={`rounded-xl px-3 py-1.5 text-xs font-semibold ${
                            isWinner
                              ? "bg-amber-400 text-zinc-950"
                              : "bg-white/10 text-white hover:bg-white/20"
                          }`}
                        >
                          {isWinner ? "👑 Winner" : "Crown"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* 1-Click Copy Kit */}
          <section className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/15 space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-white">
                📋 1-Click Announcement Copy Kit (Patreon + X)
              </h2>
              <p className="mt-1 text-xs text-white/65">
                Paste into Patreon Backstage Pass posts (reaches all 33 Patrons!) and the X group
                chat with zero broken or missing links.
              </p>
            </div>

            {[
              ["monthly", "1. Monthly Slate (Patreon Post + X Group)", monthlyPostText],
              ["poll", "2. Wednesday Public #BFEPoll Tweet (with Poster Card)", wednesdayPollTweet],
              ["sunday", "3. Sunday Morning 'Last Call' (X Group Chat)", sundayLastCallText],
              ["gif", "4. Tuesday #BFERandomWord Thread Tweet", tuesdayGifTweet],
            ].map(([key, label, txt]) => (
              <div key={key} className="rounded-2xl bg-black/40 p-4 ring-1 ring-white/10 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-white">{label}</span>
                  <button
                    type="button"
                    onClick={() => copyText(key, txt)}
                    className="rounded-xl bg-emerald-400 px-3 py-1 text-xs font-semibold text-zinc-950 hover:bg-emerald-300"
                  >
                    {copiedKey === key ? "✓ Copied!" : "Copy Text"}
                  </button>
                </div>
                <pre className="whitespace-pre-wrap text-[11px] text-white/70 font-mono">
                  {txt}
                </pre>
              </div>
            ))}

            {/* Evergreen Pre-Filled Google Form Config */}
            <form
              onSubmit={handleSaveEvergreen}
              className="rounded-2xl bg-zinc-900/80 p-4 ring-1 ring-white/10 space-y-3"
            >
              <div className="text-xs font-semibold text-white">
                Optional: Single Evergreen Pre-Filled Google Form
              </div>
              <p className="text-[11px] text-white/55">
                Paste one master Google Form `viewform` URL + the Movie field’s `entry.XXXX` ID so
                Ian never has to duplicate Google Forms again!
              </p>
              <input
                type="url"
                value={evergreenUrl}
                onChange={(e) => setEvergreenUrl(e.target.value)}
                placeholder="https://docs.google.com/forms/d/e/.../viewform"
                className="w-full rounded-xl bg-black/50 px-3 py-2 text-xs text-white ring-1 ring-white/10"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  value={evergreenEntryId}
                  onChange={(e) => setEvergreenEntryId(e.target.value)}
                  placeholder="entry.123456789"
                  className="flex-1 rounded-xl bg-black/50 px-3 py-2 text-xs text-white ring-1 ring-white/10"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-white/15 px-4 py-2 text-xs font-semibold text-white hover:bg-white/25"
                >
                  Save Form Config
                </button>
              </div>
            </form>
          </section>

          {/* Add Upcoming Film with TMDB Auto-Fill */}
          <section className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/15 space-y-4 h-fit">
            <h2 className="text-lg font-semibold text-white">➕ Add Upcoming Film to Slate</h2>

            <div className="flex gap-2">
              <input
                type="text"
                value={tmdbSearch}
                onChange={(e) => setTmdbSearch(e.target.value)}
                placeholder="Search TMDB movie title…"
                className="flex-1 rounded-xl bg-black/50 px-3.5 py-2.5 text-xs text-white ring-1 ring-white/15"
              />
              <button
                type="button"
                onClick={searchTmdb}
                className="rounded-xl bg-white/15 px-4 py-2.5 text-xs font-semibold text-white hover:bg-white/25"
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
                    className="rounded-xl bg-black/40 p-2.5 text-left text-xs text-white ring-1 ring-white/10 hover:ring-emerald-400"
                  >
                    <div className="font-semibold truncate">{m.title}</div>
                    <div className="text-white/55">{m.year} • TMDB #{m.id}</div>
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
                  className="col-span-2 rounded-xl bg-black/50 px-3.5 py-2.5 text-xs text-white ring-1 ring-white/10"
                />
                <input
                  type="text"
                  value={newFilm.year}
                  onChange={(e) => setNewFilm((p) => ({ ...p, year: e.target.value }))}
                  placeholder="Year"
                  className="rounded-xl bg-black/50 px-3.5 py-2.5 text-xs text-white ring-1 ring-white/10"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <input
                  type="number"
                  value={newFilm.episodeNum}
                  onChange={(e) => setNewFilm((p) => ({ ...p, episodeNum: e.target.value }))}
                  placeholder="Episode #"
                  className="rounded-xl bg-black/50 px-3.5 py-2.5 text-xs text-white ring-1 ring-white/10"
                />
                <input
                  type="date"
                  value={newFilm.episodeDate}
                  onChange={(e) => setNewFilm((p) => ({ ...p, episodeDate: e.target.value }))}
                  className="rounded-xl bg-black/50 px-3.5 py-2.5 text-xs text-white ring-1 ring-white/10"
                />
                <input
                  type="number"
                  value={newFilm.tmdbId}
                  onChange={(e) => setNewFilm((p) => ({ ...p, tmdbId: e.target.value }))}
                  placeholder="TMDB ID"
                  className="rounded-xl bg-black/50 px-3.5 py-2.5 text-xs text-white ring-1 ring-white/10"
                />
              </div>

              <input
                type="text"
                value={newFilm.pickNote}
                onChange={(e) => setNewFilm((p) => ({ ...p, pickNote: e.target.value }))}
                placeholder="Pick / Cut Note (e.g. Theatrical Cut • Liam's Pick)"
                className="w-full rounded-xl bg-black/50 px-3.5 py-2.5 text-xs text-white ring-1 ring-white/10"
              />

              <input
                type="url"
                value={newFilm.googleFormUrl}
                onChange={(e) => setNewFilm((p) => ({ ...p, googleFormUrl: e.target.value }))}
                placeholder="Individual forms.gle URL (optional if Evergreen Form set)"
                className="w-full rounded-xl bg-black/50 px-3.5 py-2.5 text-xs text-white ring-1 ring-white/10"
              />

              <input
                type="text"
                value={newFilm.randomWord}
                onChange={(e) => setNewFilm((p) => ({ ...p, randomWord: e.target.value }))}
                placeholder="Optional #BFERandomWord for GIF of the Week"
                className="w-full rounded-xl bg-black/50 px-3.5 py-2.5 text-xs text-white ring-1 ring-white/10"
              />

              <button
                type="submit"
                className="w-full rounded-2xl bg-emerald-400 py-3 text-sm font-semibold text-zinc-950 hover:bg-emerald-300 transition"
              >
                Save to Fifth-Seat Slate →
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
