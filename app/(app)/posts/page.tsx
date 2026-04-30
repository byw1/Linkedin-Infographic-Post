import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { PostsList } from "@/components/posts-list";

export const dynamic = "force-dynamic";

export default async function PostsPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  return (
    <main className="container mx-auto max-w-5xl space-y-6 py-10">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Posts</h1>
        <p className="text-sm text-muted-foreground">
          Everything you&apos;ve rendered. Click <strong>Remix</strong> on any
          post to re-open it in the editor — change theme, swap logos, edit
          copy — without re-uploading from Claude.
        </p>
      </header>
      <PostsList />
    </main>
  );
}
