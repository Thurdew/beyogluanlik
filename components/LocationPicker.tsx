"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import { BEYOGLU_BOUNDARY } from "@/lib/geofence";
import { SATELLITE_STYLE } from "@/lib/mapLayers";
import { geocodeAddressAction } from "@/app/bildir/actions";
import type { AddressResult } from "@/lib/geocoding";
import { Icon } from "./icons";

type MapContainer = HTMLDivElement & { __maplibreMap?: maplibregl.Map };
const SEARCH_DEBOUNCE_MS = 400;

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
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AddressResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

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
        center: [value.lng, value.lat],
        zoom: 15,
      });
      container.__maplibreMap = map;
      map.addControl(new maplibregl.NavigationControl(), "top-right");

      map.on("load", () => {
        // Beyoğlu sınırının dışını karartan maske: geniş bir dış çerçeveden BEYOGLU_BOUNDARY
        // "delik" (hole) olarak çıkarılır. GeoJSON kuralı gereği dış halka CCW, delik halkası CW
        // olmalı; BEYOGLU_BOUNDARY zaten CCW olduğundan delik için ters çevrilir.
        const outerRing: [number, number][] = [
          [26, 39.5],
          [32, 39.5],
          [32, 42.5],
          [26, 42.5],
          [26, 39.5],
        ];
        const hole = [...BEYOGLU_BOUNDARY].reverse();

        map.addSource("beyoglu-maske", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: { type: "Polygon", coordinates: [outerRing, hole] },
          },
        });
        map.addLayer({
          id: "beyoglu-maske-fill",
          type: "fill",
          source: "beyoglu-maske",
          paint: { "fill-color": "#0f172a", "fill-opacity": 0.55 },
        });

        map.addSource("beyoglu-sinir", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: { type: "Polygon", coordinates: [BEYOGLU_BOUNDARY] },
          },
        });
        // Halo + ana çizgi: koyu zemin üzerinde de fark edilsin diye altına beyaz bir halo
        // çizgisi eklenir, üstüne daha kalın/dolu mavi sınır çizgisi gelir.
        map.addLayer({
          id: "beyoglu-sinir-halo",
          type: "line",
          source: "beyoglu-sinir",
          paint: { "line-color": "#ffffff", "line-width": 5, "line-opacity": 0.9 },
        });
        map.addLayer({
          id: "beyoglu-sinir-line",
          type: "line",
          source: "beyoglu-sinir",
          paint: { "line-color": "#1d4ed8", "line-width": 3 },
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

  function moveTo(lat: number, lng: number, zoom = 16) {
    onChangeRef.current({ lat, lng });
    markerRef.current?.setLngLat([lng, lat]);
    mapRef.current?.flyTo({ center: [lng, lat], zoom });
  }

  function useMyLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      moveTo(pos.coords.latitude, pos.coords.longitude);
    });
  }

  async function runSearch(q: string) {
    if (q.trim().length < 3) {
      setResults([]);
      return;
    }
    setIsSearching(true);
    setSearchError(null);
    try {
      const found = await geocodeAddressAction(q);
      setResults(found);
      if (found.length === 0) setSearchError("Adres bulunamadı.");
    } catch {
      setSearchError("Adres aranırken bir hata oluştu.");
    } finally {
      setIsSearching(false);
    }
  }

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

  function handleQueryChange(next: string) {
    setQuery(next);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => runSearch(next), SEARCH_DEBOUNCE_MS);
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    runSearch(query);
  }

  function selectResult(result: AddressResult) {
    setQuery(result.label);
    setResults([]);
    setSearchError(null);
    moveTo(result.lat, result.lng);
  }

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />

      <div className="absolute left-2 right-12 top-2 z-10">
        <form onSubmit={handleSearchSubmit} className="flex gap-1">
          <input
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Adres ara (ör. İstiklal Caddesi)"
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow focus:border-blue-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={isSearching}
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow hover:bg-blue-700 disabled:opacity-50"
          >
            {isSearching ? "..." : "Ara"}
          </button>
        </form>

        {(results.length > 0 || searchError) && (
          <div className="mt-1 max-h-48 overflow-y-auto rounded-md border border-gray-200 bg-white shadow">
            {results.map((r, i) => (
              <button
                key={i}
                type="button"
                onClick={() => selectResult(r)}
                className="block w-full truncate border-b border-gray-100 px-3 py-2 text-left text-xs text-gray-700 last:border-b-0 hover:bg-gray-50"
              >
                {r.label}
              </button>
            ))}
            {results.length === 0 && searchError && (
              <p className="px-3 py-2 text-xs text-gray-500">{searchError}</p>
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={useMyLocation}
        className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-md bg-white px-2 py-1 text-xs font-medium text-gray-700 shadow hover:bg-gray-50"
      >
        <Icon name="locate-fixed" size={14} />
        Mevcut Konumum
      </button>
    </div>
  );
}
