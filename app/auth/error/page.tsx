import Link from "next/link";

export default function AuthErrorPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const error = searchParams.error ?? "Unknown";
  const isAccessDenied = error === "AccessDenied";

  return (
    <main className="container mx-auto flex max-w-md flex-col items-center justify-center py-24">
      <div className="w-full space-y-4 rounded-lg border p-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          {isAccessDenied ? "Access denied" : "Sign-in error"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isAccessDenied
            ? "Your email address is not on the allowlist. Ask the admin to add you."
            : `Something went wrong (${error}). Try again.`}
        </p>
        <Link href="/" className="inline-block text-sm underline">
          Back home
        </Link>
      </div>
    </main>
  );
}
