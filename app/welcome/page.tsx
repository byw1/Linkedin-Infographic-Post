import Link from "next/link";
import { auth } from "@/lib/auth";
import { FlickeringFooter } from "@/components/ui/flickering-footer";
import { CountUp } from "@/components/welcome/count-up";
import { WelcomeReveal } from "@/components/welcome/welcome-reveal";
import "./welcome.css";

export const dynamic = "force-dynamic";

const POST_EMBEDS = [
  "https://www.linkedin.com/embed/feed/update/urn:li:share:7449661662900707329?collapsed=1",
  "https://www.linkedin.com/embed/feed/update/urn:li:share:7443026949586915328?collapsed=1",
  "https://www.linkedin.com/embed/feed/update/urn:li:share:7440637028079214592?collapsed=1",
  "https://www.linkedin.com/embed/feed/update/urn:li:share:7442361131559526400?collapsed=1",
];

export default async function WelcomePage() {
  // Show the right CTA depending on auth state — signed-in folks get
  // a subtle "open the app" button instead of being asked to sign in.
  const session = await auth();
  const signedIn = Boolean(session?.user);

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-background text-foreground">
      <WelcomeReveal />

      {/* Hero */}
      <section className="relative px-6 pb-24 pt-20 sm:pt-32">
        {/* Aurora background — large radial-gradient blobs that drift. */}
        <div
          aria-hidden
          className="welcome-aurora pointer-events-none absolute -inset-32 -z-10 opacity-70 [background:radial-gradient(ellipse_at_30%_20%,hsl(var(--primary)/0.35),transparent_55%),radial-gradient(ellipse_at_70%_60%,hsl(var(--primary)/0.2),transparent_50%)]"
        />

        <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
          <Link
            href="/"
            className="welcome-hero-cta mb-10 flex items-center gap-2 text-sm font-semibold tracking-tight"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="" aria-hidden className="h-5 w-5" />
            viral
          </Link>
          <h1 className="welcome-hero-headline text-balance text-5xl font-bold tracking-tight sm:text-6xl">
            We figured out how to{" "}
            <span className="text-primary">hack virality</span>.
          </h1>
          <p className="welcome-hero-sub mt-6 max-w-2xl text-balance text-lg text-muted-foreground sm:text-xl">
            One platform at a time, we&apos;re making our friends famous.
          </p>

          <div className="welcome-hero-cta mt-10 flex flex-wrap justify-center gap-3">
            {signedIn ? (
              <Link
                href="/"
                className="inline-flex h-11 items-center rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground hover:opacity-90"
              >
                Open the app →
              </Link>
            ) : (
              <>
                <Link
                  href="/welcome/request"
                  className="inline-flex h-11 items-center rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground hover:opacity-90"
                >
                  Request access
                </Link>
                <Link
                  href="/auth/signin"
                  className="inline-flex h-11 items-center rounded-md border px-6 text-sm font-semibold hover:bg-secondary"
                >
                  Sign in
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Big number */}
      <section className="px-6 py-16 sm:py-24">
        <div className="mx-auto max-w-4xl text-center" data-reveal>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Last 30 days
          </p>
          <p className="mt-3 text-6xl font-bold tracking-tight tabular-nums sm:text-7xl md:text-8xl">
            <CountUp target={2_000_000} suffix="+" />
          </p>
          <p className="mt-3 text-lg text-muted-foreground sm:text-xl">
            impressions across the community.
          </p>
        </div>
      </section>

      {/* Post embeds */}
      <section className="px-6 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 max-w-2xl space-y-2" data-reveal>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              A few that hit.
            </h2>
            <p className="text-muted-foreground">
              Real posts from the wall. We share what works, refine what
              doesn&apos;t, and ship the next one with what we learned.
            </p>
          </div>

          <div
            className="grid gap-6 sm:grid-cols-2"
            data-reveal
            data-reveal-stagger
          >
            {POST_EMBEDS.map((src, i) => (
              <div
                key={src}
                className="overflow-hidden rounded-xl border bg-card shadow-sm"
              >
                {/* Aspect ratio matches the natural LinkedIn embed
                  * dimensions (504 × varies); use a flexible iframe so
                  * the post auto-fits its column on every viewport. */}
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

      {/* How it works (vague, on purpose) */}
      <section className="px-6 py-16 sm:py-24">
        <div className="mx-auto max-w-4xl space-y-6" data-reveal>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Built for people who post.
          </h2>
          <p className="text-lg text-muted-foreground">
            We compress what works into a small private toolkit, share what
            we&apos;re shipping with each other, and pull each other&apos;s
            metrics into one place so the loop tightens fast.
          </p>
          <div className="grid gap-4 pt-4 sm:grid-cols-3">
            <Card title="Closed-loop feedback">
              Every post that lands gets logged + tagged. Patterns surface in
              days, not months.
            </Card>
            <Card title="Built-in accountability">
              The community keeps each other honest — show up, ship, share,
              repeat.
            </Card>
            <Card title="Tools that get out of the way">
              The system handles the boring parts so the writing can be
              sharper.
            </Card>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 py-24">
        <div
          className="mx-auto flex max-w-3xl flex-col items-center gap-6 rounded-2xl border bg-card p-10 text-center"
          data-reveal
        >
          <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            We&apos;re selective. If you ship, you&apos;re in.
          </h2>
          <p className="max-w-xl text-muted-foreground">
            Membership is referral-based. If a friend pointed you here, request
            access and we&apos;ll get back to you.
          </p>
          {signedIn ? (
            <Link
              href="/"
              className="inline-flex h-11 items-center rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Open the app →
            </Link>
          ) : (
            <Link
              href="/welcome/request"
              className="inline-flex h-11 items-center rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Request access →
            </Link>
          )}
        </div>
      </section>

      <FlickeringFooter />
    </main>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card p-5 text-card-foreground">
      <div className="mb-1 text-sm font-semibold">{title}</div>
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  );
}
