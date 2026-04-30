import { ImageResponse } from "next/og";

// 180×180 apple-touch-icon. Most messaging apps (iMessage, Slack,
// LinkedIn, Discord) read this for the small icon shown next to a
// link preview, separately from the og:image hero. SVG favicon
// (app/icon.svg) covers browsers tabs but not all messengers, so
// this raster fills the gap.
//
// Kept deliberately simple — just three indigo bars on a pad of
// background color. No multi-child <div>s without display:flex,
// no <span>+text mixes; satori is strict about both and broke our
// previous OG generator with similar shapes.

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  // Bar layout — three bars, ascending. Center the trio in the
  // canvas with equal margin on either side.
  const bars = [
    { x: 36, y: 110, w: 22, h: 38 }, // short
    { x: 70, y: 80, w: 22, h: 68 },  // mid
    { x: 104, y: 50, w: 22, h: 98 }, // tall
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: "#0a0a0f",
          display: "flex",
          // Each bar lives in absolute position so the parent only
          // has flex set for satori's sake; the bars themselves are
          // siblings without nested children.
          position: "relative",
        }}
      >
        {bars.map((b, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: b.x,
              top: b.y,
              width: b.w,
              height: b.h,
              borderRadius: 4,
              // Lightest → darkest matches the SVG logo.
              backgroundColor: ["#a5b4fc", "#818cf8", "#6366f1"][i],
            }}
          />
        ))}
      </div>
    ),
    size,
  );
}
