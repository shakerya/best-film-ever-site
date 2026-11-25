"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BFE_LINKS } from "@/lib/bfeShared";

const NAV_ITEMS = [
  { href: "/", label: "Episodes" },
  { href: "/fifth-seat", label: "🪑 Fifth Seat & Poll" },
  { href: "/gif", label: "🎬 GIF Game" },
  { href: "/leaderboard", label: "🏆 Leaderboard" },
];

export default function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-zinc-950/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-3.5">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-rose-600 text-xs font-black tracking-tight text-white shadow">
              BFE
            </span>
            <span className="text-base font-bold tracking-tight text-white">Best Film Ever</span>
          </Link>

          <nav className="flex flex-wrap items-center gap-1.5">
            {NAV_ITEMS.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/" || pathname.startsWith("/episodes/")
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    active
                      ? "bg-white text-zinc-950 font-semibold"
                      : "text-white/75 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href={BFE_LINKS.apple}
            target="_blank"
            rel="noreferrer"
            className="hidden lg:inline-flex rounded-full bg-white/5 px-2.5 py-1.5 text-xs text-white/70 ring-1 ring-white/10 hover:bg-white/10 hover:text-white transition"
          >
            Apple
          </a>
          <a
            href={BFE_LINKS.spotify}
            target="_blank"
            rel="noreferrer"
            className="hidden lg:inline-flex rounded-full bg-white/5 px-2.5 py-1.5 text-xs text-white/70 ring-1 ring-white/10 hover:bg-white/10 hover:text-white transition"
          >
            Spotify
          </a>
          <a
            href={BFE_LINKS.podbean}
            target="_blank"
            rel="noreferrer"
            className="hidden xl:inline-flex rounded-full bg-white/5 px-2.5 py-1.5 text-xs text-white/70 ring-1 ring-white/10 hover:bg-white/10 hover:text-white transition"
          >
            Podbean
          </a>
          <a
            href={BFE_LINKS.xProfile}
            target="_blank"
            rel="noreferrer"
            className="hidden sm:inline-flex rounded-full bg-white/5 px-2.5 py-1.5 text-xs text-white/70 ring-1 ring-white/10 hover:bg-white/10 hover:text-white transition"
          >
            @bestfilmeverpod
          </a>
          <a
            href={BFE_LINKS.patreon}
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-emerald-400 px-3.5 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-emerald-300 transition"
          >
            Join Patreon
          </a>
          <Link
            href="/chat"
            title="Private BFE Transcript Vault"
            className="rounded-full bg-white/5 px-2.5 py-1.5 text-xs text-white/55 ring-1 ring-white/10 hover:bg-white/10 hover:text-white transition"
          >
            🔒 Vault
          </Link>
        </div>
      </div>
    </header>
  );
}
