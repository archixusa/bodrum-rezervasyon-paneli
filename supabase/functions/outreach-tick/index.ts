// =========================================================================
// Edge Function: outreach-tick
// =========================================================================
// Should be scheduled via Supabase cron (every 15 minutes during business hours).
// Picks enrollments whose next_send_at is due, applies daily limit + warm-up,
// renders the step template, sends via Resend with proper headers, logs send.
// =========================================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("OUTREACH_FROM_EMAIL") ?? "partnership@bodrumapartkiralama.com";
const REPLY_TO = Deno.env.get("OUTREACH_REPLY_TO") ?? "info@bodrumapartkiralama.com";
const UNSUB_BASE = Deno.env.get("UNSUB_BASE") ?? "https://bodrumapartkiralama.com/unsubscribe";

// Daily warm-up schedule: ramp slowly so domain isn't flagged
function warmupCap(daysSinceStart: number): number {
  if (daysSinceStart < 7) return 5;
  if (daysSinceStart < 14) return 10;
  if (daysSinceStart < 21) return 15;
  if (daysSinceStart < 30) return 25;
  return 50;
}

interface Step { day: number; subject: string; body: string }
interface Enrollment {
  id: string;
  target_id: string;
  sequence_id: string;
  current_step: number;
  next_send_at: string;
  target?: {
    email: string;
    company_name: string;
    contact_name: string | null;
    custom_fields: Record<string, string> | null;
  };
  sequence?: { steps: Step[] };
}

async function sb<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
  // 204 No Content (PATCH/DELETE) or empty body (POST without Prefer: return=representation)
  if (r.status === 204) return undefined as unknown as T;
  const text = await r.text();
  if (!text) return undefined as unknown as T;
  return JSON.parse(text) as T;
}

function renderTemplate(tpl: string, ctx: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => ctx[k] ?? `{${k}}`);
}

function appendUnsubFooter(body: string, targetId: string): string {
  return (
    body +
    `\n\n---\nBu mail, Bodrumapartkiralama.com tarafından partnership değerlendirmesi için gönderilmiştir. ` +
    `Bir daha mail almak istemiyorsanız buradan çıkış yapın: ${UNSUB_BASE}?t=${targetId}`
  );
}

function hasSpamWord(s: string): boolean {
  const bad = /(viagra|cialis|free\s+money|win\s+now|click\s+here|guaranteed\s+money)/i;
  return bad.test(s);
}

async function sendOne(enrollment: Enrollment) {
  const tgt = enrollment.target!;
  const step = enrollment.sequence!.steps[enrollment.current_step];
  if (!step) {
    // No more steps -> complete
    await sb(`outreach_enrollments?id=eq.${enrollment.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "completed", next_send_at: null }),
    });
    return { skipped: "no-step" };
  }

  // Check suppression
  const supp = await sb<unknown[]>(`outreach_suppression?email=eq.${encodeURIComponent(tgt.email)}&select=email`);
  if (supp.length > 0) {
    await sb(`outreach_enrollments?id=eq.${enrollment.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "stopped" }),
    });
    await sb(`outreach_targets?id=eq.${enrollment.target_id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "suppressed" }),
    });
    return { skipped: "suppressed" };
  }

  const ctx: Record<string, string> = {
    company_name: tgt.company_name,
    contact_name: tgt.contact_name ?? "Merhaba",
    ...(tgt.custom_fields ?? {}),
  };
  const subject = renderTemplate(step.subject, ctx);
  const body = appendUnsubFooter(renderTemplate(step.body, ctx), enrollment.target_id);

  if (hasSpamWord(subject) || hasSpamWord(body)) {
    await sb(`outreach_send_log`, {
      method: "POST",
      body: JSON.stringify({
        enrollment_id: enrollment.id,
        target_id: enrollment.target_id,
        step_index: enrollment.current_step,
        subject,
        body_preview: body.slice(0, 200),
        status: "suppressed",
        error_message: "Spam-word filter blocked",
      }),
    });
    return { skipped: "spam-word" };
  }

  // Send via Resend
  let resendId = "";
  let errMsg = "";
  if (RESEND_API_KEY) {
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: tgt.email,
          reply_to: REPLY_TO,
          subject,
          text: body,
          headers: {
            "List-Unsubscribe": `<${UNSUB_BASE}?t=${enrollment.target_id}>`,
          },
        }),
      });
      if (r.ok) {
        const j = await r.json();
        resendId = j.id ?? "";
      } else {
        errMsg = `${r.status}: ${(await r.text()).slice(0, 200)}`;
      }
    } catch (e) {
      errMsg = (e as Error).message;
    }
  } else {
    errMsg = "RESEND_API_KEY not set — dry run";
    console.log("[outreach DRY]", { to: tgt.email, subject });
  }

  const status = errMsg ? "failed" : "sent";
  await sb("outreach_send_log", {
    method: "POST",
    body: JSON.stringify({
      enrollment_id: enrollment.id,
      target_id: enrollment.target_id,
      step_index: enrollment.current_step,
      subject,
      body_preview: body.slice(0, 200),
      status,
      resend_id: resendId,
      error_message: errMsg,
    }),
  });

  // Advance enrollment
  const steps = enrollment.sequence!.steps;
  const nextStepIdx = enrollment.current_step + 1;
  let nextSendAt: string | null = null;
  let newStatus = "active";
  if (steps[nextStepIdx]) {
    const days = steps[nextStepIdx].day - steps[enrollment.current_step].day;
    const next = new Date(Date.now() + days * 86400000);
    nextSendAt = next.toISOString();
  } else {
    newStatus = "completed";
  }

  await sb(`outreach_enrollments?id=eq.${enrollment.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      current_step: nextStepIdx,
      next_send_at: nextSendAt,
      status: newStatus,
    }),
  });
  await sb(`outreach_targets?id=eq.${enrollment.target_id}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "contacted" }),
  });

  return { sent: status === "sent", email: tgt.email };
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    // Today's send count
    const today = new Date().toISOString().slice(0, 10);
    const todayRows = await sb<{ sends_count: number; warmup_cap: number }[]>(
      `outreach_daily_limits?date=eq.${today}`,
    );
    let sentToday = todayRows[0]?.sends_count ?? 0;

    // Compute first day of outreach to set cap
    const firstRows = await sb<{ date: string }[]>(
      `outreach_daily_limits?select=date&order=date.asc&limit=1`,
    );
    const start = firstRows[0]?.date ?? today;
    const daysSince = Math.floor(
      (new Date(today).getTime() - new Date(start).getTime()) / 86400000,
    );
    const cap = warmupCap(daysSince);

    if (sentToday >= cap) {
      return new Response(
        JSON.stringify({ ok: true, skipped: "daily_cap_reached", sentToday, cap }),
        { headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    // Find due enrollments
    const due = await sb<Enrollment[]>(
      `outreach_enrollments?status=eq.active&next_send_at=lte.${new Date().toISOString()}&select=*,target:outreach_targets(*),sequence:outreach_sequences(steps)&limit=${cap - sentToday}`,
    );

    const results: unknown[] = [];
    for (const e of due) {
      if (sentToday >= cap) break;
      try {
        const r = await sendOne(e);
        results.push(r);
        if ((r as { sent?: boolean }).sent) sentToday++;
      } catch (err) {
        console.error("[outreach-tick] sendOne failed", err);
        results.push({ error: (err as Error).message, enrollment_id: e.id });
      }
    }

    // Update daily counter
    await sb("outreach_daily_limits", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({ date: today, sends_count: sentToday, warmup_cap: cap }),
    });

    return new Response(
      JSON.stringify({
        ok: true,
        processed: due.length,
        sentToday,
        cap,
        results,
      }),
      { headers: { ...CORS, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[outreach-tick] fatal", err);
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }
});
