# Rezervasyon Form Paketi

İki implementasyon:

| Klasör | Hedef | Bundle | Bağımlılık |
|---|---|---|---|
| `vanilla/` | GitHub Pages, statik HTML, jQuery dünyası | Tek dosya, ~12 KB gzip | CDN'den `@supabase/supabase-js` |
| `react/` | Next.js / React siteleri | Drop-in `<ReservationForm/>` | `@supabase/supabase-js` (peer) |

**Payload sözleşmesi (her iki implementasyon):**

```ts
{
  source_site: 'bodrumapartkiralama' | 'bodrumapartvilla' | 'bodrumacilsu' | 'bodruminsaatadilat',
  property_slug: string | null,
  guest_name: string,
  guest_phone: string,
  guest_email: string | null,
  check_in: string,            // YYYY-MM-DD
  check_out: string,           // YYYY-MM-DD
  guests_count: number,
  region: string | null,
  message: string | null,
  utm_source: string | null,
  utm_medium: string | null,
  utm_campaign: string | null,
}
```

Her iki form da:
- KVKK onayı zorunlu (submit'ten önce client + sunucu RLS uyarınca onay olmadan reddedilebilir)
- Honeypot field `_company` — bot doldurursa server kabul eder ama panele "spam" düşer
- TR telefon validasyonu yumuşak: `+90 5xx`, `05xx`, `+90 5xx xxx xx xx` hepsini kabul; uluslararası fallback
- `utm_*` URL query'sinden otomatik alınır
- Submit sonrası "1 saat içinde dönüş yapıyoruz" + WhatsApp deep link

Kullanım için `INTEGRATION.md` dosyalarına bak.
