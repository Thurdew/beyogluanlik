"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getReportDetail, type ReportDetail } from "@/lib/reports";

const HIDE_AFTER_FALSE_VOTES = 3;
const MAX_COMMENT_LENGTH = 1000;

export async function fetchReportDetailAction(reportId: string): Promise<ReportDetail | null> {
  const user = await getCurrentUser();
  return getReportDetail(reportId, user?.id);
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
  const trimmed = text.trim();
  if (!trimmed) {
    return { status: "error", message: "Yorum boş olamaz." };
  }
  if (trimmed.length > MAX_COMMENT_LENGTH) {
    return { status: "error", message: "Yorum çok uzun (en fazla 1000 karakter)." };
  }

  const report = await prisma.report.findUnique({ where: { id: reportId }, select: { id: true } });
  if (!report) {
    return { status: "error", message: "Paylaşım bulunamadı." };
  }

  await prisma.comment.create({
    data: {
      text: trimmed,
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

  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: { id: true, authorId: true },
  });
  if (!report) {
    return { status: "error" as const, message: "Paylaşım bulunamadı." };
  }

  // Kendi paylaşımına oy verilemez.
  if (report.authorId === user.id) {
    return { status: "error" as const, message: "Kendi paylaşımına oy veremezsin." };
  }

  const existing = await prisma.confirmation.findUnique({
    where: { reportId_userId: { reportId, userId: user.id } },
    select: { type: true },
  });

  // Aynı oya tekrar dokunmak = oyu geri al (sil). Farklı oy = güncelle/oluştur.
  if (existing?.type === type) {
    await prisma.confirmation.delete({
      where: { reportId_userId: { reportId, userId: user.id } },
    });
  } else {
    await prisma.confirmation.upsert({
      where: { reportId_userId: { reportId, userId: user.id } },
      update: { type },
      create: { reportId, userId: user.id, type },
    });
  }

  // Güven puanı, yazarın bu kullanıcıdan gelen TRUE oyunu kazanmasına/kaybetmesine göre
  // simetrik değişir (puan şişirme ve tutarsızlık önlenir). Kendi raporu zaten yukarıda elendi.
  const hadTrue = existing?.type === "TRUE";
  const nowHasTrue = existing?.type !== type && type === "TRUE";
  if (!hadTrue && nowHasTrue) {
    await prisma.user.update({
      where: { id: report.authorId },
      data: { trustScore: { increment: 1 } },
    });
  } else if (hadTrue && !nowHasTrue) {
    // trustScore'u 0'ın altına düşürme.
    await prisma.user.updateMany({
      where: { id: report.authorId, trustScore: { gt: 0 } },
      data: { trustScore: { decrement: 1 } },
    });
  }

  const falseCount = await prisma.confirmation.count({ where: { reportId, type: "FALSE" } });
  if (falseCount >= HIDE_AFTER_FALSE_VOTES) {
    await prisma.report.update({ where: { id: reportId }, data: { status: "UNDER_REVIEW" } });
  }

  revalidatePath("/");
  return { status: "success" as const };
}
