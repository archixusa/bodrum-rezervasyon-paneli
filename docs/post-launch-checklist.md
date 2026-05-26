# Post-Launch Checklist

Bu adımları DNS bağlandıktan ve PR'lar merge edildikten sonra uygula.

## 1. Environment Variables Güncelleme (Vercel)

### bodrumapartkiralama-com projesi:

| Key | Value |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://bodrumapartkiralama.com` |
| `NEXT_PUBLIC_SUPABASE_URL` | (Supabase URL'in) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (sb_publishable_... key) |
| `NEXT_PUBLIC_GA_ID` | (Google Analytics 4 ID — oluşturulduğunda) |
| `NEXT_PUBLIC_SITE_KEY` | `bodrumapartkiralama` |

### bodrumapartvilla-com projesi:

| Key | Value |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://bodrumapartvilla.com` |
| `NEXT_PUBLIC_SUPABASE_URL` | (aynı) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (aynı) |
| `NEXT_PUBLIC_GA_ID` | (Villa için ayrı GA property) |
| `NEXT_PUBLIC_SITE_KEY` | `bodrumapartvilla` |

Komut:
```bash
cd /Users/archixusa/Desktop/site-integrations/bodrumapartkiralama-com
vercel env add NEXT_PUBLIC_SITE_URL production
# https://bodrumapartkiralama.com yapıştır
# Aynısını diğer keylar için tekrarla

cd /Users/archixusa/Desktop/site-integrations/bodrumapartvilla-com
# Aynı süreç villa için
```

## 2. Google Search Console

İki domain için ayrı ayrı:

1. https://search.google.com/search-console
2. Add Property → **Domain** (URL prefix değil)
3. Domain yaz (bodrumapartkiralama.com / bodrumapartvilla.com)
4. TXT verification record al
5. Natro DNS panelinde TXT record ekle:
   - Type: `TXT`
   - Name: `@`
   - Value: `google-site-verification=XXX`
6. Verify (DNS prop. 5-30 dk sürer)
7. Sitemap submit:
   - `https://bodrumapartkiralama.com/sitemap.xml`
   - `https://bodrumapartvilla.com/sitemap.xml`

## 3. Bing Webmaster Tools

Aynısını https://www.bing.com/webmasters için yap.
Google Search Console'dan import seçeneği var, hızlı yol.

## 4. Sitemap Ping (Launch sonrası)

```bash
curl "https://www.google.com/ping?sitemap=https://bodrumapartkiralama.com/sitemap.xml"
curl "https://www.google.com/ping?sitemap=https://bodrumapartvilla.com/sitemap.xml"
```

## 5. Vercel Domain Setup (henüz değilse)

Her iki Vercel projesinde Settings → Domains:

1. Add Domain → `bodrumapartkiralama.com` (apex) + `www.bodrumapartkiralama.com`
2. DNS settings:
   - **A record** apex → `76.76.21.21` (Vercel)
   - **CNAME** www → `cname.vercel-dns.com`
3. Aynısını villa için
4. Vercel SSL otomatik kurar (Let's Encrypt)

**Vercel'in eski hash'li URL'ini (örn. `bodrumapartkiralama-com-hn2q.vercel.app`)**:
- Settings → Domains → eski URL'i sil
- VEYA redirect kur (Permanent 308 → apex domain)

## 6. Test Checklist

### bodrumapartkiralama.com:
- [ ] https://bodrumapartkiralama.com açılıyor (yeşil kilit görünüyor)
- [ ] https://www.bodrumapartkiralama.com → apex'e redirect
- [ ] http://bodrumapartkiralama.com → https'e redirect
- [ ] /apartlar (Coming Soon sayfası) düzgün açılıyor
- [ ] /hakkimizda, /iletisim, /kvkk, /cerez-politikasi, /sss açılıyor
- [ ] Form submit testi: /iletisim formu Supabase contact_messages'a yazıyor mu?
- [ ] Newsletter signup: /apartlar'daki form newsletter_subscribers'a yazıyor mu?
- [ ] Cookie consent banner ilk ziyarette görünüyor
- [ ] Cookie consent kabul edilince GA yükleniyor
- [ ] Mobile responsive (Chrome DevTools mobil görünüm)
- [ ] /sitemap.xml düzgün XML dönüyor
- [ ] /robots.txt doğru içerik

### bodrumapartvilla.com:
- (Aynı liste villa için)

### Lighthouse skorları
Her sayfa için (PageSpeed Insights):
- Performance: > 85
- Accessibility: > 90
- Best Practices: > 90
- SEO: > 95

## 7. Sosyal Medya OG Test

Her domain için Open Graph paylaşım önizlemesini test et:

- https://www.opengraph.xyz/ → URL yapıştır → preview'a bak
- Facebook Sharing Debugger: https://developers.facebook.com/tools/debug
- Twitter Card Validator: https://cards-dev.twitter.com/validator
- LinkedIn Post Inspector: https://www.linkedin.com/post-inspector/

OG image düzgün gözükmeli, title + description doğru olmalı.

## 8. Supabase RLS Doğrulaması (Production Smoke Test)

```bash
# Anonim INSERT testi (rate limit aktif olduğu için max 5/dk)
curl -X POST "https://YOUR_PROJECT.supabase.co/rest/v1/newsletter_subscribers" \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","source_site":"bodrumapartkiralama","source_page":"test"}'

# 6. ekleme rate-limit hatası vermeli (54000)
```

## 9. İçerik İçin Manuel Kontroller

- [ ] Furkan Şahin profil fotoğrafı upload edildi mi? (`public/authors/furkan-sahin.jpg`)
- [ ] Hero görsel(leri) generic Bodrum görselleri mi? (Unsplash creditli)
- [ ] Logo final mi yoksa placeholder mı?
- [ ] WhatsApp numarası gerçek mi? (+90 538 512 4088)
- [ ] E-posta adresi DNS'i doğrulanmış mı? (Resend dashboard)

## 10. Analytics Setup

### Google Analytics 4

1. https://analytics.google.com/ → Create Property
2. Property name: `Bodrumapartkiralama` (ayrı property villa için)
3. Industry: Travel
4. Country: Türkiye
5. Time zone: GMT+3
6. Currency: TRY
7. Web data stream → site URL'i ver
8. Measurement ID (G-XXXXXX) → Vercel env `NEXT_PUBLIC_GA_ID`'e ekle
9. Redeploy

### Goals/Events (öneri)
- `form_submit` (iletişim formu)
- `newsletter_subscribe`
- `whatsapp_click`
- `coming_soon_cta_click`

## 11. Backup Stratejisi

- Supabase DB: zaten otomatik daily snapshot (free plan'da 7 gün)
- GitHub: her commit otomatik backup
- Vercel deployment: history her zaman erişilebilir (rollback 1 tık)

## 12. Sonraki Adımlar (Launch sonrası ilk hafta)

1. **Trafik gözlem** — GA real-time'da ilk ziyaretçileri izle
2. **Form submission'ları** — admin panel /reviews, /applications, dashboard'da Supabase Realtime ile düşüyor
3. **Yorum/lead düştüğünde Telegram bildirimi** çalışıyor mu?
4. **SEO indexing** — Search Console'da indexlenme durumu (24-48 saat sürer)
5. **Performance** — gerçek kullanıcı verisi gelince Lighthouse'tan ziyade Core Web Vitals'a bak

---

**Hatırlatma:** Bu checklist sadece pre-launch + early launch için. Sonrası için ayrı bir operasyon dokümanı oluşturulacak.
