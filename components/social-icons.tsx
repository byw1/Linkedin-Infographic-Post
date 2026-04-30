"use client";

import { Github, Globe, Instagram, Linkedin, Twitter } from "lucide-react";

export type SocialKey =
  | "linkedin"
  | "twitter"
  | "github"
  | "instagram"
  | "website";

const ICON: Record<SocialKey, typeof Linkedin> = {
  linkedin: Linkedin,
  twitter: Twitter,
  github: Github,
  instagram: Instagram,
  website: Globe,
};

const LABEL: Record<SocialKey, string> = {
  linkedin: "LinkedIn",
  twitter: "Twitter / X",
  github: "GitHub",
  instagram: "Instagram",
  website: "Website",
};

const KEYS: SocialKey[] = ["linkedin", "twitter", "github", "instagram", "website"];

interface Props {
  socials: Partial<Record<SocialKey, string>>;
  // px size of the icon. Defaults to 14 for cards; profile page
  // uses 16 for slightly bigger touch targets.
  size?: number;
}

// Icon-only social link row. Renders a small circle button per
// platform — title attribute carries the human label so hover
// reveals "LinkedIn" etc., and screen readers announce it. Skips
// any platform the user hasn't filled in.
export function SocialIcons({ socials, size = 14 }: Props) {
  const present = KEYS.filter((k) => socials[k]);
  if (present.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {present.map((k) => {
        const Icon = ICON[k];
        return (
          <a
            key={k}
            href={socials[k]}
            target="_blank"
            rel="noopener noreferrer"
            title={LABEL[k]}
            aria-label={LABEL[k]}
            className="inline-flex items-center justify-center rounded-full border bg-background text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            style={{ width: size + 14, height: size + 14 }}
          >
            <Icon size={size} aria-hidden />
          </a>
        );
      })}
    </div>
  );
}
