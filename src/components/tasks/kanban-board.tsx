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
import type { TaskBoardItem, TaskStatus } from "@/types/studio";

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
  } = useStudioStore();

  // Filters
  const [search, setSearch] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const milestoneFilter = tasksMilestoneFilter;
  const setMilestoneFilter = setTasksMilestoneFilter;
  const [kindFilter, setKindFilter] = useState<"all" | "task" | "bug">("all");

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
    milestoneFilter !== "all" ||
    kindFilter !== "all";

  function resetFilters() {
    setSearch("");
    setAssigneeFilter("all");
    setTagFilter("all");
    setTasksMilestoneFilter("all");
    setKindFilter("all");
  }

  // Modals & Drawer
  const [createStatus, setCreateStatus] = useState<TaskStatus | null>(null);
  const [editingTask, setEditingTask] = useState<TaskBoardItem | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [boardError, setBoardError] = useState<string | null>(null);

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => {
      if (kindFilter !== "all" && t.kind !== kindFilter) return false;
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
    tasks,
    search,
    assigneeFilter,
    tagFilter,
    milestoneFilter,
    kindFilter,
    currentUserId,
  ]);

  const selectedTask = useMemo(
    () => tasks.find((t) => t.id === selectedTaskId) ?? null,
    [tasks, selectedTaskId]
  );

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
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
            UE5 Görevler & Kanban Panosu
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Kartları sütunlar arasında sürükleyip bırakın, alt görevleri ve
            bağımlılıkları yönetin.
          </p>
        </div>

        <button
          type="button"
          disabled={!isConfigured}
          onClick={() => setCreateStatus("todo")}
          className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-xs font-semibold text-zinc-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Yeni Görev Ekle
        </button>
      </div>

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

      {/* Compact Toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#1f2735] bg-[#10141d] p-3">
        {currentUserId && (
          <div className="inline-flex rounded-lg border border-[#242e40] bg-[#080a0f] p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setAssigneeFilter("all")}
              className={`rounded-md px-2.5 py-1.5 font-medium transition ${
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
              className={`rounded-md px-2.5 py-1.5 font-medium transition ${
                assigneeFilter === "mine"
                  ? "bg-amber-500/20 text-amber-300"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Bana Atananlar
            </button>
          </div>
        )}

        <div className="relative min-w-44 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Görev veya tag ara..."
            className="w-full rounded-lg border border-[#242e40] bg-[#080a0f] py-1.5 pr-3 pl-8.5 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-amber-500/60 focus:outline-none"
          />
        </div>

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
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          className="rounded-lg border border-[#242e40] bg-[#080a0f] px-2.5 py-1.5 text-xs text-zinc-200 focus:border-amber-500/60 focus:outline-none"
        >
          <option value="all">Etiket: Tümü</option>
          {UE_DISCIPLINE_TAGS.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </select>

        <select
          value={milestoneFilter}
          onChange={(e) => setMilestoneFilter(e.target.value)}
          className="rounded-lg border border-[#242e40] bg-[#080a0f] px-2.5 py-1.5 text-xs text-zinc-200 focus:border-amber-500/60 focus:outline-none"
        >
          <option value="all">Milestone: Tümü</option>
          {milestones.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title}
            </option>
          ))}
        </select>

        <select
          value={kindFilter}
          onChange={(e) =>
            setKindFilter(e.target.value as "all" | "task" | "bug")
          }
          className="rounded-lg border border-[#242e40] bg-[#080a0f] px-2.5 py-1.5 text-xs text-zinc-200 focus:border-amber-500/60 focus:outline-none"
        >
          <option value="all">Tür: Hepsi</option>
          <option value="task">Görev</option>
          <option value="bug">Bug</option>
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

      {/* Mobile Column Switcher Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 md:hidden">
        {TASK_STATUSES.map((col) => {
          const count = filteredTasks.filter((t) => t.status === col.value).length;
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
        className={`flex flex-col gap-4 pb-2 md:h-[calc(100dvh-210px)] md:min-h-[480px] md:flex-row md:overflow-x-auto md:overflow-y-hidden ${
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
              } min-h-[340px] w-full flex-col overflow-hidden rounded-xl border bg-[#0c1018] transition md:h-full md:w-76 md:shrink-0 ${
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
              <div className="flex-1 space-y-2.5 overflow-y-auto overscroll-contain p-3">
                {columnTasks.length === 0 ? (
                  <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-[#1e2636] text-[11px] text-zinc-600">
                    Kart yok
                  </div>
                ) : (
                  columnTasks.map((task) => {
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
                        data-kanban-card="true"
                        draggable
                        onDragStart={() => setDraggedTaskId(task.id)}
                        onDragEnd={() => {
                          setDraggedTaskId(null);
                          setDragOverColumn(null);
                        }}
                        onClick={() => setSelectedTaskId(task.id)}
                        className={`cursor-pointer rounded-xl border border-[#1f2735] bg-[#121722] p-3.5 transition hover:border-amber-500/50 hover:bg-[#161c29] ${
                          draggedTaskId === task.id ? "opacity-50" : ""
                        }`}
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
                                backgroundColor: task.assignee.avatar_color,
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
