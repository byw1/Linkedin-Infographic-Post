import { redirect } from "next/navigation";

// Settings used to be one long-scrolling page; each section now
// lives on its own route under /settings/* with a sidebar nav (see
// layout.tsx). Profile is the most common landing.
export default function SettingsPage() {
  redirect("/settings/profile");
}
