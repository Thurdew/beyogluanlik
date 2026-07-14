// Beyoğlu mahalle sınırlarını OpenStreetMap'ten (Overpass API) çekip GeoJSON'a çevirir.
// Tek seferlik kullanım: `node scripts/fetch-mahalle.mjs`
// Çıktı: public/data/beyoglu-mahalleler.geojson (FeatureCollection, properties.mahalle_adi, Polygon).
//
// Neden OSM: Türkiye mahalle (admin_level=10) sınırları için ücretsiz, anahtarsız ve
// topluluk-bakımlı tek gerçekçi kaynak. Tek zayıf nokta: kapsama/kıyı hassasiyeti yer yer
// değişebilir — o yüzden çıktı çekildikten sonra görsel olarak doğrulanır.

import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = fileURLToPath(new URL("../public/data/beyoglu-mahalleler.geojson", import.meta.url));
const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.osm.ch/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Beyoğlu ilçe OSM relation id = 1765892 (wikidata Q217411), area id = 3600000000 + rel.
// Türkiye'de mahalle idari sınırları admin_level=8 (ilçe=6); tanılama ile doğrulandı: 45 mahalle.
const BEYOGLU_AREA_ID = 3601765892;
const QUERY = `
[out:json][timeout:120];
(relation["admin_level"="8"]["boundary"="administrative"](area:${BEYOGLU_AREA_ID}););
out geom;
`;

const EPS = 1e-7;
const samePt = (a, b) => Math.abs(a[0] - b[0]) < EPS && Math.abs(a[1] - b[1]) < EPS;
const isClosed = (r) => r.length > 3 && samePt(r[0], r[r.length - 1]);

// Halkasız (uç uca eklenmemiş) way parçalarını kapalı halkalara birleştirir.
function assembleRings(ways) {
  const remaining = ways.map((w) => w.slice()).filter((s) => s.length >= 2);
  const rings = [];
  while (remaining.length) {
    let ring = remaining.shift().slice();
    let extended = true;
    while (extended && !isClosed(ring)) {
      extended = false;
      for (let i = 0; i < remaining.length; i++) {
        const s = remaining[i];
        const rEnd = ring[ring.length - 1];
        const rStart = ring[0];
        if (samePt(rEnd, s[0])) { ring = ring.concat(s.slice(1)); }
        else if (samePt(rEnd, s[s.length - 1])) { ring = ring.concat(s.slice().reverse().slice(1)); }
        else if (samePt(rStart, s[s.length - 1])) { ring = s.slice(0, -1).concat(ring); }
        else if (samePt(rStart, s[0])) { ring = s.slice().reverse().slice(0, -1).concat(ring); }
        else continue;
        remaining.splice(i, 1);
        extended = true;
        break;
      }
    }
    if (!isClosed(ring)) ring.push(ring[0].slice());
    rings.push(ring);
  }
  return rings;
}

// Shoelace (derece cinsinden yaklaşık alan; sadece en büyük halkayı seçmek için).
function ringArea(r) {
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    a += r[j][0] * r[i][1] - r[i][0] * r[j][1];
  }
  return Math.abs(a) / 2;
}

async function overpass() {
  const headers = {
    "Content-Type": "application/x-www-form-urlencoded",
    // Bazı Overpass instance'ları User-Agent'sız isteği 406 ile reddeder.
    "User-Agent": "beyoglu-anlik/1.0 (mahalle sinir cekimi; tasdelengokturk@gmail.com)",
    Accept: "application/json",
  };
  let lastErr;
  for (const url of ENDPOINTS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers,
          body: "data=" + encodeURIComponent(QUERY),
        });
        if (res.status === 429 || res.status === 504) {
          console.warn(`  ! ${url} → ${res.status} (meşgul), ${attempt === 0 ? "5sn bekleyip tekrar" : "atlanıyor"}`);
          if (attempt === 0) { await sleep(5000); continue; }
          break;
        }
        if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
        return await res.json();
      } catch (e) {
        lastErr = e;
        console.warn(`  ! ${url} başarısız: ${e.message}`);
        break;
      }
    }
  }
  throw lastErr;
}

const data = await overpass();
const rels = data.elements.filter((e) => e.type === "relation");
console.log(`Bulunan admin_level=8 (mahalle) relation: ${rels.length}`);

const features = [];
let droppedPieces = 0;
for (const rel of rels) {
  const name = rel.tags?.name;
  if (!name) continue;
  // 'outer' rollü way geometrileri (rol boşsa da dış kabul et).
  const ways = (rel.members || [])
    .filter((m) => m.type === "way" && (m.role === "outer" || m.role === "") && Array.isArray(m.geometry))
    .map((m) => m.geometry.map((p) => [p.lon, p.lat]));
  if (!ways.length) { console.warn(`  ! ${name}: outer way yok, atlandı`); continue; }
  const rings = assembleRings(ways).filter((r) => r.length >= 4);
  if (!rings.length) { console.warn(`  ! ${name}: halka oluşmadı, atlandı`); continue; }
  rings.sort((a, b) => ringArea(b) - ringArea(a));
  if (rings.length > 1) droppedPieces += rings.length - 1;
  features.push({
    type: "Feature",
    properties: { mahalle_adi: name },
    geometry: { type: "Polygon", coordinates: [rings[0]] },
  });
}

if (features.length === 0) {
  console.error("HATA: 0 mahalle çıktı — mevcut dosya korunuyor, üzerine yazılmadı.");
  process.exit(1);
}

features.sort((a, b) => a.properties.mahalle_adi.localeCompare(b.properties.mahalle_adi, "tr"));
console.log(`Yazılan mahalle: ${features.length}${droppedPieces ? ` (kopuk ${droppedPieces} parça en-büyük-halka lehine atıldı)` : ""}`);
console.log("Mahalleler:", features.map((f) => f.properties.mahalle_adi).join(", "));

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify({ type: "FeatureCollection", features }));
console.log(`✓ Yazıldı: ${OUT}`);
