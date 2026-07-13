import { isWithinBeyoglu } from "./geofence";

const COLLECTAPI_URL = "https://api.collectapi.com/health/dutyPharmacy";
const CACHE_SECONDS = 6 * 60 * 60;

export type DutyPharmacy = {
  name: string;
  address: string;
  phone: string;
  district: string;
  lat: number;
  lng: number;
};

type CollectApiPharmacy = {
  name: string;
  dist: string;
  address: string;
  phone: string;
  loc: string;
};

type CollectApiResponse = {
  success: boolean;
  result: CollectApiPharmacy[];
};

// CollectAPI "Nöbetçi Eczane" servisi; il/ilçe bazlı sorgulanır, konum "lat,lng" string'i
// olarak "loc" alanında döner. Veri gün içinde sık değişmediği için birkaç saat cache'lenir.
export async function getDutyPharmacies(): Promise<DutyPharmacy[]> {
  const apiKey = process.env.COLLECTAPI_KEY;
  if (!apiKey) return [];

  const url = `${COLLECTAPI_URL}?il=${encodeURIComponent("İstanbul")}&ilce=${encodeURIComponent("Beyoğlu")}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        authorization: `apikey ${apiKey}`,
        "content-type": "application/json",
      },
      next: { revalidate: CACHE_SECONDS },
    });
  } catch {
    return [];
  }

  if (!res.ok) return [];

  const data: CollectApiResponse = await res.json();
  if (!data.success) return [];

  const pharmacies: DutyPharmacy[] = [];
  for (const p of data.result) {
    const [latStr, lngStr] = p.loc.split(",");
    const lat = Number(latStr);
    const lng = Number(lngStr);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    // CollectAPI ilçe filtresi metin bazlı; döndürdüğü konum bazen Beyoğlu sınırları dışına
    // düşebiliyor (ör. komşu ilçedeki bir eczane "BEYOĞLU" olarak etiketlenmiş olabilir).
    if (!isWithinBeyoglu(lat, lng)) continue;
    pharmacies.push({ name: p.name, address: p.address, phone: p.phone, district: p.dist, lat, lng });
  }
  return pharmacies;
}
