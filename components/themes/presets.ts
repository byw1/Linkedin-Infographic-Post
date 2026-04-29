import type { ThemeFormValues } from "@/components/themes/css-compose";
import { DEFAULT_FORM } from "@/components/themes/css-compose";

// Starter palettes for the visual theme builder. Each preset is a
// complete `ThemeFormValues` object the user can clone and tweak —
// they're not stored anywhere; the form just copies values in when
// a card is clicked. Picking a preset never auto-saves; the user
// still has to name it and click Save like any other theme.
//
// Designed to feel distinct from one another — different surface
// temperature (cool/warm/neutral), different accent family (indigo
// / blue / purple / green / monochrome), different type vibe
// (geometric sans / humanist / serif-adjacent). One preset is
// enough as a starting point for most teams.

export interface ThemePreset {
  // Internal id for React keys + click handlers; doesn't surface.
  id: string;
  // What the card shows.
  label: string;
  // One-line description under the label.
  blurb: string;
  // The form values the picker pours into the form on click.
  values: ThemeFormValues;
}

const SYSTEM_SANS =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const SYSTEM_MONO =
  "ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace";

// Each preset extends the default form so any field we forget to
// override (e.g. radii on a preset that doesn't care about radius)
// inherits sensible defaults instead of empty strings.
function preset(values: Partial<ThemeFormValues>): ThemeFormValues {
  return { ...DEFAULT_FORM, ...values };
}

export const PRESETS: ThemePreset[] = [
  {
    id: "notion-warm",
    label: "Notion warm",
    blurb: "Cream + charcoal + indigo accent. The default skill's house style.",
    values: preset({
      bgPrimary: "#FFFFFF",
      bgSecondary: "#F5F5F4",
      bgTertiary: "#EBEBE9",
      textPrimary: "#1A1A1A",
      textSecondary: "#555555",
      textTertiary: "#888888",
      borderTertiary: "rgba(0,0,0,0.06)",
      accentPrimary: "#534AB7",
      accentSecondary: "#AFA9EC",
      accentSoft: "#EEEDFE",
      accentText: "#26215C",
      fontBase: SYSTEM_SANS,
      fontDisplay: SYSTEM_SANS,
      fontMono: SYSTEM_MONO,
    }),
  },
  {
    id: "apple-clean",
    label: "Apple clean",
    blurb: "Pure white surfaces, system gray scale, electric blue accent.",
    values: preset({
      bgPrimary: "#FFFFFF",
      bgSecondary: "#F2F2F7",
      bgTertiary: "#E5E5EA",
      textPrimary: "#000000",
      textSecondary: "#3C3C43",
      textTertiary: "#8E8E93",
      borderPrimary: "rgba(60,60,67,0.29)",
      borderSecondary: "rgba(60,60,67,0.18)",
      borderTertiary: "rgba(60,60,67,0.10)",
      accentPrimary: "#007AFF",
      accentSecondary: "#5AC8FA",
      accentSoft: "#E5F1FF",
      accentText: "#0040A0",
      signalSuccess: "#34C759",
      signalWarn: "#FF9500",
      signalError: "#FF3B30",
      fontBase: SYSTEM_SANS,
      fontDisplay: SYSTEM_SANS,
      fontMono: SYSTEM_MONO,
    }),
  },
  {
    id: "vercel-mono",
    label: "Vercel mono",
    blurb: "Black and white, high-contrast, geometric sans. Accent-free.",
    values: preset({
      bgPrimary: "#FFFFFF",
      bgSecondary: "#FAFAFA",
      bgTertiary: "#F4F4F5",
      textPrimary: "#000000",
      textSecondary: "#52525B",
      textTertiary: "#A1A1AA",
      borderPrimary: "rgba(0,0,0,0.20)",
      borderSecondary: "rgba(0,0,0,0.12)",
      borderTertiary: "rgba(0,0,0,0.06)",
      accentPrimary: "#000000",
      accentSecondary: "#52525B",
      accentSoft: "#F4F4F5",
      accentText: "#000000",
      signalSuccess: "#10B981",
      signalWarn: "#F59E0B",
      signalError: "#EF4444",
      fontBase: `'Inter', ${SYSTEM_SANS}`,
      fontDisplay: `'Inter', ${SYSTEM_SANS}`,
      fontMono: `'Geist Mono', ${SYSTEM_MONO}`,
    }),
  },
  {
    id: "linear-dark",
    label: "Linear dark",
    blurb: "Near-black canvas, electric purple accent, tight neutrals.",
    values: preset({
      bgPrimary: "#08080B",
      bgSecondary: "#16161D",
      bgTertiary: "#1F1F28",
      textPrimary: "#F7F7F8",
      textSecondary: "#A8A8B3",
      textTertiary: "#6E6E78",
      textOnAccent: "#FFFFFF",
      borderPrimary: "rgba(255,255,255,0.16)",
      borderSecondary: "rgba(255,255,255,0.10)",
      borderTertiary: "rgba(255,255,255,0.06)",
      accentPrimary: "#5E6AD2",
      accentSecondary: "#8B95E8",
      accentSoft: "rgba(94,106,210,0.18)",
      accentText: "#C7CCF1",
      signalSuccess: "#26B07B",
      signalWarn: "#E5A23B",
      signalError: "#EB5757",
      fontBase: `'Inter', ${SYSTEM_SANS}`,
      fontDisplay: `'Inter', ${SYSTEM_SANS}`,
      fontMono: `'JetBrains Mono', ${SYSTEM_MONO}`,
    }),
  },
  {
    id: "stripe-pastel",
    label: "Stripe pastel",
    blurb: "Soft lavender + blue, a la fintech marketing pages.",
    values: preset({
      bgPrimary: "#FFFFFF",
      bgSecondary: "#F6F9FC",
      bgTertiary: "#ECF1F8",
      textPrimary: "#0A2540",
      textSecondary: "#425466",
      textTertiary: "#8898AA",
      borderPrimary: "rgba(10,37,64,0.18)",
      borderSecondary: "rgba(10,37,64,0.10)",
      borderTertiary: "rgba(10,37,64,0.06)",
      accentPrimary: "#635BFF",
      accentSecondary: "#9B95FF",
      accentSoft: "#EFEDFF",
      accentText: "#3B30D9",
      signalSuccess: "#06AED5",
      signalWarn: "#F8BC4C",
      signalError: "#F25F5C",
      fontBase: `'Plus Jakarta Sans', ${SYSTEM_SANS}`,
      fontDisplay: `'Plus Jakarta Sans', ${SYSTEM_SANS}`,
      fontMono: `'IBM Plex Mono', ${SYSTEM_MONO}`,
    }),
  },
  {
    id: "editorial-sepia",
    label: "Editorial sepia",
    blurb: "Warm paper canvas, sepia ink, terracotta accent. Print magazine.",
    values: preset({
      bgPrimary: "#F8F4EB",
      bgSecondary: "#EFE9DA",
      bgTertiary: "#E5DDC8",
      textPrimary: "#2A2522",
      textSecondary: "#574F46",
      textTertiary: "#8B7F6F",
      borderPrimary: "rgba(42,37,34,0.20)",
      borderSecondary: "rgba(42,37,34,0.12)",
      borderTertiary: "rgba(42,37,34,0.08)",
      accentPrimary: "#B14B2B",
      accentSecondary: "#D88A6F",
      accentSoft: "#F5DBCD",
      accentText: "#7A2F18",
      signalSuccess: "#5A7A3A",
      signalWarn: "#C58B22",
      signalError: "#A8362B",
      fontBase: `'IBM Plex Sans', ${SYSTEM_SANS}`,
      fontDisplay: `'IBM Plex Sans', ${SYSTEM_SANS}`,
      fontMono: `'IBM Plex Mono', ${SYSTEM_MONO}`,
    }),
  },
  {
    id: "tech-green",
    label: "Tech green",
    blurb: "Dark canvas, neon green accent — terminal vibes.",
    values: preset({
      bgPrimary: "#0B0F0D",
      bgSecondary: "#131915",
      bgTertiary: "#1B231E",
      textPrimary: "#E6F1E9",
      textSecondary: "#9DB3A4",
      textTertiary: "#5F7268",
      textOnAccent: "#0B0F0D",
      borderPrimary: "rgba(122,255,170,0.20)",
      borderSecondary: "rgba(255,255,255,0.10)",
      borderTertiary: "rgba(255,255,255,0.06)",
      accentPrimary: "#3CD27E",
      accentSecondary: "#7AFFAA",
      accentSoft: "rgba(60,210,126,0.18)",
      accentText: "#A8F3C2",
      signalSuccess: "#3CD27E",
      signalWarn: "#F2C24B",
      signalError: "#FF6B6B",
      fontBase: `'Manrope', ${SYSTEM_SANS}`,
      fontDisplay: `'Manrope', ${SYSTEM_SANS}`,
      fontMono: `'JetBrains Mono', ${SYSTEM_MONO}`,
    }),
  },
  {
    id: "brutalist",
    label: "Brutalist",
    blurb: "Pure white + true black, red signal, no soft anything.",
    values: preset({
      bgPrimary: "#FFFFFF",
      bgSecondary: "#FFFFFF",
      bgTertiary: "#F5F5F5",
      textPrimary: "#000000",
      textSecondary: "#000000",
      textTertiary: "#666666",
      borderPrimary: "#000000",
      borderSecondary: "#000000",
      borderTertiary: "rgba(0,0,0,0.20)",
      accentPrimary: "#000000",
      accentSecondary: "#444444",
      accentSoft: "#F5F5F5",
      accentText: "#000000",
      signalSuccess: "#000000",
      signalWarn: "#000000",
      signalError: "#FF0000",
      fontBase: `'Space Grotesk', ${SYSTEM_SANS}`,
      fontDisplay: `'Space Grotesk', ${SYSTEM_SANS}`,
      fontMono: `'Space Mono', ${SYSTEM_MONO}`,
      radiusSm: "0px",
      radiusMd: "0px",
      radiusLg: "0px",
    }),
  },
];
