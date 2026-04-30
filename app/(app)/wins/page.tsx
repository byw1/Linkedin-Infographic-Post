import { redirect } from "next/navigation";

// Wins folded into the Community tab on /posts ("Top" sub-view).
// Keep this route so old bookmarks / member-profile links land in
// the right place.
export const dynamic = "force-dynamic";

export default function WinsPage() {
  redirect("/posts?tab=community&view=top");
}
