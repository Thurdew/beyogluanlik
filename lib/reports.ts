import { prisma } from "./prisma";
import { isWithinBeyoglu } from "./geofence";
import { haversineMeters } from "./distance";

const REPORT_LIFETIME_MS = 24 * 60 * 60 * 1000;
const DUPLICATE_RADIUS_METERS = 150;
const DUPLICATE_WINDOW_MINUTES = 30;
const RATE_LIMIT_WINDOW_MINUTES = 2;

export type MapReport = {
  id: string;
  category: string;
  lat: number;
  lng: number;
  description: string;
  photoUrl: string | null;
  createdAt: string;
  trueCount: number;
  falseCount: number;
  authorName: string;
};

export async function getActiveReports(): Promise<MapReport[]> {
  const reports = await prisma.report.findMany({
    where: {
      status: "ACTIVE",
      expiresAt: { gt: new Date() },
    },
    include: {
      author: { select: { fullName: true } },
      confirmations: { select: { type: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return reports.map((r) => ({
    id: r.id,
    category: r.category,
    lat: r.lat,
    lng: r.lng,
    description: r.description,
    photoUrl: r.photoUrl,
    createdAt: r.createdAt.toISOString(),
    trueCount: r.confirmations.filter((c) => c.type === "TRUE").length,
    falseCount: r.confirmations.filter((c) => c.type === "FALSE").length,
    authorName: r.author.fullName,
  }));
}

export type ReportComment = {
  id: string;
  text: string;
  photoUrl: string | null;
  createdAt: string;
  authorName: string;
};

export type ReportDetail = MapReport & {
  status: "ACTIVE" | "UNDER_REVIEW" | "REMOVED";
  comments: ReportComment[];
};

export async function getReportDetail(reportId: string): Promise<ReportDetail | null> {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    include: {
      author: { select: { fullName: true } },
      confirmations: { select: { type: true } },
      comments: {
        include: { author: { select: { fullName: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!report) return null;

  return {
    id: report.id,
    category: report.category,
    lat: report.lat,
    lng: report.lng,
    description: report.description,
    photoUrl: report.photoUrl,
    createdAt: report.createdAt.toISOString(),
    status: report.status,
    trueCount: report.confirmations.filter((c) => c.type === "TRUE").length,
    falseCount: report.confirmations.filter((c) => c.type === "FALSE").length,
    authorName: report.author.fullName,
    comments: report.comments.map((c) => ({
      id: c.id,
      text: c.text,
      photoUrl: c.photoUrl,
      createdAt: c.createdAt.toISOString(),
      authorName: c.author.fullName,
    })),
  };
}

export type CreateReportInput = {
  category: string;
  lat: number;
  lng: number;
  description: string;
  photoUrl: string | null;
  authorId: string;
};

export type SubmitReportResult =
  | { kind: "created"; reportId: string }
  | { kind: "merged"; reportId: string }
  | { kind: "rate_limited" }
  | { kind: "outside_geofence" };

// Konum doğrulama (geofence) + spam engelleme (rate limit) + olay birleştirme (duplicate detection)
// tek bir akışta uygulanır: aynı kategori + yakın konum + son 30 dakika içindeki mevcut bir Report varsa
// yeni pin açmak yerine o Report'a teyit eklenir.
export async function submitReport(input: CreateReportInput): Promise<SubmitReportResult> {
  if (!isWithinBeyoglu(input.lat, input.lng)) {
    return { kind: "outside_geofence" };
  }

  const rateLimitSince = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000);
  const recentByUser = await prisma.report.count({
    where: { authorId: input.authorId, createdAt: { gt: rateLimitSince } },
  });
  if (recentByUser > 0) {
    return { kind: "rate_limited" };
  }

  const duplicateSince = new Date(Date.now() - DUPLICATE_WINDOW_MINUTES * 60 * 1000);
  const candidates = await prisma.report.findMany({
    where: {
      category: input.category,
      status: "ACTIVE",
      createdAt: { gt: duplicateSince },
    },
  });
  const duplicate = candidates.find(
    (r) => haversineMeters(r.lat, r.lng, input.lat, input.lng) <= DUPLICATE_RADIUS_METERS,
  );

  if (duplicate) {
    await prisma.confirmation.upsert({
      where: { reportId_userId: { reportId: duplicate.id, userId: input.authorId } },
      update: {},
      create: { reportId: duplicate.id, userId: input.authorId, type: "TRUE" },
    });
    return { kind: "merged", reportId: duplicate.id };
  }

  const createdAt = new Date();
  const report = await prisma.report.create({
    data: {
      category: input.category,
      lat: input.lat,
      lng: input.lng,
      description: input.description,
      photoUrl: input.photoUrl,
      authorId: input.authorId,
      createdAt,
      expiresAt: new Date(createdAt.getTime() + REPORT_LIFETIME_MS),
    },
  });
  return { kind: "created", reportId: report.id };
}
