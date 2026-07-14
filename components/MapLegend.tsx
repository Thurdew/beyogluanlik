"use client";

import { useState } from "react";
import { CATEGORIES } from "@/lib/categories";
import { Icon } from "./icons";

// Nöbetçi eczane haritada sabit yeşil "cross" pin ile gösterilir (MapView'daki PHARMACY_COLOR ile aynı).
const PHARMACY_LEGEND = { color: "#16a34a", iconName: "cross", label: "Nöbetçi eczane" };

/**
 * Harita üzerinde lejant + kategori filtresi. Hangi renk/ikon ne demek gösterir ve her kategoriyi
 * aç/kapat yapar (gizli kategori haritadan düşer). Nöbetçi eczane satırı yalnızca bilgi amaçlı.
 * Durum (aktif kategoriler) üst bileşende (MapView) tutulur; bu bileşen sunumsaldır.
 */
export function MapLegend({
  active,
  onToggle,
  onReset,
}: {
  active: Set<string>;
  onToggle: (slug: string) => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(true);
  const allActive = active.size === CATEGORIES.length;

  return (
    <div className="absolute left-3 top-3 z-20 w-56 max-w-[calc(100%-1.5rem)] overflow-hidden rounded-xl bg-white/95 text-sm shadow-lg ring-1 ring-black/5 backdrop-blur">
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex flex-1 items-center gap-2 font-semibold text-gray-700"
        >
          <Icon name="funnel" size={16} className="text-gray-500" />
          <span>Olay türleri</span>
          <Icon
            name="chevron-down"
            size={16}
            className={`ml-auto text-gray-400 transition-transform ${open ? "" : "-rotate-90"}`}
          />
        </button>
      </div>

      {open && (
        <div className="border-t border-gray-100">
          {!allActive && (
            <button
              type="button"
              onClick={onReset}
              className="w-full px-3 py-1.5 text-left text-xs font-medium text-blue-600 hover:bg-blue-50"
            >
              Tümünü göster
            </button>
          )}

          <ul>
            {CATEGORIES.map((c) => {
              const isOn = active.has(c.slug);
              return (
                <li key={c.slug}>
                  <button
                    type="button"
                    onClick={() => onToggle(c.slug)}
                    aria-pressed={isOn}
                    aria-label={`${c.label} — ${isOn ? "gizle" : "göster"}`}
                    className={`flex min-h-[40px] w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-gray-50 ${
                      isOn ? "" : "opacity-45"
                    }`}
                  >
                    <span
                      className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md"
                      style={{ backgroundColor: c.color }}
                    >
                      <Icon name={c.iconName} size={13} strokeWidth={2.4} className="text-white" />
                    </span>
                    <span className="flex-1 text-gray-700">{c.label}</span>
                    <Icon
                      name={isOn ? "eye" : "eye-off"}
                      size={16}
                      className="flex-shrink-0 text-gray-400"
                    />
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="flex items-center gap-2.5 border-t border-gray-100 px-3 py-2 text-gray-500">
            <span
              className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md"
              style={{ backgroundColor: PHARMACY_LEGEND.color }}
            >
              <Icon name={PHARMACY_LEGEND.iconName} size={13} strokeWidth={2.4} className="text-white" />
            </span>
            <span className="flex-1">{PHARMACY_LEGEND.label}</span>
          </div>
        </div>
      )}
    </div>
  );
}
