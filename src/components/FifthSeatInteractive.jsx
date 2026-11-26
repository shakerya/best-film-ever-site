"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BFE_LINKS } from "@/lib/bfeShared";

const SCORE_BUTTONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const BEETROOT_OPTIONS = [
  { key: "great", label: "Great Film", desc: "Top-tier cinema — counts Fresh" },
  { key: "good", label: "Good Film", desc: "Solid recommend — counts Fresh" },
  { key: "ok", label: "OK Film", desc: "Watchable / mixed bag" },
  { key: "poor", label: "Poor Film", desc: "Skip it — counts Rotten" },
];

export default function FifthSeatInteractive({
  film,
  isPatron = false,
  unlockFailed = false,
  googleFormLink,
  initialFifthSeatCount = 0,
  initialBeetroot,
  initialMyBeetChoice = "",
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(isPatron ? "fifth-seat" : "beetroot");

  const [patronKeyInput, setPatronKeyInput] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState(
    unlockFailed ? "That unlock link didn’t match the current Patron key." : ""
  );

  const [name, setName] = useState("");
  const [score, setScore] = useState(null);
  const [thoughts, setThoughts] = useState("");
  const [hostQuestion, setHostQuestion] = useState("");
  const [submitting5th, setSubmitting5th] = useState(false);
  const [fifthResult, setFifthResult] = useState(null);
  const [fifthError, setFifthError] = useState("");
  const [fifthCount, setFifthCount] = useState(initialFifthSeatCount);

  const [beetSummary, setBeetSummary] = useState(initialBeetroot);
  const [myBeetChoice, setMyBeetChoice] = useState(initialMyBeetChoice || "");
  const [beetComment, setBeetComment] = useState("");
  const [submittingBeet, setSubmittingBeet] = useState(false);
  const [beetError, setBeetError] = useState("");
  const [beetSaved, setBeetSaved] = useState(false);
  const [beetStatusNote, setBeetStatusNote] = useState("");

  useEffect(() => {
    try {
      const savedName = localStorage.getItem("bfe_patron_name") || "";
      if (savedName) setName(savedName);
      if (initialMyBeetChoice) {
        setMyBeetChoice(initialMyBeetChoice);
        localStorage.setItem(`bfe_beetroot_${film.id}`, initialMyBeetChoice);
      } else {
        const savedVote = localStorage.getItem(`bfe_beetroot_${film.id}`) || "";
        if (savedVote) setMyBeetChoice(savedVote);
      }
    } catch {
      // ignore
    }
  }, [film.id, initialMyBeetChoice]);

  async function handlePassphraseUnlock(e) {
    e.preventDefault();
    setUnlockError("");
    if (!patronKeyInput.trim()) return;
    setUnlocking(true);
    try {
      const res = await fetch("/api/patron/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: patronKeyInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setUnlockError(data.error || "Incorrect Patron passphrase.");
      } else {
        setActiveTab("fifth-seat");
        router.refresh();
      }
    } catch {
      setUnlockError("Network error checking passphrase.");
    } finally {
      setUnlocking(false);
    }
  }

  async function handleLockPreview() {
    await fetch("/api/patron/unlock", { method: "DELETE" });
    setActiveTab("beetroot");
    router.refresh();
  }

  async function handleFifthSeatSubmit(e) {
    e.preventDefault();
    setFifthError("");
    if (!score) {
      setFifthError("Select a score from 1 to 10 first.");
      return;
    }
    if (!name.trim()) {
      setFifthError("Enter your name so Ian can credit you on the episode.");
      return;
    }

    setSubmitting5th(true);
    try {
      localStorage.setItem("bfe_patron_name", name.trim());
    } catch {
      // ignore
    }

    try {
      const res = await fetch("/api/fifth-seat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filmId: film.id,
          name: name.trim(),
          score,
          thoughts,
          hostQuestion,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setFifthError(data.error || "Could not submit right now.");
      } else {
        setFifthCount(data.count);
        setFifthResult(data);
      }
    } catch {
      setFifthError("Network error — try again or use the Google Form link.");
    } finally {
      setSubmitting5th(false);
    }
  }

  async function handleBeetrootVote(choiceKey, withComment = false) {
    setBeetError("");
    if (film.status === "closed") {
      setBeetError("Voting has closed for this episode.");
      return;
    }
    // Ignore repeat clicks on the already-locked-in choice (unless posting a comment)
    if (!withComment && myBeetChoice === choiceKey) {
      setBeetStatusNote("Your vote is already locked in — tap a different option anytime to switch.");
      return;
    }

    setSubmittingBeet(true);
    setBeetStatusNote("");

    try {
      const res = await fetch("/api/beetroot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filmId: film.id,
          choice: choiceKey,
          name: name.trim(),
          comment: withComment ? beetComment.trim() : "",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setBeetError(data.error || "Could not record vote.");
      } else {
        setMyBeetChoice(choiceKey);
        setBeetSummary(data.summary);
        setBeetSaved(true);
        if (withComment) {
          setBeetComment("");
          setBeetStatusNote("Your take is saved for Fledgling Fandom.");
        } else if (data.switchedFrom) {
          setBeetStatusNote(`Switched your single ballot from ${data.switchedFrom.toUpperCase()} to ${choiceKey.toUpperCase()}.`);
        } else if (data.alreadySameChoice) {
          setBeetStatusNote("1 vote per listener — your ballot is already counted.");
        } else {
          setBeetStatusNote("Ballot locked in (1 vote per listener — tap another option to change).");
        }
        try {
          localStorage.setItem(`bfe_beetroot_${film.id}`, choiceKey);
        } catch {
          // ignore
        }
      }
    } catch {
      setBeetError("Network error while voting.");
    } finally {
      setSubmittingBeet(false);
    }
  }

  const totalBeet = beetSummary?.total || 0;

  return (
    <div className="rounded-2xl bg-zinc-950/75 p-4 sm:p-7 ring-1 ring-white/[0.08]">
      {/* Segmented Mode Switcher (2-column grid on mobile so it never wraps awkwardly inside a pill) */}
      <div className="flex flex-col gap-3 border-b border-white/[0.08] pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid grid-cols-2 gap-1 rounded-full bg-zinc-900 p-1 ring-1 ring-white/[0.08] sm:inline-flex">
          <button
            type="button"
            onClick={() => setActiveTab("beetroot")}
            className={`truncate rounded-full px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium transition ${
              activeTab === "beetroot"
                ? "bg-white text-zinc-950 font-semibold"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Beetroot Poll{totalBeet > 0 ? ` (${totalBeet})` : ""}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("fifth-seat")}
            className={`truncate rounded-full px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium transition ${
              activeTab === "fifth-seat"
                ? "bg-white text-zinc-950 font-semibold"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            {isPatron ? "Fifth-Seat (1–10)" : "Patron 5th Seat"}
          </button>
        </div>

        <div className="flex items-center gap-3 text-xs">
          {isPatron ? (
            <>
              <span className="rounded-full bg-amber-300/15 px-3 py-1 font-medium text-amber-300 ring-1 ring-amber-300/30">
                Patron Unlocked
              </span>
              <button
                type="button"
                onClick={handleLockPreview}
                className="text-zinc-500 hover:text-zinc-300 transition"
                title="Clear cookie to preview what non-patrons see"
              >
                Lock preview
              </button>
            </>
          ) : fifthCount > 0 ? (
            <span className="text-zinc-400">
              {fifthCount} Patron Fifth-Seat{fifthCount === 1 ? "" : "s"} in
            </span>
          ) : null}
        </div>
      </div>

      {activeTab === "fifth-seat" ? (
        !isPatron ? (
          /* PATRONS-ONLY GATE */
          <div className="mt-6 rounded-2xl bg-zinc-900/60 p-6 sm:p-7 ring-1 ring-white/[0.08] space-y-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-300">
              BFE Patrons Clubhouse
            </div>
            <div>
              <h3 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
                The Fifth Seat & Advance Slate Are Exclusive to BFE Patrons
              </h3>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
                Patrons receive the upcoming movie slate in advance and submit a{" "}
                <strong className="text-white font-medium">1–10 Fifth-Seat score</strong> that
                averages into <strong className="text-white font-medium">one equal host chair</strong>{" "}
                on the episode.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <a
                href={BFE_LINKS.patreon}
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-amber-300 px-5 py-2.5 text-xs sm:text-sm font-semibold text-zinc-950 hover:bg-amber-200 transition"
              >
                Join BFE on Patreon →
              </a>
              <button
                type="button"
                onClick={() => setActiveTab("beetroot")}
                className="rounded-full bg-white/[0.06] px-5 py-2.5 text-xs sm:text-sm font-medium text-white ring-1 ring-white/15 hover:bg-white/10 transition"
              >
                Vote in Free Public Poll →
              </button>
            </div>

            <div className="border-t border-white/[0.08] pt-5">
              <div className="text-xs font-medium text-zinc-300">
                Already a Patron? Open the 1-click Magic Link from Patreon / the X group chat, or
                enter the Patron passphrase once to unlock this browser for a year:
              </div>
              <form onSubmit={handlePassphraseUnlock} className="mt-3 flex max-w-md gap-2">
                <input
                  type="password"
                  value={patronKeyInput}
                  onChange={(e) => setPatronKeyInput(e.target.value)}
                  placeholder="Patron passphrase…"
                  className="flex-1 rounded-xl bg-zinc-950 px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-500 ring-1 ring-white/10 focus:outline-none focus:ring-white/30"
                />
                <button
                  type="submit"
                  disabled={unlocking || !patronKeyInput.trim()}
                  className="rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-zinc-950 hover:bg-zinc-200 disabled:opacity-40 transition"
                >
                  {unlocking ? "Unlocking…" : "Unlock"}
                </button>
              </form>
              {unlockError ? (
                <div className="mt-2 text-xs text-rose-300">{unlockError}</div>
              ) : null}
            </div>
          </div>
        ) : (
          /* UNLOCKED PATRON FIFTH-SEAT FORM */
          <div className="mt-6">
            {googleFormLink?.url ? (
              <div className="mb-6 flex flex-col gap-3 rounded-2xl bg-zinc-900/70 p-4 ring-1 ring-white/[0.08] sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-medium text-white">
                    Prefer Ian’s classic Google Form?
                  </div>
                  <div className="mt-0.5 text-xs text-zinc-400">
                    {googleFormLink.isPrefilledEvergreen
                      ? `Opens the official Google Form with “${film.title}” pre-filled.`
                      : `Opens the official Fifth-Seat Google Form for ${film.title}.`}
                  </div>
                </div>
                <a
                  href={googleFormLink.url}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 inline-flex items-center justify-center rounded-full bg-white/[0.08] px-4 py-2 text-xs font-medium text-white ring-1 ring-white/15 hover:bg-white/15 transition"
                >
                  Open Google Form ↗
                </a>
              </div>
            ) : null}

            {fifthResult ? (
              <div className="rounded-2xl bg-zinc-900/80 p-6 ring-1 ring-amber-300/30">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-300">
                  Fifth-Seat Recorded
                </div>
                <h3 className="mt-1 text-2xl font-semibold text-white">
                  Thanks, {name} — locked in at {score}/10 for {film.title}.
                </h3>
                <p className="mt-2 text-sm text-zinc-400">
                  Queued on the recording-day screen as Patron #{fifthResult.count} for this
                  episode.
                </p>

                {fifthResult.myContributorProfile ? (
                  <div className="mt-4 inline-flex items-center gap-3 rounded-xl bg-zinc-950 px-4 py-2.5 text-xs ring-1 ring-white/10">
                    <span className="font-semibold text-amber-300">
                      {fifthResult.myContributorProfile.tierBadge}
                    </span>
                    <span className="text-zinc-300">
                      {fifthResult.myContributorProfile.submissions} career Fifth-Seat
                      {fifthResult.myContributorProfile.submissions === 1 ? "" : "s"} · Avg{" "}
                      {fifthResult.myContributorProfile.avgScoreGiven}/10
                    </span>
                  </div>
                ) : null}

                <div className="mt-5 flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    onClick={() => setFifthResult(null)}
                    className="rounded-full bg-white/[0.08] px-4 py-2 text-xs font-medium text-white hover:bg-white/15 transition"
                  >
                    Edit my submission
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("beetroot")}
                    className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-zinc-200 transition"
                  >
                    Also vote in Beetroot Poll →
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleFifthSeatSubmit} className="space-y-5">
                <div>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <label className="text-sm font-medium text-white">
                      1. Your Score (1–10) <span className="text-amber-300">*</span>
                    </label>
                    <span className="text-xs text-zinc-500">
                      Integer 1–10 scale · Memory scores welcome
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-10">
                    {SCORE_BUTTONS.map((n) => {
                      const active = score === n;
                      return (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setScore(n)}
                          className={`h-11 rounded-xl text-sm font-semibold transition ${
                            active
                              ? "bg-amber-300 text-zinc-950 shadow-md"
                              : "bg-zinc-900 text-zinc-200 ring-1 ring-white/10 hover:bg-zinc-800"
                          }`}
                        >
                          {n}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white">
                    2. Your Name <span className="text-amber-300">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name for the on-air shoutout"
                    className="mt-2 w-full rounded-xl bg-zinc-900 px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 ring-1 ring-white/10 focus:outline-none focus:ring-white/30"
                  />
                </div>

                <div>
                  <div className="flex items-baseline justify-between">
                    <label className="text-sm font-medium text-white">
                      3. Your Thoughts <span className="text-zinc-500 font-normal">(Optional)</span>
                    </label>
                    <span className="text-xs text-zinc-500">Read during the Endgame</span>
                  </div>
                  <textarea
                    rows={3}
                    value={thoughts}
                    onChange={(e) => setThoughts(e.target.value)}
                    placeholder="A quick review, favorite scene, or custom rating unit (e.g. '8 carnivorous plants out of 10')…"
                    className="mt-2 w-full rounded-xl bg-zinc-900 px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 ring-1 ring-white/10 focus:outline-none focus:ring-white/30"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white">
                    4. Question for the Hosts{" "}
                    <span className="text-zinc-500 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={hostQuestion}
                    onChange={(e) => setHostQuestion(e.target.value)}
                    placeholder="Optional prompt for Ian & the panel during recording…"
                    className="mt-2 w-full rounded-xl bg-zinc-900 px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 ring-1 ring-white/10 focus:outline-none focus:ring-white/30"
                  />
                </div>

                {fifthError ? (
                  <div className="rounded-xl bg-rose-500/15 px-4 py-2.5 text-xs text-rose-200 ring-1 ring-rose-400/30">
                    {fifthError}
                  </div>
                ) : null}

                <div className="pt-1">
                  <button
                    type="submit"
                    disabled={submitting5th}
                    className="rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-zinc-200 disabled:opacity-50 transition"
                  >
                    {submitting5th ? "Submitting…" : `Submit Fifth-Seat for ${film.title} →`}
                  </button>
                </div>
              </form>
            )}
          </div>
        )
      ) : (
        /* PUBLIC BEETROOT METRIC POLL */
        <div className="mt-6 space-y-6">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-300">
              Put Out a Fleece • Official #BFEPoll
            </div>
            <h3 className="mt-1 text-xl font-semibold text-white">{film.title} is a…</h3>
            <p className="mt-1 text-xs text-zinc-400">
              Open to every listener (1 ballot per person).{" "}
              <strong className="text-zinc-200">Great + Good</strong> combine for the episode’s{" "}
              <strong className="text-zinc-200">Beetroot Metric %</strong> (10+ votes required for
              official qualification).
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {BEETROOT_OPTIONS.map((opt) => {
              const count = Number(beetSummary?.[opt.key] || 0);
              const pct = totalBeet > 0 ? Math.round((count / totalBeet) * 100) : 0;
              const selected = myBeetChoice === opt.key;
              const pollClosed = film.status === "closed";

              return (
                <button
                  key={opt.key}
                  type="button"
                  disabled={submittingBeet || pollClosed}
                  onClick={() => handleBeetrootVote(opt.key, false)}
                  className={`relative overflow-hidden rounded-2xl p-4 text-left transition ${
                    selected
                      ? "bg-white/[0.10] ring-1 ring-amber-300"
                      : "bg-zinc-900/70 ring-1 ring-white/[0.08] hover:bg-zinc-900 hover:ring-white/20 disabled:opacity-60"
                  }`}
                >
                  {totalBeet > 0 ? (
                    <div
                      className="pointer-events-none absolute inset-y-0 left-0 bg-white/[0.05] transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  ) : null}
                  <div className="relative flex items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] font-semibold text-white">{opt.label}</span>
                        {selected ? (
                          <span className="rounded-full bg-amber-300/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300 ring-1 ring-amber-300/40">
                            ✓ Your Vote
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-0.5 text-xs text-zinc-400">{opt.desc}</div>
                    </div>
                    {totalBeet > 0 ? (
                      <div className="text-right tabular-nums shrink-0">
                        <div className="text-base font-semibold text-white">{pct}%</div>
                        <div className="text-[11px] text-zinc-500">
                          {count} vote{count === 1 ? "" : "s"}
                        </div>
                      </div>
                    ) : (
                      <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] text-zinc-300 shrink-0">
                        {pollClosed ? "Closed" : "Vote"}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {beetStatusNote ? (
            <div className="text-xs text-amber-300/90">{beetStatusNote}</div>
          ) : null}

          {totalBeet > 0 ? (
            <div className="rounded-2xl bg-zinc-900/70 p-4 ring-1 ring-white/[0.08]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-medium text-white">
                  Current Beetroot Metric:{" "}
                  <span className="font-semibold text-amber-300">{beetSummary.beetrootPct}%</span>
                </div>
                <div className="text-xs text-zinc-400">
                  {beetSummary.qualifies
                    ? `Qualified (${totalBeet} votes)`
                    : `${totalBeet} of 10 votes needed to qualify on air`}
                </div>
              </div>
              <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full rounded-full bg-amber-300 transition-all duration-500"
                  style={{ width: `${beetSummary.beetrootPct || 0}%` }}
                />
              </div>
            </div>
          ) : null}

          {myBeetChoice ? (
            <div className="rounded-2xl bg-zinc-900/70 p-4 ring-1 ring-white/[0.08] space-y-3">
              <div className="text-xs font-medium text-zinc-300">
                Add a 1-liner for “Fledgling Fandom” on the podcast (optional):
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name / @handle"
                  className="sm:w-48 rounded-xl bg-zinc-950 px-3 py-2 text-xs text-white placeholder:text-zinc-500 ring-1 ring-white/10"
                />
                <input
                  type="text"
                  value={beetComment}
                  onChange={(e) => setBeetComment(e.target.value)}
                  placeholder="Why is it Great, Good, OK, or Poor?"
                  className="flex-1 rounded-xl bg-zinc-950 px-3 py-2 text-xs text-white placeholder:text-zinc-500 ring-1 ring-white/10"
                />
                <button
                  type="button"
                  disabled={!beetComment.trim() || submittingBeet}
                  onClick={() => handleBeetrootVote(myBeetChoice, true)}
                  className="rounded-xl bg-white px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-zinc-200 disabled:opacity-40 transition"
                >
                  Post Take
                </button>
              </div>
              {beetSaved && !beetComment ? (
                <div className="text-xs text-zinc-400">
                  Vote saved.{" "}
                  {isPatron ? (
                    <button
                      type="button"
                      onClick={() => setActiveTab("fifth-seat")}
                      className="text-amber-300 underline font-medium"
                    >
                      Submit your 1–10 Patron Fifth-Seat score →
                    </button>
                  ) : (
                    <>
                      Want your 1–10 score counted as a full co-host chair?{" "}
                      <a
                        href={BFE_LINKS.patreon}
                        target="_blank"
                        rel="noreferrer"
                        className="text-amber-300 underline font-medium"
                      >
                        Join BFE on Patreon
                      </a>
                      .
                    </>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}

          {beetError ? <div className="text-xs text-rose-300">{beetError}</div> : null}

          {beetSummary?.comments?.length ? (
            <div className="space-y-2">
              <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                Listener Takes
              </div>
              {beetSummary.comments.slice(0, 5).map((c) => (
                <div
                  key={c.id}
                  className="rounded-xl bg-zinc-900/70 px-4 py-3 text-xs ring-1 ring-white/[0.08]"
                >
                  <span className="font-semibold text-white">{c.name}</span>{" "}
                  <span className="text-amber-300 uppercase text-[10px] ml-1">[{c.choice}]</span>
                  <p className="mt-1 text-zinc-300">{c.comment}</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
