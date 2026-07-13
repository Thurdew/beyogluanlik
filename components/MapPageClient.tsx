"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { MapView } from "./MapView";
import { ReportDetailModal } from "./ReportDetailModal";
import type { MapReport } from "@/lib/reports";

export function MapPageClient({ reports }: { reports: MapReport[] }) {
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  const handleSelectReport = useCallback((reportId: string) => {
    setSelectedReportId(reportId);
  }, []);

  return (
    <div className="relative flex flex-1 flex-col">
      <MapView reports={reports} onSelectReport={handleSelectReport} />
      <Link
        href="/bildir"
        className="absolute bottom-6 right-6 rounded-full bg-blue-600 px-5 py-3 text-sm font-medium text-white shadow-lg hover:bg-blue-700"
      >
        + Olay Bildir
      </Link>

      {selectedReportId && (
        <ReportDetailModal
          reportId={selectedReportId}
          onClose={() => setSelectedReportId(null)}
        />
      )}
    </div>
  );
}
