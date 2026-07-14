// Beyoğlu ilçe sınırı: OpenStreetMap'in resmi idari sınır poligonundan (relation 1765892)
// alınıp Douglas-Peucker ile (~40m tolerans) sadeleştirilmiştir. [lng, lat] sırasıyla.
export const BEYOGLU_BOUNDARY: [number, number][] = [
  [28.939012, 41.049334],
  [28.941535, 41.045489],
  [28.946775, 41.043069],
  [28.948329, 41.041106],
  [28.949098, 41.041377],
  [28.948604, 41.040883],
  [28.950151, 41.03923],
  [28.950779, 41.037496],
  [28.952284, 41.035749],
  [28.953057, 41.035858],
  [28.952617, 41.035394],
  [28.953614, 41.035761],
  [28.952414, 41.034889],
  [28.955713, 41.033834],
  [28.960882, 41.033878],
  [28.96062, 41.033508],
  [28.964831, 41.030707],
  [28.96568, 41.031135],
  [28.967288, 41.028905],
  [28.96653, 41.028932],
  [28.966072, 41.027995],
  [28.966722, 41.027676],
  [28.967174, 41.024888],
  [28.971108, 41.021953],
  [28.976447, 41.021781],
  [28.976992, 41.021128],
  [28.976764, 41.021841],
  [28.988564, 41.02812],
  [28.988881, 41.02841],
  [28.988252, 41.028169],
  [28.988119, 41.028931],
  [28.988696, 41.028785],
  [28.990137, 41.031065],
  [28.992112, 41.03261],
  [28.992701, 41.032701],
  [28.992772, 41.031829],
  [28.992843, 41.032735],
  [28.993627, 41.03312],
  [28.994381, 41.032615],
  [28.993708, 41.033209],
  [28.994507, 41.033776],
  [28.993905, 41.033856],
  [28.993812, 41.034399],
  [28.994391, 41.034501],
  [28.993798, 41.034998],
  [28.995784, 41.036773],
  [28.993192, 41.039091],
  [28.991075, 41.039268],
  [28.989755, 41.040241],
  [28.983082, 41.041791],
  [28.982017, 41.040945],
  [28.977751, 41.044369],
  [28.977158, 41.044187],
  [28.975908, 41.045674],
  [28.973838, 41.04602],
  [28.970916, 41.044671],
  [28.968068, 41.045565],
  [28.968009, 41.047699],
  [28.962706, 41.050921],
  [28.961999, 41.053202],
  [28.960051, 41.052925],
  [28.955537, 41.053673],
  [28.955756, 41.055704],
  [28.954913, 41.058778],
  [28.94958, 41.062569],
  [28.94844, 41.064434],
  [28.947283, 41.061997],
  [28.948475, 41.05756],
  [28.947706, 41.055521],
  [28.940272, 41.052536],
  [28.939357, 41.05146],
  [28.939012, 41.049334],
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

/** BEYOGLU_BOUNDARY'yi çevreleyen [minLng, minLat, maxLng, maxLat] kutusu; adres arama gibi bölgeye önyargılı sorgular için. */
export function getBeyogluBoundingBox(): [number, number, number, number] {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const [lng, lat] of BEYOGLU_BOUNDARY) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return [minLng, minLat, maxLng, maxLat];
}
