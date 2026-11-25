"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const STARTER_PROMPTS = [
  "What did Ian say about Robert Pattinson being cast as James Bond?",
  "Compare the host scores and Fifth-Seat scores on Full Metal Jacket and Gangs of New York",
  "How did Ian edit Episode 321 (Memento) and what were the Money Money Money guesses?",
  "Why did Liam almost watch the wrong Arrival movie with Charlie Sheen?",
  "What happened during Ian's theater chair story in Gangs of New York?",
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
        body: JSON.stringify({ question }),
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
    <div className="space-y-8">
      {/* Header + Coverage Banner */}
      <section className="rounded-3xl bg-gradient-to-br from-indigo-950/50 via-zinc-900/80 to-zinc-950 p-6 md:p-8 ring-1 ring-indigo-400/25">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-400/15 px-3 py-1 text-xs font-semibold text-indigo-300 ring-1 ring-indigo-400/30">
              🔒 OWNER PREVIEW • ASK THE BFE ARCHIVE
            </div>
            <h1 className="mt-3 text-3xl md:text-4xl font-bold text-white">
              Best Film Ever Transcript Vault
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-white/70">
              Private search & Q&A across{" "}
              <strong className="text-white">{stats.episodeCount} full transcripts</strong> (
              {stats.totalWords.toLocaleString()} words across Episodes {stats.minEpNum}–
              {stats.maxEpNum} + {stats.extrasCount} Extras). Gated to you right now while we
              backfill Episodes 1–300, and ready to open to Patrons whenever you flip the switch.
            </p>
          </div>

          <div className="rounded-2xl bg-black/40 px-4 py-3 text-xs ring-1 ring-white/10 space-y-1">
            <div className="text-white/55">Search Engine Status</div>
            <div className="font-semibold text-emerald-300">
              ✅ {stats.chunkCount.toLocaleString()} chunks indexed
            </div>
            <div className="text-white/60">
              {hasLlmKey
                ? "🤖 AI Synthesis Active"
                : "🔎 Direct Transcript Mode (add GEMINI/GROQ key for AI prose)"}
            </div>
          </div>
        </div>
      </section>

      {!unlocked ? (
        <section className="mx-auto max-w-md rounded-3xl bg-white/5 p-6 ring-1 ring-white/15">
          <h2 className="text-lg font-semibold text-white">Unlock Private Archive Chatbot</h2>
          <p className="mt-1 text-xs text-white/65">
            Enter your `CHAT_PASSCODE` / `ADMIN_PASSCODE` (default in local dev:{" "}
            <code className="rounded bg-white/10 px-1.5 py-0.5 text-indigo-200">bfe-vault</code>).
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
              placeholder="Enter vault passcode…"
              className="w-full rounded-2xl bg-black/50 px-4 py-3 text-sm text-white ring-1 ring-white/15 focus:outline-none focus:ring-indigo-400"
            />
            {authError ? <div className="text-xs text-rose-300">{authError}</div> : null}
            <button
              type="submit"
              className="w-full rounded-2xl bg-indigo-400 py-3 text-sm font-semibold text-zinc-950 hover:bg-indigo-300 transition"
            >
              Unlock Vault →
            </button>
          </form>
        </section>
      ) : (
        <section className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/15 space-y-6">
          {/* Starter Prompts */}
          {messages.length === 0 ? (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-white/50">
                Try asking across the 2.77M-word archive:
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2.5 md:grid-cols-2">
                {STARTER_PROMPTS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => sendQuestion(p)}
                    className="rounded-2xl bg-black/35 p-3.5 text-left text-xs text-white/85 ring-1 ring-white/10 hover:bg-white/10 hover:ring-indigo-400/40 transition"
                  >
                    “{p}”
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {/* Conversation Stream */}
          {messages.length > 0 ? (
            <div className="space-y-5 max-h-[62vh] overflow-y-auto pr-1">
              {messages.map((m, idx) => (
                <div
                  key={idx}
                  className={`rounded-3xl p-5 ${
                    m.role === "user"
                      ? "ml-auto max-w-2xl bg-indigo-500/20 ring-1 ring-indigo-400/35"
                      : "bg-zinc-900/90 ring-1 ring-white/10"
                  }`}
                >
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-white/45 mb-1.5">
                    {m.role === "user" ? "You" : `BFE Vault (${m.model || "RAG"})`}
                  </div>
                  <div className="whitespace-pre-wrap text-sm leading-relaxed text-white/90">
                    {m.content}
                  </div>

                  {m.sources?.length ? (
                    <details className="mt-4 rounded-2xl bg-black/40 p-3.5 ring-1 ring-white/10">
                      <summary className="cursor-pointer text-xs font-semibold text-indigo-300">
                        View {m.sources.length} cited episode transcript passages
                      </summary>
                      <div className="mt-3 space-y-3">
                        {m.sources.map((s, sIdx) => (
                          <div
                            key={`${s.slug}-${sIdx}`}
                            className="rounded-xl bg-white/5 p-3 text-xs ring-1 ring-white/10"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <Link
                                href={`/episodes/${s.slug}`}
                                className="font-semibold text-white hover:text-indigo-300 underline"
                              >
                                {s.title}
                              </Link>
                              <span className="text-[11px] text-white/50">
                                {s.section} • ~{s.pct}% in
                              </span>
                            </div>
                            <p className="mt-1.5 line-clamp-4 text-white/70 leading-relaxed">
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
                <div className="rounded-3xl bg-zinc-900/90 p-5 text-xs text-indigo-200 ring-1 ring-white/10">
                  Searching 7,725 transcript segments across 76 episodes…
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Input Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendQuestion(input);
            }}
            className="flex gap-2.5"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything spoken on Best Film Ever (movies, scores, stories, games, inside jokes)…"
              className="flex-1 rounded-2xl bg-black/50 px-4 py-3.5 text-sm text-white placeholder:text-white/35 ring-1 ring-white/15 focus:outline-none focus:ring-indigo-400"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="rounded-2xl bg-indigo-400 px-6 py-3.5 text-sm font-semibold text-zinc-950 hover:bg-indigo-300 disabled:opacity-40 transition"
            >
              Ask Vault
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
