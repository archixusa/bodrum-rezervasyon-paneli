# Admin Paneli Kullanım Kılavuzu

Panel: `https://<your-panel>.vercel.app` (veya custom domain)

## Giriş

İlk kullanım için Supabase Studio'dan davet edilmiş olman gerek (Authentication → Users → Invite). Davet mailindeki linkle şifre belirledikten sonra `/login` üzerinden giriş yap.

**Şifre kayıp** → Supabase Studio → Authentication → Users → user'a "Send password reset"

## Dashboard

Ay özetin:
- **Yeni istek sayısı:** Bu ay form'lardan gelen toplam
- **Dönüşüm oranı:** İstek → rezervasyon yüzdesi
- **Rezervasyon:** Bu ay onaylanan rezervasyon sayısı
- **Komisyon:** Mülk başına ayarlanan oranın × ciro

Yan sütunda **bekleyen istekler** (status=new) ve **yaklaşan hareketler** (7 gün).

## İstekler (`/requests`)

**En kritik ekran.** Yeni istekler:
- 🔔 Bildirim sesi çalar (`notification.mp3`)
- Sağ üstte toast notification
- Browser Notification API (izin verirseniz)

Her satırda hızlı eylemler:

| İkon | Eylem |
|---|---|
| 📞 | `tel:` linki — tıkla, ara |
| 💬 | WhatsApp — önceden yazılmış şablonla pencere açılır |
| ✅ | Status = `converted` — rezervasyona dönüştür |
| ❌ | Status = `rejected` |
| 📝 | Detay drawer aç (mesaj okuma + not ekleme) |

**Detay drawer**'da tam bilgi: IP, user-agent, UTM, dahili not. Sağ kolondan:
- "İletişim Kuruldu" (contacted)
- "Rezervasyona Dönüştür" (converted)
- "Reddet" (rejected)
- "Spam İşaretle" (spam)

**Auto-spam:** Aynı IP'den 10 dakikada 3+ istek → otomatik `spam` işaretler.

**Filtreler:** Üstte durum (Hepsi/Yeni/İletişim/Rezervasyon/Red/Spam) ve site (4 site rozetleri).

## Rezervasyonlar (`/reservations`)

Onaylanmış rezervasyonların listesi. Durum:
- **Bekliyor** (pending) — havale beklenen
- **Onaylı** (confirmed) — havale geldi
- **Tamamlandı** (completed) — misafir çıkış yaptı
- **İptal** (cancelled)

Yeni rezervasyon eklemek için en pratik yol: bir `request` üzerinde "Rezervasyona Dönüştür" → otomatik link kurulur.

## Takvim (`/calendar`)

3 aylık mülk × gün grid:
- 🟢 Yeşil = Onaylı
- 🟡 Sarı = Bekliyor
- ⬜ Boş = Müsait
- Hücreye hover → misafir adı + durum

## Mülkler (`/properties`)

Mülkleri Supabase Studio → Table Editor → `properties` üzerinden ekle/düzenle. Buradan sadece liste görünür.

**Slug eşleme kritik:** Sitelerden gelen `property_slug` ile aynı olmalı. Örn:
- Site URL: `bodrumapartkiralama.com/apartlar/gumbet-deniz-manzarali-1-1`
- Properties.slug: `gumbet-deniz-manzarali-1-1`

Eşleşmezse istek `property_id` null olarak gelir, panelden manuel atama yapılır.

## Mülk Sahipleri (`/owners`)

İletişim + IBAN bilgileri.

## Misafirler (`/guests`)

CRM görünümü. Telefon veya e-posta üzerinden otomatik birleştirme. Tekrar gelen misafirler **"NxVIP"** badge ile işaretlenir.

## Finans (`/finance`)

Bu ay vs geçen ay komisyon trend'i. Trendin altında % artış/azalma.

## Giderler (`/expenses`)

Manuel girilen giderler (temizlik, bakım, vs). Supabase Studio'dan ekle.

## Raporlar (`/reports`)

Bu ay sahip başına hesap kesim:

| Sahip | Rezervasyon | Ciro | Komisyon | Sahibe Ödenecek |

Ekran görüntüsü alıp WhatsApp ile sahibe gönderebilirsin. PDF export sonraki sürümde gelecek.

## Ayarlar (`/settings`)

Mevcut `settings` tablosundaki JSON. Değiştirmek için Supabase Studio kullan.

## Çıkış

Sol sidebar alt → "Çıkış Yap"

## Mobil

Panel responsive — telefondan kullanılabilir. PWA olarak kurmak için: tarayıcı menüsünden "Ana ekrana ekle" → uygulama gibi çalışır + push notification (ekstra setup).

## Sık sorulan

**Yeni istek geldi ama bildirim çalmadı** → Browser ses çalma izni ver veya `notification.mp3` dosyasının `public/` altında olduğunu kontrol et.

**Realtime bağlantı kopuyor** → Supabase Realtime concurrent connection limit (free tier 200) aşılmış olabilir. Sayfa yenile.

**Veri yedeği** → Supabase Studio → Database → Backups → Download
