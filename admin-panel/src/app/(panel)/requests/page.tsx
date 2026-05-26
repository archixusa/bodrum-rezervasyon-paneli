import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { RequestsList } from "./RequestsList";
import type { ReservationRequest } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function RequestsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reservation_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <>
      <PageHeader
        title="Rezervasyon İstekleri"
        desc="4 siteden gelen ham istekler. Canlı dinleme açık — yeni istekler otomatik düşer."
      />
      <RequestsList initial={(data ?? []) as ReservationRequest[]} />
    </>
  );
}
