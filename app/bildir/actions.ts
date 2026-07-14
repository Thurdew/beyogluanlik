"use server";

import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { submitReport } from "@/lib/reports";
import { CATEGORIES } from "@/lib/categories";

export type SubmitState =
  | { status: "error"; message: string }
  | { status: "success"; message: string };

const MAX_PHOTO_SIZE = 5 * 1024 * 1024;
// Yalnızca güvenli raster formatları. SVG bilerek dışarıda: aynı origin'den servis edilen
// SVG gömülü script çalıştırabildiği için stored-XSS riski taşır.
const ALLOWED_PHOTO_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export type UploadPhotoResult = { url: string } | { error: string };

export async function uploadPhotoAction(formData: FormData): Promise<UploadPhotoResult> {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Dosya bulunamadı." };
  }
  const extension = ALLOWED_PHOTO_TYPES[file.type];
  if (!extension) {
    return { error: "Yalnızca JPG, PNG veya WebP görselleri yükleyebilirsiniz." };
  }
  if (file.size > MAX_PHOTO_SIZE) {
    return { error: "Dosya boyutu 5 MB'tan küçük olmalı." };
  }

  const filename = `${randomUUID()}.${extension}`;
  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadsDir, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadsDir, filename), buffer);

  return { url: `/uploads/${filename}` };
}

export async function createReportAction(input: {
  category: string;
  lat: number;
  lng: number;
  description: string;
  photoUrl: string;
}): Promise<SubmitState> {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");

  if (!CATEGORIES.some((c) => c.slug === input.category)) {
    return { status: "error", message: "Geçersiz kategori." };
  }
  if (!input.description.trim()) {
    return { status: "error", message: "Açıklama boş olamaz." };
  }

  const result = await submitReport({
    category: input.category,
    lat: input.lat,
    lng: input.lng,
    description: input.description.trim(),
    photoUrl: input.photoUrl.trim() || null,
    authorId: user.id,
  });

  switch (result.kind) {
    case "outside_geofence":
      return {
        status: "error",
        message:
          "Seçtiğiniz konum Beyoğlu sınırları dışında görünüyor. Paylaşım yalnızca Beyoğlu içinden yapılabilir.",
      };
    case "rate_limited":
      return {
        status: "error",
        message: "Çok sık paylaşım yapıyorsunuz. Lütfen birkaç dakika sonra tekrar deneyin.",
      };
    case "merged":
      revalidatePath("/");
      return {
        status: "success",
        message: "Bu olay zaten bildirilmişti, mevcut bildirime teyidiniz eklendi.",
      };
    case "created":
      revalidatePath("/");
      return { status: "success", message: "Paylaşımınız haritaya eklendi." };
  }
}
