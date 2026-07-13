"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getReportDetail, type ReportDetail } from "@/lib/reports";

const HIDE_AFTER_FALSE_VOTES = 3;

export async function fetchReportDetailAction(reportId: string): Promise<ReportDetail | null> {
  return getReportDetail(reportId);
}

export async function addCommentAction(
  reportId: string,
  text: string,
  photoUrl: string,
): Promise<{ status: "error"; message: string } | { status: "success" }> {
  const user = await getCurrentUser();
  if (!user) {
    return { status: "error", message: "Yorum yapmak için giriş yapmalısınız." };
  }
  if (!text.trim()) {
    return { status: "error", message: "Yorum boş olamaz." };
  }

  await prisma.comment.create({
    data: {
      text: text.trim(),
      photoUrl: photoUrl.trim() || null,
      reportId,
      authorId: user.id,
    },
  });

  revalidatePath("/");
  return { status: "success" };
}

export async function confirmReportAction(reportId: string, type: "TRUE" | "FALSE") {
  const user = await getCurrentUser();
  if (!user) {
    return { status: "error" as const, message: "Giriş yapmalısınız." };
  }

  await prisma.confirmation.upsert({
    where: { reportId_userId: { reportId, userId: user.id } },
    update: { type },
    create: { reportId, userId: user.id, type },
  });

  if (type === "TRUE") {
    const report = await prisma.report.findUnique({ where: { id: reportId } });
    if (report && report.authorId !== user.id) {
      await prisma.user.update({
        where: { id: report.authorId },
        data: { trustScore: { increment: 1 } },
      });
    }
  }

  const falseCount = await prisma.confirmation.count({ where: { reportId, type: "FALSE" } });
  if (falseCount >= HIDE_AFTER_FALSE_VOTES) {
    await prisma.report.update({ where: { id: reportId }, data: { status: "UNDER_REVIEW" } });
  }

  revalidatePath("/");
  return { status: "success" as const };
}
