"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BFE_LINKS } from "@/lib/bfeShared";

const NAV_ITEMS = [
  { href: "/", label: "Library" },
  { href: "/fifth-seat", label: "Fifth Seat & Poll" },
  { href: "/gif", label: "GIF of the Week" },
  { href: "/leaderboard", label: "Leaderboard" },
];

export default function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-zinc-950/80 backdrop-blur-2xl">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-3.5">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <Link href="/" className="group flex items-center gap-2.5">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-rose-600 text-[11px] font-black tracking-tight text-white shadow-sm ring-1 ring-white/15 group-hover:bg-rose-500 transition">
              BFE
            </span>
            <span className="text-[15px] font-semibold tracking-tight text-white">
              Best Film Ever
            </span>
          </Link>

          {/* Segmented Navigation */}
          <nav className="flex flex-wrap items-center gap-1 rounded-full bg-white/[0.04] p-1 ring-1 ring-white/[0.08]">
            {NAV_ITEMS.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/" || pathname.startsWith("/episodes/")
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                    active
                      ? "bg-white text-zinc-950 font-semibold shadow-sm"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="hidden xl:flex items-center gap-3 mr-2 text-xs text-zinc-400">
            <a
              href={BFE_LINKS.apple}
              target="_blank"
              rel="noreferrer"
              className="hover:text-white transition"
            >
              Apple
            </a>
            <span className="text-white/15">•</span>
            <a
              href={BFE_LINKS.spotify}
              target="_blank"
              rel="noreferrer"
              className="hover:text-white transition"
            >
              Spotify
            </a>
            <span className="text-white/15">•</span>
            <a
              href={BFE_LINKS.xProfile}
              target="_blank"
              rel="noreferrer"
              className="hover:text-white transition"
            >
              @bestfilmeverpod
            </a>
          </div>

          <Link
            href="/admin"
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              pathname.startsWith("/admin")
                ? "bg-white text-zinc-950 font-semibold"
                : "text-zinc-400 hover:bg-white/[0.06] hover:text-white"
            }`}
          >
            Host Studio
          </Link>

          <Link
            href="/chat"
            title="Private BFE Transcript Vault"
            className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition ${
              pathname.startsWith("/chat")
                ? "bg-white text-zinc-950 font-semibold ring-transparent"
                : "bg-white/[0.04] text-zinc-300 ring-white/10 hover:bg-white/[0.08] hover:text-white"
            }`}
          >
            Vault
          </Link>

          <a
            href={BFE_LINKS.patreon}
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-amber-300 px-3.5 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-amber-200 transition"
          >
            Patreon ↗
          </a>
        </div>
      </div>
    </header>
  );
}
