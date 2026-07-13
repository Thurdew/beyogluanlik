import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ReportForm } from "@/components/ReportForm";

export default async function BildirPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");

  return (
    <div className="flex-1 bg-gray-50">
      <ReportForm />
    </div>
  );
}
