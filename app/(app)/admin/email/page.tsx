import { redirect } from "next/navigation";

// Email config moved into /admin/config alongside the other
// app-wide settings — kept this redirect so the API error copy
// pointing at "/admin/email" still lands somewhere useful.
export default function AdminEmailPage() {
  redirect("/admin/config#email");
}
