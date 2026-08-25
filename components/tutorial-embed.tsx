"use client";

import { useState } from "react";
import { PlayCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const EMBED_SRC =
  "https://supercut.ai/embed/bywilliaml/2RhSq34UAeCoBTp5BfMrSB?embed=full";

// A year. Long enough that dismissing means dismissing, short enough
// that the flag eventually ages out on a shared machine.
const SEEN_COOKIE = "infographic_tutorial_seen";
const SEEN_MAX_AGE = 60 * 60 * 24 * 365;

interface Props {
  /**
   * Whether the walkthrough starts open. Decided on the server from the
   * viewer's render count plus the dismissal cookie, so a returning user
   * never sees the video flash in before it collapses.
   */
  defaultOpen: boolean;
}

/**
 * Infographic-mode walkthrough. Opens by itself the first time someone
 * lands here with no posts to their name; after that — or once they
 * dismiss it — it collapses to a text button that stays available.
 *
 * The iframe is only mounted while open, so the collapsed state costs
 * nothing and doesn't reach out to supercut.ai at all.
 */
export function TutorialEmbed({ defaultOpen }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  function dismiss() {
    setOpen(false);
    // Server-readable so the next render already knows. Lax is right
    // here: it's a UI preference, and it should survive following a
    // link back into the app.
    document.cookie = `${SEEN_COOKIE}=1; path=/; max-age=${SEEN_MAX_AGE}; samesite=lax`;
  }

  if (!open) {
    return (
      <div className="flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpen(true)}
          className="text-muted-foreground hover:text-foreground"
        >
          <PlayCircle />
          Watch the walkthrough
        </Button>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Watch the walkthrough</CardTitle>
        <CardDescription>
          Two minutes on turning HTML from Claude into a finished post.
        </CardDescription>
        <CardAction>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={dismiss}
            aria-label="Dismiss the walkthrough"
          >
            <X />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden border bg-muted">
          <iframe
            src={EMBED_SRC}
            title="Viral Content Tool Walkthrough"
            allow="clipboard-write; encrypted-media; picture-in-picture"
            allowFullScreen
            className="aspect-video w-full border-0"
          />
        </div>
      </CardContent>
    </Card>
  );
}
