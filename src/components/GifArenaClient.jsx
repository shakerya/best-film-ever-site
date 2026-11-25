"use client";

import { useEffect, useState } from "react";
import { normalizeGifKey } from "@/lib/bfeShared";

export default function GifArenaClient({ activeRound, pastRounds = [] }) {
  const [unlockedWord, setUnlockedWord] = useState("");
  const [wordGuess, setWordGuess] = useState("");
  const [unlockError, setUnlockError] = useState("");

  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [gifUrl, setGifUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const [entries, setEntries] = useState(activeRound?.entries || []);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submittedEntry, setSubmittedEntry] = useState(null);

  useEffect(() => {
    try {
      const savedName = localStorage.getItem("bfe_patron_name") || "";
      const savedHandle = localStorage.getItem("bfe_x_handle") || "";
      if (savedName) setName(savedName);
      if (savedHandle) setHandle(savedHandle);
    } catch {
      // ignore
    }
  }, []);

  async function handleUnlock(e) {
    e.preventDefault();
    setUnlockError("");
    const res = await fetch("/api/gif", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "unlock",
        roundId: activeRound.id,
        word: wordGuess,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setUnlockError(data.error || "Wrong word — listen to the Endgame!");
      return;
    }
    setUnlockedWord(data.unlockedWord);
    setSearchQuery(data.unlockedWord);
    runGifSearch(data.unlockedWord);
  }

  function handleDemoReveal() {
    setWordGuess(activeRound.randomWord);
    setUnlockedWord(activeRound.randomWord);
    setSearchQuery(activeRound.randomWord);
    runGifSearch(activeRound.randomWord);
  }

  async function runGifSearch(q) {
    const query = String(q || "").trim();
    if (!query) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/gif?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data?.ok) {
        setSearchResults(data.results || []);
      }
    } finally {
      setSearching(false);
    }
  }

  const claimedKeys = new Set(entries.map((e) => normalizeGifKey(e.gifUrl)));
  const selectedIsDuplicate = gifUrl ? claimedKeys.has(normalizeGifKey(gifUrl)) : false;

  async function handleSubmitEntry(e) {
    e.preventDefault();
    setSubmitError("");
    setSubmitting(true);
    try {
      localStorage.setItem("bfe_patron_name", name.trim());
      if (handle.trim()) localStorage.setItem("bfe_x_handle", handle.trim());
    } catch {
      // ignore
    }

    try {
      const res = await fetch("/api/gif", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit",
          roundId: activeRound.id,
          word: unlockedWord,
          name,
          handle,
          gifUrl,
          caption,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setSubmitError(data.error || "Could not submit GIF.");
      } else {
        setEntries(data.entries || []);
        setSubmittedEntry(data.entry);
        setGifUrl("");
        setCaption("");
      }
    } catch {
      setSubmitError("Network error submitting GIF.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!activeRound) return null;

  const xShareHref = `https://x.com/intent/tweet?text=${encodeURIComponent(
    `My #BFERandomWord GIF entry for #${activeRound.filmTitle.replace(/[^a-zA-Z0-9]/g, "")} @bestfilmeverpod!`
  )}`;

  return (
    <div className="space-y-12">
      {/* Active Round Card */}
      <section className="rounded-3xl bg-white/5 p-6 md:p-8 ring-1 ring-white/15">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-400/15 px-3 py-1 text-xs font-semibold text-amber-300 ring-1 ring-amber-400/30">
              🎬 GIF OF THE WEEK • EPISODE {activeRound.epNum}
            </div>
            <h1 className="mt-3 text-3xl md:text-4xl font-bold text-white">
              {activeRound.filmTitle} — #BFERandomWord Arena
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-white/70">
              Listen until the Endgame for this week’s Random Word, unlock the arena below, and
              drop a GIF! Duplicate GIFs are automatically detected so nobody gets disqualified on
              recording morning.
            </p>
          </div>

          <div className="rounded-2xl bg-black/40 px-4 py-3 text-right ring-1 ring-white/10">
            <div className="text-xs text-white/55">Entries this week</div>
            <div className="text-2xl font-bold text-amber-300">{entries.length}</div>
          </div>
        </div>

        {/* Step 1: Secret Word Gate */}
        {!unlockedWord ? (
          <div className="mt-8 rounded-3xl bg-zinc-900/80 p-6 ring-1 ring-white/10">
            <div className="text-sm font-semibold text-white">
              🔒 Enter Episode {activeRound.epNum}’s Secret Random Word to Play & View Entries
            </div>
            <p className="mt-1 text-xs text-white/60">
              {activeRound.hint || "Announced near the start of the Endgame segment."}
            </p>

            <form onSubmit={handleUnlock} className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                value={wordGuess}
                onChange={(e) => setWordGuess(e.target.value)}
                placeholder="Type this week’s random word…"
                className="flex-1 rounded-2xl bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/35 ring-1 ring-white/10 focus:outline-none focus:ring-amber-400/50"
              />
              <button
                type="submit"
                className="rounded-2xl bg-amber-400 px-6 py-3 text-sm font-semibold text-zinc-950 hover:bg-amber-300 transition"
              >
                Unlock GIF Arena →
              </button>
              <button
                type="button"
                onClick={handleDemoReveal}
                className="rounded-2xl bg-white/10 px-4 py-3 text-xs font-medium text-white/75 hover:bg-white/15 transition"
                title="Reveal word to preview how the game works"
              >
                Heard it / Reveal word
              </button>
            </form>

            {unlockError ? (
              <div className="mt-3 text-xs text-rose-300">{unlockError}</div>
            ) : null}
          </div>
        ) : (
          <div className="mt-8 space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-amber-400/10 px-4 py-3 ring-1 ring-amber-400/30">
              <div className="text-sm text-amber-200">
                🔓 Unlocked! This week’s Random Word is{" "}
                <strong className="font-bold uppercase tracking-wider text-white">
                  “{unlockedWord}”
                </strong>
              </div>
              <a
                href={xShareHref}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20 transition"
              >
                Open #BFERandomWord on X ↗
              </a>
            </div>

            {submittedEntry ? (
              <div className="rounded-2xl bg-emerald-500/10 p-5 ring-1 ring-emerald-400/30">
                <div className="text-sm font-semibold text-emerald-300">
                  🎉 Your GIF is in the running for GIF of the Week!
                </div>
                <p className="mt-1 text-xs text-white/75">
                  Queued for judging on next week’s episode — and verified unique! Want extra love
                  on Twitter too?
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <a
                    href={xShareHref}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl bg-white px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-white/90 transition"
                  >
                    Also post my GIF to @bestfilmeverpod on X ↗
                  </a>
                  <button
                    type="button"
                    onClick={() => setSubmittedEntry(null)}
                    className="rounded-xl bg-white/10 px-4 py-2 text-xs text-white hover:bg-white/15 transition"
                  >
                    Submit another entry
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* GIF Picker */}
                <div className="rounded-3xl bg-zinc-900/75 p-5 ring-1 ring-white/10">
                  <div className="text-sm font-semibold text-white">
                    1. Search GIFs or Paste Any GIF Link
                  </div>
                  <div className="mt-3 flex gap-2">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          runGifSearch(searchQuery);
                        }
                      }}
                      placeholder={`Search GIFs for “${unlockedWord}”…`}
                      className="flex-1 rounded-xl bg-white/5 px-3.5 py-2 text-xs text-white ring-1 ring-white/10"
                    />
                    <button
                      type="button"
                      onClick={() => runGifSearch(searchQuery)}
                      className="rounded-xl bg-white/15 px-4 py-2 text-xs font-semibold text-white hover:bg-white/20 transition"
                    >
                      {searching ? "…" : "Search"}
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1">
                    {searchResults.map((g) => {
                      const alreadyTaken = claimedKeys.has(normalizeGifKey(g.url));
                      const isPicked = gifUrl === g.url;
                      return (
                        <button
                          key={g.url}
                          type="button"
                          onClick={() => setGifUrl(g.url)}
                          className={`relative overflow-hidden rounded-xl aspect-square bg-black ring-2 transition ${
                            isPicked
                              ? "ring-amber-400 scale-[0.98]"
                              : alreadyTaken
                                ? "ring-rose-500/60 opacity-50"
                                : "ring-transparent hover:ring-white/30"
                          }`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={g.url} alt={g.title} className="h-full w-full object-cover" />
                          {alreadyTaken ? (
                            <span className="absolute inset-x-1 bottom-1 rounded bg-rose-600/90 px-1 py-0.5 text-[9px] font-bold text-white">
                              TAKEN
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-3">
                    <input
                      type="url"
                      value={gifUrl}
                      onChange={(e) => setGifUrl(e.target.value)}
                      placeholder="Or paste any direct Giphy / Tenor .gif URL…"
                      className="w-full rounded-xl bg-white/5 px-3.5 py-2 text-xs text-white placeholder:text-white/35 ring-1 ring-white/10"
                    />
                  </div>
                </div>

                {/* Entry Submission Form */}
                <form
                  onSubmit={handleSubmitEntry}
                  className="rounded-3xl bg-zinc-900/75 p-5 ring-1 ring-white/10 space-y-4"
                >
                  <div className="text-sm font-semibold text-white">2. Lock In Your Entry</div>

                  {gifUrl ? (
                    <div className="overflow-hidden rounded-2xl bg-black/50 p-2 ring-1 ring-white/10">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={gifUrl}
                        alt="Selected GIF preview"
                        className="mx-auto max-h-40 rounded-xl object-contain"
                      />
                      {selectedIsDuplicate ? (
                        <div className="mt-2 rounded-lg bg-rose-500/20 px-3 py-1.5 text-xs font-medium text-rose-200">
                          ⚠️ Duplicate Alert: Someone already submitted this exact GIF! Pick another
                          so you don’t get disqualified.
                        </div>
                      ) : (
                        <div className="mt-1.5 text-center text-[11px] text-emerald-300">
                          ✅ Unique GIF — nobody else has claimed this one yet!
                        </div>
                      )}
                    </div>
                  ) : null}

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your Name *"
                      className="rounded-xl bg-white/5 px-3.5 py-2.5 text-xs text-white placeholder:text-white/35 ring-1 ring-white/10"
                    />
                    <input
                      type="text"
                      value={handle}
                      onChange={(e) => setHandle(e.target.value)}
                      placeholder="@X handle (optional)"
                      className="rounded-xl bg-white/5 px-3.5 py-2.5 text-xs text-white placeholder:text-white/35 ring-1 ring-white/10"
                    />
                  </div>

                  <input
                    type="text"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="Optional setup / joke for Ian & the judge…"
                    className="w-full rounded-xl bg-white/5 px-3.5 py-2.5 text-xs text-white placeholder:text-white/35 ring-1 ring-white/10"
                  />

                  {submitError ? (
                    <div className="rounded-xl bg-rose-500/15 px-3.5 py-2 text-xs text-rose-200 ring-1 ring-rose-400/30">
                      {submitError}
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    disabled={submitting || selectedIsDuplicate || !gifUrl}
                    className="w-full rounded-2xl bg-amber-400 py-3 text-sm font-semibold text-zinc-950 hover:bg-amber-300 disabled:opacity-40 transition"
                  >
                    {submitting ? "Submitting…" : "🎬 Enter GIF of the Week"}
                  </button>
                </form>
              </div>
            )}

            {/* Current Week Contenders */}
            <div>
              <h2 className="text-lg font-semibold text-white">
                This Week’s Contenders ({entries.length})
              </h2>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="overflow-hidden rounded-3xl bg-black/40 ring-1 ring-white/10"
                  >
                    <div className="aspect-video bg-zinc-900">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={entry.gifUrl}
                        alt={entry.caption || entry.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="p-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-white">{entry.name}</span>
                        {entry.isHostStarter ? (
                          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/70">
                            Starter GIF
                          </span>
                        ) : null}
                      </div>
                      {entry.caption ? (
                        <p className="mt-1 text-xs text-white/65">{entry.caption}</p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Past Winners Archive */}
      {pastRounds.length ? (
        <section>
          <h2 className="text-xl font-semibold text-white">Past #BFERandomWord Winners</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            {pastRounds.map((round) => {
              const winner =
                (round.entries || []).find((e) => e.id === round.winnerEntryId) ||
                round.entries?.[0];
              return (
                <div
                  key={round.id}
                  className="flex gap-4 rounded-3xl bg-white/5 p-4 ring-1 ring-white/10"
                >
                  {winner?.gifUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={winner.gifUrl}
                      alt={round.filmTitle}
                      className="h-24 w-32 shrink-0 rounded-2xl object-cover bg-black"
                    />
                  ) : null}
                  <div className="min-w-0">
                    <div className="text-xs text-amber-300 font-semibold">
                      EP {round.epNum} • WORD: “{round.randomWord}”
                    </div>
                    <div className="mt-1 text-base font-semibold text-white">{round.filmTitle}</div>
                    {winner ? (
                      <div className="mt-1 text-xs text-white/70">
                        Winner: <strong className="text-white">{winner.name}</strong>
                        {winner.caption ? ` — ${winner.caption}` : ""}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
