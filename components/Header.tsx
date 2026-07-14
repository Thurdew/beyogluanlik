import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { logoutAction } from "@/app/giris/actions";
import { Icon, LogoMark, LogoutIcon } from "./icons";
import { MobileNavbar } from "./MobileNavbar";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

// Masaüstünde yatay üst bar, mobilde (sm altı) açılıp kapanabilen bir kenar çubuğu (sidebar) gösterilir.
export async function Header() {
  const user = await getCurrentUser();

  return (
    <>
      <header className="sticky top-0 z-20 hidden border-b border-gray-200/70 bg-white/80 backdrop-blur-md sm:block">
        <div className="flex items-center justify-between gap-2 px-4 py-2.5">
          <Link href="/" className="flex min-w-0 shrink items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-sm shadow-blue-600/30">
              <LogoMark />
            </span>
            <span className="flex min-w-0 flex-col leading-none">
              <span className="truncate text-[15px] font-bold tracking-tight text-gray-900">
                Beyoğlu Anlık
              </span>
              <span className="truncate text-[10.5px] font-medium text-gray-400">
                Yerel olay haritası
              </span>
            </span>
          </Link>

          {user && (
            <div className="flex shrink-0 items-center gap-2">
              <div className="flex min-w-0 items-center gap-2 rounded-full bg-gray-50 py-1 pl-1 pr-1.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-xs font-bold text-white">
                  {initials(user.fullName)}
                </span>
                <span className="flex min-w-0 flex-col pr-1 leading-none">
                  <span className="truncate text-[13px] font-semibold text-gray-900">
                    {user.fullName}
                  </span>
                  <span className="flex items-center gap-1 truncate text-[11px] font-medium text-amber-600">
                    <Icon name="star" size={12} /> {user.trustScore} puan
                  </span>
                </span>
              </div>

              <form action={logoutAction}>
                <button
                  type="submit"
                  aria-label="Çıkış yap"
                  title="Çıkış yap"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  <LogoutIcon />
                </button>
              </form>
            </div>
          )}
        </div>
      </header>

      <MobileNavbar
        user={user ? { fullName: user.fullName, trustScore: user.trustScore } : null}
      />
    </>
  );
}
