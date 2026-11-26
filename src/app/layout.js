import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Analytics } from "@vercel/analytics/react";
import { GoogleAnalytics } from "@next/third-parties/google";
import AudioPlayerProvider from "@/components/AudioPlayerProvider";
import SiteHeader from "@/components/SiteHeader";
import { BFE_LINKS } from "@/lib/bfeStore";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  metadataBase: new URL("https://www.bestfilmeverpod.fyi"),
  title: {
    default: "Best Film Ever",
    template: "%s • Best Film Ever",
  },
  description:
    "Browse Best Film Ever episodes like a movie library — submit Patron Fifth-Seats, vote in the Beetroot Metric poll, play GIF of the Week, and explore the Leaderboard.",
  applicationName: "Best Film Ever",
  authors: [{ name: "Aashrey Kapoor", url: "https://x.com/aashrey_" }],
  creator: "Aashrey Kapoor",
  publisher: "Aashrey Kapoor",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "https://www.bestfilmeverpod.fyi",
    title: "Best Film Ever",
    description:
      "Browse Best Film Ever episodes like a movie library — submit Patron Fifth-Seats, vote in the Beetroot Poll, and play along with the hosts.",
    siteName: "Best Film Ever",
  },
  twitter: {
    card: "summary_large_image",
    title: "Best Film Ever",
    description:
      "Browse Best Film Ever episodes like a movie library — submit Patron Fifth-Seats, vote in the Beetroot Poll, and play along with the hosts.",
    creator: "@aashrey_",
  },
};

export default function RootLayout({ children }) {
  const gaId = process.env.NEXT_PUBLIC_GA_ID || "";

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans bg-zinc-950 text-white min-h-screen`}
      >
        <AudioPlayerProvider>
          <div className="min-h-screen flex flex-col pb-16">
            <SiteHeader />
            <div className="flex-1">{children}</div>

            <footer className="border-t border-white/10 bg-zinc-950">
              <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between px-4 sm:px-6 py-5 sm:py-6 text-xs sm:text-sm text-white/60">
                <a
                  href="https://x.com/aashrey_"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white/85 transition"
                  title="Aashrey on X"
                >
                  Made by Aashrey Kapoor
                </a>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                  <Link href="/fifth-seat" className="hover:text-white transition">
                    Fifth-Seat & Poll
                  </Link>
                  <Link href="/gif" className="hover:text-white transition">
                    GIF of the Week
                  </Link>
                  <Link href="/leaderboard" className="hover:text-white transition">
                    Leaderboard
                  </Link>
                  <a
                    href={BFE_LINKS.patreon}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-white transition"
                  >
                    Patreon
                  </a>
                  <Link href="/admin" className="text-white/40 hover:text-white/75 transition">
                    Studio
                  </Link>
                </div>
              </div>
            </footer>
          </div>
        </AudioPlayerProvider>

        <Analytics />
        {gaId ? <GoogleAnalytics gaId={gaId} /> : null}
      </body>
    </html>
  );
}
