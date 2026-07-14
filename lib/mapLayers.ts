import maplibregl from "maplibre-gl";
import { BEYOGLU_CENTER, BEYOGLU_BOUNDARY } from "./geofence";
import { polygonCentroid, polygonArea, getRingBounds, type Ring } from "./geo";
import { clampInterpolate } from "./scale";

export const MAP_MIN_ZOOM = 12.5;
export const MAP_MAX_ZOOM = 17;

// Saf uydu görüntüsü (Esri World Imagery, raster, API anahtarı gerekmiyor). Genel amaçlı OSM
// vektör stillerinin (ör. "liberty") aksine sokak/POI sembol katmanı ve sprite içermez — bu
// sayede "Image X could not be loaded / styleimagemissing" konsol spam'i tamamen ortadan kalkar.
// Mahalle sınırları ve etiketleri ayrı katmanlar olarak (addDistrictBoundary / loadMahalleLayer)
// bu görüntünün üzerine bindirilir.
export const SATELLITE_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    "esri-world-imagery": {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution: "Esri, Maxar, Earthstar Geographics",
    },
  },
  layers: [
    {
      id: "esri-world-imagery-layer",
      type: "raster",
      source: "esri-world-imagery",
    },
  ],
};

const MAHALLE_GEOJSON_URL = "/data/beyoglu-mahalleler.geojson";
const DISTRICT_LINE_COLOR = "#8B84DE";
const DISTRICT_FILL_COLOR = "#B5B0E8";
const MAHALLE_LINE_COLOR = "#B5B0E8";
const LEADER_LINE_COLOR = "#4b5563";
const SMALL_MAHALLE_AREA_THRESHOLD = 1e-5;
const LEADER_OFFSET_DEG = 0.0028;

// Uzaktan (düşük zoom) bakarken etiketler büyük/belirgin, yaklaştıkça (yüksek zoom) daha
// ince/detaylı hale gelir.
const MAHALLE_FONT_SIZE_FAR = 15;
const MAHALLE_FONT_SIZE_NEAR = 11;
const MAHALLE_PADDING_FAR = "4px 9px";
const MAHALLE_PADDING_NEAR = "3px 7px";

type MahalleFeature = {
  type: "Feature";
  properties: { mahalle_adi: string };
  geometry: { type: "Polygon"; coordinates: number[][][] };
};
type MahalleFeatureCollection = { type: "FeatureCollection"; features: MahalleFeature[] };

export function getBeyogluBounds(): [[number, number], [number, number]] {
  const b = getRingBounds(BEYOGLU_BOUNDARY as Ring);
  return [
    [b.minLng, b.minLat],
    [b.maxLng, b.maxLat],
  ];
}

/** fitBounds/maxBounds için hafif pay bırakılmış (kenarlarda biraz nefes payı olan) sınır kutusu. */
export function getBeyogluMaxBounds(): [[number, number], [number, number]] {
  const b = getRingBounds(BEYOGLU_BOUNDARY as Ring);
  const padLng = (b.maxLng - b.minLng) * 0.25;
  const padLat = (b.maxLat - b.minLat) * 0.25;
  return [
    [b.minLng - padLng, b.minLat - padLat],
    [b.maxLng + padLng, b.maxLat + padLat],
  ];
}

/** İlçe dış sınırını (lavanta, kalın çizgi + hafif dolgu) haritaya ekler. */
export function addDistrictBoundary(map: maplibregl.Map) {
  map.addSource("beyoglu-sinir", {
    type: "geojson",
    data: {
      type: "Feature",
      properties: {},
      geometry: { type: "Polygon", coordinates: [BEYOGLU_BOUNDARY] },
    },
  });
  map.addLayer({
    id: "beyoglu-sinir-fill",
    type: "fill",
    source: "beyoglu-sinir",
    paint: { "fill-color": DISTRICT_FILL_COLOR, "fill-opacity": 0.06 },
  });
  map.addLayer({
    id: "beyoglu-sinir-line",
    type: "line",
    source: "beyoglu-sinir",
    paint: { "line-color": DISTRICT_LINE_COLOR, "line-width": 3.5 },
  });
}

function createMahalleLabelElement(name: string): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText =
    "background:#ffffff; color:#111827; font-weight:700; letter-spacing:0.02em;" +
    " border-radius:6px; box-shadow:0 1px 3px rgba(0,0,0,0.25);" +
    " white-space:nowrap; pointer-events:none; text-transform:uppercase; font-family: sans-serif;" +
    ` font-size:${MAHALLE_FONT_SIZE_FAR}px; padding:${MAHALLE_PADDING_FAR};`;
  el.textContent = name;
  return el;
}

/** Mahalle etiketlerini mevcut zoom seviyesine göre büyütür/küçültür (uzaktan büyük, yakından ince). */
function applyMahalleLabelScale(map: maplibregl.Map, markers: maplibregl.Marker[]) {
  const zoom = map.getZoom();
  const fontSize = clampInterpolate(
    zoom,
    MAP_MIN_ZOOM,
    MAP_MAX_ZOOM,
    MAHALLE_FONT_SIZE_FAR,
    MAHALLE_FONT_SIZE_NEAR,
  );
  const t = clampInterpolate(zoom, MAP_MIN_ZOOM, MAP_MAX_ZOOM, 0, 1);
  const padding = t > 0.5 ? MAHALLE_PADDING_NEAR : MAHALLE_PADDING_FAR;

  for (const marker of markers) {
    const el = marker.getElement();
    el.style.fontSize = `${fontSize}px`;
    el.style.padding = padding;
  }
}

/**
 * Mahalle sınırlarını ve isim etiketlerini yükler. Küçük mahallelerde (poligon alanı eşiğin
 * altındaysa) etiket dışarı taşırılıp merkeze ince bir "leader line" ile bağlanır — referans
 * görseldeki ÇUKUR, KATİP MUSTAFA ÇELEBİ etiketleri gibi. Etiket boyutu zoom seviyesine göre
 * canlı olarak ölçeklenir.
 *
 * Mock veri: public/data/beyoglu-mahalleler.geojson. Gerçek CBS verisi geldiğinde bu dosyanın
 * içeriği (aynı FeatureCollection / mahalle_adi şeması korunarak) değiştirilmesi yeterlidir.
 */
export async function loadMahalleLayer(
  map: maplibregl.Map,
  markers: maplibregl.Marker[],
): Promise<void> {
  const res = await fetch(MAHALLE_GEOJSON_URL);
  const geojson: MahalleFeatureCollection = await res.json();

  map.addSource("mahalleler", { type: "geojson", data: geojson as unknown as GeoJSON.GeoJSON });
  map.addLayer({
    id: "mahalleler-line",
    type: "line",
    source: "mahalleler",
    paint: { "line-color": MAHALLE_LINE_COLOR, "line-width": 1.2 },
  });

  const leaderFeatures: GeoJSON.Feature[] = [];

  for (const feature of geojson.features) {
    const ring = feature.geometry.coordinates[0] as Ring;
    const name = feature.properties?.mahalle_adi ?? "";
    const centroid = polygonCentroid(ring);
    const area = polygonArea(ring);

    let labelPos = centroid;
    if (area < SMALL_MAHALLE_AREA_THRESHOLD) {
      const dx = centroid[0] - BEYOGLU_CENTER[0];
      const dy = centroid[1] - BEYOGLU_CENTER[1];
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      labelPos = [
        centroid[0] + (dx / len) * LEADER_OFFSET_DEG,
        centroid[1] + (dy / len) * LEADER_OFFSET_DEG,
      ];
      leaderFeatures.push({
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: [centroid, labelPos] },
      });
    }

    const marker = new maplibregl.Marker({
      element: createMahalleLabelElement(name),
      anchor: "center",
    })
      .setLngLat(labelPos)
      .addTo(map);
    markers.push(marker);
  }

  if (leaderFeatures.length > 0) {
    map.addSource("mahalle-leader-lines", {
      type: "geojson",
      data: { type: "FeatureCollection", features: leaderFeatures },
    });
    map.addLayer({
      id: "mahalle-leader-lines",
      type: "line",
      source: "mahalle-leader-lines",
      paint: { "line-color": LEADER_LINE_COLOR, "line-width": 1 },
    });
  }

  applyMahalleLabelScale(map, markers);
  map.on("zoom", () => applyMahalleLabelScale(map, markers));
}
