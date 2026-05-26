import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("settings").select("*");
  const settings = Object.fromEntries((data ?? []).map((s: { key: string; value: unknown }) => [s.key, s.value]));

  return (
    <>
      <PageHeader title="Ayarlar" desc="Kur bilgisi, mesaj şablonları, panel URL" />
      <div className="panel-card p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Mevcut Ayarlar</h3>
        <pre className="mt-3 overflow-x-auto rounded-md bg-navy-50 p-4 text-xs">
{JSON.stringify(settings, null, 2)}
        </pre>
        <p className="mt-3 text-xs text-muted">
          Düzenleme için Supabase Studio → Table Editor → <code className="rounded bg-navy-100 px-1">settings</code> tablosunu kullanın.
        </p>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card title="Telegram Bot">
          <p>
            BotFather'da <code>/newbot</code> ile bot oluştur. Token'ı Supabase Studio → Edge Functions →
            Secrets'a <code>TELEGRAM_BOT_TOKEN</code> ve <code>TELEGRAM_CHAT_ID</code> olarak ekle.
          </p>
          <p className="mt-2 text-xs">
            Chat ID için bot'a mesaj at, sonra
            <code className="ml-1">https://api.telegram.org/bot&lt;TOKEN&gt;/getUpdates</code>
            URL'ini açıp <code>chat.id</code>'yi al.
          </p>
        </Card>
        <Card title="Resend E-mail">
          <p>
            resend.com → API Keys → Create. Test için <code>FROM_EMAIL=onboarding@resend.dev</code>.
            Domain doğrulandıktan sonra kendi adresinizi kullanın.
          </p>
        </Card>
      </div>
    </>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="panel-card p-5 text-sm">
      <h3 className="mb-2 font-bold">{title}</h3>
      <div className="space-y-2 text-muted">{children}</div>
    </div>
  );
}
