import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { OutreachClient } from "./OutreachClient";
import type {
  OutreachTarget,
  OutreachSequence,
  OutreachSendLog,
} from "@/lib/types-outreach";

export const dynamic = "force-dynamic";

export default async function OutreachPage() {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const [
    { data: targets, count },
    { data: sequences },
    { data: recentSends },
    { data: dailyLimits },
  ] = await Promise.all([
    supabase
      .from("outreach_targets")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("outreach_sequences").select("*"),
    supabase
      .from("outreach_send_log")
      .select("*")
      .order("sent_at", { ascending: false })
      .limit(50),
    supabase
      .from("outreach_daily_limits")
      .select("*")
      .gte("date", today)
      .limit(1),
  ]);

  return (
    <>
      <PageHeader
        title="B2B Partnership Outreach"
        desc="Bodrum'daki turizm işletmelerine partnership önerisi e-postaları. KVKK uyumlu, warm-up'lı, sequenced."
      />
      <OutreachClient
        targets={(targets ?? []) as OutreachTarget[]}
        totalCount={count ?? 0}
        sequences={(sequences ?? []) as OutreachSequence[]}
        recentSends={(recentSends ?? []) as OutreachSendLog[]}
        sentToday={dailyLimits?.[0]?.sends_count ?? 0}
        capToday={dailyLimits?.[0]?.warmup_cap ?? 5}
      />
    </>
  );
}
