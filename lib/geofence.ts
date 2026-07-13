// Beyoğlu ilçe sınırının kabaca basitleştirilmiş bir poligonu (demo amaçlı, resmi sınır verisi değil).
// [lng, lat] sırasıyla.
export const BEYOGLU_BOUNDARY: [number, number][] = [
  [28.97, 41.023],
  [28.96, 41.03],
  [28.965, 41.042],
  [28.98, 41.048],
  [28.995, 41.045],
  [29.005, 41.038],
  [28.995, 41.03],
  [28.98, 41.025],
  [28.975, 41.022],
  [28.97, 41.023],
];

export const BEYOGLU_CENTER: [number, number] = [28.9784, 41.035];

/** Ray-casting point-in-polygon. `point` ve `polygon` [lng, lat] formatında. */
export function isPointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersects =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/** Konum doğrulama (geofence) simülasyonu: paylaşımın Beyoğlu sınırları içinde olup olmadığını kontrol eder. */
export function isWithinBeyoglu(lat: number, lng: number): boolean {
  return isPointInPolygon([lng, lat], BEYOGLU_BOUNDARY);
}
