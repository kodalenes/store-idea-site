"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import {
  Plus,
  Search,
  ThumbsUp,
  MessageSquare,
  Paperclip,
  KanbanSquare,
  ExternalLink,
  Lightbulb,
  AlertCircle,
  X,
} from "lucide-react";
import { IDEA_CATEGORIES, IDEA_STATUSES } from "@/lib/constants";
import { useStudioStore } from "@/components/studio/studio-store";
import {
  createIdeaAction,
  toggleIdeaVoteAction,
} from "@/app/actions/ideas";
import type { IdeaFormValues } from "@/components/ideas/idea-form-modal";

const IdeaFormModal = dynamic(
  () =>
    import("@/components/ideas/idea-form-modal").then(
      (mod) => mod.IdeaFormModal
    ),
  { ssr: false }
);
import type {
  IdeaCategory,
  IdeaListItem,
  IdeaStatus,
} from "@/types/studio";

export function IdeasBoard() {
  const { ideas, setIdeas, currentProfile, isConfigured } = useStudioStore();
  const [ideaError, setIdeaError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<IdeaCategory | "all">(
    "all"
  );
  const [statusFilter, setStatusFilter] = useState<IdeaStatus | "all">("all");
  const [sortBy, setSortBy] = useState<"recent" | "votes">("recent");
  const [createOpen, setCreateOpen] = useState(false);

  const filteredIdeas = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = ideas.filter((idea) => {
      if (categoryFilter !== "all" && idea.category !== categoryFilter) {
        return false;
      }
      if (statusFilter !== "all" && idea.status !== statusFilter) {
        return false;
      }
      if (q) {
        const hay = `${idea.title} ${idea.summary} ${idea.content_md}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (sortBy === "votes") {
      return [...list].sort((a, b) => b.vote_count - a.vote_count);
    }
    return list;
  }, [ideas, search, categoryFilter, statusFilter, sortBy]);

  async function handleCreateIdea(values: IdeaFormValues) {
    setIdeaError(null);
    const trimmedTitle = values.title.trim();
    if (!trimmedTitle) {
      return { ok: false, error: "Fikir başlığı zorunludur." };
    }

    const tempId = `temp-idea-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();
    const optimisticIdea: IdeaListItem = {
      id: tempId,
      title: trimmedTitle,
      summary: values.summary.trim(),
      content_md: values.content_md,
      category: values.category,
      status: values.status,
      reference_links: values.reference_links,
      created_by: currentProfile?.id ?? null,
      created_at: now,
      updated_at: now,
      author: currentProfile ?? null,
      vote_count: 0,
      has_voted: false,
      comment_count: 0,
      attachment_count: 0,
      linked_task_count: 0,
      preview_image_url: null,
    };

    setIdeas((prev) => [optimisticIdea, ...prev]);

    try {
      const res = await createIdeaAction(values);
      if (!res.ok || !res.data?.id) {
        setIdeas((prev) => prev.filter((item) => item.id !== tempId));
        setIdeaError(
          res.error ?? "Fikir oluşturulamadı, değişiklik geri alındı."
        );
        return res;
      }

      const realId = res.data.id;
      const realCreatedAt = res.data.created_at || now;
      setIdeas((prev) =>
        prev.map((item) =>
          item.id === tempId
            ? {
                ...item,
                id: realId,
                created_at: realCreatedAt,
                updated_at: realCreatedAt,
              }
            : item
        )
      );
      return res;
    } catch {
      setIdeas((prev) => prev.filter((item) => item.id !== tempId));
      setIdeaError(
        "Bağlantı hatası: Fikir oluşturulamadı, değişiklik geri alındı."
      );
      return { ok: false, error: "Bağlantı hatası." };
    }
  }

  async function handleOptimisticVote(ideaId: string) {
    if (ideaId.startsWith("temp-")) return;
    setIdeaError(null);
    const prevItem = ideas.find((item) => item.id === ideaId);
    if (!prevItem) return;

    setIdeas((prev) =>
      prev.map((item) => {
        if (item.id !== ideaId) return item;
        const nextVoted = !item.has_voted;
        return {
          ...item,
          has_voted: nextVoted,
          vote_count: Math.max(0, item.vote_count + (nextVoted ? 1 : -1)),
        };
      })
    );

    try {
      const res = await toggleIdeaVoteAction(ideaId);
      if (!res.ok) {
        setIdeas((prev) =>
          prev.map((item) =>
            item.id === ideaId
              ? {
                  ...item,
                  has_voted: prevItem.has_voted,
                  vote_count: prevItem.vote_count,
                }
              : item
          )
        );
        setIdeaError(res.error ?? "Oy güncellenemedi, değişiklik geri alındı.");
      }
    } catch {
      setIdeas((prev) =>
        prev.map((item) =>
          item.id === ideaId
            ? {
                ...item,
                has_voted: prevItem.has_voted,
                vote_count: prevItem.vote_count,
              }
            : item
        )
      );
      setIdeaError("Bağlantı hatası: Oy değişikliği geri alındı.");
    }
  }

  return (
    <div className="space-y-6">
      {ideaError && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-200">
          <span className="inline-flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            {ideaError}
          </span>
          <button
            type="button"
            onClick={() => setIdeaError(null)}
            className="rounded p-1 text-rose-300 hover:bg-rose-500/20"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
            Fikirler & Mini-GDD Panosu
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Mekanik, hikaye, level ve VFX fikirlerinizi toplayın, görsellerle
            zenginleştirip oylayın ve tek tıkla göreve dönüştürün.
          </p>
        </div>

        <button
          type="button"
          disabled={!isConfigured}
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-xs font-semibold text-zinc-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Yeni Fikir Ekle
        </button>
      </div>

      {/* Compact Filters Toolbar */}
      <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-[#1f2735] bg-[#10141d] p-3">
        <div className="relative min-w-44 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Fikirlerde ara (ör. kanca, boss, niagara)..."
            className="w-full rounded-lg border border-[#242e40] bg-[#080a0f] py-1.5 pr-3 pl-8.5 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-amber-500/60 focus:outline-none"
          />
        </div>

        {/* Status Segmented Pills */}
        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-[#242e40] bg-[#080a0f] p-0.5">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
              statusFilter === "all"
                ? "bg-amber-500/20 text-amber-300"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Tümü ({ideas.length})
          </button>
          {IDEA_STATUSES.map((st) => {
            const count = ideas.filter(
              (i) => i.status === st.value
            ).length;
            return (
              <button
                key={st.value}
                type="button"
                onClick={() => setStatusFilter(st.value)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  statusFilter === st.value
                    ? "bg-amber-500/20 text-amber-300"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {st.label} ({count})
              </button>
            );
          })}
        </div>

        <select
          value={categoryFilter}
          onChange={(e) =>
            setCategoryFilter(e.target.value as IdeaCategory | "all")
          }
          className="rounded-lg border border-[#242e40] bg-[#080a0f] px-2.5 py-1.5 text-xs text-zinc-200 focus:border-amber-500/60 focus:outline-none"
        >
          <option value="all">Kategori: Tümü</option>
          {IDEA_CATEGORIES.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as "recent" | "votes")}
          className="rounded-lg border border-[#242e40] bg-[#080a0f] px-2.5 py-1.5 text-xs text-zinc-200 focus:border-amber-500/60 focus:outline-none"
        >
          <option value="recent">Son Güncellenen</option>
          <option value="votes">En Çok Oy Alan</option>
        </select>
      </div>

      {/* Idea Cards Grid */}
      {filteredIdeas.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#242e40] bg-[#0c1018] px-6 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
            <Lightbulb className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-zinc-100">
            {ideas.length === 0
              ? "Henüz fikir eklenmemiş"
              : "Filtrelere uyan fikir bulunamadı"}
          </h3>
          <p className="mt-1 max-w-md text-xs text-zinc-400">
            {ideas.length === 0
              ? "Aklınıza gelen ilk oyun mekaniğini, level fikrini veya görsel referansı ekleyerek ekibin GDD hafızasını başlatın."
              : "Arama kelimesini veya kategori/durum filtrelerini temizleyip tekrar deneyin."}
          </p>
          {ideas.length === 0 && isConfigured && (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-amber-400"
            >
              <Plus className="h-4 w-4" />
              İlk Fikri Ekle
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredIdeas.map((idea) => {
            const catMeta =
              IDEA_CATEGORIES.find((c) => c.value === idea.category) ??
              IDEA_CATEGORIES[0];
            const statusMeta =
              IDEA_STATUSES.find((s) => s.value === idea.status) ??
              IDEA_STATUSES[0];

            return (
              <article
                key={idea.id}
                className="group flex flex-col overflow-hidden rounded-xl border border-[#1f2735] bg-[#10141d] transition hover:border-amber-500/40"
              >
                {idea.preview_image_url && (
                  <Link
                    href={`/ideas/${idea.id}`}
                    className="relative block h-40 w-full overflow-hidden border-b border-[#1f2735] bg-[#080a0f]"
                  >
                    <Image
                      src={idea.preview_image_url}
                      alt={idea.title}
                      fill
                      unoptimized
                      className="object-cover transition duration-300 group-hover:scale-105"
                    />
                  </Link>
                )}

                <div className="flex flex-1 flex-col p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${catMeta.badgeClass}`}
                    >
                      {catMeta.label}
                    </span>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[10px] font-medium ${statusMeta.badgeClass}`}
                    >
                      {statusMeta.label}
                    </span>
                  </div>

                  {idea.id.startsWith("temp-") ? (
                    <span className="mt-3 block text-base font-semibold text-zinc-200">
                      {idea.title}{" "}
                      <span className="text-[11px] font-normal text-amber-300/80">
                        (Kaydediliyor...)
                      </span>
                    </span>
                  ) : (
                    <Link
                      href={`/ideas/${idea.id}`}
                      className="mt-3 block text-base font-semibold text-zinc-100 transition group-hover:text-amber-300"
                    >
                      {idea.title}
                    </Link>
                  )}

                  <p className="mt-1.5 line-clamp-2 flex-1 text-xs leading-relaxed text-zinc-400">
                    {idea.summary || "Kısa özet girilmemiş."}
                  </p>

                  {/* Meta Footer */}
                  <div className="mt-4 flex items-center justify-between border-t border-[#1b2230] pt-3">
                    <div className="flex items-center gap-2">
                      {idea.author ? (
                        <div className="flex items-center gap-1.5">
                          <span
                            className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-zinc-950"
                            style={{ backgroundColor: idea.author.avatar_color }}
                          >
                            {idea.author.display_name.slice(0, 2).toUpperCase()}
                          </span>
                          <span className="text-[11px] text-zinc-400">
                            {idea.author.display_name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-zinc-500">Ekip</span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-zinc-400">
                      {idea.reference_links.length > 0 && (
                        <span
                          title="Referans Linki"
                          className="inline-flex items-center gap-1"
                        >
                          <ExternalLink className="h-3.5 w-3.5 text-zinc-500" />
                          {idea.reference_links.length}
                        </span>
                      )}
                      {idea.attachment_count > 0 && (
                        <span
                          title="Görsel / Ek"
                          className="inline-flex items-center gap-1"
                        >
                          <Paperclip className="h-3.5 w-3.5 text-zinc-500" />
                          {idea.attachment_count}
                        </span>
                      )}
                      <span
                        title="Yorum"
                        className="inline-flex items-center gap-1"
                      >
                        <MessageSquare className="h-3.5 w-3.5 text-zinc-500" />
                        {idea.comment_count}
                      </span>
                      {idea.linked_task_count > 0 && (
                        <span
                          title="Bağlı Görev"
                          className="inline-flex items-center gap-1 text-cyan-300"
                        >
                          <KanbanSquare className="h-3.5 w-3.5" />
                          {idea.linked_task_count}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleOptimisticVote(idea.id)}
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold transition ${
                          idea.has_voted
                            ? "border-amber-500/50 bg-amber-500/20 text-amber-300"
                            : "border-[#242e40] bg-[#0b0f17] text-zinc-400 hover:border-amber-500/30 hover:text-zinc-200"
                        }`}
                      >
                        <ThumbsUp className="h-3 w-3" />
                        {idea.vote_count}
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <IdeaFormModal
        open={createOpen}
        mode="create"
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreateIdea}
      />
    </div>
  );
}
