"use client";

import {
  startTransition,
  useEffect,
  useMemo,
  useOptimistic,
  useState,
} from "react";
import { useRouter } from "next/navigation";
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
} from "lucide-react";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  UE_DISCIPLINE_TAGS,
} from "@/lib/constants";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  createTaskAction,
  moveTaskStatusAction,
  updateTaskAction,
} from "@/app/actions/tasks";
import {
  TaskFormModal,
  type TaskFormValues,
} from "@/components/tasks/task-form-modal";
import { TaskDetailDrawer } from "@/components/tasks/task-detail-drawer";
import type {
  Idea,
  Milestone,
  Profile,
  TaskBoardItem,
  TaskStatus,
} from "@/types/studio";

export function KanbanBoard({
  initialTasks,
  teamProfiles,
  milestones,
  ideas,
  currentUserId,
  isConfigured,
  initialMilestoneFilter = "all",
}: {
  initialTasks: TaskBoardItem[];
  teamProfiles: Profile[];
  milestones: Milestone[];
  ideas: Pick<Idea, "id" | "title">[];
  currentUserId: string | null;
  isConfigured: boolean;
  initialMilestoneFilter?: string;
}) {
  const router = useRouter();

  const [optimisticTasks, moveTaskOptimistic] = useOptimistic(
    initialTasks,
    (state, update: { taskId: string; status: TaskStatus }) =>
      state.map((t) =>
        t.id === update.taskId ? { ...t, status: update.status } : t
      )
  );

  // Filters
  const [search, setSearch] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [milestoneFilter, setMilestoneFilter] = useState<string>(
    initialMilestoneFilter
  );
  const [kindFilter, setKindFilter] = useState<"all" | "task" | "bug">("all");

  // Drag state
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);

  // Modals & Drawer
  const [createStatus, setCreateStatus] = useState<TaskStatus | null>(null);
  const [editingTask, setEditingTask] = useState<TaskBoardItem | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [boardError, setBoardError] = useState<string | null>(null);

  // Live Realtime updates
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;

    const channel = supabase
      .channel("kanban-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        () => router.refresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subtasks" },
        () => router.refresh()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return optimisticTasks.filter((t) => {
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
    optimisticTasks,
    search,
    assigneeFilter,
    tagFilter,
    milestoneFilter,
    kindFilter,
    currentUserId,
  ]);

  const selectedTask = useMemo(
    () => optimisticTasks.find((t) => t.id === selectedTaskId) ?? null,
    [optimisticTasks, selectedTaskId]
  );

  function handleDropOnColumn(targetStatus: TaskStatus) {
    setDragOverColumn(null);
    if (!draggedTaskId) return;
    const task = optimisticTasks.find((t) => t.id === draggedTaskId);
    setDraggedTaskId(null);
    if (!task || task.status === targetStatus) return;

    setBoardError(null);
    startTransition(async () => {
      moveTaskOptimistic({ taskId: task.id, status: targetStatus });
      try {
        const res = await moveTaskStatusAction(task.id, targetStatus);
        if (!res.ok) {
          setBoardError(
            res.error ?? "Kart taşınamadı, eski sütununa geri alındı."
          );
          return;
        }
        router.refresh();
      } catch {
        setBoardError("Bağlantı hatası: Kart taşıma işlemi geri alındı.");
      }
    });
  }

  async function handleCreateSubmit(values: TaskFormValues) {
    const res = await createTaskAction(values);
    if (res.ok) router.refresh();
    return res;
  }

  async function handleEditSubmit(values: TaskFormValues) {
    if (!editingTask) return { ok: false, error: "Görev bulunamadı." };
    const res = await updateTaskAction(editingTask.id, values);
    if (res.ok) router.refresh();
    return res;
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

      {/* Filters Bar */}
      <div className="grid gap-3 rounded-xl border border-[#1f2735] bg-[#10141d] p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative lg:col-span-2">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Görev, tag veya sistem ara..."
            className="w-full rounded-lg border border-[#242e40] bg-[#080a0f] py-2 pr-3 pl-9 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-amber-500/60 focus:outline-none"
          />
        </div>

        <select
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
          className="rounded-lg border border-[#242e40] bg-[#080a0f] px-3 py-2 text-xs text-zinc-200 focus:border-amber-500/60 focus:outline-none"
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
          className="rounded-lg border border-[#242e40] bg-[#080a0f] px-3 py-2 text-xs text-zinc-200 focus:border-amber-500/60 focus:outline-none"
        >
          <option value="all">UE5 Etiketi: Tümü</option>
          {UE_DISCIPLINE_TAGS.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </select>

        <div className="flex gap-2">
          <select
            value={milestoneFilter}
            onChange={(e) => setMilestoneFilter(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-[#242e40] bg-[#080a0f] px-2.5 py-2 text-xs text-zinc-200 focus:border-amber-500/60 focus:outline-none"
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
            className="rounded-lg border border-[#242e40] bg-[#080a0f] px-2.5 py-2 text-xs text-zinc-200 focus:border-amber-500/60 focus:outline-none"
          >
            <option value="all">Hepsi</option>
            <option value="task">Görev</option>
            <option value="bug">Bug</option>
          </select>
        </div>
      </div>

      {/* Kanban Columns */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {TASK_STATUSES.map((column) => {
          const columnTasks = filteredTasks.filter(
            (t) => t.status === column.value
          );
          const isDropTarget = dragOverColumn === column.value;

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
              className={`flex min-h-[460px] w-72 shrink-0 flex-col rounded-xl border bg-[#0c1018] transition ${
                isDropTarget
                  ? "border-amber-400/70 bg-amber-500/5"
                  : `border-[#1f2735] border-t-2 ${column.accentClass}`
              }`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between border-b border-[#1a2130] px-3.5 py-3">
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

              {/* Column Cards */}
              <div className="flex-1 space-y-2.5 p-3">
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
          allTasks={optimisticTasks}
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
          allTasks={optimisticTasks}
          onClose={() => setEditingTask(null)}
          onSubmit={handleEditSubmit}
        />
      )}

      {/* Task Detail Modal */}
      <TaskDetailDrawer
        task={selectedTask}
        currentUserId={currentUserId}
        currentProfile={
          teamProfiles.find((p) => p.id === currentUserId) ?? null
        }
        onClose={() => setSelectedTaskId(null)}
        onEdit={(task) => setEditingTask(task)}
        onSelectTask={(id) => setSelectedTaskId(id)}
        onStatusChangeOptimistic={(taskId, status) => {
          startTransition(() => {
            moveTaskOptimistic({ taskId, status });
          });
        }}
      />
    </div>
  );
}
