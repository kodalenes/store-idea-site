"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  LayoutGrid,
  Grid2x2,
  List,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import {
  IDEA_CATEGORIES,
  IDEA_STATUSES,
  TASK_STATUSES,
} from "@/lib/constants";
import { useStudioStore } from "@/components/studio/studio-store";
import {
  createIdeaAction,
  toggleIdeaVoteAction,
  updateIdeaStatusAction,
} from "@/app/actions/ideas";
import type { IdeaFormValues } from "@/components/ideas/idea-form-modal";
import type {
  IdeaCategory,
  IdeaListItem,
  IdeaStatus,
  TaskBoardItem,
} from "@/types/studio";

const IdeaFormModal = dynamic(
  () =>
    import("@/components/ideas/idea-form-modal").then(
      (mod) => mod.IdeaFormModal
    ),
  { ssr: false }
);

type IdeaSectionTab = "split" | "active" | "converted";

export function IdeasBoard() {
  const {
    ideas,
    setIdeas,
    tasks,
    currentProfile,
    isConfigured,
    ideasViewMode,
    setIdeasViewMode,
    navigateTab,
  } = useStudioStore();

  const [ideaError, setIdeaError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<IdeaCategory | "all">(
    "all"
  );
  const [statusFilter, setStatusFilter] = useState<IdeaStatus | "all">("all");
  const [sortBy, setSortBy] = useState<"recent" | "votes">("recent");
  const [sectionTab, setSectionTab] = useState<IdeaSectionTab>("split");
  const [createStage, setCreateStage] = useState<IdeaStatus | null>(null);

  // Kanban Drag, Horizontal Pan & Mobile Column State
  const [draggedIdeaId, setDraggedIdeaId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<IdeaStatus | null>(null);
  const [mobileActiveStage, setMobileActiveStage] =
    useState<IdeaStatus>("random");
  const boardScrollRef = useRef<HTMLDivElement | null>(null);
  const panStateRef = useRef<{
    startX: number;
    startScrollLeft: number;
  } | null>(null);
  const [isPanning, setIsPanning] = useState(false);

  useEffect(() => {
    if (!isPanning) return;

    function handleWindowMouseMove(e: MouseEvent) {
      const state = panStateRef.current;
      const el = boardScrollRef.current;
      if (!state || !el) return;
      el.scrollLeft = state.startScrollLeft - (e.clientX - state.startX);
    }

    function handleWindowMouseUp() {
      panStateRef.current = null;
      setIsPanning(false);
    }

    window.addEventListener("mousemove", handleWindowMouseMove);
    window.addEventListener("mouseup", handleWindowMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleWindowMouseMove);
      window.removeEventListener("mouseup", handleWindowMouseUp);
    };
  }, [isPanning]);

  function handleBoardMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (e.button !== 0 || !boardScrollRef.current) return;
    const target = e.target as HTMLElement | null;
    if (
      target?.closest(
        "[data-idea-card], button, select, input, textarea, a, label"
      )
    ) {
      return;
    }

    panStateRef.current = {
      startX: e.clientX,
      startScrollLeft: boardScrollRef.current.scrollLeft,
    };
    setIsPanning(true);
  }

  const linkedTasksByIdea = useMemo(() => {
    const map = new Map<string, TaskBoardItem[]>();
    for (const task of tasks) {
      if (!task.source_idea_id) continue;
      const arr = map.get(task.source_idea_id) ?? [];
      arr.push(task);
      map.set(task.source_idea_id, arr);
    }
    return map;
  }, [tasks]);

  const { totalActiveCount, totalConvertedCount, activeIdeas, convertedIdeas } =
    useMemo(() => {
      const q = search.trim().toLowerCase();

      const isConverted = (idea: IdeaListItem) =>
        idea.linked_task_count > 0 ||
        (linkedTasksByIdea.get(idea.id)?.length ?? 0) > 0;

      const totalConverted = ideas.filter(isConverted).length;
      const totalActive = ideas.length - totalConverted;

      const matches = ideas.filter((idea) => {
        if (categoryFilter !== "all" && idea.category !== categoryFilter) {
          return false;
        }
        if (statusFilter !== "all" && idea.status !== statusFilter) {
          return false;
        }
        if (q) {
          const hay =
            `${idea.title} ${idea.summary} ${idea.content_md}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });

      const ordered =
        sortBy === "votes"
          ? [...matches].sort((a, b) => b.vote_count - a.vote_count)
          : matches;

      return {
        totalActiveCount: totalActive,
        totalConvertedCount: totalConverted,
        activeIdeas: ordered.filter((idea) => !isConverted(idea)),
        convertedIdeas: ordered.filter(isConverted),
      };
    }, [
      ideas,
      linkedTasksByIdea,
      search,
      categoryFilter,
      statusFilter,
      sortBy,
    ]);

  async function handleCreateIdea(values: IdeaFormValues) {
    setIdeaError(null);
    const trimmedTitle = values.title.trim();
    if (!trimmedTitle) {
      return { ok: false, error: "Fikir başlığı zorunludur." };
    }

    const tempId = `temp-idea-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 7)}`;
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

  async function handleMoveIdeaStage(ideaId: string, nextStage: IdeaStatus) {
    if (ideaId.startsWith("temp-")) return;
    const prevItem = ideas.find((item) => item.id === ideaId);
    if (!prevItem || prevItem.status === nextStage) return;

    const prevStatus = prevItem.status;
    const prevUpdatedAt = prevItem.updated_at;
    setIdeaError(null);

    setIdeas((prev) =>
      prev.map((item) =>
        item.id === ideaId
          ? { ...item, status: nextStage, updated_at: new Date().toISOString() }
          : item
      )
    );

    try {
      const res = await updateIdeaStatusAction(ideaId, nextStage);
      if (!res.ok) {
        setIdeas((prev) =>
          prev.map((item) =>
            item.id === ideaId
              ? { ...item, status: prevStatus, updated_at: prevUpdatedAt }
              : item
          )
        );
        setIdeaError(
          res.error ?? "Fikir aşaması güncellenemedi, değişiklik geri alındı."
        );
      }
    } catch {
      setIdeas((prev) =>
        prev.map((item) =>
          item.id === ideaId
            ? { ...item, status: prevStatus, updated_at: prevUpdatedAt }
            : item
        )
      );
      setIdeaError("Bağlantı hatası: Fikir aşaması değişikliği geri alındı.");
    }
  }

  function renderIdeaKanban(list: IdeaListItem[], allowColumnCreate: boolean) {
    return (
      <div className="space-y-3">
        {/* Mobile Stage Switcher */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 md:hidden">
          {IDEA_STATUSES.map((col) => {
            const count = list.filter((i) => i.status === col.value).length;
            const active = mobileActiveStage === col.value;
            return (
              <button
                key={col.value}
                type="button"
                onClick={() => setMobileActiveStage(col.value)}
                className={`shrink-0 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                  active
                    ? "border-amber-500/50 bg-amber-500/15 text-amber-300"
                    : "border-[#1f2735] bg-[#0c1018] text-zinc-400"
                }`}
              >
                {col.label} ({count})
              </button>
            );
          })}
        </div>

        {/* 4 Stage Columns (bounded height + column scroll + left-click horizontal pan) */}
        <div
          ref={boardScrollRef}
          onMouseDown={handleBoardMouseDown}
          className={`flex flex-col gap-4 pb-2 md:h-[490px] md:flex-row md:overflow-x-auto md:overflow-y-hidden xl:h-[520px] ${
            isPanning ? "md:cursor-grabbing select-none" : "md:cursor-grab"
          }`}
        >
          {IDEA_STATUSES.map((column) => {
            const colIdeas = list.filter((i) => i.status === column.value);
            const isDropTarget = dragOverStage === column.value;
            const isMobileActive = mobileActiveStage === column.value;

            return (
              <div
                key={column.value}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragOverStage !== column.value) {
                    setDragOverStage(column.value);
                  }
                }}
                onDragLeave={() => {
                  if (dragOverStage === column.value) {
                    setDragOverStage(null);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverStage(null);
                  if (draggedIdeaId) {
                    const id = draggedIdeaId;
                    setDraggedIdeaId(null);
                    void handleMoveIdeaStage(id, column.value);
                  }
                }}
                className={`${
                  isMobileActive ? "flex" : "hidden md:flex"
                } max-h-[420px] min-h-[260px] w-full flex-col overflow-hidden rounded-xl border bg-[#0c1018] transition md:h-full md:max-h-none md:min-w-[255px] md:flex-1 ${
                  isDropTarget
                    ? "border-amber-400/70 bg-amber-500/5"
                    : `border-[#1f2735] border-t-2 ${column.accentClass}`
                }`}
              >
                {/* Column Header */}
                <div className="flex shrink-0 items-start justify-between gap-2 border-b border-[#1a2130] px-3.5 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-xs font-semibold tracking-wide text-zinc-100">
                        {column.label}
                      </h3>
                      <span className="rounded-full bg-[#171e2c] px-2 py-0.5 font-mono text-[11px] text-zinc-400">
                        {colIdeas.length}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[10px] text-zinc-500">
                      {column.description}
                    </p>
                  </div>
                  {allowColumnCreate && (
                    <button
                      type="button"
                      disabled={!isConfigured}
                      onClick={() => setCreateStage(column.value)}
                      className="shrink-0 rounded-md p-1 text-zinc-400 hover:bg-[#171e2c] hover:text-amber-300 disabled:opacity-40"
                      title={`${column.label} aşamasına fikir ekle`}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Column Cards */}
                <div className="flex-1 space-y-2.5 overflow-y-auto overscroll-contain p-2.5">
                  {colIdeas.length === 0 ? (
                    <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-[#1e2636] text-[11px] text-zinc-600">
                      Bu aşamada fikir yok
                    </div>
                  ) : (
                    colIdeas.map((idea) => {
                      const isPending = idea.id.startsWith("temp-");
                      const catMeta =
                        IDEA_CATEGORIES.find((c) => c.value === idea.category) ??
                        IDEA_CATEGORIES[0];
                      const linkedTasks = linkedTasksByIdea.get(idea.id) ?? [];
                      const linkedCount = Math.max(
                        idea.linked_task_count,
                        linkedTasks.length
                      );

                      return (
                        <article
                          key={idea.id}
                          data-idea-card="true"
                          draggable={!isPending}
                          onDragStart={() => setDraggedIdeaId(idea.id)}
                          onDragEnd={() => {
                            setDraggedIdeaId(null);
                            setDragOverStage(null);
                          }}
                          className={`group rounded-xl border border-[#1f2735] bg-[#121722] p-3.5 transition ${
                            isPending
                              ? "opacity-75"
                              : "hover:border-amber-500/50 hover:bg-[#161c29]"
                          } ${draggedIdeaId === idea.id ? "opacity-50" : ""}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${catMeta.badgeClass}`}
                            >
                              {catMeta.label}
                            </span>

                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => handleOptimisticVote(idea.id)}
                              className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold transition ${
                                idea.has_voted
                                  ? "border-amber-500/50 bg-amber-500/20 text-amber-300"
                                  : "border-[#242e40] bg-[#0b0f17] text-zinc-400 hover:border-amber-500/30 hover:text-zinc-200"
                              }`}
                            >
                              <ThumbsUp className="h-2.5 w-2.5" />
                              {idea.vote_count}
                            </button>
                          </div>

                          {isPending ? (
                            <span className="mt-2 block text-xs font-semibold text-zinc-200">
                              {idea.title}{" "}
                              <span className="text-[10px] font-normal text-amber-300/80">
                                (Kaydediliyor...)
                              </span>
                            </span>
                          ) : (
                            <Link
                              href={`/ideas/${idea.id}`}
                              className="mt-2 block text-xs font-semibold leading-snug text-zinc-100 transition group-hover:text-amber-300"
                            >
                              {idea.title}
                            </Link>
                          )}

                          {idea.summary && (
                            <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-zinc-400">
                              {idea.summary}
                            </p>
                          )}

                          {linkedCount > 0 && (
                            <button
                              type="button"
                              onClick={() => navigateTab("/tasks")}
                              className="mt-2 inline-flex items-center gap-1 rounded border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 text-[10px] text-cyan-300 hover:bg-cyan-500/20"
                            >
                              <KanbanSquare className="h-3 w-3" />
                              {linkedTasks[0]
                                ? linkedTasks[0].title.slice(0, 20) +
                                  (linkedTasks[0].title.length > 20 ? "…" : "")
                                : `${linkedCount} Görev`}
                            </button>
                          )}

                          <div className="mt-3 flex items-center justify-between border-t border-[#1d2534] pt-2 text-[10px] text-zinc-400">
                            <div className="flex items-center gap-2">
                              {idea.attachment_count > 0 && (
                                <span className="inline-flex items-center gap-1">
                                  <Paperclip className="h-3 w-3 text-zinc-500" />
                                  {idea.attachment_count}
                                </span>
                              )}
                              <span className="inline-flex items-center gap-1">
                                <MessageSquare className="h-3 w-3 text-zinc-500" />
                                {idea.comment_count}
                              </span>
                            </div>

                            {idea.author ? (
                              <span
                                title={idea.author.display_name}
                                className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-zinc-950"
                                style={{
                                  backgroundColor: idea.author.avatar_color,
                                }}
                              >
                                {idea.author.display_name
                                  .slice(0, 2)
                                  .toUpperCase()}
                              </span>
                            ) : (
                              <span className="text-[10px] text-zinc-600">
                                Ekip
                              </span>
                            )}
                          </div>

                          {/* Mobile quick stage switcher */}
                          <div className="mt-2 border-t border-[#1a2130] pt-2 md:hidden">
                            <select
                              aria-label="Oyun aşaması değiştir"
                              value={idea.status}
                              disabled={isPending}
                              onChange={(e) =>
                                void handleMoveIdeaStage(
                                  idea.id,
                                  e.target.value as IdeaStatus
                                )
                              }
                              className="w-full rounded-md border border-[#242e40] bg-[#080a0f] px-2 py-1 text-[11px] text-zinc-200 focus:border-amber-500/60 focus:outline-none"
                            >
                              {IDEA_STATUSES.map((st) => (
                                <option key={st.value} value={st.value}>
                                  Aşama: {st.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function renderIdeasCollection(
    list: IdeaListItem[],
    options?: { forceNonKanban?: boolean; allowColumnCreate?: boolean }
  ) {
    if (ideasViewMode === "kanban" && !options?.forceNonKanban) {
      return renderIdeaKanban(list, options?.allowColumnCreate ?? true);
    }

    if (ideasViewMode === "list") {
      return (
        <div className="divide-y divide-[#182030] overflow-hidden rounded-xl border border-[#1f2735] bg-[#0c1018]">
          {list.map((idea) => {
            const isPending = idea.id.startsWith("temp-");
            const catMeta =
              IDEA_CATEGORIES.find((c) => c.value === idea.category) ??
              IDEA_CATEGORIES[0];
            const statusMeta =
              IDEA_STATUSES.find((s) => s.value === idea.status) ??
              IDEA_STATUSES[0];
            const linkedTasks = linkedTasksByIdea.get(idea.id) ?? [];
            const linkedCount = Math.max(
              idea.linked_task_count,
              linkedTasks.length
            );

            return (
              <div
                key={idea.id}
                className="flex flex-wrap items-center gap-2.5 px-3.5 py-2.5 text-xs transition hover:bg-[#131926]"
              >
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${catMeta.badgeClass}`}
                >
                  {catMeta.label}
                </span>

                <span
                  className={`hidden shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium sm:inline-block ${statusMeta.badgeClass}`}
                >
                  {statusMeta.label}
                </span>

                <div className="min-w-40 flex-1 truncate">
                  {isPending ? (
                    <span className="font-semibold text-zinc-200">
                      {idea.title}{" "}
                      <span className="text-[11px] font-normal text-amber-300/80">
                        (Kaydediliyor...)
                      </span>
                    </span>
                  ) : (
                    <Link
                      href={`/ideas/${idea.id}`}
                      className="font-semibold text-zinc-100 transition hover:text-amber-300"
                    >
                      {idea.title}
                    </Link>
                  )}
                  {idea.summary && (
                    <span className="ml-2 hidden text-[11px] text-zinc-500 lg:inline">
                      — {idea.summary}
                    </span>
                  )}
                </div>

                {linkedCount > 0 && (
                  <button
                    type="button"
                    onClick={() => navigateTab("/tasks")}
                    title={
                      linkedTasks[0]
                        ? `Bağlı görev: ${linkedTasks[0].title}`
                        : "Kanban Panosuna Git"
                    }
                    className="hidden shrink-0 items-center gap-1 rounded-md border border-cyan-500/35 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-medium text-cyan-300 hover:bg-cyan-500/20 md:inline-flex"
                  >
                    <KanbanSquare className="h-3 w-3" />
                    {linkedTasks[0]
                      ? linkedTasks[0].title.slice(0, 22) +
                        (linkedTasks[0].title.length > 22 ? "…" : "")
                      : `${linkedCount} Görev`}
                  </button>
                )}

                <div className="hidden shrink-0 items-center gap-2.5 text-[11px] text-zinc-400 md:flex">
                  {idea.attachment_count > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <Paperclip className="h-3 w-3 text-zinc-500" />
                      {idea.attachment_count}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <MessageSquare className="h-3 w-3 text-zinc-500" />
                    {idea.comment_count}
                  </span>
                </div>

                {idea.author && (
                  <span
                    title={idea.author.display_name}
                    className="hidden h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-zinc-950 sm:flex"
                    style={{ backgroundColor: idea.author.avatar_color }}
                  >
                    {idea.author.display_name.slice(0, 2).toUpperCase()}
                  </span>
                )}

                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleOptimisticVote(idea.id)}
                  className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold transition ${
                    idea.has_voted
                      ? "border-amber-500/50 bg-amber-500/20 text-amber-300"
                      : "border-[#242e40] bg-[#080a0f] text-zinc-400 hover:border-amber-500/30 hover:text-zinc-200"
                  }`}
                >
                  <ThumbsUp className="h-3 w-3" />
                  {idea.vote_count}
                </button>
              </div>
            );
          })}
        </div>
      );
    }

    if (ideasViewMode === "compact") {
      return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {list.map((idea) => {
            const isPending = idea.id.startsWith("temp-");
            const catMeta =
              IDEA_CATEGORIES.find((c) => c.value === idea.category) ??
              IDEA_CATEGORIES[0];
            const statusMeta =
              IDEA_STATUSES.find((s) => s.value === idea.status) ??
              IDEA_STATUSES[0];
            const linkedTasks = linkedTasksByIdea.get(idea.id) ?? [];
            const linkedCount = Math.max(
              idea.linked_task_count,
              linkedTasks.length
            );

            return (
              <article
                key={idea.id}
                className="group flex flex-col rounded-xl border border-[#1f2735] bg-[#10141d] p-3.5 transition hover:border-amber-500/40"
              >
                <div className="flex items-center justify-between gap-1.5">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${catMeta.badgeClass}`}
                  >
                    {catMeta.label}
                  </span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusMeta.badgeClass}`}
                  >
                    {statusMeta.label}
                  </span>
                </div>

                {isPending ? (
                  <span className="mt-2.5 block truncate text-sm font-semibold text-zinc-200">
                    {idea.title}
                  </span>
                ) : (
                  <Link
                    href={`/ideas/${idea.id}`}
                    className="mt-2.5 block truncate text-sm font-semibold text-zinc-100 transition group-hover:text-amber-300"
                  >
                    {idea.title}
                  </Link>
                )}

                <p className="mt-1 line-clamp-1 flex-1 text-[11px] text-zinc-400">
                  {idea.summary || "Kısa özet girilmemiş."}
                </p>

                <div className="mt-3 flex items-center justify-between border-t border-[#1b2230] pt-2.5 text-[11px] text-zinc-400">
                  <div className="flex items-center gap-2">
                    {idea.author ? (
                      <span
                        title={idea.author.display_name}
                        className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-zinc-950"
                        style={{ backgroundColor: idea.author.avatar_color }}
                      >
                        {idea.author.display_name.slice(0, 2).toUpperCase()}
                      </span>
                    ) : (
                      <span className="text-[10px] text-zinc-500">Ekip</span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <MessageSquare className="h-3 w-3 text-zinc-500" />
                      {idea.comment_count}
                    </span>
                    {linkedCount > 0 && (
                      <button
                        type="button"
                        onClick={() => navigateTab("/tasks")}
                        className="inline-flex items-center gap-1 text-cyan-300 hover:text-cyan-200"
                        title="Bağlı Görev"
                      >
                        <KanbanSquare className="h-3 w-3" />
                        {linkedCount}
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleOptimisticVote(idea.id)}
                    className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold transition ${
                      idea.has_voted
                        ? "border-amber-500/50 bg-amber-500/20 text-amber-300"
                        : "border-[#242e40] bg-[#0b0f17] text-zinc-400 hover:border-amber-500/30 hover:text-zinc-200"
                    }`}
                  >
                    <ThumbsUp className="h-3 w-3" />
                    {idea.vote_count}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      );
    }

    // Detailed Cards View
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((idea) => {
          const isPending = idea.id.startsWith("temp-");
          const catMeta =
            IDEA_CATEGORIES.find((c) => c.value === idea.category) ??
            IDEA_CATEGORIES[0];
          const statusMeta =
            IDEA_STATUSES.find((s) => s.value === idea.status) ??
            IDEA_STATUSES[0];
          const linkedTasks = linkedTasksByIdea.get(idea.id) ?? [];
          const linkedCount = Math.max(
            idea.linked_task_count,
            linkedTasks.length
          );

          return (
            <article
              key={idea.id}
              className="group flex flex-col overflow-hidden rounded-xl border border-[#1f2735] bg-[#10141d] transition hover:border-amber-500/40"
            >
              {idea.preview_image_url && !isPending && (
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

                {isPending ? (
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

                {linkedTasks.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {linkedTasks.slice(0, 2).map((t) => {
                      const taskStatusLabel =
                        TASK_STATUSES.find((s) => s.value === t.status)
                          ?.label ?? t.status;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => navigateTab("/tasks")}
                          className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-[10px] text-cyan-200 transition hover:bg-cyan-500/20"
                        >
                          <KanbanSquare className="h-3 w-3 shrink-0 text-cyan-400" />
                          <span className="truncate">{t.title}</span>
                          <span className="shrink-0 rounded bg-black/30 px-1 text-[9px] text-cyan-300">
                            {taskStatusLabel}
                          </span>
                        </button>
                      );
                    })}
                    {linkedTasks.length > 2 && (
                      <span className="rounded-md border border-cyan-500/20 bg-cyan-500/5 px-2 py-1 text-[10px] text-cyan-300">
                        +{linkedTasks.length - 2} görev
                      </span>
                    )}
                  </div>
                )}

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
                    {linkedCount > 0 && (
                      <span
                        title="Bağlı Görev"
                        className="inline-flex items-center gap-1 text-cyan-300"
                      >
                        <KanbanSquare className="h-3.5 w-3.5" />
                        {linkedCount}
                      </span>
                    )}
                    <button
                      type="button"
                      disabled={isPending}
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
    );
  }

  return (
    <div className="space-y-6 pb-8">
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

      {/* Top Action & Search Bar */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#1f2735] bg-[#10141d] p-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={!isConfigured}
              onClick={() => setCreateStage("random")}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-3.5 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Yeni Fikir Ekle
            </button>

            <div
              role="group"
              aria-label="Görünüm Modu"
              className="inline-flex rounded-lg border border-[#242e40] bg-[#080a0f] p-0.5 text-xs"
            >
              <button
                type="button"
                onClick={() => setIdeasViewMode("kanban")}
                title="Aşama Kanbanı"
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium transition ${
                  ideasViewMode === "kanban"
                    ? "bg-amber-500/20 text-amber-300"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <KanbanSquare className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Kanban</span>
              </button>
              <button
                type="button"
                onClick={() => setIdeasViewMode("cards")}
                title="Kart Görünümü"
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium transition ${
                  ideasViewMode === "cards"
                    ? "bg-amber-500/20 text-amber-300"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Kart</span>
              </button>
              <button
                type="button"
                onClick={() => setIdeasViewMode("compact")}
                title="Kompakt Kartlar"
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium transition ${
                  ideasViewMode === "compact"
                    ? "bg-amber-500/20 text-amber-300"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <Grid2x2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Kompakt</span>
              </button>
              <button
                type="button"
                onClick={() => setIdeasViewMode("list")}
                title="Tek Satır Liste"
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium transition ${
                  ideasViewMode === "list"
                    ? "bg-amber-500/20 text-amber-300"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <List className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Liste</span>
              </button>
            </div>
          </div>

          <div className="relative w-full sm:w-72 md:w-80">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Fikirlerde ara (ör. kanca, boss, niagara)..."
              className="w-full rounded-lg border border-[#242e40] bg-[#080a0f] py-1.5 pr-3 pl-8.5 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-amber-500/60 focus:outline-none"
            />
          </div>
        </div>

        {/* Category & Section Filters Underneath Search Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-[#1f2735] bg-[#10141d] p-2.5">
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => setCategoryFilter("all")}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                categoryFilter === "all"
                  ? "bg-amber-500/20 text-amber-300"
                  : "text-zinc-400 hover:bg-[#171d29] hover:text-zinc-200"
              }`}
            >
              Tümü
            </button>
            {IDEA_CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                type="button"
                onClick={() => setCategoryFilter(cat.value)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  categoryFilter === cat.value
                    ? "bg-amber-500/20 text-amber-300"
                    : "text-zinc-400 hover:bg-[#171d29] hover:text-zinc-200"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-[#242e40] bg-[#080a0f] p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setSectionTab("split")}
                className={`rounded-md px-2.5 py-1 font-medium transition ${
                  sectionTab === "split"
                    ? "bg-amber-500/20 text-amber-300"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Ayrı Bölümler ({ideas.length})
              </button>
              <button
                type="button"
                onClick={() => setSectionTab("active")}
                className={`rounded-md px-2.5 py-1 font-medium transition ${
                  sectionTab === "active"
                    ? "bg-amber-500/20 text-amber-300"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Fikir Havuzu ({totalActiveCount})
              </button>
              <button
                type="button"
                onClick={() => setSectionTab("converted")}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition ${
                  sectionTab === "converted"
                    ? "bg-cyan-500/20 text-cyan-300"
                    : "text-zinc-400 hover:text-cyan-200"
                }`}
              >
                <KanbanSquare className="h-3.5 w-3.5" />
                Göreve Dönüştürülenler ({totalConvertedCount})
              </button>
            </div>

            {ideasViewMode !== "kanban" && (
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as IdeaStatus | "all")
                }
                className="rounded-lg border border-[#242e40] bg-[#080a0f] px-2.5 py-1.5 text-xs text-zinc-200 focus:border-amber-500/60 focus:outline-none"
              >
                <option value="all">Durum: Tümü ({ideas.length})</option>
                {IDEA_STATUSES.map((st) => {
                  const count = ideas.filter(
                    (i) => i.status === st.value
                  ).length;
                  return (
                    <option key={st.value} value={st.value}>
                      {st.label} ({count})
                    </option>
                  );
                })}
              </select>
            )}

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "recent" | "votes")}
              className="rounded-lg border border-[#242e40] bg-[#080a0f] px-2.5 py-1.5 text-xs text-zinc-200 focus:border-amber-500/60 focus:outline-none"
            >
              <option value="recent">Son Güncellenen</option>
              <option value="votes">En Çok Oy Alan</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Content Sections */}
      {ideas.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#242e40] bg-[#0c1018] px-6 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
            <Lightbulb className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-zinc-100">
            Henüz fikir eklenmemiş
          </h3>
          <p className="mt-1 max-w-md text-xs text-zinc-400">
            Aklınıza gelen ilk oyun mekaniğini, level fikrini veya görsel
            referansı ekleyerek aşama kanbanınızı başlatın.
          </p>
          {isConfigured && (
            <button
              type="button"
              onClick={() => setCreateStage("random")}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-amber-400"
            >
              <Plus className="h-4 w-4" />
              İlk Fikri Ekle
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {/* Active Ideas Pool */}
          {sectionTab !== "converted" && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-amber-400" />
                  <h2 className="text-sm font-semibold text-zinc-100">
                    Fikir Havuzu & Oyun Aşamaları
                  </h2>
                  <span className="rounded-full bg-[#182030] px-2 py-0.5 font-mono text-[11px] text-zinc-300">
                    {activeIdeas.length}
                  </span>
                </div>
              </div>

              {activeIdeas.length === 0 && ideasViewMode !== "kanban" ? (
                <div className="rounded-xl border border-dashed border-[#242e40] bg-[#0c1018] px-6 py-10 text-center text-xs text-zinc-400">
                  {totalActiveCount === 0
                    ? "Tüm fikirler göreve dönüştürülmüş! Aşağıdaki veya Göreve Dönüştürülenler sekmesindeki listeden takip edebilirsiniz."
                    : "Filtrelere uyan aktif fikir bulunamadı."}
                </div>
              ) : (
                renderIdeasCollection(activeIdeas, { allowColumnCreate: true })
              )}
            </section>
          )}

          {/* Converted Ideas Section (Separate Area) */}
          {sectionTab !== "active" && (
            <section className="space-y-4 rounded-2xl border border-cyan-500/25 bg-[#0b101b] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-400">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-semibold text-zinc-100">
                        Göreve Dönüştürülen Fikirler
                      </h2>
                      <span className="rounded-full border border-cyan-500/30 bg-cyan-500/15 px-2 py-0.5 font-mono text-[11px] text-cyan-300">
                        {convertedIdeas.length}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400">
                      Kanban panosuna görev olarak aktarılmış GDD ve mekanik
                      fikirleri
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => navigateTab("/tasks")}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-300 transition hover:bg-cyan-500/20"
                >
                  Kanban&apos;da Gör
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>

              {convertedIdeas.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#243045] bg-[#080c14] px-6 py-8 text-center text-xs text-zinc-500">
                  {totalConvertedCount === 0
                    ? 'Henüz göreve dönüştürülmüş fikir yok. Bir fikrin detayına girip "Göreve Dönüştür" butonunu kullanabilirsiniz.'
                    : "Filtrelere uyan dönüştürülmüş fikir bulunamadı."}
                </div>
              ) : (
                renderIdeasCollection(convertedIdeas, {
                  forceNonKanban: sectionTab === "split",
                  allowColumnCreate: false,
                })
              )}
            </section>
          )}
        </div>
      )}

      {createStage && (
        <IdeaFormModal
          key={createStage}
          open
          mode="create"
          initialValues={{
            title: "",
            summary: "",
            content_md: "",
            category: "mechanic",
            status: createStage,
            reference_links: [],
          }}
          onClose={() => setCreateStage(null)}
          onSubmit={handleCreateIdea}
        />
      )}
    </div>
  );
}
