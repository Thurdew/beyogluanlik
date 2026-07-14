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
  SATELLITE_STYLE,
} from "@/lib/mapLayers";

type MapContainer = HTMLDivElement & { __maplibreMap?: maplibregl.Map };

// Uzaktan (düşük zoom) bakarken olay ikonları büyük/belirgin olur; yaklaştıkça normal boyuta
// döner ve kategori adı etiketi görünür hale gelir (detaylandırma). Vatandaş bildirimleri
// haritadaki en önemli katman olduğu için eczane gibi referans katmanlarından belirgin şekilde
// büyük tutulur ve z-index ile her zaman onların üstünde gösterilir.
const REPORT_ICON_SIZE_FAR = 48;
const REPORT_ICON_SIZE_NEAR = 30;
const REPORT_LABEL_ZOOM_THRESHOLD = 14.5;
const EMERGENCY_SIZE_MULTIPLIER = 1.3;
const REPORT_MARKER_Z_INDEX = 20;
const EMERGENCY_MARKER_Z_INDEX = 30;
const SELECTED_MARKER_Z_INDEX = 40;
const SELECTED_FLYTO_MIN_ZOOM = 15.5;

// Nöbetçi eczaneler resmi/statik bir katman olduğu için sabit boyutta gösterilir,
// vatandaş bildirimlerinin aksine zoom'a göre ölçeklenmez. Olay pinleriyle karışmaması için
// daha düşük bir z-index'te tutulur.
const PHARMACY_ICON_SIZE = 42;
const PHARMACY_MARKER_Z_INDEX = 10;

function createPharmacyMarkerElement() {
  const el = document.createElement("div");
  el.style.cssText =
    "font-size:" +
    PHARMACY_ICON_SIZE +
    "px; line-height:1; cursor:pointer; z-index:" +
    PHARMACY_MARKER_Z_INDEX +
    "; filter:drop-shadow(0 1px 3px rgba(0,0,0,0.45));";
  el.textContent = "💊";
  return el;
}

// Kullanıcının anlık konumunu gösteren mavi nokta; kategori/eczane pinleriyle karışmaması için
// sade bir "buradasın" işareti olarak tasarlandı.
function createCurrentLocationMarkerElement() {
  const el = document.createElement("div");
  el.style.cssText =
    "width:18px; height:18px; border-radius:9999px; background:#2563eb;" +
    " border:3px solid white; box-shadow:0 0 0 2px rgba(37,99,235,0.5), 0 1px 4px rgba(0,0,0,0.4);";
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

function createReportMarkerElement(categoryLabel: string, icon: string, categoryColor: string, isEmergency: boolean) {
  const wrapper = document.createElement("div");
  wrapper.style.cssText =
    "display:flex; flex-direction:column; align-items:center; cursor:pointer; z-index:" +
    (isEmergency ? EMERGENCY_MARKER_Z_INDEX : REPORT_MARKER_Z_INDEX) +
    ";";

  // İkon + (varsa) acil durum pulse halkası aynı konteynerde konumlanır ki halka ikonun tam
  // ortasında büyüyüp sönsün.
  const iconContainer = document.createElement("div");
  iconContainer.style.cssText = "position:relative; display:flex; align-items:center; justify-content:center;";

  let pulseEl: HTMLDivElement | null = null;
  if (isEmergency) {
    pulseEl = document.createElement("div");
    pulseEl.className = "report-pulse-ring";
    iconContainer.appendChild(pulseEl);
  }

  // Sağ paneldeki/haritadaki bir olay seçildiğinde etrafında beliren mavi seçim halkası;
  // acil durum pulse halkasından ayırt edilsin diye farklı renk/animasyon kullanır.
  const selectionRingEl = document.createElement("div");
  selectionRingEl.className = "report-selection-ring";
  selectionRingEl.style.display = "none";
  iconContainer.appendChild(selectionRingEl);

  const iconEl = document.createElement("div");
  iconEl.textContent = icon;
  iconEl.style.cssText = `position:relative; font-size:${REPORT_ICON_SIZE_FAR}px; line-height:1; filter:drop-shadow(0 1px 3px rgba(0,0,0,0.5));`;
  iconContainer.appendChild(iconEl);
  wrapper.appendChild(iconContainer);

  const labelEl = document.createElement("div");
  labelEl.textContent = categoryLabel;
  labelEl.style.cssText =
    `margin-top:2px; background:${categoryColor}; color:#fff; font-size:11px; font-weight:700;` +
    " padding:2px 7px; border-radius:5px; white-space:nowrap; display:none;" +
    " box-shadow:0 1px 3px rgba(0,0,0,0.35);";
  wrapper.appendChild(labelEl);

  return { wrapper, iconEl, labelEl, pulseEl, selectionRingEl };
}

type ReportScaleEntry = {
  iconEl: HTMLElement;
  labelEl: HTMLElement;
  pulseEl: HTMLElement | null;
  selectionRingEl: HTMLElement;
  isEmergency: boolean;
};

function applyReportIconScale(map: maplibregl.Map, entries: ReportScaleEntry[]) {
  const zoom = map.getZoom();
  const baseSize = clampInterpolate(
    zoom,
    MAP_MIN_ZOOM,
    MAP_MAX_ZOOM,
    REPORT_ICON_SIZE_FAR,
    REPORT_ICON_SIZE_NEAR,
  );
  const showLabel = zoom >= REPORT_LABEL_ZOOM_THRESHOLD;
  for (const { iconEl, labelEl, pulseEl, selectionRingEl, isEmergency } of entries) {
    const size = isEmergency ? baseSize * EMERGENCY_SIZE_MULTIPLIER : baseSize;
    iconEl.style.fontSize = `${size}px`;
    labelEl.style.display = showLabel ? "block" : "none";
    if (pulseEl) {
      const ringSize = size * 1.2;
      pulseEl.style.width = `${ringSize}px`;
      pulseEl.style.height = `${ringSize}px`;
    }
    const selectionRingSize = size * 1.7;
    selectionRingEl.style.width = `${selectionRingSize}px`;
    selectionRingEl.style.height = `${selectionRingSize}px`;
  }
}

/** Bir olay pinini seçili/seçili-değil olarak işaretler: mavi seçim halkası + öne çıkan z-index. */
function setReportMarkerSelected(
  entry: { wrapper: HTMLElement; selectionRingEl: HTMLElement; isEmergency: boolean },
  selected: boolean,
) {
  entry.selectionRingEl.style.display = selected ? "block" : "none";
  entry.wrapper.style.zIndex = String(
    selected
      ? SELECTED_MARKER_Z_INDEX
      : entry.isEmergency
        ? EMERGENCY_MARKER_Z_INDEX
        : REPORT_MARKER_Z_INDEX,
  );
}

export function MapView({
  reports,
  pharmacies,
  onSelectReport,
  selectedReportId,
}: {
  reports: MapReport[];
  pharmacies: DutyPharmacy[];
  onSelectReport: (reportId: string) => void;
  selectedReportId: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const mahalleMarkersRef = useRef<maplibregl.Marker[]>([]);
  const reportEntriesRef = useRef<
    Map<string, { wrapper: HTMLElement; selectionRingEl: HTMLElement; isEmergency: boolean; lat: number; lng: number }>
  >(new Map());
  const previousSelectedIdRef = useRef<string | null>(null);
  const currentLocationMarkerRef = useRef<maplibregl.Marker | null>(null);
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
        style: SATELLITE_STYLE,
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
    const scaleEntries: ReportScaleEntry[] = [];
    const entryMap = new Map<
      string,
      { wrapper: HTMLElement; selectionRingEl: HTMLElement; isEmergency: boolean; lat: number; lng: number }
    >();

    reports.forEach((report) => {
      const category = getCategory(report.category);
      const { wrapper, iconEl, labelEl, pulseEl, selectionRingEl } = createReportMarkerElement(
        category.label,
        category.icon,
        category.color,
        category.isEmergency,
      );
      scaleEntries.push({ iconEl, labelEl, pulseEl, selectionRingEl, isEmergency: category.isEmergency });
      wrapper.addEventListener("click", () => onSelectReport(report.id));

      const marker = new maplibregl.Marker({ element: wrapper })
        .setLngLat([report.lng, report.lat])
        .addTo(map);

      markers.push(marker);
      entryMap.set(report.id, {
        wrapper,
        selectionRingEl,
        isEmergency: category.isEmergency,
        lat: report.lat,
        lng: report.lng,
      });
    });

    reportEntriesRef.current = entryMap;
    applyReportIconScale(map, scaleEntries);
    const onZoom = () => applyReportIconScale(map, scaleEntries);
    map.on("zoom", onZoom);

    // Yeni marker seti oluşturulduğunda, hâlâ geçerliyse mevcut seçim vurgusunu koru (ör. reports
    // prop'u tazelendiğinde seçili pin görünürlüğünü kaybetmesin).
    if (selectedReportId) {
      const selectedEntry = entryMap.get(selectedReportId);
      if (selectedEntry) setReportMarkerSelected(selectedEntry, true);
    }

    return () => {
      map.off("zoom", onZoom);
      markers.forEach((m) => m.remove());
      reportEntriesRef.current = new Map();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports, mapReady, onSelectReport]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const previousId = previousSelectedIdRef.current;
    if (previousId && previousId !== selectedReportId) {
      const previousEntry = reportEntriesRef.current.get(previousId);
      if (previousEntry) setReportMarkerSelected(previousEntry, false);
    }

    if (selectedReportId) {
      const entry = reportEntriesRef.current.get(selectedReportId);
      if (entry) {
        setReportMarkerSelected(entry, true);
        map.flyTo({
          center: [entry.lng, entry.lat],
          zoom: Math.max(map.getZoom(), SELECTED_FLYTO_MIN_ZOOM),
          essential: true,
        });
      }
    }

    previousSelectedIdRef.current = selectedReportId;
  }, [selectedReportId, mapReady]);

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

  function handleLocateMe() {
    const map = mapRef.current;
    if (!map || !navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude, longitude } = pos.coords;
      if (currentLocationMarkerRef.current) {
        currentLocationMarkerRef.current.setLngLat([longitude, latitude]);
      } else {
        currentLocationMarkerRef.current = new maplibregl.Marker({
          element: createCurrentLocationMarkerElement(),
        })
          .setLngLat([longitude, latitude])
          .addTo(map);
      }
      map.flyTo({ center: [longitude, latitude], zoom: 16 });
    });
  }

  return (
    <>
      <div ref={containerRef} className="w-full flex-1" />
      <button
        type="button"
        onClick={handleLocateMe}
        aria-label="Şu anki konumumu göster"
        title="Şu anki konumumu göster"
        className="absolute bottom-6 left-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white text-lg shadow-lg hover:bg-gray-50"
      >
        📍
      </button>
    </>
  );
}
