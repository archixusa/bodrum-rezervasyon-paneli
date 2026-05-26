# Telegram Bot Kurulumu

Yeni rezervasyon istekleri için Telegram'a anlık bildirim göndereceğiz. Free, hızlı, mobil bildirim için ideal.

## 1. Bot oluştur

1. Telegram'da **@BotFather**'a yaz
2. `/newbot` komutu
3. Bot adı: `Bodrum Rezervasyon Bot` (gösterilen ad)
4. Username: `bodrum_rezervasyon_bot` (sonu `_bot` ile bitmeli ve benzersiz olmalı)
5. BotFather sana token verir:
   ```
   123456789:ABCDefGhIJklMnOPqrsTUVwxyz
   ```
   Bu **`TELEGRAM_BOT_TOKEN`** — kaybetme, hesaba erişimdir.

## 2. Bot ile mesajlaş

Botu kişisel hesabından açıp **Start** butonuna bas. Bu, bot'un sana mesaj göndermesini mümkün kılar (Telegram güvenliği için karşılıklı onay şart).

## 3. Chat ID'yi öğren

Tarayıcıda aç (TOKEN'ı kendininkiyle değiştir):

```
https://api.telegram.org/bot123456789:ABCDef.../getUpdates
```

JSON çıktıda:

```json
{
  "result": [{
    "message": {
      "chat": {
        "id": 987654321,   // ← TELEGRAM_CHAT_ID
        "first_name": "Furkan",
        "type": "private"
      }
    }
  }]
}
```

`chat.id` numarasını al — bu **`TELEGRAM_CHAT_ID`**.

## 4. Grup chat (ekip varsa)

Birden fazla kişi bildirim almalıysa:

1. Telegram'da yeni grup aç
2. Bot'u gruba ekle
3. Bot'u admin yap (mesaj atmak için)
4. Gruba bir mesaj yaz, `getUpdates` URL'ini yeniden aç
5. `chat.id` artık negatif bir sayı olur (örn. `-1001234567890`) — bunu kullan

## 5. Supabase'e ekle

Dashboard → **Edge Functions** → `notify-new-request` → **Manage Secrets**:

```
TELEGRAM_BOT_TOKEN=123456789:ABCDef...
TELEGRAM_CHAT_ID=987654321
```

## 6. Test

Supabase SQL Editor:
```sql
insert into reservation_requests (source_site, guest_name, guest_phone)
values ('test', 'Test Bildirim', '+90 555 555 55 55');
```

Telegram'da:

> 🔔 **YENİ REZERVASYON İSTEĞİ**
> Site: test
> Misafir: Test Bildirim (+90 555 555 55 55)
> ...

mesajı düşmeli.

## Sık karşılaşılan sorunlar

**"Forbidden: bot was blocked by the user"** → Bot'u Telegram'da unblock et veya `/start` ile yeniden başlat.

**"Bad Request: chat not found"** → `chat_id` yanlış. `getUpdates`'i tekrar çalıştırıp doğru ID'yi al.

**Mesaj gelmiyor ama log'da hata yok** → Edge Function deploy yapılmamış olabilir:
```bash
supabase functions deploy notify-new-request
```

**Edge Function log'larına bak:**
Dashboard → Edge Functions → `notify-new-request` → Logs
