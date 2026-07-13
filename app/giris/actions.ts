"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession, destroySession } from "@/lib/session";

function isValidFakeTcNo(tc: string) {
  return /^[0-9]{11}$/.test(tc);
}

// Mock kimlik/ikamet doğrulama: gerçek bir e-Devlet/belediye CRM sorgusu yapılmaz.
// Aynı (sahte) TC kimlik no ile giriş yapan kullanıcı her zaman aynı hesaba döner
// ve "Beyoğlu sakini" olarak otomatik onaylanır (residencyVerified).
export async function loginAction(formData: FormData) {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const fakeTcNo = String(formData.get("fakeTcNo") ?? "").trim();

  if (!fullName || !isValidFakeTcNo(fakeTcNo)) {
    redirect("/giris?hata=gecersiz");
  }

  const user = await prisma.user.upsert({
    where: { fakeTcNo },
    update: { fullName },
    create: { fullName, fakeTcNo, residencyVerified: true },
  });

  await createSession(user.id);
  redirect("/");
}

export async function logoutAction() {
  await destroySession();
  redirect("/giris");
}
