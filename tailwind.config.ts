import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: { "2xl": "1280px" },
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-geist-sans)", ...defaultTheme.fontFamily.sans],
        mono: ["var(--font-geist-mono)", ...defaultTheme.fontFamily.mono],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        // Semantic status pairs — `success`/`warning` are the text+icon
        // color, `*-bg` the fill they sit on. These four roles plus the
        // status-dot palette are the only chromatic color in the chrome.
        success: {
          DEFAULT: "hsl(var(--success))",
          bg: "hsl(var(--success-bg))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          bg: "hsl(var(--warning-bg))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
      },
      borderRadius: {
        // `xl` is deliberately NOT Tailwind's default 12px. Cards are the
        // most frequent surface in the app and 14px vs 12px is visible.
        xl: "calc(var(--radius) + 4px)", // 14px
        lg: "var(--radius)", //             10px
        md: "calc(var(--radius) - 2px)", //  8px
        sm: "calc(var(--radius) - 4px)", //  6px
      },
      // Tailwind's stock ladder is authored against a theme that also
      // ships light mode; `rgb(0 0 0 / 0.05)` over a 3.9% canvas is ~0
      // contrast. Same five contiguous steps, re-weighted so the
      // one-rung hover lift actually reads on near-black.
      boxShadow: {
        sm: "0 1px 2px 0 rgb(0 0 0 / 0.30)",
        DEFAULT: "0 1px 3px 0 rgb(0 0 0 / 0.40), 0 1px 2px -1px rgb(0 0 0 / 0.40)",
        md: "0 4px 6px -1px rgb(0 0 0 / 0.45), 0 2px 4px -2px rgb(0 0 0 / 0.45)",
        lg: "0 10px 15px -3px rgb(0 0 0 / 0.55), 0 4px 6px -4px rgb(0 0 0 / 0.55)",
        xl: "0 20px 25px -5px rgb(0 0 0 / 0.65), 0 8px 10px -6px rgb(0 0 0 / 0.65)",
        rim: "inset 0 1px 0 0 hsl(0 0% 100% / 0.04)",
      },
      keyframes: {
        shimmer: { "100%": { transform: "translateX(100%)" } },
      },
      animation: {
        shimmer: "shimmer 1.6s cubic-bezier(0.4, 0, 0.2, 1) infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
