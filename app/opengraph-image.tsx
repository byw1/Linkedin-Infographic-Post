import { ImageResponse } from "next/og";

// Dynamic 1200×630 share image used by social previews (iMessage,
// Twitter, Slack, LinkedIn — anything that respects og:image). Lives
// at the app root so any URL on the site picks it up by default;
// /welcome can override later if we want a different framing there.
//
// Rendered at request-time by next/og. No remote font fetches —
// keeping it system-font-only avoids cold-start latency.

export const alt = "viral — we figured out how to hack virality";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          // satori (next/og) rejects mixing a solid color into the
          // `background` shorthand alongside gradients, so split:
          // backgroundColor for the base, backgroundImage for the
          // gradient stack on top.
          backgroundColor: "#0a0a0f",
          backgroundImage:
            "radial-gradient(ellipse at 25% 20%, #4f46e5 0%, transparent 55%), radial-gradient(ellipse at 80% 75%, #7c3aed 0%, transparent 55%)",
          color: "#fff",
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        }}
      >
        {/* Top: brand row */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <BarsLogo />
          <span style={{ fontSize: 32, fontWeight: 700, letterSpacing: -0.5 }}>
            viral
          </span>
        </div>

        {/* Middle: punchline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              fontSize: 84,
              lineHeight: 1.05,
              fontWeight: 800,
              letterSpacing: -1.5,
              maxWidth: 980,
            }}
          >
            We figured out how to{" "}
            <span style={{ color: "#a5b4fc" }}>hack virality</span>.
          </div>
          <div
            style={{
              fontSize: 32,
              lineHeight: 1.3,
              color: "rgba(255,255,255,0.7)",
              maxWidth: 880,
            }}
          >
            Making our friends famous, one platform at a time.
          </div>
        </div>

        {/* Bottom: stat strip */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 24,
            fontSize: 24,
            color: "rgba(255,255,255,0.65)",
          }}
        >
          <span style={{ fontSize: 56, fontWeight: 700, color: "#fff" }}>
            1M+
          </span>
          <span>impressions in the last 30 days · invite only</span>
        </div>
      </div>
    ),
    size,
  );
}

// Inline SVG bars in the brand color so the OG image stays self-
// contained (no remote fetch). Mirrors /public/logo.svg.
function BarsLogo() {
  return (
    <svg width={48} height={48} viewBox="0 0 24 24">
      <rect x={3} y={14} width={4} height={7} rx={1} fill="#a5b4fc" />
      <rect x={10} y={9} width={4} height={12} rx={1} fill="#818cf8" />
      <rect x={17} y={4} width={4} height={17} rx={1} fill="#6366f1" />
    </svg>
  );
}
