import maplibregl from "maplibre-gl";
import polygonClipping, { type Geom } from "polygon-clipping";
import { polygonCentroid, polygonArea, type Ring } from "./geo";
import { clampInterpolate } from "./scale";

// Min zoom = tüm ilçenin (K-G dahil) landscape viewport'a sığdığı taban. maxBounds bunu
// yükseltmesin diye aşağıda bolca genişletildi; yoksa yatay ekranda ilçenin kuzey/güney uçları
// uzaklaştırınca kırpılıyordu.
export const MAP_MIN_ZOOM = 13;
export const MAP_MAX_ZOOM = 17;

const MAHALLE_GEOJSON_URL = "/data/beyoglu-mahalleler.geojson";
const MAHALLE_LINE_COLOR = "#8B84DE";
// Beyoğlu dışını karartan "spotlight" maskesi + net dış sınır çizgisi.
const OUTSIDE_MASK_COLOR = "#0b1020";
const OUTSIDE_MASK_OPACITY = 0.42;
const DISTRICT_LINE_COLOR = "#5b53c9";
const DISTRICT_CASING_COLOR = "#ffffff";
// Maskenin dış halkası: dünya çapı (-180..180) yerine Beyoğlu'yu bolca kapsayan yerel kutu.
// Dev dış halka + çok sayıda delik earcut üçgenlemesini bozuyordu; yerel kutu bunu engeller.
const MASK_BBOX: [number, number][] = [
  [28.8, 40.95],
  [29.15, 40.95],
  [29.15, 41.12],
  [28.8, 41.12],
  [28.8, 40.95],
];
// Mahalle etiketleri uzaklaştıkça küçülür (zoom eşiğiyle kaybolmaz); yaklaştıkça büyür.
// Yoğun merkezde iki etiket fiziksel olarak çakışırsa küçük mahalleninki gizlenir (harita stili),
// yakınlaştıkça çakışma çözülünce geri gelir.
const MAHALLE_FONT_SIZE_FAR = 9;
const MAHALLE_FONT_SIZE_NEAR = 13;
const MAHALLE_PADDING_FAR = "1px 5px";
const MAHALLE_PADDING_NEAR = "3px 7px";
const MAHALLE_PAD_X_FAR = 5;
const MAHALLE_PAD_X_NEAR = 7;
const MAHALLE_PAD_Y_FAR = 1;
const MAHALLE_PAD_Y_NEAR = 3;

// Etiket → mahalle alanı: çakışma çözümünde büyük mahalle önceliklidir.
const labelArea = new WeakMap<maplibregl.Marker, number>();

type MahalleFeature = {
  type: "Feature";
  properties: { mahalle_adi: string };
  geometry: { type: "Polygon"; coordinates: number[][][] };
};
type MahalleFeatureCollection = { type: "FeatureCollection"; features: MahalleFeature[] };

// Beyoğlu ilçesinin GERÇEK kapsama kutusu (public/data/beyoglu-mahalleler.geojson,
// OSM admin_level=8 · 45 mahalle). scripts/fetch-mahalle.mjs çıktısından ölçüldü. Çerçeveleme
// bu extent'e bağlı: kaba el-poligonu doğuya taşıp kuzey/kuzeybatıyı (Sütlüce, Halıcıoğlu)
// kırptığı için tüm ilçe uzaklaştırınca görünmüyordu. Sınır stabil olduğundan sabit tutuldu.
const BEYOGLU_EXTENT = { minLng: 28.939, minLat: 41.0211, maxLng: 28.9958, maxLat: 41.0644 };

export function getBeyogluBounds(): [[number, number], [number, number]] {
  return [
    [BEYOGLU_EXTENT.minLng, BEYOGLU_EXTENT.minLat],
    [BEYOGLU_EXTENT.maxLng, BEYOGLU_EXTENT.maxLat],
  ];
}

/**
 * Panoramayı Beyoğlu civarında tutan sınır kutusu. Yatay viewport, ~kare ilçeyi K-G'de
 * çerçevelerken E-B'de daha geniş alan gösterdiği için lng padding'i cömert tutulur; böylece
 * MAP_MIN_ZOOM'da (13) viewport bu kutunun içinde kalır ve maxBounds effektif min zoom'u
 * yükseltip ilçenin uçlarını kırpmaz. Dış alan zaten maskeyle karartılıyor.
 */
export function getBeyogluMaxBounds(): [[number, number], [number, number]] {
  const padLng = (BEYOGLU_EXTENT.maxLng - BEYOGLU_EXTENT.minLng) * 0.9;
  const padLat = (BEYOGLU_EXTENT.maxLat - BEYOGLU_EXTENT.minLat) * 0.6;
  return [
    [BEYOGLU_EXTENT.minLng - padLng, BEYOGLU_EXTENT.minLat - padLat],
    [BEYOGLU_EXTENT.maxLng + padLng, BEYOGLU_EXTENT.maxLat + padLat],
  ];
}

/** Beyoğlu mahalle poligonlarını içeren geojson'u getirir. */
export async function fetchMahalleGeojson(): Promise<MahalleFeatureCollection> {
  const res = await fetch(MAHALLE_GEOJSON_URL);
  return (await res.json()) as MahalleFeatureCollection;
}

// 27 mahalle poligonunun birleşimi (union) — polygon-clipping ile bir kez hesaplanıp cache'lenir.
// Sonuç MultiPolygon: number[][][][] (poligon[] → halka[] → nokta[] → [lng,lat]).
let cachedUnion: number[][][][] | null = null;
function getBeyogluUnion(geojson: MahalleFeatureCollection): number[][][][] {
  if (cachedUnion) return cachedUnion;
  const polys = geojson.features.map((f) => f.geometry.coordinates) as unknown as Geom[];
  cachedUnion = polygonClipping.union(
    polys[0],
    ...polys.slice(1),
  ) as unknown as number[][][][];
  return cachedUnion;
}

/**
 * Bölge katmanları — ana harita ve konum seçici tarafından paylaşılır:
 *  1) "Spotlight" maskesi: mahalle union'ının dış halkaları yerel bir kutuya delik olarak açılır →
 *     Beyoğlu aydınlık, dışı kararık; kenar tam ilçe sınırına oturur. Union tek/az sayıda temiz
 *     halka verdiği için (komşu poligonlar birleşti) earcut bozulması olmaz.
 *  2) Net dış sınır çizgisi (beyaz halo + mor çizgi).
 *  3) İnce, soluk mahalle sınır çizgileri.
 */
export function addBeyogluRegionLayers(map: maplibregl.Map, geojson: MahalleFeatureCollection) {
  const union = getBeyogluUnion(geojson);
  const outerRings = union.map((poly) => poly[0]);

  // 1) Karartma maskesi
  map.addSource("beyoglu-mask", {
    type: "geojson",
    data: {
      type: "Feature",
      properties: {},
      geometry: { type: "Polygon", coordinates: [MASK_BBOX, ...outerRings] },
    },
  });
  map.addLayer({
    id: "beyoglu-mask",
    type: "fill",
    source: "beyoglu-mask",
    paint: { "fill-color": OUTSIDE_MASK_COLOR, "fill-opacity": OUTSIDE_MASK_OPACITY },
  });

  // 2) İlçe dış sınırı (union) — beyaz halo + mor çizgi
  map.addSource("beyoglu-sinir", {
    type: "geojson",
    data: {
      type: "Feature",
      properties: {},
      geometry: { type: "MultiPolygon", coordinates: union },
    },
  });
  map.addLayer({
    id: "beyoglu-sinir-halo",
    type: "line",
    source: "beyoglu-sinir",
    layout: { "line-join": "round" },
    paint: {
      "line-color": DISTRICT_CASING_COLOR,
      "line-width": 4,
      "line-opacity": 0.7,
      "line-blur": 1,
    },
  });
  map.addLayer({
    id: "beyoglu-sinir-line",
    type: "line",
    source: "beyoglu-sinir",
    layout: { "line-join": "round" },
    paint: { "line-color": DISTRICT_LINE_COLOR, "line-width": 2.4 },
  });

  // 3) İç mahalle sınırları (ince, soluk)
  map.addSource("mahalleler", { type: "geojson", data: geojson as unknown as GeoJSON.GeoJSON });
  map.addLayer({
    id: "mahalleler-line",
    type: "line",
    source: "mahalleler",
    paint: { "line-color": MAHALLE_LINE_COLOR, "line-width": 0.8, "line-opacity": 0.45 },
  });
}

function createMahalleLabelElement(name: string): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText =
    "background:rgba(255,255,255,0.92); color:#374151; font-weight:600; letter-spacing:0.02em;" +
    " border-radius:5px; box-shadow:0 1px 2px rgba(0,0,0,0.18);" +
    " white-space:nowrap; pointer-events:none; text-transform:uppercase; font-family: sans-serif;" +
    ` font-size:${MAHALLE_FONT_SIZE_FAR}px; padding:${MAHALLE_PADDING_FAR};`;
  el.textContent = name;
  return el;
}

/**
 * Etiketleri zoom'a göre ölçekler ve çakışmayı çözer: font uzakta küçük / yakında büyük.
 * İki etiket kutusu ekranda çakışırsa büyük mahalleninki kalır, küçük mahalleninki gizlenir;
 * yakınlaştıkça çakışma çözülünce gizlenenler geri gelir. Kutu genişliği analitik tahmin edilir
 * (metin uzunluğu × font), böylece her kare reflow tetiklemeden çalışır.
 */
function applyMahalleLabelScale(map: maplibregl.Map, markers: maplibregl.Marker[]) {
  const zoom = map.getZoom();
  const fontSize = clampInterpolate(zoom, MAP_MIN_ZOOM, MAP_MAX_ZOOM, MAHALLE_FONT_SIZE_FAR, MAHALLE_FONT_SIZE_NEAR);
  const near = clampInterpolate(zoom, MAP_MIN_ZOOM, MAP_MAX_ZOOM, 0, 1) > 0.5;
  const padding = near ? MAHALLE_PADDING_NEAR : MAHALLE_PADDING_FAR;
  const padX = near ? MAHALLE_PAD_X_NEAR : MAHALLE_PAD_X_FAR;
  const padY = near ? MAHALLE_PAD_Y_NEAR : MAHALLE_PAD_Y_FAR;

  const GAP = 3; // korunan etiketler arasında en az bu kadar boşluk kalsın
  const boxes = markers.map((marker) => {
    const el = marker.getElement();
    el.style.fontSize = `${fontSize}px`;
    el.style.padding = padding;
    const p = map.project(marker.getLngLat());
    const text = el.textContent ?? "";
    const w = text.length * fontSize * 0.62 + padX * 2 + GAP * 2; // büyük harf ort. ~0.62em
    const h = fontSize * 1.2 + padY * 2 + GAP * 2;
    return { el, l: p.x - w / 2, r: p.x + w / 2, t: p.y - h / 2, b: p.y + h / 2, area: labelArea.get(marker) ?? 0 };
  });

  // Büyük mahalle önce yerleşir; sonrakiler çakışırsa gizlenir.
  boxes.sort((a, b) => b.area - a.area);
  const placed: { l: number; r: number; t: number; b: number }[] = [];
  for (const bx of boxes) {
    const hit = placed.some((q) => bx.l < q.r && bx.r > q.l && bx.t < q.b && bx.b > q.t);
    if (hit) {
      bx.el.style.display = "none";
    } else {
      bx.el.style.display = "";
      placed.push(bx);
    }
  }
}

/**
 * Mahalle sınırlarını ve isim etiketlerini yükler. Her etiket mahallesinin merkezine (centroid)
 * konur; boyut zoom'a göre ölçeklenir ve çakışan etiketler harita stiliyle gizlenir
 * (bkz. applyMahalleLabelScale). Pan/zoom sırasında çakışma yeniden hesaplanır.
 *
 * Veri: public/data/beyoglu-mahalleler.geojson (OSM admin_level=8, 45 mahalle;
 * scripts/fetch-mahalle.mjs ile üretilir). Aynı FeatureCollection / mahalle_adi / Polygon şeması
 * korundukça veri güncellenebilir.
 */
export async function loadMahalleLayer(
  map: maplibregl.Map,
  markers: maplibregl.Marker[],
): Promise<void> {
  const geojson = await fetchMahalleGeojson();
  addBeyogluRegionLayers(map, geojson);

  for (const feature of geojson.features) {
    const ring = feature.geometry.coordinates[0] as Ring;
    const name = feature.properties?.mahalle_adi ?? "";
    const marker = new maplibregl.Marker({
      element: createMahalleLabelElement(name),
      anchor: "center",
    })
      .setLngLat(polygonCentroid(ring))
      .addTo(map);
    labelArea.set(marker, polygonArea(ring));
    markers.push(marker);
  }

  applyMahalleLabelScale(map, markers);
  // 'move' hem pan hem zoom'u kapsar → çakışma her ikisinde de yeniden çözülür.
  map.on("move", () => applyMahalleLabelScale(map, markers));
}
