import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { CalendarGrid } from "./CalendarGrid";
import type { Reservation, Property } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const supabase = await createClient();
  const today = new Date();
  const startISO = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const endISO = new Date(today.getFullYear(), today.getMonth() + 3, 0).toISOString().slice(0, 10);

  const [{ data: properties }, { data: reservations }] = await Promise.all([
    supabase.from("properties").select("*").order("name"),
    supabase
      .from("reservations")
      .select("*")
      .in("status", ["pending", "confirmed"])
      .lte("check_in", endISO)
      .gte("check_out", startISO),
  ]);

  return (
    <>
      <PageHeader
        title="Müsaitlik Takvimi"
        desc="3 ay görünüm, mülk × gün grid"
      />
      <CalendarGrid
        properties={(properties ?? []) as Property[]}
        reservations={(reservations ?? []) as Reservation[]}
        startDate={startISO}
        days={92}
      />
    </>
  );
}
