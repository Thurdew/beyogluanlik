import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { BEYOGLU_CENTER } from "../lib/geofence";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

const HOURS_24 = 24 * 60 * 60 * 1000;

async function main() {
  const [centerLng, centerLat] = BEYOGLU_CENTER;

  const ayse = await prisma.user.upsert({
    where: { fakeTcNo: "11111111110" },
    update: {},
    create: {
      fullName: "Ayşe Yılmaz",
      fakeTcNo: "11111111110",
      trustScore: 12,
    },
  });

  const mehmet = await prisma.user.upsert({
    where: { fakeTcNo: "22222222220" },
    update: {},
    create: {
      fullName: "Mehmet Demir",
      fakeTcNo: "22222222220",
      trustScore: 4,
    },
  });

  const now = Date.now();

  const seedReports: {
    category: string;
    lat: number;
    lng: number;
    description: string;
    authorId: string;
    ageMs: number;
  }[] = [
    {
      category: "etkinlik",
      lat: centerLat + 0.002,
      lng: centerLng + 0.001,
      description: "İstiklal Caddesi'nde sokak müzisyenleri konseri var, kalabalık oluştu.",
      authorId: ayse.id,
      ageMs: 30 * 60 * 1000,
    },
    {
      category: "trafik",
      lat: centerLat - 0.003,
      lng: centerLng + 0.004,
      description: "Tarlabaşı Bulvarı'nda yoğun trafik, yol çalışması var.",
      authorId: mehmet.id,
      ageMs: 2 * 60 * 60 * 1000,
    },
    {
      category: "gurultu",
      lat: centerLat + 0.0015,
      lng: centerLng - 0.002,
      description: "Nevizade sokağında gece geç saatte yüksek ses şikayeti.",
      authorId: ayse.id,
      ageMs: 5 * 60 * 60 * 1000,
    },
  ];

  for (const r of seedReports) {
    const createdAt = new Date(now - r.ageMs);
    await prisma.report.create({
      data: {
        category: r.category,
        lat: r.lat,
        lng: r.lng,
        description: r.description,
        authorId: r.authorId,
        createdAt,
        expiresAt: new Date(createdAt.getTime() + HOURS_24),
      },
    });
  }

  console.log("Seed tamamlandı.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
