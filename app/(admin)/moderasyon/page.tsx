import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCategory, CATEGORIES } from "@/lib/categories";
import { Icon } from "@/components/icons";
import { isModeratorSession } from "@/lib/moderatorSession";
import {
  approveReportAction,
  removeReportAction,
  moderatorLoginAction,
  moderatorLogoutAction,
} from "@/app/moderasyon/actions";

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Aktif",
  UNDER_REVIEW: "İncelemede",
  REMOVED: "Kaldırılmış",
};

const STATUS_BADGE_CLASS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  UNDER_REVIEW: "bg-amber-100 text-amber-700",
  REMOVED: "bg-gray-200 text-gray-600",
};

type SearchParams = {
  hata?: string;
  kategori?: string;
  durum?: string;
  sirala?: string;
};

export default async function ModerasyonPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");

  const isModerator = await isModeratorSession();
  const params = await searchParams;

  if (!isModerator) {
    return (
      <div className="mx-auto flex w-full max-w-sm flex-1 items-center justify-center p-4">
        <div className="w-full rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-gray-900">Yönetici Girişi</h1>
          <p className="mt-1 text-sm text-gray-500">
            Bu alan yalnızca yetkili moderatörler içindir.
          </p>

          {params.hata && (
            <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
              Kullanıcı adı veya şifre hatalı.
            </p>
          )}

          <form action={moderatorLoginAction} className="mt-4 space-y-3">
            <input
              name="username"
              required
              placeholder="Kullanıcı adı"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
            />
            <input
              name="password"
              type="password"
              required
              placeholder="Şifre"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
            />
            <button
              type="submit"
              className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Giriş Yap
            </button>
          </form>
        </div>
      </div>
    );
  }

  const VALID_STATUSES = ["ACTIVE", "UNDER_REVIEW", "REMOVED"] as const;
  const kategori = params.kategori && params.kategori !== "tumu" ? params.kategori : undefined;
  // Geçersiz bir ?durum=... değeri Prisma enum sorgusunu 500'e düşürebiliyor; beyaz listeye al.
  const durum =
    params.durum && (VALID_STATUSES as readonly string[]).includes(params.durum)
      ? (params.durum as (typeof VALID_STATUSES)[number])
      : undefined;
  const sirala = params.sirala ?? "yeni";
  const now = new Date();

  const reports = await prisma.report.findMany({
    where: {
      ...(kategori ? { category: kategori } : {}),
      ...(durum ? { status: durum } : {}),
    },
    include: { author: true, confirmations: true },
    orderBy: { createdAt: "desc" },
  });

  const withCounts = reports.map((r) => ({
    ...r,
    trueCount: r.confirmations.filter((c) => c.type === "TRUE").length,
    falseCount: r.confirmations.filter((c) => c.type === "FALSE").length,
  }));

  withCounts.sort((a, b) => {
    if (sirala === "asilsiz") return b.falseCount - a.falseCount;
    if (sirala === "dogru") return b.trueCount - a.trueCount;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Tüm Paylaşımlar</h1>
        <form action={moderatorLogoutAction}>
          <button type="submit" className="text-sm text-gray-500 hover:underline">
            Oturumu kapat
          </button>
        </form>
      </div>
      <p className="mt-1 text-sm text-gray-500">
        Tüm paylaşımları görüntüle, filtrele ve gerektiğinde kaldır.
      </p>

      <form
        method="GET"
        className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white p-3"
      >
        <select
          name="kategori"
          defaultValue={params.kategori ?? "tumu"}
          className="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900"
        >
          <option value="tumu">Tüm kategoriler</option>
          {CATEGORIES.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.label}
            </option>
          ))}
        </select>

        <select
          name="durum"
          defaultValue={params.durum ?? "tumu"}
          className="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900"
        >
          <option value="tumu">Tüm durumlar</option>
          <option value="ACTIVE">Aktif</option>
          <option value="UNDER_REVIEW">İncelemede</option>
          <option value="REMOVED">Kaldırılmış</option>
        </select>

        <select
          name="sirala"
          defaultValue={sirala}
          className="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900"
        >
          <option value="yeni">En yeni</option>
          <option value="asilsiz">En çok asılsız işaretlenen</option>
          <option value="dogru">En çok doğru işaretlenen</option>
        </select>

        <button
          type="submit"
          className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
        >
          Filtrele
        </button>
      </form>

      <p className="mt-3 text-sm text-gray-500">{withCounts.length} sonuç</p>

      {withCounts.length === 0 && (
        <p className="mt-6 text-sm text-gray-500">Bu filtrelerle eşleşen paylaşım yok.</p>
      )}

      <ul className="mt-3 flex flex-col gap-3">
        {withCounts.map((r) => {
          const category = getCategory(r.category);
          return (
            <li key={r.id} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <span
                  className="flex items-center gap-1.5 font-medium"
                  style={{ color: category.color }}
                >
                  <Icon name={category.iconName} size={16} />
                  {category.label}
                </span>
                <div className="flex items-center gap-1.5">
                  {r.status === "ACTIVE" && r.expiresAt <= now && (
                    <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">
                      Süresi doldu
                    </span>
                  )}
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[r.status]}`}
                  >
                    {STATUS_LABEL[r.status]}
                  </span>
                </div>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {r.author.fullName} · {r.createdAt.toLocaleString("tr-TR")}
              </p>
              <p className="mt-2 text-sm text-gray-700">{r.description}</p>
              {r.photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={r.photoUrl}
                  alt={r.description}
                  className="mt-2 h-32 w-full rounded-md border border-gray-200 object-cover"
                />
              )}
              <p className="mt-2 flex items-center gap-3 text-xs font-semibold text-gray-800">
                <span className="flex items-center gap-1 text-green-700">
                  <Icon name="circle-check" size={14} /> {r.trueCount} doğru
                </span>
                <span className="flex items-center gap-1 text-red-700">
                  <Icon name="triangle-alert" size={14} /> {r.falseCount} asılsız
                </span>
              </p>
              <div className="mt-3 flex gap-2">
                {r.status !== "ACTIVE" && (
                  <form action={approveReportAction.bind(null, r.id)}>
                    <button className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700">
                      Aktif Yap
                    </button>
                  </form>
                )}
                {r.status !== "REMOVED" && (
                  <form action={removeReportAction.bind(null, r.id)}>
                    <button className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700">
                      Kaldır
                    </button>
                  </form>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
