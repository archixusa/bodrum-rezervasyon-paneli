import { PageHeader } from "@/components/PageHeader";
import { NewPropertyWizard } from "./NewPropertyWizard";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NewPropertyPage() {
  const supabase = await createClient();
  const { data: owners } = await supabase.from("owners").select("id,name");
  return (
    <>
      <PageHeader
        title="Yeni Mülk Ekle"
        desc="3 adımda mülkü tanımla, fotoğrafları yükle, ham açıklamayı yaz. AI iki siteye özgün içerik üretsin."
      />
      <NewPropertyWizard owners={(owners ?? []) as { id: string; name: string }[]} />
    </>
  );
}
