export type Ring = [number, number][];

/** Basit poligon centroid'i (dış halka üzerinden, alan-ağırlıklı). [lng, lat] döner. */
export function polygonCentroid(ring: Ring): [number, number] {
  let area = 0;
  let cx = 0;
  let cy = 0;

  for (let i = 0; i < ring.length - 1; i++) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[i + 1];
    const cross = x0 * y1 - x1 * y0;
    area += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }

  area *= 0.5;
  if (Math.abs(area) < 1e-12) {
    // Dejenere poligon: basit ortalamaya düş.
    const n = ring.length - 1;
    const sum = ring.slice(0, n).reduce(
      (acc, [x, y]) => [acc[0] + x, acc[1] + y],
      [0, 0],
    );
    return [sum[0] / n, sum[1] / n];
  }

  return [cx / (6 * area), cy / (6 * area)];
}

/** Shoelace formülüyle poligon alanı (derece cinsinden koordinatlarla, karşılaştırma amaçlı). */
export function polygonArea(ring: Ring): number {
  let area = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[i + 1];
    area += x0 * y1 - x1 * y0;
  }
  return Math.abs(area) / 2;
}

export type Bounds = { minLng: number; minLat: number; maxLng: number; maxLat: number };

export function getRingBounds(ring: Ring): Bounds {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const [lng, lat] of ring) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return { minLng, minLat, maxLng, maxLat };
}
