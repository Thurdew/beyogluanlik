"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES, getCategory } from "@/lib/categories";
import { BEYOGLU_CENTER } from "@/lib/geofence";
import { LocationPicker } from "./LocationPicker";
import { createReportAction, uploadPhotoAction } from "@/app/bildir/actions";

export function ReportForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [category, setCategory] = useState(CATEGORIES[0].slug);
  const [location, setLocation] = useState<{ lat: number; lng: number }>({
    lat: BEYOGLU_CENTER[1],
    lng: BEYOGLU_CENTER[0],
  });
  const [description, setDescription] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);

  const selectedCategory = getCategory(category);

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoError(null);
    setIsUploadingPhoto(true);
    const formData = new FormData();
    formData.append("photo", file);
    const result = await uploadPhotoAction(formData);
    setIsUploadingPhoto(false);

    if ("error" in result) {
      setPhotoError(result.error);
      return;
    }
    setPhotoUrl(result.url);
  }

  function removePhoto() {
    setPhotoUrl("");
    setPhotoError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleSubmitClick() {
    setError(null);
    if (!description.trim()) {
      setError("Lütfen kısa bir açıklama yazın.");
      return;
    }
    if (isUploadingPhoto) {
      setError("Fotoğraf yükleniyor, lütfen bekleyin.");
      return;
    }
    if (selectedCategory.isEmergency) {
      setShowEmergencyModal(true);
      return;
    }
    doSubmit();
  }

  async function doSubmit() {
    setShowEmergencyModal(false);
    setIsSubmitting(true);
    const result = await createReportAction({
      category,
      lat: location.lat,
      lng: location.lng,
      description,
      photoUrl,
    });
    if (result.status === "error") {
      setError(result.message);
      setIsSubmitting(false);
    } else {
      router.push("/");
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold text-gray-900">Olay Bildir</h1>

      <div>
        <label className="block text-sm font-medium text-gray-700">Kategori</label>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {CATEGORIES.map((c) => (
            <button
              key={c.slug}
              type="button"
              onClick={() => setCategory(c.slug)}
              className={`rounded-md border px-3 py-2 text-sm ${
                category === c.slug
                  ? "border-blue-600 bg-blue-50 text-blue-700"
                  : "border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
            >
              {c.icon} {c.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Konum</label>
        <p className="mt-1 text-xs text-gray-500">
          Haritaya tıklayarak veya işaretçiyi sürükleyerek konum seçin. Paylaşım yalnızca Beyoğlu
          sınırları içinde yapılabilir (konum doğrulama simülasyonu).
        </p>
        <div className="mt-2 h-64 overflow-hidden rounded-md border border-gray-300">
          <LocationPicker value={location} onChange={setLocation} />
        </div>
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700">
          Açıklama
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
          placeholder="Kısaca ne oldu?"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Fotoğraf (opsiyonel)</label>
        <p className="mt-1 text-xs text-gray-500">
          Bilgisayarından bir dosya seç ya da telefondaysan kamera/galeriden fotoğraf ekle.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handlePhotoChange}
        />

        {photoUrl ? (
          <div className="mt-2 flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoUrl}
              alt="Seçilen fotoğraf"
              className="h-20 w-20 rounded-md border border-gray-200 object-cover"
            />
            <button
              type="button"
              onClick={removePhoto}
              className="text-sm text-red-600 hover:underline"
            >
              Kaldır
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploadingPhoto}
            className="mt-2 flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            📷 {isUploadingPhoto ? "Yükleniyor..." : "Fotoğraf Seç"}
          </button>
        )}

        {photoError && <p className="mt-1 text-xs text-red-600">{photoError}</p>}
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => router.push("/")}
          disabled={isSubmitting}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Vazgeç
        </button>
        <button
          type="button"
          onClick={handleSubmitClick}
          disabled={isSubmitting}
          className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting ? "Gönderiliyor..." : "Paylaş"}
        </button>
      </div>

      {showEmergencyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl">
            <h2 className="text-base font-semibold text-gray-900">Bu hayati bir tehlike mi?</h2>
            <p className="mt-2 text-sm text-gray-600">
              Bu uygulama bir acil durum ihbar kanalı değildir. Can veya mal güvenliğini tehdit
              eden bir durum varsa lütfen hemen 112&apos;yi arayın.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <a
                href="tel:112"
                className="rounded-md bg-red-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-red-700"
              >
                112&apos;yi Ara
              </a>
              <button
                type="button"
                onClick={doSubmit}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Hayır, sadece bilgilendirme amaçlı paylaşıyorum
              </button>
              <button
                type="button"
                onClick={() => setShowEmergencyModal(false)}
                className="text-center text-sm text-gray-500 hover:underline"
              >
                Vazgeç
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
