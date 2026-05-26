import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { ApplicationsList } from "./ApplicationsList";
import type { OwnerApplication } from "@/lib/types-owner";

export const dynamic = "force-dynamic";

export default async function ApplicationsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("owner_applications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <>
      <PageHeader
        title="Mülk Sahibi Başvuruları"
        desc="İki siteden gelen 'Evinizi Kiraya Verin' formundan inbound başvurular. Canlı dinleme açık."
      />
      <ApplicationsList initial={(data ?? []) as OwnerApplication[]} />
    </>
  );
}
