import { ImageResponse } from "next/og";

// Next file convention: this becomes the og:image and twitter:image for
// every route that doesn't override it. It replaces a hardcoded
// /public/og.png reference that pointed at a file which was never
// committed, so every share of the site resolved to a 404.
export const runtime = "edge";
export const alt = "Viral — a Shifu Labs tool";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const OFF_BLACK = "#101010";
const CHALK = "#F1EFEA";
const CONCRETE = "#55534E";
const SIGNAL = "#FF4D00";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: OFF_BLACK,
          color: CHALK,
          padding: 72,
          fontFamily: "Helvetica, Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 28, fontWeight: 700 }}>
          Viral
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 76,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              maxWidth: 900,
            }}
          >
            Write it. Render it. Track what it did.
          </div>
          {/* The one accent on the card — a rule, never a fill. */}
          <div
            style={{ display: "flex", height: 4, width: 140, background: SIGNAL, marginTop: 40 }}
          />
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            borderTop: `1px solid ${CONCRETE}`,
            paddingTop: 28,
            fontSize: 24,
            color: CONCRETE,
          }}
        >
          <div style={{ display: "flex" }}>
            2,000,000+ impressions · last 30 days
          </div>
          <div style={{ display: "flex" }}>A Shifu Labs tool</div>
        </div>
      </div>
    ),
    size,
  );
}
