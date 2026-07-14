"use client";

import { useState } from "react";
import { getCategory } from "@/lib/categories";
import { timeAgo } from "@/lib/time";
import type { MapReport } from "@/lib/reports";
import { Icon, CloseIcon } from "./icons";

export function EventSidebar({
  reports,
  onSelectReport,
}: {
  reports: MapReport[];
  onSelectReport: (reportId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Panel açıkken kendi başlığındaki ✕ butonuyla kapatılır; bu yüzden yüzen buton yalnızca
          kapalıyken gösterilir, yoksa panelin başlığıyla üst üste biner. */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Olay listesini aç"
          className="fixed right-4 top-16 z-40 flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-lg hover:bg-gray-50"
        >
          <Icon name="list" size={16} />
          Olaylar ({reports.length})
        </button>
      )}

      {/* Panel açıkken haritanın geri kalanını tıklayınca kapatan arka plan; mobilde panel tam
          genişlik olduğu için görünmez ama desktop'ta panel dışına tıklamayı yakalar. */}
      {isOpen && (
        <div
          className="fixed inset-0 top-14 z-30 bg-black/20 sm:top-0 sm:bg-transparent"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Mobilde sabit üst navbar'ın (h-14) altından başlar ki menü/çıkış butonlarını kapatmasın;
          masaüstünde en üstten başlar. */}
      <aside
        className={`fixed bottom-0 right-0 top-14 z-30 flex w-full flex-col bg-white shadow-2xl transition-transform duration-300 ease-in-out sm:top-0 sm:w-96 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h2 className="text-base font-semibold text-gray-900">Olaylar ({reports.length})</h2>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="Kapat"
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {reports.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">Şu anda aktif bir olay bildirimi yok.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {reports.map((report) => {
                const category = getCategory(report.category);
                return (
                  <li key={report.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectReport(report.id);
                        setIsOpen(false);
                      }}
                      className="flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-gray-50"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className="flex items-center gap-1.5 text-sm font-semibold"
                          style={{ color: category.color }}
                        >
                          <Icon name={category.iconName} size={16} />
                          {category.label}
                        </span>
                        <span className="shrink-0 text-xs text-gray-400">
                          {timeAgo(report.createdAt)}
                        </span>
                      </div>
                      <p className="line-clamp-2 text-sm text-gray-700">{report.description}</p>
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Icon name="map-pin" size={12} />
                        {report.lat.toFixed(4)}, {report.lng.toFixed(4)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>
    </>
  );
}
