import { redirect } from "next/navigation";

// /admin used to be one long-scrolling page; each section now lives
// on its own route under /admin/* with a sidebar nav (see layout.tsx).
// Land on Health since that's the most common reason to open this.
export default function AdminPage() {
  redirect("/admin/health");
}
