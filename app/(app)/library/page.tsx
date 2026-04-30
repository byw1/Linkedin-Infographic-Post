import { redirect } from "next/navigation";

// The library moved into /settings. Keep this route alive so any
// bookmarks / older deep-links still land in the right spot.
export const dynamic = "force-dynamic";

export default function LibraryPage() {
  redirect("/settings#library");
}
