# Beyoğlu Anlık — Proje Notları

Bu dosya, Beyoğlu Belediyesi bünyesinde geliştirilmesi planlanan yerel haber/olay paylaşım uygulamasının konsept notlarını içerir. Gelecekteki geliştirme oturumlarında bağlam olarak kullanılmak üzere hazırlanmıştır.

## Proje Özeti

Beyoğlu haritası üzerinde, bölgede yaşanan anlık olayları vatandaşların paylaşabildiği bir yerel haber/gözlem platformu. Amaç acil durum ihbarı (112/itfaiye/polis) değil; bölgede olup biteni merak eden vatandaşlar için "herkesin muhabir olduğu" bir yerel gazetecilik deneyimi.

Belediyenin mevcut uygulaması ve CRM sistemine entegre şekilde ya da onun bir modülü olarak konumlandırılıyor.

## Amaç / Konumlandırma

- Acil durum ihbar kanalı DEĞİL — 112, itfaiye, zabıta gibi resmi ihbar hatlarının yerini almıyor.
- Bölgesel farkındalık ve bilgilendirme aracı: "şurada ne oluyor" sorusuna cevap.
- Vatandaş kaynaklı içerik, editoryal doğrulama katmanıyla desteklenir.

## Hedef Kullanıcı

Beyoğlu'nda ikamet eden, belediye CRM/app sistemine kayıtlı vatandaşlar. Paylaşım yapma yetkisi ikamet doğrulamasından geçen kullanıcılarla sınırlı; içeriği görüntüleme herkese açık olabilir (tartışılacak).

## Temel Özellikler

- Harita üzerinde kategori bazlı olay pin'leri (yangın, trafik, etkinlik, gürültü, vb.)
- Konum + kategori + kısa açıklama + foto/video ile paylaşım
- Yakın çevredeki teyitli/popüler olaylar için push bildirim
- Kullanıcı profili, geçmiş paylaşımlar, güven puanı

## Doğrulama Mekanizmaları

**Kimlik / ikamet doğrulama**
Kullanıcı TC kimlik ile giriş yapar; sistem belediyenin elindeki mevcut kayıtlarla (emlak vergisi, su aboneliği, nüfus/adres kaydı vb.) eşleştirip "Beyoğlu sakini" onayı verir. Tek seferlik KYC adımı — kendi beyanına dayalı adres girişinden çok daha güvenilir.

**Konum doğrulama (paylaşım anı)**
İkamet doğrulamasından ayrı bir kontrol: paylaşım yapılırken GPS ile Beyoğlu sınırları içinde olunduğu teyit edilir (geofence), sahte konum (mock GPS) tespiti için temel anti-spoofing kontrolleri eklenir. İkamet + anlık konum ikisi birlikte gerekli.

**Güven puanı / kullanıcı seviyesi**
Yeni hesaplar düşük görünürlükle başlar. Doğru çıkan paylaşımlar puan kazandırır, topluluk tarafından "yanlış/asılsız" işaretlenen içerik otomatik gizlenip incelemeye düşer. İleri aşamada "güvenilir yerel muhabir" rozeti/kademesi düşünülebilir — gönüllü, yüksek puanlı kullanıcılara hafif moderatör yetkisi.

**Moderasyon**
Otomatik içerik kontrolü (metin/görsel) + topluluk flagging + insan incelemesi (bilgi işlem/ilgili birim). Moderasyon iş yükü MVP kapsamı belirlerken göz önünde bulundurulmalı.

**Spam / kötüye kullanım engelleme**
Kullanıcı başına zaman aralıklı paylaşım limiti (rate limiting) — kısa sürede çok sayıda paylaşım yapan hesaplar otomatik kısıtlanır/incelemeye düşer. Amaç hem spam'i hem de taşkın/koordineli yanlış bilgi paylaşımını (brigading) engellemek.

## Olay Birleştirme (Duplicate Detection)

Aynı olay için farklı kullanıcılardan gelen paylaşımlar (yakın konum + zaman + kategori) haritada ayrı pin'ler olarak değil, tek bir "doğrulanmış olay" altında birleştirilir; her yeni bildirim mevcut olayın teyit sayısını artırır. Bu hem harita kirliliğini önler hem de çoklu bildirim alan olayların güvenilirliğini görünür kılar.

## Acil Durum Yönlendirmesi

Paylaşım anında kategori/içerik hayati risk taşıyabilecek türdeyse (yangın, ciddi kaza vb.), kullanıcıya paylaşımdan önce "Bu hayati bir tehlike mi? 112'yi arayın" uyarısı ve doğrudan arama kısayolu gösterilir. Uygulama üzerinden yapılan paylaşım hiçbir zaman resmi ihbarın yerine geçmez; bu yönlendirme pasif bir sorumluluk reddinden daha aktif bir önlemdir.

## İçerik Yaşam Döngüsü

Paylaşımlar belirli bir süre sonra (öneri: 12–24 saat) otomatik arşivlenir/haritadan kalkar — güncellik korunur, eski/yanlış bilginin kalıcı görünür kalması önlenir.

## Hukuki / KVKK

- TC kimlik + konum + kullanıcı içeriği toplandığı için aydınlatma metni ve açık rıza şart.
- Her paylaşımda sorumluluk reddi ibaresi: "Bu bir vatandaş bildirimidir, belediye tarafından doğrulanmamıştır."
- Kullanım sözleşmesi: hakaret, nefret söylemi, kişisel veri ifşası vb. için hesap askıya alma mekanizması.
- Arşivlenen paylaşımların akıbeti netleşmeli: harita üzerinden kalkması veri tabanından silinmesi anlamına gelmiyor. Moderasyon/hukuki itiraz süreçleri için saklama süresi ve amacı KVKK aydınlatma metninde ayrıca belirtilmeli.

## Belediye CRM / App Entegrasyonu

- Mevcut belediye uygulamasına modül olarak mı, yoksa bağımsız app olarak mı sunulacağı açık soru.
- Kimlik/ikamet doğrulama için CRM'deki vatandaş verileriyle API üzerinden entegrasyon gerekli.

## Teknik Yığın (öneri, netleşmedi)

- Harita: Mapbox veya Google Maps
- Mobil: iOS/Android (React Native / Flutter — tartışılacak)
- Backend: CRM ile API entegrasyonu, moderasyon paneli
- Bildirim: Push notification servisi

## Yol Haritası

1. **Faz 1 (MVP):** Pilot bölgede (1-2 mahalle), temel özellik seti — paylaşım, harita, ikamet+konum doğrulama, temel moderasyon.
2. **Faz 2:** Güven puanı sistemi, topluluk flagging, gönüllü yerel muhabir modeli.
3. **Faz 3:** Tüm Beyoğlu'na yayılım, CRM ile tam entegrasyon.

## Açık Sorular

- İçeriği görüntüleme herkese mi açık olacak, yoksa sadece doğrulanmış kullanıcılara mı?
- Moderasyon ekibi kimlerden oluşacak, kaç kişilik olacak?
- Ayrı app mı, mevcut app'e modül mü?
- Teknik yığın kesinleşmedi.

## Referans / Benzer Uygulamalar

- **Citizen** (ABD) — anlık güvenlik olayları, harita üzerinde
- **Waze** — kullanıcı kaynaklı trafik olayları
- **FixMyStreet** (İngiltere) — altyapı şikayeti, harita bazlı
- **Nextdoor** — mahalle bazlı sosyal paylaşım
