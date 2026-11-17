"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import dynamic from "next/dynamic";
import {
  Plus,
  Search,
  AlertTriangle,
  CheckSquare,
  MessageSquare,
  Paperclip,
  Lightbulb,
  Bug,
  Flag,
  RotateCcw,
  KanbanSquare,
  LayoutGrid,
  List,
  Users,
  BarChart3,
} from "lucide-react";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  UE_DISCIPLINE_TAGS,
} from "@/lib/constants";
import { useStudioStore } from "@/components/studio/studio-store";
import {
  createTaskAction,
  deleteTaskAction,
  moveTaskStatusAction,
  updateTaskAction,
} from "@/app/actions/tasks";
import type { TaskFormValues } from "@/components/tasks/task-form-modal";

const TaskFormModal = dynamic(
  () =>
    import("@/components/tasks/task-form-modal").then(
      (mod) => mod.TaskFormModal
    ),
  { ssr: false }
);

const TaskDetailDrawer = dynamic(
  () =>
    import("@/components/tasks/task-detail-drawer").then(
      (mod) => mod.TaskDetailDrawer
    ),
  { ssr: false }
);
import type { TaskBoardItem, TaskPriority, TaskStatus } from "@/types/studio";

const PRIORITY_DOTS: Record<TaskPriority, string> = {
  critical: "bg-rose-400",
  high: "bg-amber-400",
  medium: "bg-cyan-400",
  low: "bg-zinc-400",
};

export function KanbanBoard() {
  const {
    tasks,
    setTasks,
    teamProfiles,
    milestones,
    ideas,
    currentUserId,
    currentProfile,
    isConfigured,
    tasksMilestoneFilter,
    setTasksMilestoneFilter,
    tasksViewMode,
    setTasksViewMode,
    navigateTab,
  } = useStudioStore();

  // Filters
  const [search, setSearch] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const milestoneFilter = tasksMilestoneFilter;
  const setMilestoneFilter = setTasksMilestoneFilter;
  const [listStatusFilter, setListStatusFilter] = useState<TaskStatus | "all">(
    "all"
  );

  // Drag state, Horizontal Pan & Mobile active column
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);
  const [mobileActiveColumn, setMobileActiveColumn] =
    useState<TaskStatus>("todo");

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
        "[data-kanban-card], button, select, input, textarea, a, label"
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

  const hasActiveFilters =
    search.trim().length > 0 ||
    assigneeFilter !== "all" ||
    tagFilter !== "all" ||
    milestoneFilter !== "all";

  function resetFilters() {
    setSearch("");
    setAssigneeFilter("all");
    setTagFilter("all");
    setTasksMilestoneFilter("all");
  }

  // Modals & Drawer
  const [createStatus, setCreateStatus] = useState<TaskStatus | null>(null);
  const [editingTask, setEditingTask] = useState<TaskBoardItem | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [boardError, setBoardError] = useState<string | null>(null);

  const tasksOnly = useMemo(
    () => tasks.filter((t) => t.kind === "task"),
    [tasks]
  );

  const openBugsTotal = useMemo(
    () => tasks.filter((t) => t.kind === "bug" && t.status !== "done").length,
    [tasks]
  );

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasksOnly.filter((t) => {
      if (assigneeFilter === "mine" && t.assignee_id !== currentUserId) {
        return false;
      }
      if (assigneeFilter === "unassigned" && t.assignee_id !== null) {
        return false;
      }
      if (
        assigneeFilter !== "all" &&
        assigneeFilter !== "mine" &&
        assigneeFilter !== "unassigned" &&
        t.assignee_id !== assigneeFilter
      ) {
        return false;
      }
      if (tagFilter !== "all" && !t.ue_tags.includes(tagFilter)) return false;
      if (milestoneFilter !== "all" && t.milestone_id !== milestoneFilter) {
        return false;
      }
      if (q) {
        const hay = `${t.title} ${t.description_md} ${t.ue_tags.join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    tasksOnly,
    search,
    assigneeFilter,
    tagFilter,
    milestoneFilter,
    currentUserId,
  ]);

  const selectedTask = useMemo(
    () => tasks.find((t) => t.id === selectedTaskId) ?? null,
    [tasks, selectedTaskId]
  );

  const boardSummary = useMemo(() => {
    const total = filteredTasks.length;
    const done = filteredTasks.filter((t) => t.status === "done").length;
    const testing = filteredTasks.filter((t) => t.status === "testing").length;
    const inProgress = filteredTasks.filter(
      (t) => t.status === "in_progress"
    ).length;
    const todo = filteredTasks.filter((t) => t.status === "todo").length;
    const backlog = filteredTasks.filter((t) => t.status === "backlog").length;
    const blockedCount = filteredTasks.filter(
      (t) => Boolean(t.blocked_by_task) && t.blocked_by_task?.status !== "done"
    ).length;
    const completionPercent = total > 0 ? Math.round((done / total) * 100) : 0;

    const workload = teamProfiles.map((member) => ({
      member,
      openCount: tasksOnly.filter(
        (t) => t.assignee_id === member.id && t.status !== "done"
      ).length,
    }));
    const unassignedOpenCount = tasksOnly.filter(
      (t) => !t.assignee_id && t.status !== "done"
    ).length;

    return {
      total,
      done,
      testing,
      inProgress,
      todo,
      backlog,
      blockedCount,
      completionPercent,
      workload,
      unassignedOpenCount,
    };
  }, [filteredTasks, tasksOnly, teamProfiles]);

  async function handleMoveStatus(taskId: string, targetStatus: TaskStatus) {
    const prevTask = tasks.find((t) => t.id === taskId);
    if (!prevTask || prevTask.status === targetStatus) return;

    const prevStatus = prevTask.status;
    setBoardError(null);
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, status: targetStatus, updated_at: new Date().toISOString() }
          : t
      )
    );

    try {
      const res = await moveTaskStatusAction(taskId, targetStatus);
      if (!res.ok) {
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: prevStatus } : t))
        );
        setBoardError(
          res.error ?? "Kart taşınamadı, eski sütununa geri alındı."
        );
      }
    } catch {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: prevStatus } : t))
      );
      setBoardError("Bağlantı hatası: Kart taşıma işlemi geri alındı.");
    }
  }

  function handleDropOnColumn(targetStatus: TaskStatus) {
    setDragOverColumn(null);
    if (!draggedTaskId) return;
    const id = draggedTaskId;
    setDraggedTaskId(null);
    void handleMoveStatus(id, targetStatus);
  }

  async function handleCreateSubmit(values: TaskFormValues) {
    setBoardError(null);
    const tempId = `temp-task-${Date.now()}`;
    const nowIso = new Date().toISOString();

    const assignee = values.assignee_id
      ? teamProfiles.find((p) => p.id === values.assignee_id) ?? null
      : null;
    const ms = values.milestone_id
      ? milestones.find((m) => m.id === values.milestone_id) ?? null
      : null;
    const srcIdea = values.source_idea_id
      ? ideas.find((i) => i.id === values.source_idea_id) ?? null
      : null;
    const blocker = values.blocked_by_task_id
      ? tasks.find((t) => t.id === values.blocked_by_task_id) ?? null
      : null;

    const optimisticTask: TaskBoardItem = {
      id: tempId,
      title: values.title,
      description_md: values.description_md,
      kind: "task",
      status: values.status,
      priority: values.priority,
      ue_tags: values.ue_tags,
      assignee_id: values.assignee_id,
      reporter_id: currentUserId,
      milestone_id: values.milestone_id,
      source_idea_id: values.source_idea_id,
      blocked_by_task_id: values.blocked_by_task_id,
      bug_severity: null,
      repro_steps: "",
      build_version: "",
      position: 0,
      created_at: nowIso,
      updated_at: nowIso,
      assignee,
      reporter: currentProfile,
      milestone: ms ? { id: ms.id, title: ms.title } : null,
      source_idea: srcIdea ? { id: srcIdea.id, title: srcIdea.title } : null,
      blocked_by_task: blocker
        ? { id: blocker.id, title: blocker.title, status: blocker.status }
        : null,
      subtasks: [],
      comment_count: 0,
      attachment_count: 0,
    };

    setTasks((prev) => [optimisticTask, ...prev]);

    try {
      const res = await createTaskAction(values);
      if (!res.ok || !res.data) {
        setTasks((prev) => prev.filter((t) => t.id !== tempId));
        setBoardError(
          res.error ?? "Görev veritabanına kaydedilemedi, geri alındı."
        );
        return { ok: false, error: res.error };
      }

      const realId = res.data.id;
      const realCreatedAt = res.data.created_at;
      setTasks((prev) =>
        prev.map((t) =>
          t.id === tempId
            ? { ...t, id: realId, created_at: realCreatedAt }
            : t
        )
      );
      setSelectedTaskId((cur) => (cur === tempId ? realId : cur));
      return { ok: true };
    } catch {
      setTasks((prev) => prev.filter((t) => t.id !== tempId));
      setBoardError("Bağlantı hatası: Görev oluşturulamadı, geri alındı.");
      return { ok: false, error: "Bağlantı hatası." };
    }
  }

  async function handleEditSubmit(values: TaskFormValues) {
    if (!editingTask) return { ok: false, error: "Görev bulunamadı." };
    const targetId = editingTask.id;
    const prevSnapshot = tasks.find((t) => t.id === targetId);
    if (!prevSnapshot) return { ok: false, error: "Görev bulunamadı." };

    setBoardError(null);
    const assignee = values.assignee_id
      ? teamProfiles.find((p) => p.id === values.assignee_id) ?? null
      : null;
    const ms = values.milestone_id
      ? milestones.find((m) => m.id === values.milestone_id) ?? null
      : null;
    const srcIdea = values.source_idea_id
      ? ideas.find((i) => i.id === values.source_idea_id) ?? null
      : null;
    const blocker = values.blocked_by_task_id
      ? tasks.find((t) => t.id === values.blocked_by_task_id) ?? null
      : null;

    setTasks((prev) =>
      prev.map((t) =>
        t.id === targetId
          ? {
              ...t,
              title: values.title,
              description_md: values.description_md,
              status: values.status,
              priority: values.priority,
              ue_tags: values.ue_tags,
              assignee_id: values.assignee_id,
              milestone_id: values.milestone_id,
              source_idea_id: values.source_idea_id,
              blocked_by_task_id: values.blocked_by_task_id,
              assignee,
              milestone: ms ? { id: ms.id, title: ms.title } : null,
              source_idea: srcIdea
                ? { id: srcIdea.id, title: srcIdea.title }
                : null,
              blocked_by_task: blocker
                ? {
                    id: blocker.id,
                    title: blocker.title,
                    status: blocker.status,
                  }
                : null,
              updated_at: new Date().toISOString(),
            }
          : t
      )
    );

    try {
      const res = await updateTaskAction(targetId, values);
      if (!res.ok) {
        setTasks((prev) =>
          prev.map((t) => (t.id === targetId ? prevSnapshot : t))
        );
        setBoardError(
          res.error ?? "Görev güncellenemedi, değişiklik geri alındı."
        );
        return { ok: false, error: res.error };
      }
      return { ok: true };
    } catch {
      setTasks((prev) =>
        prev.map((t) => (t.id === targetId ? prevSnapshot : t))
      );
      setBoardError("Bağlantı hatası: Görev güncellemesi geri alındı.");
      return { ok: false, error: "Bağlantı hatası." };
    }
  }

  async function handleDeleteTaskOptimistic(taskId: string) {
    const prevSnapshot = tasks.find((t) => t.id === taskId);
    if (!prevSnapshot) return;
    setBoardError(null);
    setTasks((prev) => prev.filter((t) => t.id !== taskId));

    try {
      const res = await deleteTaskAction(taskId);
      if (!res.ok) {
        setTasks((prev) => [prevSnapshot, ...prev]);
        setBoardError(res.error ?? "Görev silinemedi, geri yüklendi.");
      }
    } catch {
      setTasks((prev) => [prevSnapshot, ...prev]);
      setBoardError("Bağlantı hatası: Görev silme işlemi geri alındı.");
    }
  }

  return (
    <div className="space-y-5 pb-8">
      {boardError && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-200">
          <span>{boardError}</span>
          <button
            type="button"
            onClick={() => setBoardError(null)}
            className="text-rose-300 underline hover:text-white"
          >
            Kapat
          </button>
        </div>
      )}

      {/* Top Action & Search Bar + Filters */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#1f2735] bg-[#10141d] p-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={!isConfigured}
              onClick={() => setCreateStatus("todo")}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-3.5 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Yeni Görev Ekle
            </button>

            <div
              role="group"
              aria-label="Görünüm Modu"
              className="inline-flex rounded-lg border border-[#242e40] bg-[#080a0f] p-0.5 text-xs"
            >
              <button
                type="button"
                onClick={() => setTasksViewMode("kanban")}
                title="Standart Kanban"
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium transition ${
                  tasksViewMode === "kanban"
                    ? "bg-amber-500/20 text-amber-300"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <KanbanSquare className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Kanban</span>
              </button>
              <button
                type="button"
                onClick={() => setTasksViewMode("compact")}
                title="Kompakt Kanban"
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium transition ${
                  tasksViewMode === "compact"
                    ? "bg-amber-500/20 text-amber-300"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Kompakt</span>
              </button>
              <button
                type="button"
                onClick={() => setTasksViewMode("list")}
                title="Tek Satır Liste"
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium transition ${
                  tasksViewMode === "list"
                    ? "bg-amber-500/20 text-amber-300"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <List className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Liste</span>
              </button>
            </div>

            {openBugsTotal > 0 && (
              <button
                type="button"
                onClick={() => navigateTab("/bugs")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/35 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-200 transition hover:bg-rose-500/20"
              >
                <Bug className="h-3.5 w-3.5 text-rose-400" />
                Buglar ({openBugsTotal} Açık)
              </button>
            )}
          </div>

          <div className="relative w-full sm:w-72 md:w-80">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Görev veya tag ara..."
              className="w-full rounded-lg border border-[#242e40] bg-[#080a0f] py-1.5 pr-3 pl-8.5 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-amber-500/60 focus:outline-none"
            />
          </div>
        </div>

        {/* Category / Discipline & Filters Underneath Search Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-[#1f2735] bg-[#10141d] p-2.5">
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => setTagFilter("all")}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                tagFilter === "all"
                  ? "bg-amber-500/20 text-amber-300"
                  : "text-zinc-400 hover:bg-[#171d29] hover:text-zinc-200"
              }`}
            >
              Tümü
            </button>
            {UE_DISCIPLINE_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setTagFilter(tag)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  tagFilter === tag
                    ? "bg-amber-500/20 text-amber-300"
                    : "text-zinc-400 hover:bg-[#171d29] hover:text-zinc-200"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {currentUserId && (
              <div className="inline-flex rounded-lg border border-[#242e40] bg-[#080a0f] p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setAssigneeFilter("all")}
                  className={`rounded-md px-2.5 py-1 font-medium transition ${
                    assigneeFilter !== "mine"
                      ? "bg-[#1a2232] text-zinc-100"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  Tüm İşler
                </button>
                <button
                  type="button"
                  onClick={() => setAssigneeFilter("mine")}
                  className={`rounded-md px-2.5 py-1 font-medium transition ${
                    assigneeFilter === "mine"
                      ? "bg-amber-500/20 text-amber-300"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  Bana Atananlar
                </button>
              </div>
            )}

            <select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              className="rounded-lg border border-[#242e40] bg-[#080a0f] px-2.5 py-1.5 text-xs text-zinc-200 focus:border-amber-500/60 focus:outline-none"
            >
              <option value="all">Kişi: Tümü</option>
              {currentUserId && <option value="mine">Bana Atananlar</option>}
              <option value="unassigned">Atanmamış</option>
              {teamProfiles.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.display_name}
                </option>
              ))}
            </select>

            <select
              value={milestoneFilter}
              onChange={(e) => setMilestoneFilter(e.target.value)}
              className="rounded-lg border border-[#242e40] bg-[#080a0f] px-2.5 py-1.5 text-xs text-zinc-200 focus:border-amber-500/60 focus:outline-none"
            >
              <option value="all">Sistem / Hedef: Tümü</option>
              {milestones.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 rounded-lg border border-[#242e40] bg-[#080a0f] px-2.5 py-1.5 text-xs text-zinc-300 hover:border-amber-500/40 hover:text-amber-300"
              >
                <RotateCcw className="h-3 w-3" />
                Sıfırla
              </button>
            )}
          </div>
        </div>
      </div>

      {tasksViewMode === "list" ? (
        <div className="space-y-3">
          {/* Status Summary Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-[#1f2735] bg-[#0c1018] p-2 text-xs">
            <button
              type="button"
              onClick={() => setListStatusFilter("all")}
              className={`rounded-lg px-2.5 py-1.5 font-medium transition ${
                listStatusFilter === "all"
                  ? "bg-amber-500/20 text-amber-300"
                  : "text-zinc-400 hover:bg-[#141a26] hover:text-zinc-200"
              }`}
            >
              Tümü ({filteredTasks.length})
            </button>
            {TASK_STATUSES.map((st) => {
              const count = filteredTasks.filter(
                (t) => t.status === st.value
              ).length;
              return (
                <button
                  key={st.value}
                  type="button"
                  onClick={() => setListStatusFilter(st.value)}
                  className={`rounded-lg px-2.5 py-1.5 font-medium transition ${
                    listStatusFilter === st.value
                      ? "bg-[#1a2232] text-zinc-100"
                      : "text-zinc-400 hover:bg-[#141a26] hover:text-zinc-200"
                  }`}
                >
                  {st.label} ({count})
                </button>
              );
            })}
          </div>

          {/* Single-Line List Rows */}
          {(() => {
            const visibleListTasks =
              listStatusFilter === "all"
                ? filteredTasks
                : filteredTasks.filter((t) => t.status === listStatusFilter);

            if (visibleListTasks.length === 0) {
              return (
                <div className="flex h-36 items-center justify-center rounded-xl border border-dashed border-[#242e40] bg-[#0c1018] text-xs text-zinc-500">
                  Bu görünümde eşleşen görev bulunamadı.
                </div>
              );
            }

            return (
              <div className="max-h-[460px] min-h-[240px] divide-y divide-[#192130] overflow-y-auto overscroll-contain rounded-xl border border-[#1f2735] bg-[#0c1018] xl:max-h-[500px]">
                {visibleListTasks.map((task) => {
                  const isPending = task.id.startsWith("temp-");
                  const priorityMeta =
                    TASK_PRIORITIES.find((p) => p.value === task.priority) ??
                    TASK_PRIORITIES[1];
                  const isBlocked =
                    Boolean(task.blocked_by_task) &&
                    task.blocked_by_task?.status !== "done";
                  const doneSubtasks = task.subtasks.filter(
                    (s) => s.is_done
                  ).length;

                  return (
                    <div
                      key={task.id}
                      onClick={() => {
                        if (!isPending) setSelectedTaskId(task.id);
                      }}
                      className={`flex items-center gap-2.5 px-3.5 py-2 text-xs transition ${
                        isPending
                          ? "opacity-75"
                          : "cursor-pointer hover:bg-[#131926]"
                      }`}
                    >
                      <div
                        className="shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <select
                          aria-label="Durum"
                          value={task.status}
                          disabled={isPending}
                          onChange={(e) =>
                            handleMoveStatus(
                              task.id,
                              e.target.value as TaskStatus
                            )
                          }
                          className="rounded-md border border-[#242e40] bg-[#080a0f] px-2 py-1 text-[11px] font-medium text-zinc-200 focus:border-amber-500/60 focus:outline-none disabled:opacity-50"
                        >
                          {TASK_STATUSES.map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <span
                        className={`w-14 shrink-0 rounded border px-1.5 py-0.5 text-center text-[10px] font-medium ${priorityMeta.badgeClass}`}
                      >
                        {priorityMeta.label}
                      </span>

                      {task.kind === "bug" && (
                        <span className="hidden shrink-0 items-center gap-1 rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-rose-300 sm:inline-flex">
                          <Bug className="h-3 w-3" />
                          Bug
                        </span>
                      )}

                      <span className="min-w-0 flex-1 truncate font-medium text-zinc-100">
                        {task.title}
                        {isPending && (
                          <span className="ml-2 text-[10px] font-normal text-amber-300/80">
                            (Kaydediliyor...)
                          </span>
                        )}
                      </span>

                      {isBlocked && (
                        <span
                          title={`Bekliyor: ${task.blocked_by_task?.title}`}
                          className="hidden shrink-0 items-center gap-1 rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-200 md:inline-flex"
                        >
                          <AlertTriangle className="h-3 w-3 text-amber-400" />
                          Bekliyor
                        </span>
                      )}

                      {task.milestone && (
                        <span className="hidden max-w-36 shrink-0 items-center gap-1 truncate rounded bg-[#141c2b] px-2 py-0.5 text-[10px] text-cyan-300 sm:inline-flex">
                          <Flag className="h-2.5 w-2.5 shrink-0" />
                          <span className="truncate">
                            {task.milestone.title}
                          </span>
                        </span>
                      )}

                      {task.ue_tags.length > 0 && (
                        <div className="hidden shrink-0 items-center gap-1 lg:flex">
                          {task.ue_tags.slice(0, 2).map((tag) => (
                            <span
                              key={tag}
                              className="rounded bg-[#1b2232] px-1.5 py-0.5 text-[10px] text-zinc-300"
                            >
                              {tag}
                            </span>
                          ))}
                          {task.ue_tags.length > 2 && (
                            <span className="rounded bg-[#1b2232] px-1.5 py-0.5 text-[10px] text-zinc-400">
                              +{task.ue_tags.length - 2}
                            </span>
                          )}
                        </div>
                      )}

                      <div className="hidden shrink-0 items-center gap-2 text-[11px] text-zinc-400 md:flex">
                        {task.subtasks.length > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <CheckSquare className="h-3 w-3 text-emerald-400" />
                            {doneSubtasks}/{task.subtasks.length}
                          </span>
                        )}
                        {task.comment_count > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" />
                            {task.comment_count}
                          </span>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5">
                        {task.assignee ? (
                          <>
                            <span
                              title={task.assignee.display_name}
                              className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-zinc-950"
                              style={{
                                backgroundColor: task.assignee.avatar_color,
                              }}
                            >
                              {task.assignee.display_name
                                .slice(0, 2)
                                .toUpperCase()}
                            </span>
                            <span className="hidden max-w-20 truncate text-[11px] text-zinc-300 xl:inline">
                              {task.assignee.display_name}
                            </span>
                          </>
                        ) : (
                          <span className="text-[10px] text-zinc-600">
                            Boşta
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      ) : (
        <>
          {/* Mobile Column Switcher Tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 md:hidden">
            {TASK_STATUSES.map((col) => {
              const count = filteredTasks.filter(
                (t) => t.status === col.value
              ).length;
              const active = mobileActiveColumn === col.value;
              return (
                <button
                  key={col.value}
                  type="button"
                  onClick={() => setMobileActiveColumn(col.value)}
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

          {/* Kanban Columns (bounded height + internal vertical scroll + left-click horizontal pan) */}
          <div
            ref={boardScrollRef}
            onMouseDown={handleBoardMouseDown}
            className={`flex flex-col gap-4 pb-2 md:h-[480px] md:flex-row md:overflow-x-auto md:overflow-y-hidden xl:h-[520px] ${
              isPanning ? "md:cursor-grabbing select-none" : "md:cursor-grab"
            }`}
          >
            {TASK_STATUSES.map((column) => {
              const columnTasks = filteredTasks.filter(
                (t) => t.status === column.value
              );
              const isDropTarget = dragOverColumn === column.value;
              const isMobileActive = mobileActiveColumn === column.value;

              return (
                <div
                  key={column.value}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragOverColumn !== column.value) {
                      setDragOverColumn(column.value);
                    }
                  }}
                  onDragLeave={() => {
                    if (dragOverColumn === column.value) {
                      setDragOverColumn(null);
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleDropOnColumn(column.value);
                  }}
                  className={`${
                    isMobileActive ? "flex" : "hidden md:flex"
                  } max-h-[420px] min-h-[260px] w-full flex-col overflow-hidden rounded-xl border bg-[#0c1018] transition md:h-full md:max-h-none md:min-w-[270px] md:flex-1 ${
                    isDropTarget
                      ? "border-amber-400/70 bg-amber-500/5"
                      : `border-[#1f2735] border-t-2 ${column.accentClass}`
                  }`}
                >
                  {/* Column Header */}
                  <div className="flex shrink-0 items-center justify-between border-b border-[#1a2130] px-3.5 py-3">
                    <div className="flex items-center gap-2">
                      <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-200">
                        {column.label}
                      </h2>
                      <span className="rounded-full bg-[#171e2c] px-2 py-0.5 font-mono text-[11px] text-zinc-400">
                        {columnTasks.length}
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={!isConfigured}
                      onClick={() => setCreateStatus(column.value)}
                      className="rounded-md p-1 text-zinc-400 hover:bg-[#171e2c] hover:text-amber-300 disabled:opacity-40"
                      title={`${column.label} sütununa ekle`}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Column Cards (vertical wheel scroll inside column) */}
                  <div
                    className={`flex-1 overflow-y-auto overscroll-contain ${
                      tasksViewMode === "compact"
                        ? "space-y-1.5 p-2"
                        : "space-y-2.5 p-3"
                    }`}
                  >
                    {columnTasks.length === 0 ? (
                      <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-[#1e2636] text-[11px] text-zinc-600">
                        Kart yok
                      </div>
                    ) : (
                      columnTasks.map((task) => {
                        const isPending = task.id.startsWith("temp-");
                        const priorityMeta =
                          TASK_PRIORITIES.find(
                            (p) => p.value === task.priority
                          ) ?? TASK_PRIORITIES[1];
                        const isBlocked =
                          Boolean(task.blocked_by_task) &&
                          task.blocked_by_task?.status !== "done";
                        const doneSubtasks = task.subtasks.filter(
                          (s) => s.is_done
                        ).length;

                        if (tasksViewMode === "compact") {
                          return (
                            <div
                              key={task.id}
                              data-kanban-card="true"
                              draggable={!isPending}
                              onDragStart={() => setDraggedTaskId(task.id)}
                              onDragEnd={() => {
                                setDraggedTaskId(null);
                                setDragOverColumn(null);
                              }}
                              onClick={() => {
                                if (!isPending) setSelectedTaskId(task.id);
                              }}
                              className={`rounded-lg border border-[#1f2735] bg-[#121722] px-2.5 py-2 transition ${
                                isPending
                                  ? "opacity-75"
                                  : "cursor-pointer hover:border-amber-500/50 hover:bg-[#161c29]"
                              } ${draggedTaskId === task.id ? "opacity-50" : ""}`}
                            >
                              <div className="flex items-center gap-2">
                                <span
                                  title={`Öncelik: ${priorityMeta.label}`}
                                  className={`h-2 w-2 shrink-0 rounded-full ${
                                    PRIORITY_DOTS[task.priority]
                                  }`}
                                />
                                {task.kind === "bug" && (
                                  <Bug
                                    aria-label="Bug"
                                    className="h-3 w-3 shrink-0 text-rose-400"
                                  />
                                )}
                                {isBlocked && (
                                  <span
                                    title={`Bekliyor: ${task.blocked_by_task?.title}`}
                                    className="shrink-0"
                                  >
                                    <AlertTriangle className="h-3 w-3 text-amber-400" />
                                  </span>
                                )}
                                <h3 className="min-w-0 flex-1 truncate text-xs font-medium text-zinc-100">
                                  {task.title}
                                </h3>
                                {task.subtasks.length > 0 && (
                                  <span className="shrink-0 font-mono text-[10px] text-zinc-400">
                                    {doneSubtasks}/{task.subtasks.length}
                                  </span>
                                )}
                                {task.assignee && (
                                  <span
                                    title={task.assignee.display_name}
                                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-zinc-950"
                                    style={{
                                      backgroundColor:
                                        task.assignee.avatar_color,
                                    }}
                                  >
                                    {task.assignee.display_name
                                      .slice(0, 2)
                                      .toUpperCase()}
                                  </span>
                                )}
                              </div>

                              {(task.milestone ||
                                task.ue_tags.length > 0 ||
                                isPending) && (
                                <div className="mt-1 flex items-center gap-1.5 truncate pl-4 text-[10px] text-zinc-500">
                                  {task.milestone && (
                                    <span className="truncate text-cyan-400/90">
                                      {task.milestone.title}
                                    </span>
                                  )}
                                  {task.ue_tags[0] && (
                                    <span className="rounded bg-[#1a2130] px-1 text-[9px] text-zinc-400">
                                      {task.ue_tags[0]}
                                    </span>
                                  )}
                                  {isPending && (
                                    <span className="text-amber-300/80">
                                      Kaydediliyor...
                                    </span>
                                  )}
                                </div>
                              )}

                              <div
                                className="mt-2 border-t border-[#1a2130] pt-1.5 md:hidden"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <select
                                  aria-label="Sütun değiştir"
                                  value={task.status}
                                  disabled={isPending}
                                  onChange={(e) =>
                                    handleMoveStatus(
                                      task.id,
                                      e.target.value as TaskStatus
                                    )
                                  }
                                  className="w-full rounded-md border border-[#242e40] bg-[#080a0f] px-2 py-1 text-[11px] font-medium text-zinc-200 focus:border-amber-500/60 focus:outline-none"
                                >
                                  {TASK_STATUSES.map((s) => (
                                    <option key={s.value} value={s.value}>
                                      Taşı: {s.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={task.id}
                            data-kanban-card="true"
                            draggable={!isPending}
                            onDragStart={() => setDraggedTaskId(task.id)}
                            onDragEnd={() => {
                              setDraggedTaskId(null);
                              setDragOverColumn(null);
                            }}
                            onClick={() => {
                              if (!isPending) setSelectedTaskId(task.id);
                            }}
                            className={`rounded-xl border border-[#1f2735] bg-[#121722] p-4 transition ${
                              isPending
                                ? "opacity-75"
                                : "cursor-pointer hover:border-amber-500/50 hover:bg-[#161c29]"
                            } ${draggedTaskId === task.id ? "opacity-50" : ""}`}
                          >
                            {/* Top badges */}
                            <div className="flex flex-wrap items-center justify-between gap-1.5">
                              <div className="flex items-center gap-1.5">
                                {task.kind === "bug" && (
                                  <span className="inline-flex items-center gap-1 rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-rose-300">
                                    <Bug className="h-3 w-3" />
                                    Bug
                                  </span>
                                )}
                                <span
                                  className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${priorityMeta.badgeClass}`}
                                >
                                  {priorityMeta.label}
                                </span>
                              </div>

                              {task.milestone && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-cyan-300">
                                  <Flag className="h-2.5 w-2.5" />
                                  {task.milestone.title}
                                </span>
                              )}
                            </div>

                            <h3 className="mt-2 text-xs font-semibold leading-snug text-zinc-100">
                              {task.title}
                              {isPending && (
                                <span className="ml-1.5 text-[10px] font-normal text-amber-300/80">
                                  (Kaydediliyor...)
                                </span>
                              )}
                            </h3>

                            {isBlocked && (
                              <div className="mt-2 flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-200">
                                <AlertTriangle className="h-3 w-3 shrink-0 text-amber-400" />
                                <span className="truncate">
                                  Bekliyor: {task.blocked_by_task?.title}
                                </span>
                              </div>
                            )}

                            {task.ue_tags.length > 0 && (
                              <div className="mt-2.5 flex flex-wrap gap-1">
                                {task.ue_tags.slice(0, 3).map((tag) => (
                                  <span
                                    key={tag}
                                    className="rounded bg-[#1b2232] px-1.5 py-0.5 text-[10px] text-zinc-300"
                                  >
                                    {tag}
                                  </span>
                                ))}
                                {task.ue_tags.length > 3 && (
                                  <span className="rounded bg-[#1b2232] px-1.5 py-0.5 text-[10px] text-zinc-400">
                                    +{task.ue_tags.length - 3}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Card Footer */}
                            <div className="mt-3 flex items-center justify-between border-t border-[#1d2534] pt-2.5 text-[11px] text-zinc-400">
                              <div className="flex items-center gap-2.5">
                                {task.subtasks.length > 0 && (
                                  <span className="inline-flex items-center gap-1">
                                    <CheckSquare className="h-3 w-3 text-emerald-400" />
                                    {doneSubtasks}/{task.subtasks.length}
                                  </span>
                                )}
                                {task.comment_count > 0 && (
                                  <span className="inline-flex items-center gap-1">
                                    <MessageSquare className="h-3 w-3" />
                                    {task.comment_count}
                                  </span>
                                )}
                                {task.attachment_count > 0 && (
                                  <span className="inline-flex items-center gap-1">
                                    <Paperclip className="h-3 w-3" />
                                    {task.attachment_count}
                                  </span>
                                )}
                                {task.source_idea && (
                                  <span
                                    title={`Fikir: ${task.source_idea.title}`}
                                    className="inline-flex items-center gap-0.5 text-amber-300"
                                  >
                                    <Lightbulb className="h-3 w-3" />
                                  </span>
                                )}
                              </div>

                              {task.assignee ? (
                                <span
                                  title={task.assignee.display_name}
                                  className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-zinc-950"
                                  style={{
                                    backgroundColor:
                                      task.assignee.avatar_color,
                                  }}
                                >
                                  {task.assignee.display_name
                                    .slice(0, 2)
                                    .toUpperCase()}
                                </span>
                              ) : (
                                <span className="text-[10px] text-zinc-600">
                                  Boşta
                                </span>
                              )}
                            </div>

                            {/* Mobil dokunmatik tek dokunusla sutun degistirici */}
                            <div
                              className="mt-2.5 border-t border-[#1a2130] pt-2 md:hidden"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <select
                                aria-label="Sütun değiştir"
                                value={task.status}
                                disabled={isPending}
                                onChange={(e) =>
                                  handleMoveStatus(
                                    task.id,
                                    e.target.value as TaskStatus
                                  )
                                }
                                className="w-full rounded-lg border border-[#242e40] bg-[#080a0f] px-2.5 py-1.5 text-xs font-medium text-zinc-200 focus:border-amber-500/60 focus:outline-none"
                              >
                                {TASK_STATUSES.map((s) => (
                                  <option key={s.value} value={s.value}>
                                    Taşı: {s.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Pano İlerleme & Ekip İş Yükü Özeti */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-[#1f2735] bg-[#0c1018] p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
              <BarChart3 className="h-4 w-4 text-amber-400" />
              <span>Pano İlerleme & Durum Dağılımı</span>
            </div>
            <span className="font-mono text-xs font-bold text-amber-300">
              %{boardSummary.completionPercent} ({boardSummary.done}/
              {boardSummary.total})
            </span>
          </div>

          <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-[#171e2c]">
            {boardSummary.total > 0 && (
              <>
                {boardSummary.done > 0 && (
                  <div
                    title={`Tamamlandı: ${boardSummary.done}`}
                    className="h-full bg-emerald-400 transition-all duration-300"
                    style={{
                      width: `${(boardSummary.done / boardSummary.total) * 100}%`,
                    }}
                  />
                )}
                {boardSummary.testing > 0 && (
                  <div
                    title={`Testte: ${boardSummary.testing}`}
                    className="h-full bg-purple-400 transition-all duration-300"
                    style={{
                      width: `${(boardSummary.testing / boardSummary.total) * 100}%`,
                    }}
                  />
                )}
                {boardSummary.inProgress > 0 && (
                  <div
                    title={`Geliştiriliyor: ${boardSummary.inProgress}`}
                    className="h-full bg-amber-400 transition-all duration-300"
                    style={{
                      width: `${(boardSummary.inProgress / boardSummary.total) * 100}%`,
                    }}
                  />
                )}
                {boardSummary.todo > 0 && (
                  <div
                    title={`Yapılacak: ${boardSummary.todo}`}
                    className="h-full bg-cyan-400 transition-all duration-300"
                    style={{
                      width: `${(boardSummary.todo / boardSummary.total) * 100}%`,
                    }}
                  />
                )}
              </>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
            <span className="inline-flex items-center gap-1.5 rounded-md border border-[#1d2534] bg-[#10141d] px-2 py-1">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Bitti:{" "}
              <strong className="text-zinc-100">{boardSummary.done}</strong>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-[#1d2534] bg-[#10141d] px-2 py-1">
              <span className="h-2 w-2 rounded-full bg-purple-400" />
              Testte:{" "}
              <strong className="text-zinc-100">{boardSummary.testing}</strong>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-[#1d2534] bg-[#10141d] px-2 py-1">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              Geliştiriliyor:{" "}
              <strong className="text-zinc-100">
                {boardSummary.inProgress}
              </strong>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-[#1d2534] bg-[#10141d] px-2 py-1">
              <span className="h-2 w-2 rounded-full bg-cyan-400" />
              Yapılacak:{" "}
              <strong className="text-zinc-100">{boardSummary.todo}</strong>
            </span>
            {boardSummary.blockedCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-amber-200">
                <AlertTriangle className="h-3 w-3 text-amber-400" />
                Blokeli: <strong>{boardSummary.blockedCount}</strong>
              </span>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-[#1f2735] bg-[#0c1018] p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
              <Users className="h-4 w-4 text-cyan-400" />
              <span>Ekip İş Yükü</span>
            </div>
            <span className="text-[11px] text-zinc-500">
              Filtrelemek için tıkla
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {boardSummary.workload.map(({ member, openCount }) => {
              const isSelected = assigneeFilter === member.id;
              return (
                <button
                  key={member.id}
                  type="button"
                  onClick={() =>
                    setAssigneeFilter(isSelected ? "all" : member.id)
                  }
                  className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition ${
                    isSelected
                      ? "border-amber-500/50 bg-amber-500/15 text-amber-200"
                      : "border-[#1d2534] bg-[#10141d] text-zinc-300 hover:border-amber-500/30 hover:text-zinc-100"
                  }`}
                >
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-zinc-950"
                    style={{ backgroundColor: member.avatar_color }}
                  >
                    {member.display_name.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="font-medium">{member.display_name}</span>
                  <span className="rounded bg-[#080a0f] px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">
                    {openCount} açık
                  </span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() =>
                setAssigneeFilter(
                  assigneeFilter === "unassigned" ? "all" : "unassigned"
                )
              }
              className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition ${
                assigneeFilter === "unassigned"
                  ? "border-amber-500/50 bg-amber-500/15 text-amber-200"
                  : "border-[#1d2534] bg-[#10141d] text-zinc-400 hover:border-zinc-500/40 hover:text-zinc-200"
              }`}
            >
              <span>Atanmamış</span>
              <span className="rounded bg-[#080a0f] px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">
                {boardSummary.unassignedOpenCount}
              </span>
            </button>
          </div>
        </section>
      </div>

      {/* Create Task Modal */}
      {createStatus && (
        <TaskFormModal
          open
          mode="create"
          initialValues={{
            title: "",
            description_md: "",
            status: createStatus,
            priority: "medium",
            ue_tags: ["Blueprint"],
            assignee_id: null,
            milestone_id:
              milestones.find((m) => m.status === "active")?.id ?? null,
            source_idea_id: null,
            blocked_by_task_id: null,
          }}
          teamProfiles={teamProfiles}
          milestones={milestones}
          ideas={ideas}
          allTasks={tasks}
          onClose={() => setCreateStatus(null)}
          onSubmit={handleCreateSubmit}
        />
      )}

      {/* Edit Task Modal */}
      {editingTask && (
        <TaskFormModal
          open
          mode="edit"
          editingTaskId={editingTask.id}
          initialValues={{
            title: editingTask.title,
            description_md: editingTask.description_md,
            status: editingTask.status,
            priority: editingTask.priority,
            ue_tags: editingTask.ue_tags,
            assignee_id: editingTask.assignee_id,
            milestone_id: editingTask.milestone_id,
            source_idea_id: editingTask.source_idea_id,
            blocked_by_task_id: editingTask.blocked_by_task_id,
          }}
          teamProfiles={teamProfiles}
          milestones={milestones}
          ideas={ideas}
          allTasks={tasks}
          onClose={() => setEditingTask(null)}
          onSubmit={handleEditSubmit}
        />
      )}

      {/* Task Detail Modal */}
      <TaskDetailDrawer
        task={selectedTask}
        currentUserId={currentUserId}
        currentProfile={currentProfile}
        onClose={() => setSelectedTaskId(null)}
        onEdit={(task) => {
          setSelectedTaskId(null);
          setEditingTask(task);
        }}
        onSelectTask={(id) => setSelectedTaskId(id)}
        onStatusChangeOptimistic={handleMoveStatus}
        onDeleteTask={handleDeleteTaskOptimistic}
      />
    </div>
  );
}
