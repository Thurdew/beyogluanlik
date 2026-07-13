"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  checkModeratorCredentials,
  createModeratorSession,
  destroyModeratorSession,
  isModeratorSession,
} from "@/lib/moderatorSession";

export async function moderatorLoginAction(formData: FormData) {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!checkModeratorCredentials(username, password)) {
    redirect("/moderasyon?hata=1");
  }

  await createModeratorSession();
  redirect("/moderasyon");
}

export async function moderatorLogoutAction() {
  await destroyModeratorSession();
  redirect("/");
}

export async function approveReportAction(reportId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  if (!(await isModeratorSession())) redirect("/moderasyon");

  await prisma.report.update({ where: { id: reportId }, data: { status: "ACTIVE" } });
  revalidatePath("/moderasyon");
  revalidatePath("/");
}

export async function removeReportAction(reportId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  if (!(await isModeratorSession())) redirect("/moderasyon");

  await prisma.report.update({ where: { id: reportId }, data: { status: "REMOVED" } });
  revalidatePath("/moderasyon");
  revalidatePath("/");
}
