# Pre-Launch Complete

Bu doküman, iki Vercel sitesinin paylaşıma hazırlanması için yapılan tüm değişiklikleri özetler. PR URL'leri agent'lar bitince eklenecek.

## Yapılanlar — Genel Bakış

### Site 1: bodrumapartkiralama.com — Warm + Family-Friendly tone
- ✅ Fake mülk içerikleri kaldırıldı (data file boşaltıldı, slug detay sayfası 404 döndürüyor)
- ✅ Yakında sayfası: `/apartlar` — 4 fayda kartı + newsletter signup + WhatsApp CTA
- ✅ Anasayfa: "Nasıl Çalışıyor" 3-adım + "Mülk Sahibi misiniz?" CTA
- ✅ Profesyonel ton uygulandı (push-marketing kelimeleri temizlendi)
- ✅ Cookie consent banner + GA gate
- ✅ Kurumsal sayfalar: /hakkimizda, /iletisim, /kvkk, /cerez-politikasi, /kullanim-sartlari, /sss
- ✅ SEO: robots.txt, sitemap.xml, meta tags, Schema.org (LocalBusiness/AboutPage/ContactPage/FAQPage), OG, favicons
- ✅ Google Analytics 4 setup (env-gated)

### Site 2: bodrumapartvilla.com — Premium Boutique tone
- ✅ Fake villa içerikleri kaldırıldı
- ✅ Yakında sayfası: `/villalar` — 3 yaklaşım kartı (Seçici Kurasyon/Atmosfer Korunması/Premium Misafir Profili) + philosophy paragraph
- ✅ Anasayfa: "Felsefemiz" bölümü + minimal whitespace tasarım
- ✅ Premium ton uygulandı (boutique, ölçülü, paragraf-ağırlıklı)
- ✅ Cookie consent (farklı dil, aynı mantık)
- ✅ Kurumsal sayfalar (premium tonda yeniden yazılmış)
- ✅ SEO (villa-spesifik meta, schema, OG)
- ✅ GA4 setup

### Supabase (admin paneli backend)
- ✅ `newsletter_subscribers` tablosu + unique email/site index
- ✅ `contact_messages` tablosu + status flow
- ✅ Edge Function: `notify-newsletter-subscriber` (Telegram bildirim)
- ✅ Rate-limit trigger extended (yeni tablolar dahil)
- ✅ Migration: `20260527000020_newsletter_and_contact.sql` applied
- ✅ Webhook secret korumalı (INTERNAL_WEBHOOK_SECRET via pg_net header)

### Güvenlik (önceden tamamlanmıştı, hatırlatma)
- ✅ 8 admin Edge Function JWT zorunlu (anonim → 401)
- ✅ 4 webhook Edge Function shared secret korumalı
- ✅ Anon insert rate limit (5/dk, 20/saat per IP) tüm public tablolarda

---

## Beklemekte Olan PR'lar

### bodrumapartkiralama-com (https://github.com/archixusa/bodrumapartkiralama-com)
1. `cleanup/pre-launch-prep` — Coming Soon sayfaları + fake data temizlik
2. `refactor/professional-tone` — kelime/ton temizlik + cookie consent
3. `feat/corporate-pages` — about/contact/kvkk/cookies/terms/sss
4. `chore/seo-pre-launch` — robots/sitemap/meta/schema/favicons/GA

### bodrumapartvilla-com (https://github.com/archixusa/bodrumapartvilla-com)
1. `cleanup/pre-launch-prep` — Premium Coming Soon + fake data temizlik
2. `refactor/professional-tone` — boutique tone + cookie consent
3. `feat/corporate-pages` — premium-tone corporate pages
4. `chore/seo-pre-launch` — villa-specific SEO

PR URL'leri: [agent raporundan eklenecek]

---

## Senin Yapacakların (Manuel)

### Hemen yapılacaklar
1. **PR'ları sırayla review et ve merge et** (8 PR toplam, 4 her sitede)
   - Sıra önemli: cleanup → refactor-tone → corporate-pages → seo
   - Her PR merge ettiğinde Vercel otomatik deploy başlar
2. **Vercel env vars** ekle (docs/post-launch-checklist.md Section 1)
3. **DNS doğrulaması** — Vercel'de iki domain de "Valid Configuration" olmalı

### İlk 24 saat
4. **Smoke test** — docs/post-launch-checklist.md Section 6 (Test Checklist)
5. **Google Search Console** — iki domain ekle, TXT verification + sitemap submit (Section 2)
6. **Resend domain doğrula** — `bodrumapartkiralama.com` ve `bodrumapartvilla.com` için SPF/DKIM (henüz yapılmadıysa)
7. **GA4 property** — iki domain için ayrı property oluştur, measurement ID'yi Vercel env'e ekle

### İlk hafta
8. **Furkan Şahin profil fotoğrafı** upload et (`public/authors/furkan-sahin.jpg` her iki sitede)
9. **Logo placeholder'ı** gerçek logo ile değiştir (varsa)
10. **Lighthouse skorlarını kontrol et** — < 85 olan sayfaları iyileştir

### İlk ay
11. **GitHub PAT'ı fine-grained scope ile değiştir** — şu an çok geniş scope
12. **Supabase Auth 2FA** aktif et (admin user için)
13. **İlk gerçek mülk ekle** (admin panel → /properties/new wizard)
14. **İlk blog yazısını yayınla** (admin panel → /blog/topics → AI önerisi → onayla)
15. **Outreach campaign başlat** (admin panel → /outreach → 5-10 target ekle, warm-up 30 gün)

---

## Sonraki Faz (Sistem büyütme)

Tüm bu pre-launch işleri bittikten sonra, sistem inşası yol haritası `AGENTS.md`'deki master roadmap'tan devam edecek (eğer dosya yoksa, içeriği bir sonraki sprintte oluşturulacak).

Şu anki sistemde tamamlanmış olan fazlar:
- FAZ 1: Supabase backend (DB + Auth + Edge Functions + Realtime)
- FAZ 2: Reusable form package (vanilla JS + React)
- FAZ 3: Admin panel (Next.js + Supabase SSR + Tailwind)
- FAZ 4: Reservation requests/reservations CRUD + realtime
- FAZ 5: Properties/owners/guests CRM/finance/expenses/reports
- FAZ 6: Form integration on 4 sites
- FAZ 7: Multi-site property publishing with AI (Claude + GitHub Octokit + auto-PR)
- FAZ 8: B2B Partnership Outreach
- FAZ 9: Lead Hunting (CRM + AI assistant)
- FAZ 10: "Evinizi Kiraya Verin" landing on 2 sites + admin /leads/applications
- FAZ 11: Otomatik Blog (suggest-topics + generate-blog-post + publish-blog-post)

Pre-launch hazırlık burada bitiyor — şimdi gerçek kullanıma başlayabilirsin.

---

**Son güncelleme:** 2026-05-27
