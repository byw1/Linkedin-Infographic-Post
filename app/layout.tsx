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

const TITLE = "Viral";
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
    siteName: "Viral",
    // No explicit `images` here on purpose: an explicit entry would
    // take precedence over Next's file convention, and the /og.png it
    // used to point at was never committed — every share resolved to a
    // 404. app/opengraph-image.tsx renders the card instead.
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
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
