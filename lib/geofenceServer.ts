import { promises as fs } from "fs";
import path from "path";
import { isPointInPolygon, isWithinBeyoglu } from "./geofence";

// Sadece sunucuda kullanılır (fs erişimi). Client tarafı geofence.ts'i (kaba poligon) kullanır.

type Ring = [number, number][];
let cachedRings: Ring[] | null = null;

async function loadMahalleRings(): Promise<Ring[]> {
  if (cachedRings) return cachedRings;
  const file = path.join(process.cwd(), "public", "data", "beyoglu-mahalleler.geojson");
  const raw = await fs.readFile(file, "utf8");
  const geojson = JSON.parse(raw) as {
    features: { geometry: { coordinates: number[][][] } }[];
  };
  cachedRings = geojson.features.map((f) => f.geometry.coordinates[0] as Ring);
  return cachedRings;
}

/**
 * Yetkili (sunucu tarafı) konum doğrulaması: nokta gerçek Beyoğlu sınırının — yani 27 mahalle
 * poligonunun birleşiminin — içinde mi. Haritada çizilen sınırla birebir tutarlıdır.
 * Geojson okunamazsa kaba poligona (isWithinBeyoglu) düşer.
 */
export async function isWithinBeyogluStrict(lat: number, lng: number): Promise<boolean> {
  try {
    const rings = await loadMahalleRings();
    return rings.some((ring) => isPointInPolygon([lng, lat], ring));
  } catch {
    return isWithinBeyoglu(lat, lng);
  }
}
