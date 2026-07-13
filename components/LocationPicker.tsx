"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import { BEYOGLU_BOUNDARY } from "@/lib/geofence";

type MapContainer = HTMLDivElement & { __maplibreMap?: maplibregl.Map };

export function LocationPicker({
  value,
  onChange,
}: {
  value: { lat: number; lng: number };
  onChange: (v: { lat: number; lng: number }) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

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
        center: [value.lng, value.lat],
        zoom: 15,
      });
      container.__maplibreMap = map;
      map.addControl(new maplibregl.NavigationControl(), "top-right");

      map.on("load", () => {
        map.addSource("beyoglu-sinir", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: { type: "Polygon", coordinates: [BEYOGLU_BOUNDARY] },
          },
        });
        map.addLayer({
          id: "beyoglu-sinir-line",
          type: "line",
          source: "beyoglu-sinir",
          paint: { "line-color": "#2563eb", "line-width": 2, "line-dasharray": [2, 2] },
        });
      });

      const marker = new maplibregl.Marker({ draggable: true, color: "#2563eb" })
        .setLngLat([value.lng, value.lat])
        .addTo(map);
      marker.on("dragend", () => {
        const { lat, lng } = marker.getLngLat();
        onChangeRef.current({ lat, lng });
      });
      markerRef.current = marker;

      map.on("click", (e) => {
        marker.setLngLat(e.lngLat);
        onChangeRef.current({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      });

      mapRef.current = map;
    }

    if (container.clientWidth > 0 && container.clientHeight > 0) {
      createMap();
    }

    const resizeObserver = new ResizeObserver(() => {
      if (!container.__maplibreMap) {
        if (container.clientWidth > 0 && container.clientHeight > 0) createMap();
      } else {
        container.__maplibreMap.resize();
      }
    });
    resizeObserver.observe(container);

    return () => {
      cancelled = true;
      resizeObserver.disconnect();
      container.__maplibreMap?.remove();
      delete container.__maplibreMap;
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function useMyLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude, longitude } = pos.coords;
      onChangeRef.current({ lat: latitude, lng: longitude });
      markerRef.current?.setLngLat([longitude, latitude]);
      mapRef.current?.flyTo({ center: [longitude, latitude], zoom: 16 });
    });
  }

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      <button
        type="button"
        onClick={useMyLocation}
        className="absolute bottom-2 left-2 rounded-md bg-white px-2 py-1 text-xs font-medium text-gray-700 shadow hover:bg-gray-50"
      >
        📍 Mevcut Konumum
      </button>
    </div>
  );
}
