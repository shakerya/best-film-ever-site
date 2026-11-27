"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const STARTER_PROMPTS = [
  "What did Ian say about Robert Pattinson being cast as James Bond?",
  "Compare the host scores and Fifth-Seat scores on Full Metal Jacket and Gangs of New York",
  "What did the hosts say about Gerard Butler and Zack Snyder in Episode 300 (300)?",
  "Why did Liam almost watch the wrong Arrival movie with Charlie Sheen?",
  "What happened during Ian's office chair story in Gangs of New York?",
  "Why did Debbie get disqualified in GIF of the Week for Sniper?",
];

export default function ArchiveChatClient({ stats, hasLlmKey, requiresPasscode }) {
  const [passcode, setPasscode] = useState("");
  const [unlocked, setUnlocked] = useState(!requiresPasscode);
  const [authError, setAuthError] = useState("");

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("bfe_vault_passcode") || "";
      if (saved) {
        setPasscode(saved);
        setUnlocked(true);
      }
    } catch {
      // ignore
    }
  }, []);

  async function sendQuestion(qText) {
    const question = String(qText || input).trim();
    if (!question || loading) return;

    const priorHistory = messages.slice(-6).map((m) => ({
      role: m.role,
      content: m.content,
    }));
    setAuthError("");
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-bfe-passcode": passcode,
        },
        body: JSON.stringify({ question, history: priorHistory }),
      });
      const data = await res.json();
      if (res.status === 401) {
        setUnlocked(false);
        setAuthError(data.error || "Private passcode required.");
        setMessages((prev) => prev.slice(0, -1));
        return;
      }
      if (!res.ok || !data.ok) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.error || "Something went wrong.", sources: [] },
        ]);
      } else {
        try {
          if (passcode) localStorage.setItem("bfe_vault_passcode", passcode);
        } catch {
          // ignore
        }
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.answer,
            model: data.model,
            sources: data.sources || [],
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Network error querying transcript index.", sources: [] },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <section className="rounded-2xl sm:rounded-3xl bg-zinc-900/60 p-5 sm:p-6 md:p-8 ring-1 ring-white/[0.08]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-300">
              Private Archive Search & Q&A
            </div>
            <h1 className="mt-1.5 text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight text-white">
              Best Film Ever Transcript Vault
            </h1>
            <p className="mt-2 max-w-2xl text-xs sm:text-sm leading-relaxed text-zinc-400">
              Search and ask questions across{" "}
              <strong className="text-zinc-200 font-medium">
                {stats.episodeCount} full transcripts
              </strong>{" "}
              ({stats.totalWords.toLocaleString()} words across Episodes {stats.minEpNum}–
              {stats.maxEpNum} + {stats.extrasCount} Extras), expanding automatically as historical
              episodes finish transcribing.
            </p>
          </div>

          <div className="w-full sm:w-auto rounded-2xl bg-zinc-950/80 px-4 py-3 text-xs ring-1 ring-white/[0.08] flex sm:block items-center justify-between gap-2 sm:space-y-1">
            <div>
              <div className="text-zinc-500">Index Status</div>
              <div className="font-semibold text-white tabular-nums">
                {stats.chunkCount.toLocaleString()} transcript segments
              </div>
            </div>
            <div className={hasLlmKey ? "text-amber-300 font-medium" : "text-zinc-400"}>
              {hasLlmKey ? "AI Synthesis Active" : "Direct Transcript Search"}
            </div>
          </div>
        </div>
      </section>

      {!unlocked ? (
        <section className="mx-auto max-w-md rounded-2xl sm:rounded-3xl bg-zinc-900/60 p-5 sm:p-6 ring-1 ring-white/[0.08]">
          <h2 className="text-lg font-semibold text-white">Unlock Private Transcript Vault</h2>
          <p className="mt-1 text-xs text-zinc-400">
            Enter your Vault passcode (default:{" "}
            <code className="rounded bg-zinc-950 px-1.5 py-0.5 text-amber-300">bfe-vault</code>).
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!passcode.trim()) return;
              setUnlocked(true);
            }}
            className="mt-4 space-y-3"
          >
            <input
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Passcode…"
              className="w-full rounded-xl bg-zinc-950 px-4 py-2.5 text-sm text-white ring-1 ring-white/10 focus:outline-none focus:ring-white/30"
            />
            {authError ? <div className="text-xs text-rose-300">{authError}</div> : null}
            <button
              type="submit"
              className="w-full rounded-full bg-white py-2.5 text-sm font-semibold text-zinc-950 hover:bg-zinc-200 transition"
            >
              Unlock Vault →
            </button>
          </form>
        </section>
      ) : (
        <section className="rounded-2xl sm:rounded-3xl bg-zinc-900/60 p-4 sm:p-6 ring-1 ring-white/[0.08] space-y-5 sm:space-y-6">
          {messages.length === 0 ? (
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                Sample Queries Across the Archive
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2.5 md:grid-cols-2">
                {STARTER_PROMPTS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => sendQuestion(p)}
                    className="rounded-2xl bg-zinc-950/70 p-3.5 text-left text-xs text-zinc-300 ring-1 ring-white/[0.08] hover:bg-zinc-950 hover:text-white hover:ring-white/20 transition"
                  >
                    “{p}”
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {messages.length > 0 ? (
            <div className="space-y-4 max-h-[62vh] overflow-y-auto pr-1">
              {messages.map((m, idx) => (
                <div
                  key={idx}
                  className={`rounded-2xl p-5 ${
                    m.role === "user"
                      ? "ml-auto max-w-2xl bg-white/[0.09] ring-1 ring-white/15"
                      : "bg-zinc-950/85 ring-1 ring-white/[0.08]"
                  }`}
                >
                  <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1.5">
                    {m.role === "user" ? "You" : `BFE Vault · ${m.model || "Transcript RAG"}`}
                  </div>
                  <div className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-100">
                    {m.content}
                  </div>

                  {m.sources?.length ? (
                    <details className="mt-4 rounded-xl bg-zinc-900/80 p-3.5 ring-1 ring-white/[0.08]">
                      <summary className="cursor-pointer text-xs font-medium text-amber-300">
                        View {m.sources.length} cited transcript passages
                      </summary>
                      <div className="mt-3 space-y-2.5">
                        {m.sources.map((s, sIdx) => (
                          <div
                            key={`${s.slug}-${sIdx}`}
                            className="rounded-xl bg-zinc-950 p-3 text-xs ring-1 ring-white/[0.06]"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <Link
                                href={`/episodes/${s.slug}`}
                                className="font-semibold text-white hover:text-amber-300 underline"
                              >
                                {s.title}
                              </Link>
                              <span className="text-[11px] text-zinc-500">
                                {s.section} · ~{s.pct}% in
                              </span>
                            </div>
                            <p className="mt-1.5 line-clamp-4 text-zinc-400 leading-relaxed">
                              “{s.text}”
                            </p>
                          </div>
                        ))}
                      </div>
                    </details>
                  ) : null}
                </div>
              ))}
              {loading ? (
                <div className="rounded-2xl bg-zinc-950/85 p-5 text-xs text-zinc-400 ring-1 ring-white/[0.08]">
                  Searching {stats.chunkCount.toLocaleString()} transcript segments across{" "}
                  {stats.episodeCount} episodes…
                </div>
              ) : null}
            </div>
          ) : null}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendQuestion(input);
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything spoken on BFE…"
              className="min-w-0 flex-1 rounded-xl bg-zinc-950 px-3.5 sm:px-4 py-2.5 sm:py-3 text-sm text-white placeholder:text-zinc-500 ring-1 ring-white/10 focus:outline-none focus:ring-white/30"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="shrink-0 whitespace-nowrap rounded-full bg-white px-4 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold text-zinc-950 hover:bg-zinc-200 disabled:opacity-40 transition"
            >
              Ask Vault
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
