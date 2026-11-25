"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BFE_LINKS } from "@/lib/bfeShared";

const SCORE_BUTTONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const BEETROOT_OPTIONS = [
  { key: "great", label: "Great Film", emoji: "🔥", desc: "Top-tier cinema — counts Fresh" },
  { key: "good", label: "Good Film", emoji: "🥬", desc: "Solid recommend — counts Fresh" },
  { key: "ok", label: "OK Film", emoji: "🤷", desc: "Watchable / mixed bag" },
  { key: "poor", label: "Poor Film", emoji: "💀", desc: "Skip it — counts Rotten" },
];

export default function FifthSeatInteractive({
  film,
  isPatron = false,
  unlockFailed = false,
  googleFormLink,
  initialFifthSeatCount = 0,
  initialBeetroot,
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(isPatron ? "fifth-seat" : "beetroot");

  // Patron unlock passphrase state (fallback if not arriving via Magic Link)
  const [patronKeyInput, setPatronKeyInput] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState(
    unlockFailed ? "That unlock link didn’t match the current Patron key." : ""
  );

  // Patron Fifth-Seat state
  const [name, setName] = useState("");
  const [score, setScore] = useState(null);
  const [thoughts, setThoughts] = useState("");
  const [hostQuestion, setHostQuestion] = useState("");
  const [submitting5th, setSubmitting5th] = useState(false);
  const [fifthResult, setFifthResult] = useState(null);
  const [fifthError, setFifthError] = useState("");
  const [fifthCount, setFifthCount] = useState(initialFifthSeatCount);

  // Public Beetroot Poll state
  const [beetSummary, setBeetSummary] = useState(initialBeetroot);
  const [myBeetChoice, setMyBeetChoice] = useState("");
  const [beetComment, setBeetComment] = useState("");
  const [submittingBeet, setSubmittingBeet] = useState(false);
  const [beetError, setBeetError] = useState("");
  const [beetSaved, setBeetSaved] = useState(false);

  useEffect(() => {
    try {
      const savedName = localStorage.getItem("bfe_patron_name") || "";
      if (savedName) setName(savedName);
      const savedVote = localStorage.getItem(`bfe_beetroot_${film.id}`) || "";
      if (savedVote) setMyBeetChoice(savedVote);
    } catch {
      // ignore storage errors
    }
  }, [film.id]);

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
      setFifthError("Tap a score from 1 to 10 first!");
      return;
    }
    if (!name.trim()) {
      setFifthError("Pop in your name so Ian can shout you out on the pod.");
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
      setFifthError("Network hiccup — try again or use the Google Form button.");
    } finally {
      setSubmitting5th(false);
    }
  }

  async function handleBeetrootVote(choiceKey, withComment = false) {
    setBeetError("");
    setSubmittingBeet(true);
    let prevChoice = "";
    try {
      prevChoice = localStorage.getItem(`bfe_beetroot_${film.id}`) || "";
    } catch {
      // ignore
    }

    try {
      const res = await fetch("/api/beetroot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filmId: film.id,
          choice: choiceKey,
          prevChoice: withComment ? choiceKey : prevChoice,
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
        if (withComment) setBeetComment("");
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
    <div className="rounded-3xl bg-zinc-900/75 p-6 md:p-8 ring-1 ring-white/15 backdrop-blur">
      {/* Mode Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("fifth-seat")}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              activeTab === "fifth-seat"
                ? "bg-emerald-400 text-zinc-950"
                : "bg-white/5 text-white/80 ring-1 ring-white/10 hover:bg-white/10"
            }`}
          >
            {isPatron ? "🪑 Patron Fifth-Seat (1–10)" : "🔒 Patron Fifth-Seat (Patrons Only)"}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("beetroot")}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              activeTab === "beetroot"
                ? "bg-fuchsia-400 text-zinc-950"
                : "bg-white/5 text-white/80 ring-1 ring-white/10 hover:bg-white/10"
            }`}
          >
            🥬 Public Beetroot Poll ({totalBeet})
          </button>
        </div>

        <div className="flex items-center gap-3 text-xs">
          {isPatron ? (
            <>
              <span className="rounded-full bg-emerald-400/15 px-3 py-1 font-semibold text-emerald-300 ring-1 ring-emerald-400/30">
                ✓ BFE Patron Unlocked
              </span>
              <button
                type="button"
                onClick={handleLockPreview}
                className="text-white/40 hover:text-white/75 transition"
                title="Clear cookie to preview what non-patrons see"
              >
                Preview non-patron view
              </button>
            </>
          ) : (
            <span className="text-white/55">
              {fifthCount} Patron Fifth-Seat{fifthCount === 1 ? "" : "s"} in
            </span>
          )}
        </div>
      </div>

      {activeTab === "fifth-seat" ? (
        !isPatron ? (
          /* PATRONS-ONLY GATE */
          <div className="mt-6 rounded-3xl bg-black/45 p-6 md:p-8 ring-1 ring-emerald-400/25 space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-400/30">
              🔒 BFE PATRONS CLUBHOUSE
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white">
                The Fifth Seat & Monthly Advance Slate Are Exclusive to BFE Patrons
              </h3>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/70">
                BFE Patrons get the full month’s movie slate in advance and cast a{" "}
                <strong className="text-white">1–10 Fifth-Seat score</strong> that counts as{" "}
                <strong className="text-emerald-300">one full co-host chair</strong> on the pod.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <a
                href={BFE_LINKS.patreon}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-zinc-950 hover:bg-emerald-300 transition"
              >
                Join BFE on Patreon (from £3 / $4.50) →
              </a>
              <button
                type="button"
                onClick={() => setActiveTab("beetroot")}
                className="rounded-2xl bg-white/10 px-5 py-3 text-sm font-semibold text-white ring-1 ring-white/15 hover:bg-white/15 transition"
              >
                Vote in Free Public Beetroot Poll →
              </button>
            </div>

            <div className="border-t border-white/10 pt-5">
              <div className="text-xs font-semibold text-white/90">
                Already a BFE Patron? Tap the Magic Link in the pinned Patreon post / X group chat —
                or unlock this browser for 1 year with the Patron passphrase:
              </div>
              <form onSubmit={handlePassphraseUnlock} className="mt-3 flex max-w-md gap-2">
                <input
                  type="password"
                  value={patronKeyInput}
                  onChange={(e) => setPatronKeyInput(e.target.value)}
                  placeholder="Enter Patron passphrase…"
                  className="flex-1 rounded-xl bg-white/5 px-3.5 py-2.5 text-xs text-white placeholder:text-white/35 ring-1 ring-white/15 focus:outline-none focus:ring-emerald-400"
                />
                <button
                  type="submit"
                  disabled={unlocking || !patronKeyInput.trim()}
                  className="rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-zinc-950 hover:bg-white/90 disabled:opacity-40 transition"
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
              <div className="mb-6 flex flex-col gap-3 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-white">
                    Prefer Ian’s classic Google Form?
                  </div>
                  <div className="mt-0.5 text-xs text-white/65">
                    {googleFormLink.isPrefilledEvergreen
                      ? `Opens our single official Google Form with “${film.title}” already pre-filled.`
                      : `Opens the official Fifth-Seat Google Form for ${film.title} in a new tab.`}
                  </div>
                </div>
                <a
                  href={googleFormLink.url}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 inline-flex items-center justify-center rounded-xl bg-white px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-white/90 transition"
                >
                  Open Google Form ↗
                </a>
              </div>
            ) : null}

            {fifthResult ? (
              <div className="rounded-2xl bg-emerald-500/10 p-6 ring-1 ring-emerald-400/30">
                <div className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
                  🪑 Fifth-Seat Locked In!
                </div>
                <h3 className="mt-1 text-2xl font-semibold text-white">
                  Thanks, {name}! You gave {film.title} a {score}/10.
                </h3>
                <p className="mt-2 text-sm text-white/75">
                  Your rating is queued directly on Ian’s recording-day screen as Patron #
                  {fifthResult.count} for this episode. Remember: the Fifth-Seat average counts as{" "}
                  <strong className="text-white">one full co-host chair</strong> in the official BFE
                  score!
                </p>

                {fifthResult.myContributorProfile ? (
                  <div className="mt-4 inline-flex items-center gap-3 rounded-2xl bg-black/40 px-4 py-2.5 text-xs ring-1 ring-white/10">
                    <span className="font-semibold text-emerald-300">
                      {fifthResult.myContributorProfile.tierBadge}
                    </span>
                    <span className="text-white/75">
                      {fifthResult.myContributorProfile.submissions} career Fifth-Seat
                      {fifthResult.myContributorProfile.submissions === 1 ? "" : "s"} logged • Avg
                      score: {fifthResult.myContributorProfile.avgScoreGiven}/10
                    </span>
                  </div>
                ) : null}

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setFifthResult(null)}
                    className="rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/15 transition"
                  >
                    Edit my score or thoughts
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("beetroot")}
                    className="rounded-xl bg-fuchsia-400/20 px-4 py-2 text-xs font-semibold text-fuchsia-200 ring-1 ring-fuchsia-400/30 hover:bg-fuchsia-400/30 transition"
                  >
                    Vote in the Beetroot Poll too →
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleFifthSeatSubmit} className="space-y-5">
                <div>
                  <div className="flex items-baseline justify-between">
                    <label className="text-sm font-semibold text-white">
                      1. Your Score (1–10) <span className="text-emerald-400">*</span>
                    </label>
                    <span className="text-xs text-white/55">
                      Tap a number — seen it years ago? Memory scores count!
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
                          className={`h-12 rounded-2xl text-base font-bold transition ${
                            active
                              ? "bg-emerald-400 text-zinc-950 scale-[1.04] shadow-lg shadow-emerald-500/20"
                              : "bg-white/5 text-white ring-1 ring-white/10 hover:bg-white/15"
                          }`}
                        >
                          {n}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-white">
                    2. Your Name <span className="text-emerald-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Paul Komoroski, Shai, Dirk Diggler…"
                    className="mt-2 w-full rounded-2xl bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/35 ring-1 ring-white/10 focus:outline-none focus:ring-emerald-400/50"
                  />
                </div>

                <div>
                  <div className="flex items-baseline justify-between">
                    <label className="text-sm font-semibold text-white">
                      3. Your Thoughts <span className="text-white/45 font-normal">(Optional)</span>
                    </label>
                    <span className="text-xs text-white/50">
                      Even 1 sentence or just a score is great
                    </span>
                  </div>
                  <textarea
                    rows={3}
                    value={thoughts}
                    onChange={(e) => setThoughts(e.target.value)}
                    placeholder="Drop a few words on the film, your favorite scene, or a hot take for Ian to read on the pod…"
                    className="mt-2 w-full rounded-2xl bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/35 ring-1 ring-white/10 focus:outline-none focus:ring-emerald-400/50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-white">
                    4. Got a Question for the Hosts?{" "}
                    <span className="text-white/45 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={hostQuestion}
                    onChange={(e) => setHostQuestion(e.target.value)}
                    placeholder="Optional 1-question prompt for Ian, Liam, Megs & Kev during recording…"
                    className="mt-2 w-full rounded-2xl bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/35 ring-1 ring-white/10 focus:outline-none focus:ring-emerald-400/50"
                  />
                </div>

                {fifthError ? (
                  <div className="rounded-xl bg-rose-500/15 px-4 py-2.5 text-xs text-rose-200 ring-1 ring-rose-400/30">
                    {fifthError}
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <button
                    type="submit"
                    disabled={submitting5th}
                    className="rounded-2xl bg-emerald-400 px-6 py-3 text-sm font-semibold text-zinc-950 hover:bg-emerald-300 disabled:opacity-50 transition"
                  >
                    {submitting5th
                      ? "Locking in Fifth-Seat…"
                      : `🪑 Submit Fifth-Seat for ${film.title}`}
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
            <div className="text-xs font-semibold uppercase tracking-wider text-fuchsia-300">
              🥬 Put Out a Fleece — Official #BFEPoll
            </div>
            <h3 className="mt-1 text-xl font-semibold text-white">{film.title} is a…</h3>
            <p className="mt-1 text-xs text-white/65">
              Open to all listeners! <strong className="text-white">Great + Good</strong> combine
              for the episode’s <strong className="text-fuchsia-200">Beetroot Metric %</strong>{" "}
              (10+ votes required for official qualification).
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {BEETROOT_OPTIONS.map((opt) => {
              const count = Number(beetSummary?.[opt.key] || 0);
              const pct = totalBeet > 0 ? Math.round((count / totalBeet) * 100) : 0;
              const selected = myBeetChoice === opt.key;

              return (
                <button
                  key={opt.key}
                  type="button"
                  disabled={submittingBeet}
                  onClick={() => handleBeetrootVote(opt.key, false)}
                  className={`relative overflow-hidden rounded-2xl p-4 text-left transition ${
                    selected
                      ? "bg-fuchsia-500/20 ring-2 ring-fuchsia-400"
                      : "bg-white/5 ring-1 ring-white/10 hover:bg-white/10"
                  }`}
                >
                  <div
                    className="pointer-events-none absolute inset-y-0 left-0 bg-fuchsia-400/10 transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                  <div className="relative flex items-center justify-between gap-2">
                    <div>
                      <div className="text-base font-semibold text-white">
                        {opt.emoji} {opt.label}
                      </div>
                      <div className="mt-0.5 text-xs text-white/60">{opt.desc}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-white">{pct}%</div>
                      <div className="text-[11px] text-white/55">{count} votes</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {totalBeet > 0 ? (
            <div className="rounded-2xl bg-black/35 p-4 ring-1 ring-white/10">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold text-white">
                  🥬 Current Beetroot Metric:{" "}
                  <span className="text-fuchsia-300">{beetSummary.beetrootPct}%</span>
                </div>
                <div className="text-xs text-white/60">
                  {beetSummary.qualifies
                    ? `✅ Qualified (${totalBeet} votes)`
                    : `${totalBeet}/10 votes to qualify on air`}
                </div>
              </div>
              <div className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-fuchsia-400 to-emerald-400 transition-all duration-500"
                  style={{ width: `${beetSummary.beetrootPct || 0}%` }}
                />
              </div>
            </div>
          ) : null}

          {myBeetChoice ? (
            <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10 space-y-3">
              <div className="text-xs font-semibold text-white/90">
                Add a 1-liner for “Fledgling Fandom” on this week’s episode (optional):
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name / @handle"
                  className="sm:w-48 rounded-xl bg-black/40 px-3 py-2 text-xs text-white placeholder:text-white/35 ring-1 ring-white/10"
                />
                <input
                  type="text"
                  value={beetComment}
                  onChange={(e) => setBeetComment(e.target.value)}
                  placeholder="Why is it Great, Good, OK, or Poor?"
                  className="flex-1 rounded-xl bg-black/40 px-3 py-2 text-xs text-white placeholder:text-white/35 ring-1 ring-white/10"
                />
                <button
                  type="button"
                  disabled={!beetComment.trim() || submittingBeet}
                  onClick={() => handleBeetrootVote(myBeetChoice, true)}
                  className="rounded-xl bg-fuchsia-400 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-fuchsia-300 disabled:opacity-40 transition"
                >
                  Post Take
                </button>
              </div>
              {beetSaved && !beetComment ? (
                <div className="text-[11px] text-emerald-300">
                  Vote saved!{" "}
                  {isPatron ? (
                    <>
                      Don’t forget to cast your{" "}
                      <button
                        type="button"
                        onClick={() => setActiveTab("fifth-seat")}
                        className="underline font-semibold"
                      >
                        1–10 Patron Fifth-Seat score
                      </button>{" "}
                      too.
                    </>
                  ) : (
                    <>
                      Want your 1–10 score counted as a full co-host chair?{" "}
                      <a
                        href={BFE_LINKS.patreon}
                        target="_blank"
                        rel="noreferrer"
                        className="underline font-semibold"
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
              <div className="text-xs font-semibold uppercase tracking-wider text-white/50">
                Recent Listener Takes
              </div>
              {beetSummary.comments.slice(0, 5).map((c) => (
                <div
                  key={c.id}
                  className="rounded-2xl bg-white/5 px-4 py-3 text-xs ring-1 ring-white/10"
                >
                  <span className="font-semibold text-white">{c.name}</span>{" "}
                  <span className="text-fuchsia-300 uppercase text-[10px] ml-1">[{c.choice}]</span>
                  <p className="mt-1 text-white/75">{c.comment}</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
