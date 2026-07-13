"use client";

import { useState } from "react";
import Link from "next/link";
import { logoutAction } from "@/app/giris/actions";
import { LogoMark, LogoutIcon, MenuIcon, CloseIcon } from "./icons";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

type NavbarUser = { fullName: string; trustScore: number };

export function MobileNavbar({ user }: { user: NavbarUser | null }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Üst navbar — mobilde her zaman görünür */}
      <header className="fixed inset-x-0 top-0 z-20 flex h-14 items-center justify-between border-b border-gray-200 bg-white/95 px-3 backdrop-blur-md sm:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            aria-label="Menüyü aç"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100"
          >
            <MenuIcon />
          </button>
          <Link href="/" className="flex min-w-0 items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-sm shadow-blue-600/30">
              <LogoMark />
            </span>
            <span className="truncate text-[15px] font-bold tracking-tight text-gray-900">
              Beyoğlu Anlık
            </span>
          </Link>
        </div>

        {user && (
          <div className="flex shrink-0 items-center gap-2">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-[11px] font-bold text-white"
              title={`${user.fullName} · ${user.trustScore} puan`}
            >
              {initials(user.fullName)}
            </span>
            <form action={logoutAction}>
              <button
                type="submit"
                aria-label="Çıkış yap"
                title="Çıkış yap"
                className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-red-50 hover:text-red-600"
              >
                <LogoutIcon />
              </button>
            </form>
          </div>
        )}
      </header>

      {/* Açılır panel: hamburger'a tıklanınca soldan kayarak açılır, arka plana tıklayınca kapanır */}
      {isOpen && (
        <div className="fixed inset-0 z-30 sm:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setIsOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-64 flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <Link
                href="/"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2.5"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-sm shadow-blue-600/30">
                  <LogoMark />
                </span>
                <span className="flex flex-col leading-none">
                  <span className="text-[15px] font-bold tracking-tight text-gray-900">
                    Beyoğlu Anlık
                  </span>
                  <span className="text-[10.5px] font-medium text-gray-400">
                    Yerel olay haritası
                  </span>
                </span>
              </Link>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Menüyü kapat"
                className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <CloseIcon />
              </button>
            </div>

            {user && (
              <div className="flex flex-col gap-3 p-4">
                <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-sm font-bold text-white">
                    {initials(user.fullName)}
                  </span>
                  <div className="flex flex-col leading-none">
                    <span className="text-sm font-semibold text-gray-900">{user.fullName}</span>
                    <span className="mt-1 text-xs font-medium text-amber-600">
                      ⭐ {user.trustScore} puan
                    </span>
                  </div>
                </div>

                <form action={logoutAction}>
                  <button
                    type="submit"
                    className="flex w-full items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-red-600"
                  >
                    <LogoutIcon />
                    Çıkış yap
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
