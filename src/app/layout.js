import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// If you ever add a custom domain, set NEXT_PUBLIC_SITE_URL to it in Vercel.
// Example: https://bestfilmever.com
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  "https://best-film-ever-site.vercel.app"; // fallback (ok to leave)

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Best Film Ever",
    template: "%s · Best Film Ever",
  },
  description:
    "Browse Best Film Ever podcast episodes like a movie library — posters first, details when you click in.",
  creator: "Aashrey Kapoor",
  authors: [{ name: "Aashrey Kapoor", url: "https://x.com/aashrey_" }],
  openGraph: {
    type: "website",
    url: siteUrl,
    title: "Best Film Ever",
    description:
      "Browse Best Film Ever podcast episodes like a movie library — posters first, details when you click in.",
  },
  twitter: {
    card: "summary_large_image",
    creator: "@aashrey_",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-zinc-950 text-white`}
      >
        {children}

        <footer className="mx-auto max-w-6xl px-6 py-10 text-xs text-white/55">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              Made by{" "}
              <a
                href="https://x.com/aashrey_"
                target="_blank"
                rel="noreferrer"
                className="text-white/75 hover:text-white transition underline underline-offset-4 decoration-white/20 hover:decoration-white/50"
              >
                Aashrey Kapoor
              </a>
            </div>

            <div className="text-white/40">
              Data from TMDB and the podcast RSS feed.
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
