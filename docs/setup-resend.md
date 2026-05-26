# Resend E-mail Kurulumu

E-posta bildirimleri için. Ayda **3.000 e-mail ücretsiz**, kayıt 2 dakika.

## 1. Hesap aç

1. **https://resend.com/signup** → e-posta veya GitHub ile
2. Onay e-postasını tıkla

## 2. API key oluştur

Dashboard → **API Keys** → **Create API Key**:

- Name: `Bodrum Rezervasyon Production`
- Permission: **Full access** (veya sadece **Sending access**)
- Domain: **All domains**
- Save → key başlangıçtaki kısmı:
  ```
  re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
  ```
  **Bir kez gösterilir**. Kopyala.

## 3. Hızlı başlangıç — test domain

Domain doğrulaması ileride, hemen başlamak için Resend'in test domain'ini kullan:

```
FROM_EMAIL=onboarding@resend.dev
```

Bu adresten **kendi e-posta adresine** mesaj gönderebilirsin (sadece hesap sahibinin adresi). Test için yeter.

## 4. Production — kendi domain'ini ekle

Domain doğrulayınca her adrese gönderebilirsin ve marka adın görünür:

1. Dashboard → **Domains** → **Add Domain** → `bodrumapartkiralama.com`
2. Resend sana 3-4 DNS kaydı verir (SPF, DKIM, return-path)
3. Domain'inin DNS panelinden (Vercel, GoDaddy, Namecheap, vs.) kayıtları ekle
4. Resend ekranında **Verify** → 5-30 dakika içinde yeşil tik
5. Sonra `FROM_EMAIL`'i kendi adresine güncelle:
   ```
   FROM_EMAIL=no-reply@bodrumapartkiralama.com
   ```

## 5. Supabase'e ekle

Dashboard → **Edge Functions** → `notify-new-request` → **Manage Secrets**:

```
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
FROM_EMAIL=onboarding@resend.dev
ADMIN_EMAIL=info@bodrumapartkiralama.com
```

## 6. Test

SQL editor:
```sql
insert into reservation_requests (source_site, guest_name, guest_phone)
values ('test', 'Test Email', '+90 555 555 55 55');
```

`ADMIN_EMAIL` adresine `[Rezervasyon Talebi] test · Test Email` konulu HTML mail düşmeli.

## Sık karşılaşılan sorunlar

**"You can only send testing emails to your own email address"** → `FROM_EMAIL=onboarding@resend.dev` kullanıyorsun ama `ADMIN_EMAIL` Resend hesabının e-postasından farklı. İki seçenek:
- ADMIN_EMAIL'i Resend hesap adresine eşitle
- Veya domain doğrula

**Mail spam'e düşüyor** → Domain verify'sını tamamla (SPF + DKIM Gmail/Outlook için kritik).

**API rate limit (10/sec)** → Free tier sınırı. Webhook'tan birden fazla insert'te problem olursa fonksiyon retry yapar.

## Resend log'ları

Dashboard → **Emails** sekmesinde gönderilen tüm e-mailler, durum (delivered / bounced / complained) ve içerik (HTML preview) görünür. Sorun teşhisi için ideal.
