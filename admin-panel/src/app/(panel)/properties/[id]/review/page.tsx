import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { ReviewClient } from "./ReviewClient";
import type {
  PropertyTemplate,
  PropertySiteVersion,
  PropertyImage,
} from "@/lib/types-property";

export const dynamic = "force-dynamic";

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: template }, { data: versions }, { data: images }] = await Promise.all([
    supabase.from("property_templates").select("*").eq("id", id).maybeSingle(),
    supabase.from("property_site_versions").select("*").eq("template_id", id),
    supabase
      .from("property_images")
      .select("*")
      .eq("template_id", id)
      .order("display_order"),
  ]);

  if (!template) notFound();

  return (
    <>
      <PageHeader
        title={template.internal_name}
        desc={`${template.type} · ${template.region}${
          template.district ? ` (${template.district})` : ""
        } · ${template.bedrooms ?? "?"}+1 · ${template.max_guests ?? "?"} kişi`}
      />
      <ReviewClient
        template={template as PropertyTemplate}
        versions={(versions ?? []) as PropertySiteVersion[]}
        images={(images ?? []) as PropertyImage[]}
      />
    </>
  );
}
