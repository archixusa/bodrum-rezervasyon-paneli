import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { TopicsClient } from "./TopicsClient";
import type { BlogTopic } from "@/lib/types-blog";

export const dynamic = "force-dynamic";

export default async function BlogTopicsPage({
  searchParams,
}: {
  searchParams: Promise<{ generate?: string }>;
}) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("blog_topic_pool")
    .select("*")
    .order("used", { ascending: true })
    .order("created_at", { ascending: false });

  const sp = await searchParams;
  return (
    <>
      <PageHeader
        title="Konu Havuzu"
        desc="AI önerileri + manuel konular. Her konudan tek tıkla iki sitelik blog üretebilirsin."
      />
      <TopicsClient initial={(data ?? []) as BlogTopic[]} autoOpenGenerate={sp.generate === "1"} />
    </>
  );
}
