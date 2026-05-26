# Supabase Kurulum Rehberi

## 1. Yeni proje aç

1. **https://supabase.com/dashboard** → "New project"
2. Organization seç (ya da yeni oluştur — ücretsiz)
3. Project name: `bodrum-rezervasyon`
4. Database password: güçlü bir şifre üret ve **1Password / kasaya kaydet** (kayıp olursa erişim biter)
5. Region: **Frankfurt (eu-central-1)** — Türkiye'ye en yakın
6. Plan: Free (2 GB DB, 5 GB transfer, 500 MB file storage — yeterli)
7. Create → 2 dakika beklenir

## 2. Credentials'ları al

Project hazır olunca **Project Settings → API**:

- **Project URL:** `https://abcdef.supabase.co`
- **Project API keys:**
  - `anon` `public` → `SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` (form'lar ve panel client tarafı)
  - `service_role` `secret` → `SUPABASE_SERVICE_ROLE_KEY` (yalnız Edge Function ve admin server tarafı — **asla** client'a koyma)

## 3. CLI ile bağlan

```bash
npm install -g supabase            # veya: brew install supabase/tap/supabase
cd bodrum-rezervasyon-paneli
supabase login                     # tarayıcı açar
supabase link --project-ref <REF>  # REF = project URL'deki ilk parça (abcdef)
```

## 4. Migration'ları çalıştır

```bash
supabase db push
```

Bu komut `supabase/migrations/` altındaki tüm `.sql` dosyaları sırayla çalıştırır:

1. `20260525000001_initial_schema.sql` — tablolar, indexler, trigger'lar
2. `20260525000002_rls_policies.sql` — RLS politikaları
3. `20260525000003_realtime.sql` — realtime publication
4. `20260525000004_helper_views.sql` — `upcoming_movements`, `requests_summary`

Dashboard → **Table Editor**'da 6 tabloyu görmen lazım: `owners`, `properties`, `reservation_requests`, `reservations`, `expenses`, `settings`.

## 5. Edge Function'ı deploy et

```bash
supabase functions deploy notify-new-request
```

## 6. Edge Function secrets

Dashboard → **Edge Functions** → `notify-new-request` → **Manage Secrets**:

| Key | Değer |
|---|---|
| TELEGRAM_BOT_TOKEN | BotFather'dan alınan token |
| TELEGRAM_CHAT_ID | Sizin Telegram chat ID'niz |
| RESEND_API_KEY | Resend'den alınan key (`re_...`) |
| FROM_EMAIL | `onboarding@resend.dev` (geçici) veya verify'lı `no-reply@domain.com` |
| ADMIN_EMAIL | Bildirim alacak adresiniz |
| PANEL_URL | Vercel'e deploy ettikten sonra `https://...vercel.app` |

> **Önemli:** secrets'ı buradan ayarladıktan sonra Edge Function'ı **yeniden deploy** etmek gerekmez; runtime'da okunur.

## 7. Database Webhook (Edge Function'ı tetikleyici)

Dashboard → **Database** → **Webhooks** → **Create a new hook**:

| Alan | Değer |
|---|---|
| Name | `notify-on-new-request` |
| Table | `public.reservation_requests` |
| Events | ☑ Insert |
| Type | Supabase Edge Functions |
| Method | POST |
| Edge Function | `notify-new-request` |
| HTTP Headers | (boş bırak) |
| HTTP Params | (boş) |

Save → her yeni `INSERT` Edge Function'ı tetikler.

## 8. İlk admin kullanıcı

Dashboard → **Authentication** → **Users** → **Add user** → **Send invitation**:

- Email: kendi adresin
- Auto Confirm User: ☑ aç
- → Davet maili gelir, link'e tıkla, şifre belirle, panele login ol

## 9. Test

```bash
# Manuel insert (psql veya Supabase Studio SQL editor):
insert into reservation_requests (source_site, guest_name, guest_phone, check_in, check_out, guests_count)
values ('bodrumapartkiralama', 'Test User', '+90 538 512 40 88', '2026-07-01', '2026-07-08', 2);
```

Telegram'a mesaj + e-postaya bildirim düşmeli. Admin panel `/requests` açıksa toast notification da çıkar.

## RLS sorun giderme

Form `INSERT` çalışmıyorsa:
```sql
-- Politika doğru mu?
select * from pg_policies where tablename = 'reservation_requests';
-- Beklenen: "Anyone can insert request" with check (true)

-- RLS açık mı?
select relname, relrowsecurity from pg_class where relname = 'reservation_requests';
-- Beklenen: t (true)
```

Panel'de hiçbir kayıt görünmüyorsa: kullanıcının `authenticated` rolüne sahip olduğundan emin ol (Authentication → Users → user.role = `authenticated`).
