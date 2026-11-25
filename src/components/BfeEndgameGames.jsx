"use client";

import { useState } from "react";

function formatMillions(dollars) {
  const m = Math.round((Number(dollars || 0) / 1_000_000) * 10) / 10;
  return `$${m.toLocaleString()}M`;
}

function scoreAgeGuess(guess, actual) {
  const g = Number.parseInt(String(guess || ""), 10);
  if (!Number.isFinite(g)) return { pts: 0, label: "No guess" };
  const diff = Math.abs(g - actual);
  const tolerance = actual < 18 ? 1 : 2;
  if (diff === 0) return { pts: 1.5, label: "🎯 Bang on! (1.5 pts)" };
  if (diff <= tolerance) return { pts: 1.0, label: `✅ Within ±${tolerance} (1 pt)` };
  return { pts: 0, label: `❌ Off by ${diff}y (0 pts)` };
}

export default function BfeEndgameGames({
  movieTitle,
  releaseYear,
  ageGameCast = [],
  budget = 0,
  revenue = 0,
}) {
  const hasAgeGame = Array.isArray(ageGameCast) && ageGameCast.length >= 3;
  const hasMoneyGame = Number(budget) > 0 && Number(revenue) > 0;

  const [guesses, setGuesses] = useState({});
  const [ageRevealed, setAgeRevealed] = useState(false);

  const [boxGuessM, setBoxGuessM] = useState("");
  const [moneyRevealed, setMoneyRevealed] = useState(false);

  if (!hasAgeGame && !hasMoneyGame) return null;

  const ageResults = ageGameCast.map((actor) => ({
    ...actor,
    result: scoreAgeGuess(guesses[actor.id], actor.ageAtRelease),
  }));
  const totalPts = ageResults.reduce((s, r) => s + r.result.pts, 0);
  const neededToWin = ageGameCast.length * 0.5;
  const wonAgeGame = totalPts >= neededToWin;

  const actualRevM = Math.round((Number(revenue) / 1_000_000) * 10) / 10;
  const userRevM = Number.parseFloat(boxGuessM);
  const revDiffM = Number.isFinite(userRevM)
    ? Math.round(Math.abs(userRevM - actualRevM) * 10) / 10
    : null;

  return (
    <section className="rounded-3xl bg-gradient-to-br from-amber-950/30 via-zinc-900/70 to-zinc-950 p-6 ring-1 ring-amber-400/20 space-y-6">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-300">
          🎮 WE’RE IN THE ENDGAME NOW — PLAY ALONG
        </div>
        <h2 className="mt-1 text-xl font-semibold text-white">
          Beat the Hosts: Official BFE Mini-Games
        </h2>
        <p className="mt-1 text-xs text-white/65">
          Play along before Ian gets to the Endgame segment! Uses official BFE rules (±2 years, ±1
          for minors, 1.5 pts for bang-on).
        </p>
      </div>

      {/* Game 1: The Age Game */}
      {hasAgeGame ? (
        <div className="rounded-2xl bg-black/35 p-5 ring-1 ring-white/10">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-base font-semibold text-white">
              🎂 The Age Game {releaseYear ? `(${releaseYear})` : ""}
            </h3>
            <span className="text-xs text-white/55">
              Need {neededToWin} pts to win (out of {ageGameCast.length})
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {ageResults.map((actor) => (
              <div
                key={actor.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/5 p-3 ring-1 ring-white/10"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {actor.profileUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={actor.profileUrl}
                      alt={actor.name}
                      className="h-11 w-11 rounded-xl object-cover shrink-0"
                    />
                  ) : null}
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white">{actor.name}</div>
                    {actor.character ? (
                      <div className="truncate text-xs text-white/60">as {actor.character}</div>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={1}
                    max={105}
                    disabled={ageRevealed}
                    value={guesses[actor.id] ?? ""}
                    onChange={(e) =>
                      setGuesses((prev) => ({ ...prev, [actor.id]: e.target.value }))
                    }
                    placeholder="Age?"
                    className="w-20 rounded-xl bg-black/50 px-3 py-2 text-center text-sm font-semibold text-white ring-1 ring-white/15 focus:outline-none focus:ring-amber-400"
                  />
                  {ageRevealed ? (
                    <div className="text-right min-w-[130px]">
                      <div className="text-xs font-bold text-white">
                        Actual: {actor.ageAtRelease}
                      </div>
                      <div className="text-[11px] text-amber-200">{actor.result.label}</div>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            {!ageRevealed ? (
              <button
                type="button"
                onClick={() => setAgeRevealed(true)}
                className="rounded-xl bg-amber-400 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-amber-300 transition"
              >
                Lock In Ages & Check Score →
              </button>
            ) : (
              <>
                <div className="text-sm font-semibold text-white">
                  Score: <span className="text-amber-300">{totalPts} pts</span> —{" "}
                  {wonAgeGame ? "🏆 YOU WON THE AGE GAME!" : "💀 Chaz & Ian got you this week!"}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAgeRevealed(false);
                    setGuesses({});
                  }}
                  className="rounded-xl bg-white/10 px-3 py-1.5 text-xs text-white/80 hover:bg-white/15"
                >
                  Reset
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}

      {/* Game 2: Money, Money, Money */}
      {hasMoneyGame ? (
        <div className="rounded-2xl bg-black/35 p-5 ring-1 ring-white/10">
          <h3 className="text-base font-semibold text-white">
            💰 “Money, Money, Money” — Box Office Guess
          </h3>
          <p className="mt-1 text-xs text-white/65">
            <strong className="text-white">{movieTitle}</strong> had a reported budget of{" "}
            <strong className="text-emerald-300">{formatMillions(budget)}</strong>. What did it take
            home worldwide (in millions USD)?
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-2 text-sm text-white/50">
                $
              </span>
              <input
                type="number"
                step="0.1"
                disabled={moneyRevealed}
                value={boxGuessM}
                onChange={(e) => setBoxGuessM(e.target.value)}
                placeholder="e.g. 195"
                className="w-36 rounded-xl bg-black/50 pl-7 pr-8 py-2 text-sm font-semibold text-white ring-1 ring-white/15"
              />
              <span className="pointer-events-none absolute right-3 top-2 text-xs text-white/50">
                M
              </span>
            </div>

            {!moneyRevealed ? (
              <button
                type="button"
                disabled={!boxGuessM}
                onClick={() => setMoneyRevealed(true)}
                className="rounded-xl bg-emerald-400 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-emerald-300 disabled:opacity-40 transition"
              >
                Reveal Box Office →
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMoneyRevealed(false);
                  setBoxGuessM("");
                }}
                className="rounded-xl bg-white/10 px-3 py-2 text-xs text-white/80 hover:bg-white/15"
              >
                Try again
              </button>
            )}
          </div>

          {moneyRevealed ? (
            <div className="mt-3 rounded-xl bg-white/5 px-4 py-3 text-xs text-white/85 ring-1 ring-white/10">
              Actual Worldwide Gross:{" "}
              <strong className="text-emerald-300 text-sm">{formatMillions(revenue)}</strong>
              {revDiffM !== null ? (
                <span className="ml-2 text-white/70">
                  (You were within <strong>${revDiffM}M</strong>
                  {revDiffM <= 10 ? " — 🎯 Retire on that guess!" : "!"})
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
