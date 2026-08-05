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
        <h1 className="text-2xl font-semibold tracking-tight">Posts</h1>
        <p className="text-sm text-muted-foreground">
          <strong>My posts</strong> = everything you&apos;ve rendered, with
          a <strong>Remix</strong> button that re-opens any post in the
          editor without re-uploading from Claude.{" "}
          <strong>Community</strong> = posts other members have published
          and tracked. Inside Community, switch to <strong>Top</strong> for
          the wins leaderboard. Track yours to put them on the wall.
        </p>
      </header>
      <PostsList />
    </main>
  );
}
