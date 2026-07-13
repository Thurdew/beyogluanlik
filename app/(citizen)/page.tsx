import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getActiveReports } from "@/lib/reports";
import { MapPageClient } from "@/components/MapPageClient";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");

  const reports = await getActiveReports();

  return <MapPageClient reports={reports} />;
}
