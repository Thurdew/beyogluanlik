"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getCategory } from "@/lib/categories";
import { timeAgo } from "@/lib/time";
import type { ReportDetail } from "@/lib/reports";
import { confirmReportAction } from "@/app/actions";
import { fetchReportDetailAction, addCommentAction } from "@/app/actions";
import { uploadPhotoAction } from "@/app/bildir/actions";

export function ReportDetailModal({
  reportId,
  onClose,
}: {
  reportId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [detail, setDetail] = useState<ReportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isVoting, setIsVoting] = useState(false);

  const [commentText, setCommentText] = useState("");
  const [commentPhotoUrl, setCommentPhotoUrl] = useState("");
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

  async function loadDetail() {
    const data = await fetchReportDetailAction(reportId);
    setDetail(data);
    setLoading(false);
  }

  useEffect(() => {
    loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId]);

  async function handleVote(type: "TRUE" | "FALSE") {
    setIsVoting(true);
    await confirmReportAction(reportId, type);
    await loadDetail();
    router.refresh();
    setIsVoting(false);
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingPhoto(true);
    const formData = new FormData();
    formData.append("photo", file);
    const result = await uploadPhotoAction(formData);
    setIsUploadingPhoto(false);

    if ("error" in result) {
      setCommentError(result.error);
      return;
    }
    setCommentPhotoUrl(result.url);
  }

  async function handleCommentSubmit() {
    setCommentError(null);
    if (!commentText.trim()) {
      setCommentError("Lütfen bir yorum yazın.");
      return;
    }
    setIsSubmittingComment(true);
    const result = await addCommentAction(reportId, commentText, commentPhotoUrl);
    setIsSubmittingComment(false);

    if (result.status === "error") {
      setCommentError(result.message);
      return;
    }
    setCommentText("");
    setCommentPhotoUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    await loadDetail();
  }

  const category = detail ? getCategory(detail.category) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {loading || !detail || !category ? (
          <div className="flex h-64 items-center justify-center text-sm text-gray-500">
            Yükleniyor...
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <span
                className="text-lg font-bold"
                style={{ color: category.color }}
              >
                {category.icon} {category.label}
              </span>
              <button
                type="button"
                onClick={onClose}
                aria-label="Kapat"
                className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-4">
              {detail.photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={detail.photoUrl}
                  alt={detail.description}
                  className="mb-4 max-h-72 w-full rounded-xl object-cover"
                />
              )}

              <p className="text-[15px] leading-relaxed text-gray-900">{detail.description}</p>
              <p className="mt-2 text-xs text-gray-500">
                {timeAgo(detail.createdAt)} · {detail.authorName}
              </p>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => handleVote("TRUE")}
                  disabled={isVoting}
                  className="flex-1 rounded-lg border border-green-600 py-2 text-sm font-medium text-green-700 hover:bg-green-50 disabled:opacity-50"
                >
                  ✅ Doğru ({detail.trueCount})
                </button>
                <button
                  type="button"
                  onClick={() => handleVote("FALSE")}
                  disabled={isVoting}
                  className="flex-1 rounded-lg border border-red-600 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  ⚠️ Asılsız ({detail.falseCount})
                </button>
              </div>

              <div className="mt-6 border-t border-gray-100 pt-4">
                <h3 className="text-sm font-semibold text-gray-900">
                  Yorumlar ({detail.comments.length})
                </h3>

                {detail.comments.length === 0 ? (
                  <p className="mt-2 text-sm text-gray-500">Henüz yorum yok.</p>
                ) : (
                  <ul className="mt-3 flex flex-col gap-3">
                    {detail.comments.map((c) => (
                      <li key={c.id} className="rounded-lg bg-gray-50 p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-800">
                            {c.authorName}
                          </span>
                          <span className="text-xs text-gray-400">{timeAgo(c.createdAt)}</span>
                        </div>
                        <p className="mt-1 text-sm text-gray-700">{c.text}</p>
                        {c.photoUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={c.photoUrl}
                            alt={c.text}
                            className="mt-2 max-h-40 w-full rounded-md object-cover"
                          />
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-4">
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    rows={2}
                    placeholder="Bir yorum yaz..."
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                  />

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoChange}
                  />

                  {commentPhotoUrl && (
                    <div className="mt-2 flex items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={commentPhotoUrl}
                        alt="Eklenen fotoğraf"
                        className="h-14 w-14 rounded-md border border-gray-200 object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setCommentPhotoUrl("")}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Kaldır
                      </button>
                    </div>
                  )}

                  {commentError && (
                    <p className="mt-2 text-xs text-red-600">{commentError}</p>
                  )}

                  <div className="mt-2 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingPhoto}
                      className="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      📷 {isUploadingPhoto ? "Yükleniyor..." : "Fotoğraf Ekle"}
                    </button>
                    <button
                      type="button"
                      onClick={handleCommentSubmit}
                      disabled={isSubmittingComment || isUploadingPhoto}
                      className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {isSubmittingComment ? "Gönderiliyor..." : "Yorum Yap"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
