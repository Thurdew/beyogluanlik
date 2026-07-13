"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import { BEYOGLU_CENTER } from "@/lib/geofence";
import { getCategory } from "@/lib/categories";
import { clampInterpolate } from "@/lib/scale";
import type { MapReport } from "@/lib/reports";
import type { DutyPharmacy } from "@/lib/pharmacies";
import {
  addDistrictBoundary,
  loadMahalleLayer,
  getBeyogluBounds,
  getBeyogluMaxBounds,
  MAP_MIN_ZOOM,
  MAP_MAX_ZOOM,
} from "@/lib/mapLayers";

type MapContainer = HTMLDivElement & { __maplibreMap?: maplibregl.Map };

// Uzaktan (düşük zoom) bakarken olay ikonları büyük/belirgin olur; yaklaştıkça normal boyuta
// döner ve kategori adı etiketi görünür hale gelir (detaylandırma).
const REPORT_ICON_SIZE_FAR = 40;
const REPORT_ICON_SIZE_NEAR = 24;
const REPORT_LABEL_ZOOM_THRESHOLD = 14.5;

// Nöbetçi eczaneler resmi/statik bir katman olduğu için sabit boyutta gösterilir,
// vatandaş bildirimlerinin aksine zoom'a göre ölçeklenmez.
const PHARMACY_ICON_SIZE = 42;

function createPharmacyMarkerElement() {
  const el = document.createElement("div");
  el.style.cssText =
    "font-size:" +
    PHARMACY_ICON_SIZE +
    "px; line-height:1; cursor:pointer; filter:drop-shadow(0 1px 3px rgba(0,0,0,0.45));";
  el.textContent = "💊";
  return el;
}

function googleMapsDirectionsUrl(pharmacy: DutyPharmacy) {
  return `https://www.google.com/maps/dir/?api=1&destination=${pharmacy.lat},${pharmacy.lng}`;
}

function createPharmacyPopupElement(pharmacy: DutyPharmacy) {
  const el = document.createElement("div");
  el.style.cssText = "font-family: sans-serif; font-size: 16px; max-width: 280px;";

  const nameEl = document.createElement("div");
  nameEl.style.cssText = "font-weight:700; font-size:18px; margin-bottom:6px;";
  nameEl.textContent = `💊 ${pharmacy.name}`;
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

function createReportMarkerElement(categoryLabel: string, icon: string) {
  const wrapper = document.createElement("div");
  wrapper.style.cssText =
    "display:flex; flex-direction:column; align-items:center; cursor:pointer;";

  const iconEl = document.createElement("div");
  iconEl.textContent = icon;
  iconEl.style.cssText = `font-size:${REPORT_ICON_SIZE_FAR}px; line-height:1; filter:drop-shadow(0 1px 3px rgba(0,0,0,0.45));`;
  wrapper.appendChild(iconEl);

  const labelEl = document.createElement("div");
  labelEl.textContent = categoryLabel;
  labelEl.style.cssText =
    "margin-top:2px; background:#111827; color:#fff; font-size:11px; font-weight:600;" +
    " padding:2px 6px; border-radius:5px; white-space:nowrap; display:none;";
  wrapper.appendChild(labelEl);

  return { wrapper, iconEl, labelEl };
}

function applyReportIconScale(
  map: maplibregl.Map,
  entries: { iconEl: HTMLElement; labelEl: HTMLElement }[],
) {
  const zoom = map.getZoom();
  const size = clampInterpolate(
    zoom,
    MAP_MIN_ZOOM,
    MAP_MAX_ZOOM,
    REPORT_ICON_SIZE_FAR,
    REPORT_ICON_SIZE_NEAR,
  );
  const showLabel = zoom >= REPORT_LABEL_ZOOM_THRESHOLD;
  for (const { iconEl, labelEl } of entries) {
    iconEl.style.fontSize = `${size}px`;
    labelEl.style.display = showLabel ? "block" : "none";
  }
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
  const [mapReady, setMapReady] = useState(false);

  // Container'ın gerçek bir boyuta ulaşmasını bekleyip haritayı ancak o zaman kuruyoruz;
  // 0x0 boyutlu bir container'da oluşturulan MapLibre haritası tile isteklerini hiç tetiklemiyor.
  // Harita instance'ı container DOM elemanına bağlanır (__maplibreMap): React'in geliştirme
  // modunda efekti iki kez çalıştırması (StrictMode) aynı container için iki harita
  // oluşturulmasına yol açabiliyordu; bu guard bunu engeller.
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

      map.on("load", () => {
        addDistrictBoundary(map);
        map.fitBounds(getBeyogluBounds(), { padding: 32, duration: 0 });

        loadMahalleLayer(map, mahalleMarkersRef.current).catch(() => {
          // mahalle verisi opsiyonel; yüklenemezse harita ilçe sınırıyla çalışmaya devam eder
        });

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

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const markers: maplibregl.Marker[] = [];
    const scaleEntries: { iconEl: HTMLElement; labelEl: HTMLElement }[] = [];

    reports.forEach((report) => {
      const category = getCategory(report.category);
      const { wrapper, iconEl, labelEl } = createReportMarkerElement(category.label, category.icon);
      scaleEntries.push({ iconEl, labelEl });
      wrapper.addEventListener("click", () => onSelectReport(report.id));

      const marker = new maplibregl.Marker({ element: wrapper })
        .setLngLat([report.lng, report.lat])
        .addTo(map);

      markers.push(marker);
    });

    applyReportIconScale(map, scaleEntries);
    const onZoom = () => applyReportIconScale(map, scaleEntries);
    map.on("zoom", onZoom);

    return () => {
      map.off("zoom", onZoom);
      markers.forEach((m) => m.remove());
    };
  }, [reports, mapReady, onSelectReport]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const markers: maplibregl.Marker[] = [];

    pharmacies.forEach((pharmacy) => {
      const popup = new maplibregl.Popup({ offset: 20, maxWidth: "300px" }).setDOMContent(
        createPharmacyPopupElement(pharmacy),
      );
      const marker = new maplibregl.Marker({ element: createPharmacyMarkerElement() })
        .setLngLat([pharmacy.lng, pharmacy.lat])
        .setPopup(popup)
        .addTo(map);
      markers.push(marker);
    });

    return () => {
      markers.forEach((m) => m.remove());
    };
  }, [pharmacies, mapReady]);

  return <div ref={containerRef} className="w-full flex-1" />;
}
