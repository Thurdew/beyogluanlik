import { getBeyogluBoundingBox } from "./geofence";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

export type AddressResult = {
  label: string;
  lat: number;
  lng: number;
};

type NominatimResult = {
  display_name: string;
  lat: string;
  lon: string;
};

// OSM Nominatim "search" servisi; sonuçlar Beyoğlu sınır kutusuyla (bounded=1) önyargılı hale
// getirilir. Kesin geofence kontrolü yine de paylaşım anında isWithinBeyoglu ile yapılır — burası
// yalnızca arama kutusunu Beyoğlu'ya yakın sonuçlara yönlendirir.
export async function searchAddress(query: string): Promise<AddressResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  const [minLng, minLat, maxLng, maxLat] = getBeyogluBoundingBox();
  const params = new URLSearchParams({
    format: "json",
    q: trimmed,
    countrycodes: "tr",
    viewbox: `${minLng},${maxLat},${maxLng},${minLat}`,
    bounded: "1",
    limit: "5",
  });

  let res: Response;
  try {
    res = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
      headers: {
        "User-Agent": "BeyogluAnlik/1.0",
        "Accept-Language": "tr",
      },
      cache: "no-store",
    });
  } catch {
    return [];
  }

  if (!res.ok) return [];

  const data: NominatimResult[] = await res.json();
  return data
    .map((r) => ({ label: r.display_name, lat: Number(r.lat), lng: Number(r.lon) }))
    .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng));
}
