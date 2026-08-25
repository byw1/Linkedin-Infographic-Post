import Link from "next/link";
import { auth } from "@/lib/auth";
import { Asterisk } from "@/components/ui/asterisk";

export const dynamic = "force-dynamic";

const POST_EMBEDS = [
  "https://www.linkedin.com/embed/feed/update/urn:li:share:7449661662900707329?collapsed=1",
  "https://www.linkedin.com/embed/feed/update/urn:li:share:7443026949586915328?collapsed=1",
  "https://www.linkedin.com/embed/feed/update/urn:li:share:7440637028079214592?collapsed=1",
  "https://www.linkedin.com/embed/feed/update/urn:li:share:7442361131559526400?collapsed=1",
];

// Numerals, stats and metadata are mono, middot-separated. Never body copy.
function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="border-t border-concrete pt-4">
      <div className="font-mono text-3xl">{value}</div>
      <div className="mt-1 font-mono text-xs text-concrete">{label}</div>
    </div>
  );
}

export default async function WelcomePage() {
  // Signed-in visitors get a way into the app instead of a sign-in ask.
  const session = await auth();
  const signedIn = Boolean(session?.user);

  const cta = signedIn
    ? { href: "/", label: "Open Viral" }
    : { href: "/welcome/request", label: "Request access" };

  return (
    <main className="min-h-screen bg-off-black text-chalk">
      <header className="border-b border-concrete">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
          <span className="text-sm font-bold tracking-tight">Viral</span>
          <nav className="flex items-center gap-6 text-sm">
            <Link
              href="/auth/signin"
              className="text-concrete hover:text-chalk"
            >
              Sign in
            </Link>
            <Link
              href={cta.href}
              className="border-b-2 border-signal pb-0.5 text-chalk"
            >
              {cta.label}
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-concrete">
        <div className="mx-auto w-full max-w-5xl px-6 py-24">
          <h1 className="max-w-3xl text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
            Write it. Render it. Track what it did.
          </h1>
          <p className="mt-8 max-w-xl text-lg leading-relaxed text-concrete">
            Viral turns a draft into a finished LinkedIn image and keeps the
            numbers it earned. The next post starts from what worked.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-6">
            <Link
              href={cta.href}
              className="border border-chalk px-6 py-3 text-sm font-bold hover:bg-chalk hover:text-off-black"
            >
              {cta.label}
            </Link>
            <span className="font-mono text-xs text-concrete">
              Invite-only · Referral-based
            </span>
          </div>
        </div>
      </section>

      {/* Numbers */}
      <section className="border-b border-concrete">
        <div className="mx-auto grid w-full max-w-5xl gap-8 px-6 py-16 sm:grid-cols-3">
          <Stat value="2,000,000+" label="impressions · last 30 days" />
          <Stat value="4" label="formats · image, carousel, tweet, external" />
          <Stat value="1" label="place · draft to published to measured" />
        </div>
      </section>

      {/* Proof */}
      <section className="border-b border-concrete">
        <div className="mx-auto w-full max-w-5xl px-6 py-16">
          <h2 className="text-2xl font-bold tracking-tight">A few that hit.</h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-concrete">
            Real posts from the wall. We share what works. We refine what
            doesn&apos;t.
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {POST_EMBEDS.map((src, i) => (
              <div key={src} className="border border-concrete">
                <iframe
                  src={src}
                  loading="lazy"
                  className="block h-[600px] w-full border-0"
                  allowFullScreen
                  title={`Embedded LinkedIn post ${i + 1}`}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What it is */}
      <section className="border-b border-concrete">
        <div className="mx-auto w-full max-w-5xl px-6 py-16">
          <h2 className="text-2xl font-bold tracking-tight">
            Built for people who post.
          </h2>
          <div className="mt-10 grid gap-px border border-concrete bg-concrete sm:grid-cols-3">
            <div className="bg-off-black p-6">
              <h3 className="text-sm font-bold">Closed-loop feedback</h3>
              <p className="mt-2 text-sm leading-relaxed text-concrete">
                Every post that lands gets logged and tagged. Patterns surface
                in days.
              </p>
            </div>
            <div className="bg-off-black p-6">
              <h3 className="text-sm font-bold">Built-in accountability</h3>
              <p className="mt-2 text-sm leading-relaxed text-concrete">
                The group keeps each other honest. Show up. Ship. Share.
              </p>
            </div>
            <div className="bg-off-black p-6">
              <h3 className="text-sm font-bold">Tools that stay out of it</h3>
              <p className="mt-2 text-sm leading-relaxed text-concrete">
                The boring parts are handled. The writing stays yours.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Close */}
      <section className="border-b border-concrete">
        <div className="mx-auto w-full max-w-5xl px-6 py-24">
          <h2 className="max-w-2xl text-3xl font-bold tracking-tight">
            We&apos;re selective. If you ship, you&apos;re in.
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-concrete">
            Membership is referral-based. If a friend pointed you here, request
            access.
          </p>
          <Link
            href={cta.href}
            className="mt-10 inline-block border border-chalk px-6 py-3 text-sm font-bold hover:bg-chalk hover:text-off-black"
          >
            {cta.label}
          </Link>
        </div>
      </section>

      {/* The page's single asterisk, in the page's own ink. */}
      <footer>
        <div className="mx-auto flex w-full max-w-5xl items-center gap-2 px-6 py-8 text-xs text-concrete">
          <Asterisk className="text-concrete" size={12} />
          <span>A Shifu Labs tool</span>
        </div>
      </footer>
    </main>
  );
}
