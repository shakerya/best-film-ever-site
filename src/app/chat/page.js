// src/app/chat/page.js
import { getArchiveStats } from "@/lib/transcriptSearch";
import ArchiveChatClient from "@/components/ArchiveChatClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "BFE Transcript Vault (Private)",
  robots: { index: false, follow: false },
};

export default function ArchiveChatPage() {
  const stats = getArchiveStats();
  const hasLlmKey = Boolean(
    process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY
  );
  const requiresPasscode = process.env.PUBLIC_PATRON_CHAT !== "true";

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-5xl px-6 pb-20 pt-8">
        <ArchiveChatClient
          stats={stats}
          hasLlmKey={hasLlmKey}
          requiresPasscode={requiresPasscode}
        />
      </div>
    </main>
  );
}
