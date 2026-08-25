import type { Config } from "tailwindcss";

// Shifu Labs brand system.
//
// `borderRadius` and `boxShadow` are set at the THEME level, not under
// `extend` — that replaces Tailwind's scales outright, so `rounded-lg`
// and `shadow-md` stop compiling entirely. The no-radius / no-shadow
// rules are structural rather than a convention someone forgets.
//
// One exception is deliberate and load-bearing: components/tweet-preview.tsx
// pins its geometry with inline styles. It is the html-to-image capture
// target, so anything it took from this file would be baked into users'
// exported PNGs. Do not "tidy" those inline styles back into classes.
const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    // Removing the scales removes the utilities. Intentional.
    borderRadius: {},
    boxShadow: {},
    container: {
      center: true,
      padding: "1.5rem",
      screens: { "2xl": "1280px" },
    },
    extend: {
      fontFamily: {
        // Display and text are the same face at different weights.
        sans: ["var(--font-instrument-sans)", "Helvetica", "Arial", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "Menlo", "monospace"],
      },
      colors: {
        // The whole palette. Four inks, no others.
        "off-black": "#101010",
        chalk: "#F1EFEA",
        concrete: "#55534E",
        signal: "#FF4D00",

        // Semantic aliases so existing markup keeps resolving, each
        // mapping onto one of the four. Nothing here introduces a
        // fifth colour — they are names for the same inks.
        background: "#101010",
        foreground: "#F1EFEA",
        card: "#101010",
        "card-foreground": "#F1EFEA",
        popover: "#101010",
        "popover-foreground": "#F1EFEA",
        muted: "#101010",
        "muted-foreground": "#55534E",
        border: "#55534E",
        input: "#55534E",
        ring: "#FF4D00",
        primary: {
          DEFAULT: "#F1EFEA",
          foreground: "#101010",
        },
        secondary: {
          DEFAULT: "#101010",
          foreground: "#F1EFEA",
        },
        accent: {
          DEFAULT: "#101010",
          foreground: "#F1EFEA",
        },
        destructive: {
          DEFAULT: "#FF4D00",
          foreground: "#101010",
        },
        success: {
          DEFAULT: "#F1EFEA",
          bg: "#101010",
        },
        warning: {
          DEFAULT: "#FF4D00",
          bg: "#101010",
        },
      },
    },
  },
  // tailwindcss-animate is gone with the motion it provided.
  plugins: [],
};

export default config;
