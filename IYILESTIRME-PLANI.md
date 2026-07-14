# Beyoğlu Anlık — İyileştirme Planı (Bug + Özellik Yol Haritası)

> **Kapsam:** prototip cilası. Gerçek KYC/e-Devlet, belediye CRM entegrasyonu, push bildirim, nesne
> depolama (S3) gibi büyük entegrasyonlar bu listede değil — en altta **Production vizyonu** olarak
> faz faz ayrıldı.
>
> **Denetim başlıkları:** UX & Tasarım · Frontend/UI · Backend · Güvenlik · Performans · Test &
> Doğrulama · Yasal (KVKK).
>
> **Yöntem:** `proje-checklist` + `ui-ux-pro-max` skill çerçeveleri; tüm kaynak kod taraması +
> `npm run lint` + `tsc --noEmit` + `npm test` kapıları + `chrome-devtools` MCP ile görsel doğrulama.
>
> **Etiketler:** 🟢 Hızlı kazanım (düşük risk) · 🟠 Onay/tasarım gerekir · 🔵 Not / kapsam dışı
> **Durum:** ✅ yapıldı · 🟡 kısmî · ⬜ yapılmadı · ⏭️ bilinçli ertelendi

---

## 0. Özet Durum

| Kategori | Toplam | ✅ | 🟡 | ⬜ / ⏭️ |
|---|---|---|---|---|
| Bug (B1–B14) | 14 | 10 | 0 | 4 |
| Özellik (F1–F15) | 15 | 10 | 1 | 4 |

**Kalan kritik iş (gerçek yayın öncesi):** B1 oturum imzalama · B2 moderatör sırrı env'e · B5 login
rate-limit. **Kalan UX/yasal:** B13, F7, F9, F10, F14 (aydınlatma/rıza).

---

## 1. BUG'LAR

### 1.1 Güvenlik & KVKK

| # | Önem | Bulgu | Konum | Çözüm | Etiket | Durum |
|---|------|-------|-------|-------|--------|-------|
| B1 | 🔴 Kritik | **Oturum cookie'si imzasız ham `userId`.** Herhangi biri `beyoglu_session` cookie'sini başka bir kullanıcının id'sine set ederek o kişi gibi oturum açabilir (session forgery). | `lib/session.ts` | İmzalı/şifreli oturum (HMAC imza veya `iron-session`/JWT). | 🟠 | ⬜ |
| B2 | 🔴 Kritik | **Moderatör kimlik bilgileri kaynak kodda sabit ve public repo'da commit'li** (`Thurdew` / `19031903190`) — git geçmişinde de var. | `lib/moderatorSession.ts` | Env değişkenine taşı + hash'le. (Git geçmişini temizlemek ayrı iş.) | 🟠 | ⬜ |
| B3 | 🟠 Yüksek | **SVG upload → stored XSS.** `image/svg+xml` aynı origin'den servis edildiğinde script çalıştırabilir. | `app/bildir/actions.ts` | MIME beyaz listesi (jpg/png/webp); SVG'yi reddet. | 🟢 | ✅ |
| B4 | 🟠 Yüksek | **`public/uploads/` gitignore'da değil** → kullanıcı fotoğrafları repoya commit'leniyor (KVKK). | `.gitignore` | `public/uploads/` ekle + mevcutları untrack et. | 🟢 | ✅ |
| B5 | 🟡 Orta | **Moderatör login'de rate-limit yok**, düz metin karşılaştırma → brute-force'a açık. | `app/moderasyon/actions.ts` | Rate limit + sabit-zaman karşılaştırma. | 🟠 | ⬜ |

**Bekleyen kalemler için detay:**

- **B1 — Oturum imzalama.** *Kabul kriteri:* Cookie değeri elle değiştirilince oturum geçersiz sayılmalı (imza doğrulaması başarısız → 401/anonim). *Uygulama notu:* `iron-session` (şifreli, en az kod) veya HMAC-imzalı `userId.timestamp.sig` formatı; `SESSION_SECRET` env'den. Süre sonu (TTL) + yenileme eklenebilir. *Risk:* Mevcut oturumlar geçersizleşir (kabul edilebilir). *Bağımlılık:* B2 ile birlikte "auth sertleştirme" başlığı altında yapılmalı.
- **B2 — Moderatör sırrı env'e.** *Kabul kriteri:* Kaynak kodda düz metin parola kalmamalı; `MODERATOR_USER` + `MODERATOR_PASS_HASH` env'den okunmalı; `bcryptjs` ile hash karşılaştırması. *Not:* Sır zaten public repo geçmişinde olduğu için parola **döndürülmeli**; git geçmişi temizliği (filter-repo/BFG) ayrı, opsiyonel iş.
- **B5 — Moderatör rate-limit.** *Kabul kriteri:* IP/oturum başına N başarısız denemeden sonra geçici kilit; `bcrypt.compare` zaten sabit-zamanlı. *Uygulama notu:* Prototipte in-memory sayaç yeterli; production'da Redis/DB tabanlı. B1/B2 ile aynı PR'da.

### 1.2 Correctness / Backend

| # | Önem | Bulgu | Konum | Çözüm | Etiket | Durum |
|---|------|-------|-------|-------|--------|-------|
| B6 | 🟠 Yüksek | **trustScore çift/tekrar artışı** — aynı raporu tekrar TRUE oylayarak puan şişirme. | `app/actions.ts` | Puanı yalnızca oy ilk kez TRUE'ya geçtiğinde artır; oy geri alma/değiştirmede simetrik azalt. | 🟢 | ✅ |
| B7 | 🟡 Orta | **Eczane API'si HomePage'i çökertebilir** (`res.json()` try/catch dışı). | `lib/pharmacies.ts` | `.json()`'ı sarmala, hata → `[]`. | 🟢 | ✅ |
| B8 | 🟡 Orta | **Geofence gerçek sınıra uymuyor** — kaba 10-noktalı el poligonu. | `lib/geofence.ts`, `lib/geofenceServer.ts` | Paylaşım anı doğrulaması gerçek mahalle poligonlarına bağlandı (`isWithinBeyogluStrict`). | 🟠 | ✅ |
| B9 | 🟢 Düşük | `reportId` doğrulanmadan `comment.create`/`confirmation.upsert` → geçersiz id'de 500. Yorum uzunluk limiti yok. | `app/actions.ts` | reportId doğrula; `text` için 1000 karakter üst sınır. | 🟢 | ✅ |
| B10 | 🟢 Düşük | Moderasyonda `?durum=FOO` geçersiz enum → Prisma 500. | `app/(admin)/moderasyon/page.tsx` | Enum beyaz listesine karşı doğrula. | 🟢 | ✅ |

### 1.3 Frontend / React / Build kapısı

| # | Önem | Bulgu | Konum | Çözüm | Etiket | Durum |
|---|------|-------|-------|-------|--------|-------|
| B11 | 🟠 Yüksek | **`npm run lint` 2 hata ile kırılıyor** (CI blocker): render'da ref'e yazma + effect'te senkron setState. | `LocationPicker.tsx`, `ReportDetailModal.tsx` | Ref güncellemesini effect'e taşı; effect'i cancel-guard'lı yap. | 🟢 | ✅ |
| B12 | 🟡 Orta | **Geist fontu boşuna yükleniyor** — `globals.css` Arial ile eziyor. | `app/globals.css` | body'yi `var(--font-geist-sans)`'a bağla. | 🟢 | ✅ |

### 1.4 UX bug'ları

| # | Önem | Bulgu | Konum | Çözüm | Etiket | Durum |
|---|------|-------|-------|-------|--------|-------|
| B13 | 🟢 Düşük | `useMyLocation` geolocation hata callback'i yok; Beyoğlu dışına düşerse anlık uyarı yok. | `LocationPicker.tsx` | Hata callback'i + anlık "Beyoğlu dışında" uyarısı (F7 ile). | 🟢 | ⬜ |
| B14 | 🟢 Düşük | Kullanıcının oyu belli değil; iki buton hep aktif, kendi raporuna oy verilebilir. | `ReportDetailModal.tsx` | Mevcut oyu işaretle; kendi raporunda gizle. | 🟠 | ✅ (F5 ile) |

- **B13 — Geolocation hata + anlık geofence.** *Kabul kriteri:* Kullanıcı konum iznini reddederse görünür bir mesaj; harita üzerinde seçilen konum Beyoğlu dışındaysa **submit'e gerek kalmadan** canlı uyarı. *Bağımlılık:* F7 ile aynı iş.

---

## 2. ÖZELLİKLER / İYİLEŞTİRMELER

### 2.1 Görsel / Estetik

| # | Öneri | Etiket | Durum |
|---|-------|--------|-------|
| F1 | **Emoji → tutarlı SVG ikon sistemi.** Lucide path'leri `components/icons.tsx`'e gömüldü (runtime bağımlılık yok); kategori ikonları + eczane + oy + form hepsi tek kaynaktan. `ui-ux-pro-max` "emoji as icon kullanma" kuralı. | 🟠 | ✅ |
| F2 | **Bölge/Beyoğlu sınırı — precise + estetik.** (a) Sınır gerçek OSM verisinden (admin_level=8, 45 mahalle) union ile çiziliyor. (b) Dış alan karartma maskesi (spotlight). (c) Beyaz halo + mor dış çizgi. (d) Geofence aynı poligona bağlı. (e) Mahalle etiketleri zoom'la küçülür, çakışanlar harita stiliyle gizlenir (büyük mahalle öncelikli). (f) Event pin ucu tam koordinata oturur. (g) Çerçeveleme gerçek ilçe extent'ine bağlı — uzaklaştırınca tüm ilçe görünür. | 🟠 | ✅ |
| F15 | **Pin kümeleme (clustering).** Native MapLibre; uzaklaşınca "+N" küme, yaklaşınca dağılır. | 🟠 | ✅ |
| F4 | **Kategori filtresi + lejant.** Sol-üstte katlanabilir panel (renkli ikon + eye toggle + "Tümünü göster" + eczane lejantı); kategori kapatınca pin'ler kaynaktan düşer, kümeler yeniden hesaplanır. | 🟠 | ✅ |
| F11 | Kullanılmayan Next.js şablon SVG'lerini sil. | 🟢 | ✅ |
| F3 | Kategori renklerini **design token**'a çek; opsiyonel **dark mode**. | 🟠 | ⏭️ |

- **F3 — Design token + dark mode.** *Bilinçli ertelendi.* *Neden:* Harita (OpenFreeMap "liberty") açık temalı; tutarlı dark mode haritayı da koyu bir tile stiline geçirmeyi (harici bağımlılık + görsel doğrulama yükü) gerektirir. *Kabul kriteri (ileride):* `prefers-color-scheme` + manuel toggle; kategori renkleri CSS custom property; UI ve harita birlikte koyu. *Ön adım (düşük risk):* Renkleri `:root` değişkenlerine taşımak dark mode'dan bağımsız yapılabilir.

### 2.2 UX akışı

| # | Öneri | Etiket | Durum |
|---|-------|--------|-------|
| F5 | **Kullanıcı kendi oyunu görsün + geri alsın.** Mevcut oy vurgulanır (dolu yeşil/kırmızı + `aria-pressed`); aynı oya tekrar dokununca geri alınır (server toggle + simetrik trustScore); kendi paylaşımında butonlar gizli + "Bu senin paylaşımın" (B14). | 🟠 | ✅ |
| F6 | **Boş durum mesajı.** Görünür olay 0 olunca üst-ortada pill (hiç olay yok / seçili türlerde yok). | 🟢 | ✅ |
| F8 | Modal **skeleton** (animate-pulse; layout sıçraması yok). | 🟢 | ✅ |
| F7 | Konum seçerken **canlı "Beyoğlu içinde/dışında"** göstergesi. | 🟠 | ⬜ |
| F9 | **Erişilebilirlik**: harita marker'larına `aria-label`/klavye; ikon-only butonlara metin etiketi. | 🟠 | ⬜ |
| F10 | **Mobil menüye** `/bildir` ve `/moderasyon` bağlantıları. | 🟢 | ⬜ |

- **F7 — Canlı geofence göstergesi.** *Kabul kriteri:* `LocationPicker`'da marker her taşındığında, seçili konum Beyoğlu içindeyse yeşil "✓ Beyoğlu içinde", dışındaysa kırmızı "Beyoğlu dışında" rozeti; submit butonu dışarıdayken pasif. *Uygulama notu:* İstemci tarafı ön kontrol için `isWithinBeyoglu` (kaba) yeterli; asıl doğrulama sunucuda `isWithinBeyogluStrict` ile kalır. B13 ile aynı PR.
- **F9 — Erişilebilirlik.** *Kabul kriteri:* Tüm ikon-only butonlarda `aria-label`; harita pin'lerine klavye erişimi/aria; renkle taşınan bilgi (kategori) ikon+metinle de verilsin (kısmen var); kontrast AA (4.5:1). *Not:* Lejant/oy/filtre butonlarında `aria-pressed`/`aria-label` kısmen eklendi; harita katmanı klavye erişimi eksik.
- **F10 — Mobil menü.** *Kabul kriteri:* `MobileNavbar`'da logo+çıkış yanında `/bildir` ve (moderatörse) `/moderasyon` linkleri; 44px dokunma hedefi.

### 2.3 Sorumlu tasarım & yasal

| # | Öneri | Etiket | Durum |
|---|-------|--------|-------|
| — | **112 acil durum yönlendirmesi.** Yangın/kaza kategorisinde submit'te "112'yi Ara" modalı (mevcuttu) + formda seçim anında **pasif inline uyarı** eklendi. | 🟢 | ✅ |
| F14 | **KVKK metinleri.** Her paylaşımda "vatandaş bildirimidir, doğrulanmamıştır" ibaresi (modal'a eklendi ✅). Giriş/paylaşımda **aydınlatma + kısa rıza** metinleri ⬜. | 🟠 | 🟡 |
| F12 | **Test altyapısı.** Vitest kuruldu + `test`/`test:watch`; `lib/*.test.ts` (scale/distance/geo/geofence) — 17 test geçiyor. | 🟠 | ✅ |
| F13 | **`.env.example`** eklendi (`DATABASE_URL`, `COLLECTAPI_KEY`). | 🟢 | ✅ |

- **F14 — Aydınlatma + rıza (kalan).** *Kabul kriteri:* İlk girişte/ilk paylaşımda KVKK aydınlatma metni + açık rıza onayı (checkbox); saklama süresi/amacı belirtilmeli. *Not:* Hukuki metin içeriği belediye/hukuk biriminden gelmeli; buradaki iş yer tutucu + akış.
- **F12 — Test kapsamı (genişletme).** *Sıradaki:* `submitReport` duplicate/rate-limit ve `confirmReportAction` trustScore akışları Prisma mock'u (ör. `vitest` + in-memory adapter veya repository soyutlaması) ister; ayrı PR. Kritik saf yardımcılar (geofence/distance/geo/scale) kapsandı.

---

## 3. Bu oturumda tamamlananlar (changelog)

**Harita & sınır (F2/F15/B8):** OSM `admin_level=8` verisiyle 45 mahalle precise sınır (`scripts/fetch-mahalle.mjs`) · union tabanlı dış-karartma maskesi + ilçe dış çizgisi · native clustering · zoom'la küçülen + çakışma-gizlemeli mahalle etiketleri · pin ucu koordinat hizası · çerçeveleme gerçek extent'e bağlı (tüm ilçe görünür) · paylaşım anı geofence gerçek poligona (`lib/geofenceServer.ts`).

**İkonlar (F1):** Emoji → gömülü Lucide SVG seti (`components/icons.tsx`), tek kaynak.

**UX (F4/F5/F6/F8/B14):** Kategori filtresi + lejant paneli (`components/MapLegend.tsx`) · oy görünürlüğü/geri alma + kendi-raporu gizleme · boş durum pill'i · modal skeleton.

**Sorumlu tasarım:** Formda pasif 112 uyarısı · modal'da "vatandaş bildirimidir" sorumluluk reddi.

**Backend/güvenlik (B3/B6/B7/B9/B10):** SVG upload reddi · trustScore simetrik/tek-artış · eczane API try/catch · reportId + yorum uzunluğu doğrulama · moderasyon enum doğrulama.

**Altyapı (F11/F12/F13/B4/B12):** Şablon SVG temizliği · Vitest + 17 test · `.env.example` · `public/uploads` untrack + gitignore · font düzeltmesi.

**Kalite kapıları:** `tsc --noEmit` temiz · `npm run lint` temiz · `npm test` 17/17 · tüm görsel değişiklikler `chrome-devtools` MCP ile doğrulandı.

---

## 4. Production vizyonu (kapsam dışı — faz faz) 🔵

`CLAUDE.md`'deki büyük hedefler prototip-cila listesinde değil. Fazlara ayrılmış hâli:

**Faz 1 — Pilot altyapı (MVP → gerçeğe ilk adım)**
- Gerçek TC Kimlik / e-Devlet KYC (tek seferlik) + belediye CRM ile ikamet eşleştirme (API).
- Oturum & moderatör auth sertleştirme (B1/B2/B5) — pilottan önce şart.
- Nesne depolama: fotoğraflar yerel diske değil S3/uyumlu store'a (serverless'ta yerel disk kalıcı değil).
- KVKK aydınlatma + açık rıza + saklama politikası (F14) — hukuk onaylı.

**Faz 2 — Topluluk & güven**
- Güven puanı kademeleri / rozetler; gönüllü "yerel muhabir" moderasyon yetkisi.
- Otomatik içerik moderasyonu (metin/görsel) + insan inceleme kuyruğu.
- GPS anti-spoofing (mock konum tespiti) — paylaşım anı konum doğrulamasını güçlendir.
- Push bildirim servisi (yakın/teyitli olaylar).

**Faz 3 — Ölçek & entegrasyon**
- Tüm Beyoğlu'na yayılım; belediye app'ine modül olarak tam entegrasyon.
- Olay birleştirme/analitik panosu; performans (tile/CDN, sorgu indeksleri, sanallaştırma).

---

## 5. Önerilen uygulama sırası (kalanlar)

1. **Güvenlik sertleştirme (aynı PR):** B1 oturum imzalama → B2 moderatör env + parola döndürme → B5 rate-limit. *Gerçek yayına çıkmadan önce şart.*
2. **UX tamamlama:** F7 + B13 (canlı geofence + geolocation hata) → F10 (mobil menü) → F9 (erişilebilirlik geçişi).
3. **Yasal:** F14 aydınlatma + rıza metinleri (hukuk onaylı içerikle).
4. **İsteğe bağlı:** F3 design token (dark mode'suz ön adım) · F12 test kapsamını Prisma akışlarına genişletme.

---

## 6. Açık kararlar / riskler

- **Görüntüleme herkese açık mı?** İçeriği görme herkese mi, yalnız doğrulanmış kullanıcıya mı — ürün kararı bekliyor.
- **Ayrı app mı, modül mü?** CRM entegrasyon yüzeyini belirler.
- **Mahalle sınır verisi kaynağı:** Şu an OSM (topluluk-bakımlı). Resmi CBS verisi gelirse aynı şema (`FeatureCollection`/`mahalle_adi`/`Polygon`) korunarak `public/data/beyoglu-mahalleler.geojson` değiştirilir; `scripts/fetch-mahalle.mjs` yeniden üretim için referans.
- **Dark mode ↔ harita stili** uyumu (F3): tutarlılık için koyu harita stili gerekir.
