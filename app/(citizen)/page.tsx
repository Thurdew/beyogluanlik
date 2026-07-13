import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getActiveReports } from "@/lib/reports";
import { getDutyPharmacies } from "@/lib/pharmacies";
import { MapPageClient } from "@/components/MapPageClient";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");

  const [reports, pharmacies] = await Promise.all([getActiveReports(), getDutyPharmacies()]);

  return <MapPageClient reports={reports} pharmacies={pharmacies} />;
}
