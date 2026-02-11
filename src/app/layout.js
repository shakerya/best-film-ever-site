import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { GoogleAnalytics } from "@next/third-parties/google";
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
  description: "Browse Best Film Ever episodes like a movie library — posters first, details when you click in.",
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
    description: "Browse Best Film Ever episodes like a movie library — posters first, details when you click in.",
    siteName: "Best Film Ever",
  },
  twitter: {
    card: "summary_large_image",
    title: "Best Film Ever",
    description: "Browse Best Film Ever episodes like a movie library — posters first, details when you click in.",
    creator: "@aashrey_",
  },
};

export default function RootLayout({ children }) {
  const gaId = process.env.NEXT_PUBLIC_GA_ID || "";

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans bg-zinc-950 text-white min-h-screen`}>
        <div className="min-h-screen flex flex-col">
          <div className="flex-1">{children}</div>

          <footer className="border-t border-white/10 bg-zinc-950">
            <div className="mx-auto max-w-6xl px-6 py-6 text-sm text-white/60">
              <a
                href="https://x.com/aashrey_"
                target="_blank"
                rel="noreferrer"
                className="hover:text-white/85 transition"
                title="Aashrey on X"
              >
                Made by Aashrey Kapoor
              </a>
            </div>
          </footer>
        </div>

        <Analytics />
        {gaId ? <GoogleAnalytics gaId={gaId} /> : null}
      </body>
    </html>
  );
}
