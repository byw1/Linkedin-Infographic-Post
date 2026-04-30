import { redirect } from "next/navigation";

// Tools admin lived here briefly; the catalog now hosts admin
// actions inline on /docs/tools so members and admins look at the
// same surface. Keep this redirect so any old bookmarks land in
// the right spot.
export default function AdminToolsPage() {
  redirect("/docs/tools");
}
