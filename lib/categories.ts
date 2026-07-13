export type Category = {
  slug: string;
  label: string;
  color: string;
  icon: string;
  /** Seçildiğinde paylaşımdan önce "112'yi arayın" uyarısı gösterilir. */
  isEmergency: boolean;
};

export const CATEGORIES: Category[] = [
  { slug: "yangin", label: "Yangın", color: "#ef4444", icon: "🔥", isEmergency: true },
  { slug: "kaza", label: "Trafik Kazası", color: "#f97316", icon: "🚧", isEmergency: true },
  { slug: "trafik", label: "Trafik Yoğunluğu", color: "#eab308", icon: "🚗", isEmergency: false },
  { slug: "etkinlik", label: "Etkinlik", color: "#22c55e", icon: "🎉", isEmergency: false },
  { slug: "gurultu", label: "Gürültü", color: "#3b82f6", icon: "🔊", isEmergency: false },
  { slug: "altyapi", label: "Altyapı Arızası", color: "#8b5cf6", icon: "🚰", isEmergency: false },
  { slug: "diger", label: "Diğer", color: "#6b7280", icon: "📍", isEmergency: false },
];

export function getCategory(slug: string): Category {
  return CATEGORIES.find((c) => c.slug === slug) ?? CATEGORIES[CATEGORIES.length - 1];
}
