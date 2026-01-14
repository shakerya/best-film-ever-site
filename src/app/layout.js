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

export const metadata = {
  // OK for now. When you add a custom domain, update this to that domain.
  metadataBase: new URL("https://best-film-ever-site.vercel.app"),

  title: {
    default: "Best Film Ever",
    template: "%s · Best Film Ever",
  },
  description: "A movie-style episode index for the Best Film Ever podcast. Built by Aashrey Kapoor.",

  applicationName: "Best Film Ever",
  authors: [{ name: "Aashrey Kapoor", url: "https://x.com/aashrey_" }],
  creator: "Aashrey Kapoor",
  publisher: "Aashrey Kapoor",

  openGraph: {
    type: "website",
    title: "Best Film Ever",
    description: "A movie-style episode index for the Best Film Ever podcast. Built by Aashrey Kapoor.",
    siteName: "Best Film Ever",
  },

  twitter: {
    card: "summary_large_image",
    title: "Best Film Ever",
    description: "A movie-style episode index for the Best Film Ever podcast. Built by Aashrey Kapoor.",
    creator: "@aashrey_",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
