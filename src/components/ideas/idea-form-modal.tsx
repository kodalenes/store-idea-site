"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { X, Plus, Trash2, Eye, Edit3, AlertCircle } from "lucide-react";
import { IDEA_CATEGORIES, IDEA_STATUSES } from "@/lib/constants";

const MarkdownViewer = dynamic(
  () =>
    import("@/components/ideas/markdown-viewer").then(
      (mod) => mod.MarkdownViewer
    ),
  { ssr: false }
);
import type {
  IdeaCategory,
  IdeaReferenceLink,
  IdeaStatus,
} from "@/types/studio";

export interface IdeaFormValues {
  title: string;
  summary: string;
  content_md: string;
  category: IdeaCategory;
  status: IdeaStatus;
  reference_links: IdeaReferenceLink[];
}

export function IdeaFormModal({
  open,
  mode,
  initialValues,
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: "create" | "edit";
  initialValues?: IdeaFormValues;
  onClose: () => void;
  onSubmit: (values: IdeaFormValues) => Promise<{ ok: boolean; error?: string }> | void;
}) {
  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [summary, setSummary] = useState(initialValues?.summary ?? "");
  const [contentMd, setContentMd] = useState(initialValues?.content_md ?? "");
  const [category, setCategory] = useState<IdeaCategory>(
    initialValues?.category ?? "mechanic"
  );
  const [status, setStatus] = useState<IdeaStatus>(
    initialValues?.status ?? "raw"
  );
  const [links, setLinks] = useState<IdeaReferenceLink[]>(
    initialValues?.reference_links ?? []
  );
  const [newLabel, setNewLabel] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [previewMode, setPreviewMode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  function handleAddLink() {
    const cleanUrl = newUrl.trim();
    if (!cleanUrl) return;
    let formattedUrl = cleanUrl;
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = `https://${formattedUrl}`;
    }
    const label = newLabel.trim() || new URL(formattedUrl).hostname;
    setLinks((prev) => [...prev, { label, url: formattedUrl }]);
    setNewLabel("");
    setNewUrl("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (title.trim().length < 2) {
      setError("Fikir başlığı en az 2 karakter olmalı.");
      return;
    }
    setError(null);
    const values: IdeaFormValues = {
      title: title.trim(),
      summary,
      content_md: contentMd,
      category,
      status,
      reference_links: links,
    };

    onClose();
    void onSubmit(values);
  }

  return (
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-60 flex items-center justify-center bg-black/75 p-2.5 sm:p-4 backdrop-blur-xs"
    >
      <div className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#242e40] bg-[#0e131c] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1f2735] px-6 py-4">
          <h2 className="text-base font-semibold text-zinc-100">
            {mode === "create" ? "Yeni Fikir / Mini-GDD Ekle" : "Fikri Düzenle"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto p-6">
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-zinc-300">
              Fikir Başlığı
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Örn. Kanca (Grappling Hook) ile Duvar Koşusu"
              className="w-full rounded-lg border border-[#242e40] bg-[#080a0f] px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500/60 focus:outline-none"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-300">
                Kategori
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as IdeaCategory)}
                className="w-full rounded-lg border border-[#242e40] bg-[#080a0f] px-3 py-2 text-sm text-zinc-100 focus:border-amber-500/60 focus:outline-none"
              >
                {IDEA_CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-300">
                Durum
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as IdeaStatus)}
                className="w-full rounded-lg border border-[#242e40] bg-[#080a0f] px-3 py-2 text-sm text-zinc-100 focus:border-amber-500/60 focus:outline-none"
              >
                {IDEA_STATUSES.map((st) => (
                  <option key={st.value} value={st.value}>
                    {st.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-zinc-300">
              Kısa Özet (Kart üzerinde görünür)
            </label>
            <input
              type="text"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              maxLength={300}
              placeholder="Tek cümleyle bu fikir oyuna ne katıyor?"
              className="w-full rounded-lg border border-[#242e40] bg-[#080a0f] px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500/60 focus:outline-none"
            />
          </div>

          {/* Markdown Editor + Preview */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-zinc-300">
                Detaylı Tasarım Notu (Markdown destekli)
              </label>
              <button
                type="button"
                onClick={() => setPreviewMode((p) => !p)}
                className="inline-flex items-center gap-1 rounded-md border border-[#242e40] bg-[#131926] px-2.5 py-1 text-[11px] font-medium text-zinc-300 hover:text-amber-300"
              >
                {previewMode ? (
                  <>
                    <Edit3 className="h-3 w-3" />
                    Düzenle
                  </>
                ) : (
                  <>
                    <Eye className="h-3 w-3" />
                    Önizle
                  </>
                )}
              </button>
            </div>

            {previewMode ? (
              <div className="min-h-44 rounded-lg border border-[#242e40] bg-[#080a0f] p-4">
                <MarkdownViewer content={contentMd} />
              </div>
            ) : (
              <textarea
                rows={7}
                value={contentMd}
                onChange={(e) => setContentMd(e.target.value)}
                placeholder={`## Mekanik Nasıl Çalışır?\n- Sağ tık ile kanca atılır\n- \`CMC\` momentum korunur\n- [ ] UE5 Prototip testi`}
                className="w-full rounded-lg border border-[#242e40] bg-[#080a0f] px-3 py-2 font-mono text-xs leading-relaxed text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500/60 focus:outline-none"
              />
            )}
          </div>

          {/* Reference Links */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-zinc-300">
              Referans Linkleri (YouTube, ArtStation, Pinterest vb.)
            </label>

            {links.length > 0 && (
              <div className="space-y-1.5">
                {links.map((link, idx) => (
                  <div
                    key={`${link.url}-${idx}`}
                    className="flex items-center justify-between gap-2 rounded-lg border border-[#1f2735] bg-[#080a0f] px-3 py-1.5 text-xs"
                  >
                    <div className="min-w-0 truncate">
                      <span className="font-medium text-amber-300">
                        {link.label}
                      </span>
                      <span className="mx-2 text-zinc-600">•</span>
                      <span className="text-zinc-400">{link.url}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setLinks((prev) => prev.filter((_, i) => i !== idx))
                      }
                      className="text-zinc-500 hover:text-rose-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Etiket (ör. Referans Video)"
                className="sm:w-44 rounded-lg border border-[#242e40] bg-[#080a0f] px-3 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500/60 focus:outline-none"
              />
              <input
                type="text"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                className="flex-1 rounded-lg border border-[#242e40] bg-[#080a0f] px-3 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500/60 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddLink}
                className="inline-flex items-center justify-center gap-1 rounded-lg border border-[#242e40] bg-[#151b26] px-3 py-1.5 text-xs font-medium text-zinc-200 hover:border-amber-500/40 hover:text-amber-300"
              >
                <Plus className="h-3.5 w-3.5" />
                Ekle
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-[#1f2735] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[#242e40] px-4 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
            >
              İptal
            </button>
            <button
              type="submit"
              className="rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-amber-400"
            >
              {mode === "create" ? "Fikri Oluştur" : "Değişiklikleri Kaydet"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
