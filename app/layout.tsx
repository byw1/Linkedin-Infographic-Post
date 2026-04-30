import type { Metadata } from "next";
import "@/styles/globals.css";

// Prefer the deployed origin if it's known via env so absolute URLs
// in og:image / twitter:image resolve correctly when the URL is
// shared. Falls back to localhost for dev.
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.NEXTAUTH_URL ??
  "http://localhost:3000";

const TITLE = "viral · making our friends famous";
const DESCRIPTION =
  "We figured out how to hack virality. 1M+ impressions in the last 30 days. Invite-only.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    siteName: "viral",
    // Static branded render lives in /public/og.png. Dropping an
    // explicit `images` entry here takes precedence over Next 14's
    // file-convention auto-discovery (app/opengraph-image.*) — the
    // dynamic generator is gone now, so this is the only source.
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "viral — making our friends famous",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background antialiased">{children}</body>
    </html>
  );
}
