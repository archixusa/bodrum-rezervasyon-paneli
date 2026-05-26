# Mimari

## Sistem komponentleri

```
┌──────────────────────────────────────────────────────────────────┐
│ FRONT                                                            │
│                                                                  │
│ Site 1: bodrumapartkiralama-com.vercel.app  (Next.js)           │
│ Site 2: bodrumapartvilla.vercel.app          (Next.js)          │
│ Site 3: bodruminsaatadilat.vercel.app        (Next.js)          │
│ Site 4: archixusa.github.io/bodrumacilsu     (Static HTML)      │
│                                                                  │
│ Hepsinde: <ReservationForm /> (React) veya                       │
│           BodrumReservationForm.mount() (Vanilla)                │
└────────────────────┬─────────────────────────────────────────────┘
                     │ supabase-js → REST API
                     │ INSERT to reservation_requests
                     ▼
┌──────────────────────────────────────────────────────────────────┐
│ SUPABASE  (managed Postgres + Edge Functions + Realtime)         │
│                                                                  │
│  Tablolar:                                                       │
│    owners                                                        │
│    properties        (slug ↔ form'dan gelen property_slug)       │
│    reservation_requests  ← form INSERT, anon                     │
│    reservations          ← admin convert                         │
│    expenses                                                      │
│    settings                                                      │
│                                                                  │
│  Görünümler:                                                     │
│    upcoming_movements    (dashboard widget için)                 │
│    requests_summary                                              │
│                                                                  │
│  Auth:                                                           │
│    anon role → reservation_requests INSERT (RLS)                 │
│    authenticated → tüm tablolarda full CRUD                      │
│                                                                  │
│  Realtime publication:                                           │
│    reservation_requests (INSERT, UPDATE)                         │
│    reservations (INSERT, UPDATE)                                 │
│                                                                  │
│  Edge Function:                                                  │
│    notify-new-request                                            │
│      ← Database Webhook (INSERT on reservation_requests)         │
│      → Telegram Bot API (sendMessage)                            │
│      → Resend API (e-mail)                                       │
└────────────────────┬─────────────────────────────────────────────┘
                     │ Realtime + RPC
                     ▼
┌──────────────────────────────────────────────────────────────────┐
│ ADMIN PANEL  (Next.js 14 App Router, deployed to Vercel)        │
│                                                                  │
│  /login                  Supabase Auth (email+password)          │
│  /                       Dashboard (KPIs + widgets)              │
│  /requests               Realtime liste, ses+toast bildirim      │
│  /reservations           CRUD                                    │
│  /calendar               Mülk × gün grid (3 ay)                  │
│  /properties             Slug eşleme                             │
│  /owners                                                         │
│  /guests                 Telefon/email ile auto-merge CRM        │
│  /finance                Komisyon raporu                         │
│  /expenses                                                       │
│  /reports                Sahip hesap kesim                       │
│  /settings                                                       │
└──────────────────────────────────────────────────────────────────┘
```

## Veri akışı: yeni rezervasyon isteği

```
1. Misafir formu doldurur (Sites 1-4'ten birinde)
       │
2. Form supabase-js ile reservation_requests'e INSERT
   (anon key, RLS: anon INSERT allowed; başka hiçbir şey okuyamaz/yazamaz)
       │
3. Postgres trigger: webhook → Edge Function notify-new-request
       │
       ├─► Telegram Bot sendMessage → Admin telefonuna anlık bildirim
       └─► Resend → ADMIN_EMAIL'e formatted HTML mail
       │
4. Admin panel Realtime subscription:
       Yeni satır → audio play + toast + Notification API
       │
5. Admin "Rezervasyona Dönüştür" butonu:
       reservation_requests.status = 'converted'
       INSERT INTO reservations (...)
```

## Güvenlik modeli

### Anon key (form'lar)

`reservation_requests` tablosu üzerinde sadece **INSERT** yetkisi var. SELECT/UPDATE/DELETE engelleniyor. Bu sayede:

- Anon key public görünebilir (GitHub Pages'te bile)
- Bot bir saldırgan veri okuyamaz, başka tabloyu değiştiremez
- Honeypot + auto-spam (aynı IP, 10 dk içinde 3+ istek) ile spam azaltılır

### Service role key

Sadece Edge Function ve admin panel server tarafında. RLS bypass eder, **client'a asla gönderme**.

### Authenticated role (admin)

Email+password ile login. Tüm tablolarda full CRUD. Davet edilmemiş kimse signup yapamaz (`config.toml` → `enable_signup = false`).

### Webhook signing

`notify-new-request` Edge Function'ı **JWT doğrulama olmadan** çağrılır (`verify_jwt = false`) çünkü Supabase Database Webhook'tan tetikleniyor. İlerde dış servisler de tetikleyebilsin diye dahil edebilirsiniz.

## Performans

| Bileşen | Hedef | Gerçek |
|---|---|---|
| Form bundle (vanilla) | < 30 KB gzip | ~14 KB |
| Form bundle (React) | < 30 KB gzip + supabase-js peer | ~6 KB own + 22 KB shared |
| Realtime latency | < 500 ms | ~150 ms (Frankfurt) |
| Edge Function cold start | < 1 sn | ~400 ms |
| Mail teslimi | < 30 sn | ~5 sn (Resend) |
| Telegram bildirim | < 5 sn | ~1 sn |

## Skala

Free tier limitleri:

| Servis | Free limit | Tahmini kullanım |
|---|---|---|
| Supabase DB | 500 MB | Yıllık 50.000 satır @ ~1 KB = 50 MB |
| Supabase Edge Function invocation | 500 K / ay | 5K istek × 1 invoke = 5K — bol bol yeter |
| Supabase Realtime concurrent | 200 | Tek admin için 1-2 |
| Resend | 3.000 / ay, 100 / gün | Yeterli (ortalama 50 istek/gün) |
| Telegram Bot API | sınırsız | OK |

10K+ ay başvuruda Pro plan'a ($25/ay) geçilebilir.
