import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { LeadDetailClient } from "./LeadDetailClient";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: lead } = await supabase
    .from("owner_leads")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!lead) notFound();
  return (
    <>
      <PageHeader title={lead.name} desc={`Lead · ${lead.source} · ${lead.status}`} />
      <LeadDetailClient lead={lead} />
    </>
  );
}
