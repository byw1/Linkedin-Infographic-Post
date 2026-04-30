import { redirect } from "next/navigation";

// Sign-in providers moved into /admin/config alongside the other
// app-wide settings.
export default function AdminAuthPage() {
  redirect("/admin/config#auth");
}
