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
      setUnlockError(data.error || "Not quite — listen to the start of the Endgame segment.");
      return;
    }
    setUnlockedWord(data.unlockedWord);
    setSearchQuery(data.unlockedWord);
    runGifSearch(data.unlockedWord);
  }

  function handleRevealWord() {
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
      <section className="rounded-3xl bg-zinc-900/60 p-6 md:p-8 ring-1 ring-white/[0.08]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-300">
              GIF of the Week • Episode {activeRound.epNum}
            </div>
            <h1 className="mt-2 text-3xl md:text-4xl font-semibold tracking-tight text-white">
              {activeRound.filmTitle} — #BFERandomWord
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
              Listen until the Endgame for this week’s Random Word, unlock the arena below, and
              submit your GIF. Duplicate GIFs are automatically flagged so nobody gets disqualified
              on recording morning.
            </p>
          </div>

          <div className="rounded-2xl bg-zinc-950/80 px-4 py-3 text-right ring-1 ring-white/[0.08]">
            <div className="text-[11px] uppercase tracking-wider text-zinc-500">Entries</div>
            <div className="mt-0.5 text-2xl font-semibold text-white tabular-nums">
              {entries.length}
            </div>
          </div>
        </div>

        {!unlockedWord ? (
          <div className="mt-8 rounded-2xl bg-zinc-950/75 p-6 ring-1 ring-white/[0.08]">
            <div className="text-sm font-medium text-white">
              Enter Episode {activeRound.epNum}’s Random Word to Unlock
            </div>
            <p className="mt-1 text-xs text-zinc-400">
              {activeRound.hint || "Announced at the start of the Endgame segment."}
            </p>

            <form onSubmit={handleUnlock} className="mt-4 flex flex-col gap-2.5 sm:flex-row">
              <input
                type="text"
                value={wordGuess}
                onChange={(e) => setWordGuess(e.target.value)}
                placeholder="Type this week’s secret word…"
                className="flex-1 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 ring-1 ring-white/10 focus:outline-none focus:ring-white/30"
              />
              <button
                type="submit"
                className="rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-zinc-200 transition"
              >
                Unlock Arena →
              </button>
              <button
                type="button"
                onClick={handleRevealWord}
                className="rounded-full bg-white/[0.06] px-4 py-2.5 text-xs font-medium text-zinc-300 ring-1 ring-white/10 hover:bg-white/10 transition"
              >
                Already listened? Reveal word
              </button>
            </form>

            {unlockError ? (
              <div className="mt-3 text-xs text-rose-300">{unlockError}</div>
            ) : null}
          </div>
        ) : (
          <div className="mt-8 space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-zinc-950/80 px-4 py-3 ring-1 ring-amber-300/25">
              <div className="text-sm text-zinc-200">
                This week’s Random Word:{" "}
                <strong className="font-semibold uppercase tracking-wider text-amber-300">
                  “{unlockedWord}”
                </strong>
              </div>
              <a
                href={xShareHref}
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-white/[0.08] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-white/15 transition"
              >
                Reply on X (#BFERandomWord) ↗
              </a>
            </div>

            {submittedEntry ? (
              <div className="rounded-2xl bg-zinc-950/80 p-5 ring-1 ring-amber-300/30">
                <div className="text-sm font-semibold text-amber-300">
                  Your GIF is locked in for judging
                </div>
                <p className="mt-1 text-xs text-zinc-400">
                  Verified unique and queued on the hosts’ recording-day screen. Want to post it on
                  X as well?
                </p>
                <div className="mt-4 flex flex-wrap gap-2.5">
                  <a
                    href={xShareHref}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-zinc-200 transition"
                  >
                    Also post to @bestfilmeverpod on X ↗
                  </a>
                  <button
                    type="button"
                    onClick={() => setSubmittedEntry(null)}
                    className="rounded-full bg-white/[0.08] px-4 py-2 text-xs text-white hover:bg-white/15 transition"
                  >
                    Submit another GIF
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="rounded-2xl bg-zinc-950/75 p-5 ring-1 ring-white/[0.08]">
                  <div className="text-sm font-medium text-white">
                    1. Search GIFs or Paste Any .gif Link
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
                      className="flex-1 rounded-xl bg-zinc-900 px-3.5 py-2 text-xs text-white ring-1 ring-white/10"
                    />
                    <button
                      type="button"
                      onClick={() => runGifSearch(searchQuery)}
                      className="rounded-xl bg-white/[0.08] px-4 py-2 text-xs font-medium text-white hover:bg-white/15 transition"
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
                              ? "ring-amber-300 scale-[0.98]"
                              : alreadyTaken
                                ? "ring-rose-500/60 opacity-45"
                                : "ring-transparent hover:ring-white/30"
                          }`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={g.url} alt={g.title} className="h-full w-full object-cover" />
                          {alreadyTaken ? (
                            <span className="absolute inset-x-1 bottom-1 rounded bg-rose-600/90 px-1 py-0.5 text-[9px] font-bold text-white">
                              CLAIMED
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
                      className="w-full rounded-xl bg-zinc-900 px-3.5 py-2 text-xs text-white placeholder:text-zinc-500 ring-1 ring-white/10"
                    />
                  </div>
                </div>

                <form
                  onSubmit={handleSubmitEntry}
                  className="rounded-2xl bg-zinc-950/75 p-5 ring-1 ring-white/[0.08] space-y-4"
                >
                  <div className="text-sm font-medium text-white">2. Lock In Your Entry</div>

                  {gifUrl ? (
                    <div className="overflow-hidden rounded-xl bg-zinc-900 p-2.5 ring-1 ring-white/10">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={gifUrl}
                        alt="Selected GIF preview"
                        className="mx-auto max-h-40 rounded-lg object-contain"
                      />
                      {selectedIsDuplicate ? (
                        <div className="mt-2 rounded-lg bg-rose-500/20 px-3 py-1.5 text-xs text-rose-200">
                          Duplicate alert: someone already claimed this GIF. Pick another so you
                          don’t get disqualified.
                        </div>
                      ) : (
                        <div className="mt-1.5 text-center text-[11px] text-amber-300">
                          Unique GIF — unclaimed so far
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
                      className="rounded-xl bg-zinc-900 px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-500 ring-1 ring-white/10"
                    />
                    <input
                      type="text"
                      value={handle}
                      onChange={(e) => setHandle(e.target.value)}
                      placeholder="@X handle (optional)"
                      className="rounded-xl bg-zinc-900 px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-500 ring-1 ring-white/10"
                    />
                  </div>

                  <input
                    type="text"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="Optional caption for Ian & this week’s judge…"
                    className="w-full rounded-xl bg-zinc-900 px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-500 ring-1 ring-white/10"
                  />

                  {submitError ? (
                    <div className="rounded-xl bg-rose-500/15 px-3.5 py-2 text-xs text-rose-200 ring-1 ring-rose-400/30">
                      {submitError}
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    disabled={submitting || selectedIsDuplicate || !gifUrl}
                    className="w-full rounded-full bg-white py-2.5 text-sm font-semibold text-zinc-950 hover:bg-zinc-200 disabled:opacity-40 transition"
                  >
                    {submitting ? "Submitting…" : "Submit GIF of the Week →"}
                  </button>
                </form>
              </div>
            )}

            <div>
              <h2 className="text-base font-semibold text-white">
                This Week’s Contenders ({entries.length})
              </h2>
              {entries.length === 0 ? (
                <div className="mt-3 rounded-2xl bg-zinc-950/60 p-6 text-xs text-zinc-400 ring-1 ring-white/[0.06]">
                  No GIFs claimed yet for “{unlockedWord}” — be the first contender in for Episode{" "}
                  {activeRound.epNum + 1}’s opening segment.
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
                  {entries.map((entry) => (
                    <div
                      key={entry.id}
                      className="overflow-hidden rounded-2xl bg-zinc-950/80 ring-1 ring-white/[0.08]"
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
                        <div className="text-sm font-semibold text-white">{entry.name}</div>
                        {entry.caption ? (
                          <p className="mt-1 text-xs text-zinc-400">{entry.caption}</p>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {pastRounds.length ? (
        <section>
          <h2 className="text-lg font-semibold tracking-tight text-white">
            Recent #BFERandomWord Winners
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            {pastRounds.map((round) => {
              const winner =
                (round.entries || []).find((e) => e.id === round.winnerEntryId) ||
                round.entries?.[0];
              return (
                <div
                  key={round.id}
                  className="flex gap-4 rounded-2xl bg-zinc-900/55 p-4 ring-1 ring-white/[0.08]"
                >
                  {winner?.gifUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={winner.gifUrl}
                      alt={round.filmTitle}
                      className="h-24 w-32 shrink-0 rounded-xl object-cover bg-black"
                    />
                  ) : null}
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-300">
                      EP {round.epNum} · Word: “{round.randomWord}”
                    </div>
                    <div className="mt-1 text-base font-semibold text-white">{round.filmTitle}</div>
                    {winner ? (
                      <div className="mt-1 text-xs text-zinc-400">
                        Winner: <strong className="text-zinc-200">{winner.name}</strong>
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
