import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "@/styles/globals.css";

// Prefer the deployed origin if it's known via env so absolute URLs
// in og:image / twitter:image resolve correctly when the URL is
// shared. Falls back to localhost for dev.
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.NEXTAUTH_URL ??
  "http://localhost:3000";

const TITLE = "viral";
const DESCRIPTION =
  "We figured out how to hack virality. 2,000,000+ impressions in the last 30 days. Invite-only.";

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
  // Both Geist axes ship as variable fonts with no `weight` array — the
  // app picks weights with Tailwind classes and only ever uses 400/500/600.
  // `dark` is hard-coded (the app is dark-only) so the `dark:` variants in
  // the component recipes resolve rather than silently no-op.
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} dark`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
