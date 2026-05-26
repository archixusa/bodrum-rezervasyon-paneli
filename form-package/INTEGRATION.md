# Form Entegrasyonu — 4 Site

Bu doküman her sitenin repo'sundaki tam dosya konumlarını ve commit'leyeceğin değişiklikleri içerir.

> **Önce:** Supabase projesini açıp `NEXT_PUBLIC_SUPABASE_URL` ve `NEXT_PUBLIC_SUPABASE_ANON_KEY` değerlerini al. Bunlar her sitenin Vercel projesinin **Environment Variables** sekmesine eklenecek (Production + Preview + Development).

---

## Site 1 — bodrumapartkiralama.com (Next.js)

**Repo:** https://github.com/archixusa/bodrumapartkiralama-com

### Adımlar

```bash
git clone https://github.com/archixusa/bodrumapartkiralama-com
cd bodrumapartkiralama-com
git checkout -b feat/reservation-system
npm install @supabase/supabase-js
```

### Dosyaları kopyala

`form-package/react/` içeriğini hedef repodaki `src/lib/reservation-form/` altına kopyala:

```
src/lib/reservation-form/
  ReservationForm.tsx
  supabaseClient.ts
  types.ts
  utils.ts
  index.ts
```

### Apart detay sayfasını güncelle

`src/app/[locale]/apartlar/[slug]/page.tsx` — mevcut `BookingForm` import'unu kaldır, yenisine geç:

```tsx
import { ReservationForm } from "@/lib/reservation-form";

// ... sticky aside içinde:
<ReservationForm
  siteName="bodrumapartkiralama"
  propertySlug={apt.slug}
  whatsappNumber={c("whatsappNumber")}
  kvkkUrl="/kvkk"
/>
```

> Mevcut `BookingForm.tsx` ve `actions/bookingAction.ts` artık ölü kod — silebilir veya bırakabilirsin. Yeni form Supabase'e direkt insert eder; Resend gönderimi artık Edge Function tarafında yapılıyor.

### Ana sayfa hero arama formu — değişiklik yok

`SearchBar` mevcut hâliyle filtreleme için kalsın. Liste sayfasından yönlendirme yapıyor; bu sistemde değişmez.

### Env

`.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

Vercel dashboard'dan da aynı değerleri **Environment Variables**'a ekle.

### Commit & PR

```bash
git add -A
git commit -m "Replace booking form with multi-site Supabase reservation form"
git push -u origin feat/reservation-system
gh pr create --title "Multi-site reservation form" --body "Form artık Supabase'e gönderiyor; bildirimler Edge Function tarafında yönetiliyor."
```

---

## Site 2 — bodrumapartvilla.vercel.app (Next.js)

**Repo:** sahibinin GitHub hesabında olan `bodrumapartvilla` repo'su (varsayım: archixusa/bodrumapartvilla)

Aynı adımları uygula. Yalnızca prop farkı:

```tsx
<ReservationForm
  siteName="bodrumapartvilla"
  propertySlug={property.slug}
  whatsappNumber="905385124088"
  kvkkUrl="/kvkk"
/>
```

---

## Site 3 — bodruminsaatadilat.vercel.app (Next.js)

**Repo:** archixusa/bodruminsaatadilat

Bu site bir inşaat/emlak sitesi — apart kiralama detayı yoksa **ana sayfada "İletişim" / "Teklif İste" bölümüne** form'u koy:

```tsx
import { ReservationForm } from "@/lib/reservation-form";

<ReservationForm
  siteName="bodruminsaatadilat"
  propertySlug={null}
  whatsappNumber="905385124088"
  kvkkUrl="/kvkk"
  compact
/>
```

`compact` prop'u mesaj alanını gizler, ana sayfa CTA bloğunda küçük formlar için idealdir.

---

## Site 4 — bodrumacilsu (GitHub Pages, statik)

**Repo:** https://github.com/archixusa/bodrumacilsu

Bu site statik HTML olduğu için **vanilla JS** versiyonunu kullan.

### Dosyaları kopyala

`form-package/vanilla/reservation-form.js` dosyasını repo köküne (veya `assets/js/`) koy:

```bash
git clone https://github.com/archixusa/bodrumacilsu
cd bodrumacilsu
git checkout -b feat/reservation-form
mkdir -p assets/js
# form-package/vanilla/reservation-form.js dosyasını buraya kopyala
cp /path/to/form-package/vanilla/reservation-form.js assets/js/
```

### HTML'e ekle

`index.html` (veya iletişim bölümünün olduğu sayfa):

```html
<!-- Sayfanın istediğin yerine yerleştir -->
<section id="rezervasyon" style="max-width:560px;margin:40px auto;padding:0 16px;">
  <div id="reservation-form"></div>
</section>

<!-- </body> öncesi -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
<script src="./assets/js/reservation-form.js"></script>
<script>
  BodrumReservationForm.mount({
    el: '#reservation-form',
    supabaseUrl: 'https://YOUR-PROJECT-REF.supabase.co',
    supabaseAnonKey: 'YOUR_ANON_KEY',
    sourceSite: 'bodrumacilsu',
    propertySlug: null,
    whatsappNumber: '905385124088',
    kvkkUrl: '/kvkk.html',
  });
</script>
```

> **Önemli:** Statik bir sitede anon key public görünür. Bu **Supabase RLS sayesinde güvenlidir** — anon role yalnızca `reservation_requests`'e INSERT yapabilir, başka hiçbir şey okuyamaz/yazamaz.

### Commit & PR

```bash
git add -A
git commit -m "Add multi-site reservation form to homepage"
git push -u origin feat/reservation-form
gh pr create --title "Reservation form" --body "Supabase-backed form, vanilla implementation."
```

---

## Test akışı (entegrasyondan sonra)

1. Vercel preview deploy'ları otomatik tetiklenir
2. Preview URL'inde formu doldur → submit
3. Supabase Studio → Table Editor → `reservation_requests` → satır görmeli
4. Telegram bot'una mesaj düşmeli (config doğruysa)
5. ADMIN_EMAIL adresine e-posta gelmeli (RESEND_API_KEY varsa)
6. Admin panel `/requests` sayfasında canlı toast notification çıkmalı

## Hangi UTM parametreleri yakalanıyor?

URL query string'i otomatik okunur:
- `?utm_source=google` → `utm_source` alanına yazılır
- `?utm_medium=cpc` → `utm_medium`
- `?utm_campaign=bodrum2026` → `utm_campaign`

Google Ads / Meta Ads URL şablonlarında bu parametreleri kullan.

## Domain doğrulanmadan email çalışır mı?

Evet. `FROM_EMAIL=onboarding@resend.dev` ile başlayabilirsin (Resend'in test domain'i). Site domain'leri için verify yapınca `from`'u kendi domain'ine çevirirsin.

## Form 30 KB üstüne çıkarsa?

- Vanilla: tek dosya ~14 KB gzipped. Sınırın altında.
- React: ReservationForm tree-shake edilmiş ~6 KB; supabase-js peer dependency olarak gelir.
