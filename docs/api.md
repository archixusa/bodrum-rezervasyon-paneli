# API Referansı

Tüm endpoint'ler Supabase REST API (auto-generated from schema) üzerinden.

Base URL: `https://YOUR-PROJECT-REF.supabase.co/rest/v1`

## Auth

- Anon istekler (form): `apikey: <ANON_KEY>` header
- Admin istekler: `Authorization: Bearer <USER_JWT>` (login sonrası alınır)

## Tablolar

### `reservation_requests`

#### POST (anon)

```http
POST /rest/v1/reservation_requests
apikey: <ANON_KEY>
Content-Type: application/json

{
  "source_site": "bodrumapartkiralama",
  "property_slug": "gumbet-deniz-manzarali-1-1",
  "guest_name": "Ahmet Yılmaz",
  "guest_phone": "+90 538 512 40 88",
  "guest_email": "ahmet@example.com",
  "check_in": "2026-07-15",
  "check_out": "2026-07-22",
  "guests_count": 4,
  "region": "Gümbet",
  "message": "Erken giriş mümkün mü?",
  "utm_source": "google",
  "utm_medium": "cpc",
  "utm_campaign": "bodrum2026"
}
```

Yanıt: `201 Created` ve insert edilen kayıt (Prefer: return=representation header'ı ile).

#### GET (admin, JWT gerekli)

```http
GET /rest/v1/reservation_requests?status=eq.new&order=created_at.desc&limit=50
Authorization: Bearer <USER_JWT>
apikey: <ANON_KEY>
```

#### PATCH (admin)

```http
PATCH /rest/v1/reservation_requests?id=eq.<UUID>
Authorization: Bearer <USER_JWT>
Content-Type: application/json

{ "status": "converted", "notes": "Aramada konuşuldu, fiyat verildi" }
```

### `reservations`

Admin yetkisi gerektirir. Standard CRUD.

```http
POST /rest/v1/reservations
{
  "request_id": "<UUID>",
  "property_id": "<UUID>",
  "guest_name": "Ahmet Yılmaz",
  "check_in": "2026-07-15",
  "check_out": "2026-07-22",
  "amount": 28000,
  "currency": "TRY",
  "deposit": 8400,
  "commission_rate": 15,
  "source": "direct"
}
```

### `properties`, `owners`, `expenses`

Standard CRUD. Schema için `supabase/migrations/20260525000001_initial_schema.sql` bak.

### `settings`

Key-value JSON store. Anahtarlar:

| Key | Şekil |
|---|---|
| `fx_rates` | `{ "EUR_TRY": 36.5, "USD_TRY": 34.0, "as_of": "..." }` |
| `notification_templates` | `{ "telegram_new_request": "..." }` |
| `panel_url` | `"https://panel.domain.com"` |

## Görünümler (read-only, admin)

### `upcoming_movements`

7 gün içinde giriş/çıkış yapacak rezervasyonlar (Dashboard'da kullanılır).

```http
GET /rest/v1/upcoming_movements?order=check_in.asc
```

### `requests_summary`

Source × status sayım. Dashboard widget için.

## Realtime

Admin panel için, supabase-js ile:

```ts
const channel = supabase
  .channel("reservation_requests")
  .on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "reservation_requests" },
    (payload) => {
      const r = payload.new as ReservationRequest;
      // → toast, ses, vs.
    }
  )
  .subscribe();
```

Dinlenen olaylar:
- `INSERT` on `reservation_requests` → yeni istek
- `UPDATE` on `reservation_requests` → durum/not değişti
- `INSERT` on `reservations` → yeni rezervasyon
- `UPDATE` on `reservations` → rezervasyon değişti

## Edge Functions

### `POST /functions/v1/notify-new-request`

Database Webhook tarafından çağrılır. Manuel test:

```bash
curl -X POST "https://<REF>.supabase.co/functions/v1/notify-new-request" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "INSERT",
    "table": "reservation_requests",
    "record": {
      "id": "test-id",
      "source_site": "test",
      "guest_name": "Manual Test",
      "guest_phone": "+90 538 512 40 88",
      "check_in": "2026-07-01",
      "check_out": "2026-07-08",
      "guests_count": 2,
      "created_at": "2026-05-25T10:00:00Z"
    }
  }'
```
