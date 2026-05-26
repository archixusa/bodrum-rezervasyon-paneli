import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { ReviewClient } from "./ReviewClient";
import type { BlogPost, BlogSiteVersion } from "@/lib/types-blog";

export const dynamic = "force-dynamic";

export default async function BlogReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: post }, { data: versions }] = await Promise.all([
    supabase.from("blog_posts").select("*").eq("id", id).single(),
    supabase
      .from("blog_site_versions")
      .select("*")
      .eq("post_id", id)
      .order("site"),
  ]);

  if (!post) notFound();

  return (
    <>
      <PageHeader
        title={post.topic}
        desc={`Durum: ${post.status} · İki site versiyonu yan yana`}
        actions={
          <Link href="/blog" className="panel-btn-ghost">
            ← Blog Listesi
          </Link>
        }
      />
      <ReviewClient
        post={post as BlogPost}
        versions={(versions ?? []) as BlogSiteVersion[]}
      />
    </>
  );
}
