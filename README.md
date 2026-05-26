# Bodrum Rezervasyon Yönetim Sistemi

4 farklı siteden (bodrumapartkiralama, bodrumapartvilla, bodrumacilsu, bodruminsaatadilat) gelen rezervasyon isteklerini tek bir Supabase veritabanında toplayan; Telegram + e-posta ile anlık bildirim gönderen; Next.js admin paneli ile yönetilen multi-site sistem.

## Mimari

```
┌─────────────────────────────────────────────────────────────┐
│ 4 SİTE  (Vercel Next.js + GitHub Pages)                     │
│ ┌─────────────────┐  ┌─────────────────┐                    │
│ │ ReservationForm │  │ ReservationForm │   ← form-package/  │
│ │   (React)       │  │   (Vanilla JS)  │                    │
│ └────────┬────────┘  └────────┬────────┘                    │
└──────────┼────────────────────┼──────────────────────────────┘
           │  POST              │
           ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│ SUPABASE                                                    │
│                                                             │
│  reservation_requests (INSERT, anon RLS)                   │
│         │                                                   │
│         │ webhook                                           │
│         ▼                                                   │
│  Edge Function: notify-new-request                          │
│         │                                                   │
│         ├──► Telegram Bot API                              │
│         └──► Resend (e-mail)                               │
│                                                             │
│  reservations / properties / owners / expenses (RLS admin) │
│  Realtime publication                                       │
└────────────┬────────────────────────────────────────────────┘
             │ Realtime + auth
             ▼
┌─────────────────────────────────────────────────────────────┐
│ ADMIN PANEL  (Vercel Next.js)                               │
│ Login → Dashboard → Requests (canlı) → Reservations → ...  │
└─────────────────────────────────────────────────────────────┘
```

## Klasör yapısı

```
bodrum-rezervasyon-paneli/
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   │   ├── 20260525000001_initial_schema.sql
│   │   ├── 20260525000002_rls_policies.sql
│   │   ├── 20260525000003_realtime.sql
│   │   └── 20260525000004_helper_views.sql
│   └── functions/notify-new-request/
│       ├── index.ts
│       └── deno.json
├── form-package/
│   ├── README.md
│   ├── INTEGRATION.md         ← 4 site için kopya-yapıştır rehberi
│   ├── vanilla/reservation-form.js
│   └── react/
│       ├── ReservationForm.tsx
│       ├── supabaseClient.ts
│       ├── types.ts
│       ├── utils.ts
│       └── index.ts
├── admin-panel/                ← Next.js 14 panel (Vercel-ready)
└── docs/
    ├── architecture.md
    ├── api.md
    ├── setup-supabase.md
    ├── setup-telegram.md
    ├── setup-resend.md
    └── admin-guide.md
```

## Hızlı kurulum (sırayla)

### 1. Supabase
```bash
# supabase.com/dashboard'tan yeni proje oluştur (free tier yeterli)
# Settings → API → URL ve anon key'i not al
npx supabase login
npx supabase link --project-ref <YOUR_REF>
npx supabase db push                              # tüm migration'ları çalıştırır
npx supabase functions deploy notify-new-request  # Edge Function'ı deploy eder
# Dashboard → Database → Webhooks → Create:
#   Table: reservation_requests, Event: INSERT
#   Type: Supabase Edge Function → notify-new-request
```

Detay: [docs/setup-supabase.md](docs/setup-supabase.md)

### 2. Telegram bot
```
1. Telegram'da @BotFather → /newbot → token al
2. Yeni bot'a mesaj at, sonra:
   https://api.telegram.org/bot<TOKEN>/getUpdates → chat.id'yi al
3. Supabase Studio → Edge Functions → Manage Secrets:
   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
```

Detay: [docs/setup-telegram.md](docs/setup-telegram.md)

### 3. Resend
```
1. resend.com/signup → API Keys → Create
2. Domain verify (opsiyonel) — başlangıçta onboarding@resend.dev kullan
3. Supabase Studio → Edge Functions → Secrets:
   RESEND_API_KEY, FROM_EMAIL, ADMIN_EMAIL
```

Detay: [docs/setup-resend.md](docs/setup-resend.md)

### 4. Admin panel
```bash
cd admin-panel
cp .env.example .env.local            # NEXT_PUBLIC_* doldur
npm install
npm run dev                            # localhost:3000
```

Production deploy:
- Vercel'e `admin-panel/` klasörünü push et
- ENV'leri Vercel dashboard'a ekle
- İlk admin kullanıcısı: Supabase Studio → Authentication → Users → "Invite"

### 5. Site entegrasyonu
Her sitenin repo'sunda [`form-package/INTEGRATION.md`](form-package/INTEGRATION.md)'deki adımları izle.

## Yeni site nasıl eklenir?

1. Site repo'sunda form'u entegre et (vanilla veya React)
2. Yeni `source_site` adı ekle (örn. `bodrumlux`)
3. `src/lib/format.ts` `SITE_LABELS` map'ine etiket ekle
4. Hepsi bu kadar — Realtime + bildirim altyapısı zaten çalışıyor

## Yedekleme

Haftada bir kez Supabase Studio → Project Settings → Database → Backups bölümünden indirebilirsin. Pro plan'da otomatik günlük backup vardır.

CLI ile:
```bash
npx supabase db dump --file backup-$(date +%Y%m%d).sql
```

## Yol haritası

- [ ] FAZ 4: 4 siteye form entegrasyonu
- [ ] PDF export (Sahip hesap kesim raporu)
- [ ] WhatsApp Business API ile şablon mesaj gönderimi (Twilio)
- [ ] Airbnb / Booking iCal sync
- [ ] Online ödeme (iyzico)
