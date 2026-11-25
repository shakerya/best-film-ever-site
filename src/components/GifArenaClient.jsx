"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BFE_LINKS,
  coerceDirectGifUrl,
  extractXStatusId,
  normalizeGifKey,
} from "@/lib/bfeShared";

export default function GifArenaClient({ activeRound, pastRounds = [] }) {
  const [unlockedWord, setUnlockedWord] = useState("");
  const [wordGuess, setWordGuess] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState("");

  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [gifUrl, setGifUrl] = useState("");
  const [previewFailed, setPreviewFailed] = useState(false);
  const [caption, setCaption] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [lastSearchedQuery, setLastSearchedQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const [entries, setEntries] = useState([]);
  const [entryCount, setEntryCount] = useState(activeRound?.entryCount || 0);
  const [threadTweetUrl, setThreadTweetUrl] = useState(activeRound?.threadTweetUrl || "");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submittedEntry, setSubmittedEntry] = useState(null);

  const runGifSearch = useCallback(async (q) => {
    const query = String(q || "").trim();
    if (!query) return;
    setSearching(true);
    setLastSearchedQuery(query);
    try {
      const res = await fetch(`/api/gif?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setSearchResults(Array.isArray(data?.results) ? data.results : []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const verifyWord = useCallback(
    async (candidateWord, silent = false) => {
      if (!activeRound?.id || !String(candidateWord || "").trim()) return;
      if (!silent) {
        setUnlockError("");
        setUnlocking(true);
      }
      try {
        const res = await fetch("/api/gif", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "unlock",
            roundId: activeRound.id,
            word: candidateWord,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          if (!silent) {
            setUnlockError(
              data.error || "Not quite — listen to the start of the Endgame segment!"
            );
          } else {
            try {
              localStorage.removeItem(`bfe_gif_word_${activeRound.id}`);
            } catch {
              // ignore
            }
          }
          return;
        }
        setUnlockedWord(data.unlockedWord);
        const loadedEntries = Array.isArray(data.entries) ? data.entries : [];
        setEntries(loadedEntries);
        setEntryCount(loadedEntries.length);
        if (data.threadTweetUrl) setThreadTweetUrl(data.threadTweetUrl);
        setSearchQuery(data.unlockedWord);
        runGifSearch(data.unlockedWord);
        try {
          localStorage.setItem(`bfe_gif_word_${activeRound.id}`, data.unlockedWord);
        } catch {
          // ignore
        }
      } catch {
        if (!silent) setUnlockError("Network error checking secret word.");
      } finally {
        if (!silent) setUnlocking(false);
      }
    },
    [activeRound?.id, runGifSearch]
  );

  useEffect(() => {
    try {
      const savedName = localStorage.getItem("bfe_patron_name") || "";
      const savedHandle = localStorage.getItem("bfe_x_handle") || "";
      if (savedName) setName(savedName);
      if (savedHandle) setHandle(savedHandle);

      if (activeRound?.id) {
        const savedUnlocked = localStorage.getItem(`bfe_gif_word_${activeRound.id}`) || "";
        if (savedUnlocked) {
          verifyWord(savedUnlocked, true);
        }
      }
    } catch {
      // ignore
    }
  }, [activeRound?.id, verifyWord]);

  function handleUnlockSubmit(e) {
    e.preventDefault();
    verifyWord(wordGuess, false);
  }

  const normalizedSelected = coerceDirectGifUrl(gifUrl);
  const claimedKeys = new Set(entries.map((e) => normalizeGifKey(e.gifUrl)));
  const selectedIsDuplicate = normalizedSelected
    ? claimedKeys.has(normalizeGifKey(normalizedSelected))
    : false;

  async function handleSubmitEntry(e) {
    e.preventDefault();
    setSubmitError("");
    if (previewFailed) {
      setSubmitError("That link didn’t load as an image — pick a GIF above or paste a direct .gif URL.");
      return;
    }
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
          gifUrl: normalizedSelected,
          caption,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setSubmitError(data.error || "Could not submit GIF.");
      } else {
        const updated = data.entries || [];
        setEntries(updated);
        setEntryCount(updated.length);
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

  const statusId = extractXStatusId(threadTweetUrl);
  const tweetText = `My #BFERandomWord GIF entry for #${activeRound.filmTitle.replace(
    /[^a-zA-Z0-9]/g,
    ""
  )} @bestfilmeverpod!`;
  const xReplyIntentHref = statusId
    ? `https://x.com/intent/tweet?in_reply_to=${statusId}&text=${encodeURIComponent(tweetText)}`
    : `https://x.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
  const xThreadLink = threadTweetUrl || BFE_LINKS.xGifThreadSearch;

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
              Listen until the Endgame segment of Episode {activeRound.epNum} to catch this week’s
              secret Random Word, then type it below to unlock the arena and enter your GIF.
              Duplicate GIFs are automatically blocked so nobody gets disqualified on air.
            </p>
          </div>

          <div className="rounded-2xl bg-zinc-950/80 px-4 py-3 text-right ring-1 ring-white/[0.08]">
            <div className="text-[11px] uppercase tracking-wider text-zinc-500">Entries</div>
            <div className="mt-0.5 text-2xl font-semibold text-white tabular-nums">
              {entryCount}
            </div>
          </div>
        </div>

        {/* Strict Secret-Word Gate (no reveal-word shortcut) */}
        {!unlockedWord ? (
          <div className="mt-8 rounded-2xl bg-zinc-950/75 p-6 ring-1 ring-white/[0.08]">
            <div className="text-sm font-medium text-white">
              Enter Episode {activeRound.epNum}’s Secret Random Word to Unlock
            </div>
            <p className="mt-1 text-xs text-zinc-400">
              {activeRound.hint || "Announced at the start of the Endgame segment."}
            </p>

            <form onSubmit={handleUnlockSubmit} className="mt-4 flex flex-col gap-2.5 sm:flex-row">
              <input
                type="text"
                value={wordGuess}
                onChange={(e) => setWordGuess(e.target.value)}
                placeholder="Type the secret Random Word from the episode…"
                autoComplete="off"
                className="flex-1 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 ring-1 ring-white/10 focus:outline-none focus:ring-white/30"
              />
              <button
                type="submit"
                disabled={unlocking || !wordGuess.trim()}
                className="rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-zinc-200 disabled:opacity-40 transition"
              >
                {unlocking ? "Checking…" : "Unlock Arena →"}
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
                Unlocked — Episode {activeRound.epNum}’s Random Word is{" "}
                <strong className="font-semibold uppercase tracking-wider text-amber-300">
                  “{unlockedWord}”
                </strong>
              </div>
              <a
                href={xThreadLink}
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-white/[0.08] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-white/15 transition"
              >
                {statusId
                  ? "Open This Week’s X Thread ↗"
                  : "Find Latest #BFERandomWord Thread on X ↗"}
              </a>
            </div>

            {submittedEntry ? (
              <div className="rounded-2xl bg-zinc-950/80 p-5 ring-1 ring-amber-300/30">
                <div className="text-sm font-semibold text-amber-300">
                  Your GIF is locked in for judging
                </div>
                <p className="mt-1 text-xs text-zinc-400">
                  Verified unique and saved to the hosts’ recording-day screen. Want to drop it on X
                  too?
                </p>
                <div className="mt-4 flex flex-wrap gap-2.5">
                  <a
                    href={statusId ? xReplyIntentHref : xThreadLink}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-zinc-200 transition"
                  >
                    {statusId
                      ? "Reply Directly to This Week’s X Thread ↗"
                      : "Open Latest #BFERandomWord Thread on X ↗"}
                  </a>
                  {!statusId ? (
                    <a
                      href={xReplyIntentHref}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full bg-white/[0.08] px-4 py-2 text-xs font-medium text-white ring-1 ring-white/15 hover:bg-white/15 transition"
                    >
                      Post Tagging @bestfilmeverpod ↗
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setSubmittedEntry(null)}
                    className="rounded-full bg-white/[0.06] px-4 py-2 text-xs text-zinc-300 hover:bg-white/10 transition"
                  >
                    Submit another GIF
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Step 1: Live GIF Search */}
                <div className="rounded-2xl bg-zinc-950/75 p-5 ring-1 ring-white/[0.08]">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="text-sm font-medium text-white">1. Search Any GIF</div>
                    <span className="text-[11px] text-zinc-500">
                      Search anything related to “{unlockedWord}”
                    </span>
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
                      placeholder={`Search GIFs (e.g. "${unlockedWord}", movie scene, reaction)…`}
                      className="flex-1 rounded-xl bg-zinc-900 px-3.5 py-2 text-xs text-white placeholder:text-zinc-500 ring-1 ring-white/10 focus:outline-none focus:ring-white/30"
                    />
                    <button
                      type="button"
                      disabled={searching || !searchQuery.trim()}
                      onClick={() => runGifSearch(searchQuery)}
                      className="rounded-xl bg-white px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-zinc-200 disabled:opacity-40 transition"
                    >
                      {searching ? "Searching…" : "Search"}
                    </button>
                  </div>

                  {searching ? (
                    <div className="mt-4 py-12 text-center text-xs text-zinc-400">
                      Searching GIFs for “{searchQuery}”…
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div className="mt-4 rounded-xl bg-zinc-900/60 p-6 text-center text-xs text-zinc-400">
                      No GIFs matched “{lastSearchedQuery || searchQuery}” — try another search
                      phrase or paste a direct `.gif` URL below.
                    </div>
                  ) : (
                    <div className="mt-3 grid grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1">
                      {searchResults.map((g) => {
                        const alreadyTaken = claimedKeys.has(normalizeGifKey(g.url));
                        const isPicked = normalizedSelected === g.url;
                        return (
                          <button
                            key={g.url}
                            type="button"
                            onClick={() => {
                              setPreviewFailed(false);
                              setGifUrl(g.url);
                            }}
                            title={g.title}
                            className={`relative overflow-hidden rounded-xl aspect-square bg-zinc-900 ring-2 transition ${
                              isPicked
                                ? "ring-amber-300 scale-[0.98]"
                                : alreadyTaken
                                  ? "ring-rose-500/60 opacity-40"
                                  : "ring-transparent hover:ring-white/30"
                            }`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={g.url}
                              alt={g.title}
                              loading="lazy"
                              className="h-full w-full object-cover"
                            />
                            {alreadyTaken ? (
                              <span className="absolute inset-x-1 bottom-1 rounded bg-rose-600/90 px-1 py-0.5 text-[9px] font-bold text-white">
                                CLAIMED
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="mt-3">
                    <input
                      type="url"
                      value={gifUrl}
                      onChange={(e) => {
                        setPreviewFailed(false);
                        setGifUrl(e.target.value);
                      }}
                      placeholder="Or paste any Giphy / Tenor .gif link…"
                      className="w-full rounded-xl bg-zinc-900 px-3.5 py-2 text-xs text-white placeholder:text-zinc-500 ring-1 ring-white/10"
                    />
                  </div>
                </div>

                {/* Step 2: Entry Submission */}
                <form
                  onSubmit={handleSubmitEntry}
                  className="rounded-2xl bg-zinc-950/75 p-5 ring-1 ring-white/[0.08] space-y-4"
                >
                  <div className="text-sm font-medium text-white">2. Lock In Your Entry</div>

                  {normalizedSelected ? (
                    <div className="overflow-hidden rounded-xl bg-zinc-900 p-2.5 ring-1 ring-white/10">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={normalizedSelected}
                        alt="Selected GIF preview"
                        onError={() => setPreviewFailed(true)}
                        onLoad={() => setPreviewFailed(false)}
                        className="mx-auto max-h-44 rounded-lg object-contain"
                      />
                      {previewFailed ? (
                        <div className="mt-2 rounded-lg bg-rose-500/20 px-3 py-1.5 text-xs text-rose-200">
                          Couldn’t load that URL as an image — select a GIF from the search grid or
                          paste a direct `.gif` image URL.
                        </div>
                      ) : selectedIsDuplicate ? (
                        <div className="mt-2 rounded-lg bg-rose-500/20 px-3 py-1.5 text-xs text-rose-200">
                          Duplicate alert: someone already claimed this GIF! Pick another so you
                          don’t get disqualified.
                        </div>
                      ) : (
                        <div className="mt-1.5 text-center text-[11px] text-amber-300">
                          Unique GIF — unclaimed so far
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-xl bg-zinc-900/50 p-6 text-center text-xs text-zinc-500 ring-1 ring-white/[0.05]">
                      Click any GIF on the left (or paste a link) to preview it here.
                    </div>
                  )}

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
                    placeholder="Optional caption / setup for Ian & this week’s judge…"
                    className="w-full rounded-xl bg-zinc-900 px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-500 ring-1 ring-white/10"
                  />

                  {submitError ? (
                    <div className="rounded-xl bg-rose-500/15 px-3.5 py-2 text-xs text-rose-200 ring-1 ring-rose-400/30">
                      {submitError}
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    disabled={
                      submitting || selectedIsDuplicate || previewFailed || !normalizedSelected
                    }
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
