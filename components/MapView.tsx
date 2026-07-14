"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import { BEYOGLU_CENTER } from "@/lib/geofence";
import { CATEGORIES } from "@/lib/categories";
import type { MapReport } from "@/lib/reports";
import type { DutyPharmacy } from "@/lib/pharmacies";
import { iconInner, iconSvgMarkup, Icon } from "./icons";
import { MapLegend } from "./MapLegend";
import {
  loadMahalleLayer,
  getBeyogluBounds,
  getBeyogluMaxBounds,
  MAP_MIN_ZOOM,
  MAP_MAX_ZOOM,
} from "@/lib/mapLayers";

type MapContainer = HTMLDivElement & { __maplibreMap?: maplibregl.Map };

// Nöbetçi eczaneler resmi/statik bir katman olduğu için DOM marker olarak, sabit boyutta gösterilir.
const PHARMACY_PIN_SIZE = 40;
const PHARMACY_COLOR = "#16a34a";

// Olay pin'leri: kümeleme (clustering) için GeoJSON symbol layer kullanılır; kategori teardrop'ları
// harita görseline (map image) rasterize edilir. 2x pixelRatio ile keskin kalır.
const PIN_IMG_W = 80;
const PIN_IMG_H = 90;
const CLUSTER_COLOR = "#2563eb";

// Kategori renginde damla (teardrop) + içinde beyaz Lucide glyph. DOM (innerHTML) için.
function pinMarkup(color: string, iconName: string): string {
  return `<svg viewBox="0 0 24 34" width="100%" xmlns="http://www.w3.org/2000/svg" style="display:block; overflow:visible;">
    <path d="M12 1C6.2 1 1.5 5.7 1.5 11.5c0 7.9 10.5 21.5 10.5 21.5s10.5-13.6 10.5-21.5C22.5 5.7 17.8 1 12 1z" fill="${color}" stroke="#ffffff" stroke-width="1.3"/>
    <g transform="translate(5.16 4.66) scale(0.57)" fill="none" stroke="#ffffff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${iconInner(iconName)}</g>
  </svg>`;
}

// Aynı teardrop, harita görseli olarak — gölge CSS filtresi map image'a uygulanamadığı için
// SVG feDropShadow ile gömülür; viewBox gölgeye pay bırakacak şekilde genişletilir.
function pinImageSvg(color: string, iconName: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${PIN_IMG_W}" height="${PIN_IMG_H}" viewBox="-4 -3 32 36">
    <defs><filter id="sh" x="-50%" y="-30%" width="200%" height="170%">
      <feDropShadow dx="0" dy="1.4" stdDeviation="1.4" flood-color="#000000" flood-opacity="0.4"/>
    </filter></defs>
    <g filter="url(#sh)">
      <path d="M12 1C6.2 1 1.5 5.7 1.5 11.5c0 7.9 10.5 21.5 10.5 21.5s10.5-13.6 10.5-21.5C22.5 5.7 17.8 1 12 1z" fill="${color}" stroke="#ffffff" stroke-width="1.3"/>
      <g transform="translate(5.16 4.66) scale(0.57)" fill="none" stroke="#ffffff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${iconInner(iconName)}</g>
    </g>
  </svg>`;
}

function loadImageEl(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  });
}

// Her kategori için teardrop görselini "cat-<slug>" adıyla haritaya kaydeder.
async function registerCategoryImages(map: maplibregl.Map) {
  await Promise.all(
    CATEGORIES.map(async (c) => {
      const id = `cat-${c.slug}`;
      if (map.hasImage(id)) return;
      const img = await loadImageEl(pinImageSvg(c.color, c.iconName));
      if (!map.hasImage(id)) map.addImage(id, img, { pixelRatio: 2 });
    }),
  );
}

function reportsToFeatureCollection(reports: MapReport[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: reports.map((r) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [r.lng, r.lat] },
      properties: { id: r.id, category: r.category },
    })),
  };
}

// Olay kaynağını (kümeli) ve katmanlarını kurar: küme baloncuğu + "+N" sayaç + tekil pin'ler.
async function setupReportClusterLayers(
  map: maplibregl.Map,
  onSelect: { current: (id: string) => void },
) {
  await registerCategoryImages(map);

  map.addSource("reports", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
    cluster: true,
    clusterRadius: 48,
    clusterMaxZoom: 16,
  });

  map.addLayer({
    id: "clusters",
    type: "circle",
    source: "reports",
    filter: ["has", "point_count"],
    paint: {
      "circle-color": CLUSTER_COLOR,
      "circle-opacity": 0.95,
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 2.5,
      "circle-radius": ["step", ["get", "point_count"], 16, 5, 20, 15, 26],
    },
  });

  map.addLayer({
    id: "cluster-count",
    type: "symbol",
    source: "reports",
    filter: ["has", "point_count"],
    layout: {
      "text-field": ["concat", "+", ["get", "point_count_abbreviated"]],
      "text-font": ["Noto Sans Bold"],
      "text-size": 13,
      "text-allow-overlap": true,
      "text-ignore-placement": true,
    },
    paint: { "text-color": "#ffffff" },
  });

  map.addLayer({
    id: "unclustered",
    type: "symbol",
    source: "reports",
    filter: ["!", ["has", "point_count"]],
    layout: {
      "icon-image": ["concat", "cat-", ["get", "category"]],
      "icon-size": [
        "interpolate",
        ["linear"],
        ["zoom"],
        MAP_MIN_ZOOM,
        0.9,
        MAP_MAX_ZOOM,
        1.2,
      ],
      "icon-anchor": "bottom",
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
    },
  });

  // Kümeye tıkla → yaklaşıp dağıt.
  map.on("click", "clusters", (e) => {
    const features = map.queryRenderedFeatures(e.point, { layers: ["clusters"] });
    const clusterId = features[0]?.properties?.cluster_id;
    if (clusterId == null) return;
    const src = map.getSource("reports") as maplibregl.GeoJSONSource;
    src.getClusterExpansionZoom(clusterId).then((zoom) => {
      const geom = features[0].geometry as GeoJSON.Point;
      map.easeTo({ center: geom.coordinates as [number, number], zoom });
    });
  });

  // Tekil pin'e tıkla → detay modalını aç.
  map.on("click", "unclustered", (e) => {
    const id = e.features?.[0]?.properties?.id;
    if (typeof id === "string") onSelect.current(id);
  });

  for (const layer of ["clusters", "unclustered"]) {
    map.on("mouseenter", layer, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", layer, () => {
      map.getCanvas().style.cursor = "";
    });
  }
}

function createPharmacyMarkerElement() {
  const el = document.createElement("div");
  el.style.cssText = `width:${PHARMACY_PIN_SIZE}px; cursor:pointer; filter:drop-shadow(0 2px 3px rgba(0,0,0,0.4));`;
  el.innerHTML = pinMarkup(PHARMACY_COLOR, "cross");
  return el;
}

function googleMapsDirectionsUrl(pharmacy: DutyPharmacy) {
  return `https://www.google.com/maps/dir/?api=1&destination=${pharmacy.lat},${pharmacy.lng}`;
}

function createPharmacyPopupElement(pharmacy: DutyPharmacy) {
  const el = document.createElement("div");
  el.style.cssText = "font-family: sans-serif; font-size: 16px; max-width: 280px;";

  const nameEl = document.createElement("div");
  nameEl.style.cssText =
    "display:flex; align-items:center; gap:6px; font-weight:700; font-size:18px; margin-bottom:6px;";
  const nameIcon = document.createElement("span");
  nameIcon.style.cssText = `color:${PHARMACY_COLOR}; display:inline-flex; flex-shrink:0;`;
  nameIcon.innerHTML = iconSvgMarkup("cross", { size: 18 });
  const nameText = document.createElement("span");
  nameText.textContent = pharmacy.name;
  nameEl.appendChild(nameIcon);
  nameEl.appendChild(nameText);
  el.appendChild(nameEl);

  const addressLink = document.createElement("a");
  addressLink.style.cssText =
    "display:block; color:#374151; margin-bottom:8px; text-decoration:underline; text-decoration-color:#d1d5db;";
  addressLink.href = googleMapsDirectionsUrl(pharmacy);
  addressLink.target = "_blank";
  addressLink.rel = "noopener noreferrer";
  addressLink.textContent = pharmacy.address;
  el.appendChild(addressLink);

  const phoneEl = document.createElement("a");
  phoneEl.style.cssText = "display:block; color:#2563eb; font-weight:600; text-decoration:none;";
  phoneEl.href = `tel:${pharmacy.phone}`;
  phoneEl.textContent = pharmacy.phone;
  el.appendChild(phoneEl);

  return el;
}

export function MapView({
  reports,
  pharmacies,
  onSelectReport,
}: {
  reports: MapReport[];
  pharmacies: DutyPharmacy[];
  onSelectReport: (reportId: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const mahalleMarkersRef = useRef<maplibregl.Marker[]>([]);
  const onSelectRef = useRef(onSelectReport);
  useEffect(() => {
    onSelectRef.current = onSelectReport;
  });
  const [mapReady, setMapReady] = useState(false);
  // Aktif (görünür) kategoriler — lejant filtresi. Varsayılan: hepsi açık.
  const [activeCats, setActiveCats] = useState<Set<string>>(
    () => new Set(CATEGORIES.map((c) => c.slug)),
  );
  const toggleCat = (slug: string) =>
    setActiveCats((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  const resetCats = () => setActiveCats(new Set(CATEGORIES.map((c) => c.slug)));

  // Container'ın gerçek bir boyuta ulaşmasını bekleyip haritayı ancak o zaman kuruyoruz;
  // 0x0 boyutlu bir container'da oluşturulan MapLibre haritası tile isteklerini hiç tetiklemiyor.
  // Harita instance'ı container DOM elemanına bağlanır (__maplibreMap): StrictMode'da efektin iki
  // kez çalışması aynı container için iki harita oluşmasına yol açabiliyordu; bu guard engeller.
  useEffect(() => {
    const container = containerRef.current as MapContainer | null;
    if (!container) return;

    let cancelled = false;

    function createMap() {
      if (cancelled || !container || container.__maplibreMap) return;

      const map = new maplibregl.Map({
        container,
        style: "https://tiles.openfreemap.org/styles/liberty",
        center: BEYOGLU_CENTER,
        zoom: 14,
        minZoom: MAP_MIN_ZOOM,
        maxZoom: MAP_MAX_ZOOM,
        maxBounds: getBeyogluMaxBounds(),
      });
      container.__maplibreMap = map;

      map.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: "metric" }), "bottom-right");

      map.on("load", async () => {
        map.fitBounds(getBeyogluBounds(), { padding: 32, duration: 0 });

        try {
          // Mahalle/sınır katmanları önce (mask altta kalsın); olay pin'leri üstünde.
          await loadMahalleLayer(map, mahalleMarkersRef.current);
        } catch {
          // mahalle verisi opsiyonel; yüklenemezse harita çalışmaya devam eder
        }
        if (cancelled) return;
        try {
          await setupReportClusterLayers(map, onSelectRef);
        } catch {
          // görseller/katmanlar kurulamazsa harita yine de gösterilir
        }
        if (cancelled) return;

        mapRef.current = map;
        setMapReady(true);
      });
    }

    if (container.clientWidth > 0 && container.clientHeight > 0) {
      createMap();
    }

    const resizeObserver = new ResizeObserver(() => {
      if (!container.__maplibreMap) {
        if (container.clientWidth > 0 && container.clientHeight > 0) {
          createMap();
        }
      } else {
        container.__maplibreMap.resize();
      }
    });
    resizeObserver.observe(container);

    return () => {
      cancelled = true;
      resizeObserver.disconnect();
      mahalleMarkersRef.current.forEach((m) => m.remove());
      mahalleMarkersRef.current = [];
      container.__maplibreMap?.remove();
      delete container.__maplibreMap;
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  // Raporlar/filtre değişince kümeli kaynağın verisini güncelle (DOM marker yeniden kurmak yerine).
  // Gizli kategoriler kaynaktan düşürülür → kümeler de yeniden hesaplanır.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const src = map.getSource("reports") as maplibregl.GeoJSONSource | undefined;
    const visible = reports.filter((r) => activeCats.has(r.category));
    src?.setData(reportsToFeatureCollection(visible));
  }, [reports, mapReady, activeCats]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const markers: maplibregl.Marker[] = [];

    pharmacies.forEach((pharmacy) => {
      const popup = new maplibregl.Popup({ offset: 46, maxWidth: "300px" }).setDOMContent(
        createPharmacyPopupElement(pharmacy),
      );
      const marker = new maplibregl.Marker({
        element: createPharmacyMarkerElement(),
        anchor: "bottom",
      })
        .setLngLat([pharmacy.lng, pharmacy.lat])
        .setPopup(popup)
        .addTo(map);
      markers.push(marker);
    });

    return () => {
      markers.forEach((m) => m.remove());
    };
  }, [pharmacies, mapReady]);

  // Görünür (filtre sonrası) olay sayısı — boş durum mesajı için.
  const visibleCount = reports.reduce((n, r) => n + (activeCats.has(r.category) ? 1 : 0), 0);

  return (
    // Wrapper flex-col: harita container'ı yüksekliği flex-1 (flex-grow) ile alır — maplibre
    // container'a position:relative dayattığı için yüzde-yükseklik (h-full) çözülmüyordu.
    // Lejant, relative wrapper'a göre absolute konumlanır.
    <div className="relative flex w-full flex-1 flex-col">
      <div ref={containerRef} className="w-full flex-1" />
      {mapReady && <MapLegend active={activeCats} onToggle={toggleCat} onReset={resetCats} />}
      {mapReady && visibleCount === 0 && (
        <div className="pointer-events-none absolute left-1/2 top-4 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full bg-white/95 px-4 py-2 text-sm font-medium text-gray-600 shadow-lg ring-1 ring-black/5 backdrop-blur">
          <Icon name="info" size={16} className="text-gray-400" />
          <span>
            {reports.length === 0
              ? "Şu an aktif olay yok"
              : "Seçili türlerde olay yok"}
          </span>
        </div>
      )}
    </div>
  );
}
