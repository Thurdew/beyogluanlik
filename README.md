# Beyoğlu Anlık (Demo/Prototip)

Beyoğlu Belediyesi için tasarlanan, vatandaş kaynaklı yerel olay paylaşım uygulaması konseptinin
çalışan bir web demosu. Konsept notları için bkz. `CLAUDE.md`.

Bu bir **prototip**tir: gerçek e-Devlet/TC Kimlik veya belediye CRM entegrasyonu yoktur, kimlik ve
ikamet doğrulaması simüle edilmiştir.

## Kurulum

```bash
npm install
npx prisma migrate dev   # veritabanını oluşturur (ilk kurulumda)
npx prisma db seed       # örnek veriyle doldurur
npm run dev
```

Tarayıcıda [http://localhost:3000](http://localhost:3000) adresini açın.

## Nasıl çalışır

- **Giriş (`/giris`):** Herhangi bir ad + 11 haneli (sahte) bir "TC kimlik no" ile giriş yapılır.
  Gerçek bir kimlik sorgusu yapılmaz; aynı numarayla tekrar giriş aynı hesaba döner.
- **Harita (`/`):** Beyoğlu merkezli harita, aktif olay pin'lerini gösterir. Bir pin'e tıklayınca
  detay + "✅ Doğru / ⚠️ Asılsız" oylama butonları açılır.
- **Olay Bildir (`/bildir`):** Kategori seçilir, haritadan konum işaretlenir (Beyoğlu sınırları
  dışına paylaşım yapılamaz), açıklama yazılır. Yangın/kaza gibi kategorilerde paylaşımdan önce
  "112'yi arayın mı?" uyarısı çıkar. Yakın zamanda (30 dk içinde, 150m yakınında) aynı kategoride
  bir bildirim varsa yeni pin açılmaz, mevcut bildirime teyit eklenir.
- **Moderasyon (`/moderasyon`):** Topluluk tarafından yeterince "asılsız" işaretlenen (3+) paylaşımlar
  otomatik olarak incelemeye düşer; buradan onaylanabilir veya kaldırılabilir.
- Paylaşımlar oluşturulduktan 24 saat sonra haritadan otomatik düşer (sorgu zamanında filtrelenir).

## Veritabanını sıfırlama

```bash
rm dev.db
npx prisma migrate dev
npx prisma db seed
```

## Bilinen kısıtlar

- Kimlik/ikamet doğrulama, GPS-spoofing tespiti ve belediye CRM entegrasyonu tamamen simülasyondur.
- Harita `tiles.openfreemap.org` üzerinden ücretsiz vektör tile'lar kullanır (API anahtarı gerekmez).
