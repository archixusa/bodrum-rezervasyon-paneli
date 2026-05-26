import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { ApplicationsList } from "./ApplicationsList";
import { StatsBar } from "./StatsBar";
import type { OwnerApplication } from "@/lib/types-owner";

export const dynamic = "force-dynamic";

export default async function ApplicationsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("owner_applications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);

  const items = (data ?? []) as OwnerApplication[];

  return (
    <>
      <PageHeader
        title="Ev Sahibi Başvuruları"
        desc="bodrumapartkiralama.com ve bodrumapartvilla.com üzerinden gelen 'Evinizi Kiraya Verin' başvuruları. Canlı dinleme açık — yeni başvuru anında düşer."
      />
      <StatsBar items={items} />
      <ApplicationsList initial={items} />
    </>
  );
}
