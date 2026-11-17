"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  Bug,
  Plus,
  Search,
  AlertTriangle,
  CheckCircle2,
  Paperclip,
  MessageSquare,
  X,
  Upload,
  AlertCircle,
  KanbanSquare,
  List,
} from "lucide-react";
import {
  BUG_SEVERITIES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  UE_DISCIPLINE_TAGS,
} from "@/lib/constants";
import { uploadStudioMedia } from "@/lib/media-upload";
import { useStudioStore } from "@/components/studio/studio-store";
import { createBugAction } from "@/app/actions/bugs";
import {
  deleteTaskAction,
  moveTaskStatusAction,
  registerTaskAttachmentAction,
  updateTaskAction,
} from "@/app/actions/tasks";
import type { TaskFormValues } from "@/components/tasks/task-form-modal";

const TaskDetailDrawer = dynamic(
  () =>
    import("@/components/tasks/task-detail-drawer").then(
      (mod) => mod.TaskDetailDrawer
    ),
  { ssr: false }
);

const TaskFormModal = dynamic(
  () =>
    import("@/components/tasks/task-form-modal").then(
      (mod) => mod.TaskFormModal
    ),
  { ssr: false }
);
import type {
  BugSeverity,
  TaskBoardItem,
  TaskPriority,
  TaskStatus,
} from "@/types/studio";

const SEVERITY_BADGES: Record<BugSeverity, string> = {
  crash: "border-rose-500/50 bg-rose-500/20 text-rose-200",
  gameplay: "border-amber-500/50 bg-amber-500/15 text-amber-200",
  visual: "border-purple-500/40 bg-purple-500/15 text-purple-200",
  audio: "border-indigo-500/40 bg-indigo-500/15 text-indigo-200",
  minor: "border-zinc-500/40 bg-zinc-500/15 text-zinc-300",
};

export function BugsBoard() {
  const {
    tasks,
    setTasks,
    teamProfiles,
    milestones,
    currentUserId,
    currentProfile,
    isConfigured,
  } = useStudioStore();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [bugsViewMode, setBugsViewMode] = useState<"list" | "kanban">("list");
  const [draggedBugId, setDraggedBugId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);
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

  const bugs = useMemo(
    () => tasks.filter((task) => task.kind === "bug"),
    [tasks]
  );

  // Filters
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<BugSeverity | "all">(
    "all"
  );
  const [statusFilter, setStatusFilter] = useState<
    "open" | "crash" | "testing" | "done" | "all"
  >("open");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");

  // Feedback & Selection
  const [boardError, setBoardError] = useState<string | null>(null);
  const [selectedBugId, setSelectedBugId] = useState<string | null>(null);
  const [editingBug, setEditingBug] = useState<TaskBoardItem | null>(null);

  // Create Bug Modal
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [severity, setSeverity] = useState<BugSeverity>("gameplay");
  const [priority, setPriority] = useState<TaskPriority>("high");
  const [buildVersion, setBuildVersion] = useState("");
  const [reproSteps, setReproSteps] = useState("");
  const [descriptionMd, setDescriptionMd] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [milestoneId, setMilestoneId] = useState(
    () => milestones.find((m) => m.status === "active")?.id ?? ""
  );
  const [ueTags, setUeTags] = useState<string[]>(["Blueprint"]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [createError, setCreateError] = useState<string | null>(null);

  const stats = useMemo(() => {
    const open = bugs.filter((b) => b.status !== "done");
    return {
      openCount: open.length,
      crashCount: open.filter((b) => b.bug_severity === "crash").length,
      testingCount: open.filter((b) => b.status === "testing").length,
      doneCount: bugs.filter((b) => b.status === "done").length,
    };
  }, [bugs]);

  const filteredBugs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bugs.filter((b) => {
      if (statusFilter === "open" && b.status === "done") return false;
      if (
        statusFilter === "crash" &&
        (b.status === "done" || b.bug_severity !== "crash")
      ) {
        return false;
      }
      if (statusFilter === "testing" && b.status !== "testing") return false;
      if (statusFilter === "done" && b.status !== "done") return false;
      if (severityFilter !== "all" && b.bug_severity !== severityFilter) {
        return false;
      }
      if (assigneeFilter === "mine" && b.assignee_id !== currentUserId) {
        return false;
      }
      if (
        assigneeFilter !== "all" &&
        assigneeFilter !== "mine" &&
        b.assignee_id !== assigneeFilter
      ) {
        return false;
      }
      if (q) {
        const hay =
          `${b.title} ${b.repro_steps} ${b.build_version} ${b.description_md}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    bugs,
    search,
    severityFilter,
    statusFilter,
    assigneeFilter,
    currentUserId,
  ]);

  const selectedBug = useMemo(
    () => bugs.find((b) => b.id === selectedBugId) ?? null,
    [bugs, selectedBugId]
  );

  async function handleQuickStatusChange(bugId: string, nextStatus: TaskStatus) {
    if (bugId.startsWith("temp-")) return;
    const prevBug = bugs.find((b) => b.id === bugId);
    if (!prevBug || prevBug.status === nextStatus) return;

    setBoardError(null);
    const now = new Date().toISOString();
    setTasks((prev) =>
      prev.map((t) =>
        t.id === bugId ? { ...t, status: nextStatus, updated_at: now } : t
      )
    );

    try {
      const res = await moveTaskStatusAction(bugId, nextStatus);
      if (!res.ok) {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === bugId
              ? { ...t, status: prevBug.status, updated_at: prevBug.updated_at }
              : t
          )
        );
        setBoardError(
          res.error ?? "Bug durumu güncellenemedi, değişiklik geri alındı."
        );
      }
    } catch {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === bugId
            ? { ...t, status: prevBug.status, updated_at: prevBug.updated_at }
            : t
        )
      );
      setBoardError("Bağlantı hatası: Bug durumu geri alındı.");
    }
  }

  async function handleCreateBug(e: React.FormEvent) {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setCreateError("Hata başlığı zorunludur.");
      return;
    }

    setCreateError(null);
    setBoardError(null);

    const payload = {
      title: cleanTitle,
      description_md: descriptionMd,
      bug_severity: severity,
      priority,
      repro_steps: reproSteps,
      build_version: buildVersion,
      ue_tags: ueTags,
      assignee_id: assigneeId || null,
      milestone_id: milestoneId || null,
    };
    const filesToUpload = [...pendingFiles];

    const tempId = `temp-bug-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();
    const selectedMilestone = payload.milestone_id
      ? milestones.find((m) => m.id === payload.milestone_id) ?? null
      : null;

    const optimisticBug: TaskBoardItem = {
      id: tempId,
      title: cleanTitle,
      description_md: payload.description_md,
      kind: "bug",
      status: "backlog",
      priority: payload.priority,
      ue_tags: payload.ue_tags,
      assignee_id: payload.assignee_id,
      reporter_id: currentUserId,
      milestone_id: payload.milestone_id,
      source_idea_id: null,
      blocked_by_task_id: null,
      bug_severity: payload.bug_severity,
      repro_steps: payload.repro_steps,
      build_version: payload.build_version,
      position: Date.now(),
      created_at: now,
      updated_at: now,
      assignee: payload.assignee_id
        ? teamProfiles.find((p) => p.id === payload.assignee_id) ?? null
        : null,
      reporter:
        currentProfile ??
        (currentUserId
          ? teamProfiles.find((p) => p.id === currentUserId) ?? null
          : null),
      milestone: selectedMilestone
        ? { id: selectedMilestone.id, title: selectedMilestone.title }
        : null,
      source_idea: null,
      blocked_by_task: null,
      subtasks: [],
      comment_count: 0,
      attachment_count: filesToUpload.length,
    };

    // 0 ms Optimistic UI + close modal immediately
    setTasks((prev) => [optimisticBug, ...prev]);
    setTitle("");
    setBuildVersion("");
    setReproSteps("");
    setDescriptionMd("");
    setPendingFiles([]);
    setCreateOpen(false);

    try {
      const res = await createBugAction(payload);
      if (!res.ok || !res.data?.id) {
        setTasks((prev) => prev.filter((t) => t.id !== tempId));
        setBoardError(
          res.error ?? "Bug raporu oluşturulamadı, değişiklik geri alındı."
        );
        return;
      }

      const realId = res.data.id;
      const realCreatedAt = res.data.created_at || now;
      setTasks((prev) =>
        prev.map((t) =>
          t.id === tempId
            ? {
                ...t,
                id: realId,
                created_at: realCreatedAt,
                updated_at: realCreatedAt,
              }
            : t
        )
      );

      if (filesToUpload.length > 0) {
        let uploadedCount = 0;
        let failedCount = 0;
        for (const file of filesToUpload) {
          try {
            const uploaded = await uploadStudioMedia("task", realId, file);
            const regRes = await registerTaskAttachmentAction({
              taskId: realId,
              ...uploaded,
            });
            if (regRes.ok) {
              uploadedCount += 1;
            } else {
              failedCount += 1;
            }
          } catch {
            failedCount += 1;
          }
        }
        if (failedCount > 0) {
          setTasks((prev) =>
            prev.map((t) =>
              t.id === realId ? { ...t, attachment_count: uploadedCount } : t
            )
          );
          setBoardError(
            "Bug kaydedildi ancak bazı ekran görüntüleri yüklenemedi."
          );
        }
      }
    } catch (err) {
      setTasks((prev) => prev.filter((t) => t.id !== tempId));
      setBoardError(
        err instanceof Error
          ? `${err.message} (Değişiklik geri alındı)`
          : "Bağlantı hatası: Bug raporu kaydedilemedi, değişiklik geri alındı."
      );
    }
  }

  async function handleEditSubmit(values: TaskFormValues) {
    const prevBug = editingBug;
    if (!prevBug) return { ok: false, error: "Kayıt bulunamadı." };
    setBoardError(null);

    const nextAssignee = values.assignee_id
      ? teamProfiles.find((p) => p.id === values.assignee_id) ?? null
      : null;
    const nextMilestone = values.milestone_id
      ? milestones.find((m) => m.id === values.milestone_id) ?? null
      : null;
    const nextBlocker = values.blocked_by_task_id
      ? tasks.find((t) => t.id === values.blocked_by_task_id) ?? null
      : null;

    setTasks((prev) =>
      prev.map((t) =>
        t.id === prevBug.id
          ? {
              ...t,
              title: values.title.trim() || t.title,
              description_md: values.description_md,
              status: values.status,
              priority: values.priority,
              ue_tags: values.ue_tags,
              assignee_id: values.assignee_id,
              assignee: nextAssignee,
              milestone_id: values.milestone_id,
              milestone: nextMilestone
                ? { id: nextMilestone.id, title: nextMilestone.title }
                : null,
              source_idea_id: values.source_idea_id,
              blocked_by_task_id: values.blocked_by_task_id,
              blocked_by_task: nextBlocker
                ? {
                    id: nextBlocker.id,
                    title: nextBlocker.title,
                    status: nextBlocker.status,
                  }
                : null,
              updated_at: new Date().toISOString(),
            }
          : t
      )
    );

    try {
      const res = await updateTaskAction(prevBug.id, values);
      if (!res.ok) {
        setTasks((prev) =>
          prev.map((t) => (t.id === prevBug.id ? prevBug : t))
        );
        setBoardError(
          res.error ?? "Bug güncellenemedi, değişiklik geri alındı."
        );
      }
      return res;
    } catch {
      setTasks((prev) => prev.map((t) => (t.id === prevBug.id ? prevBug : t)));
      setBoardError("Bağlantı hatası: Bug düzenleme işlemi geri alındı.");
      return { ok: false, error: "Bağlantı hatası." };
    }
  }

  async function handleDeleteBug(bugId: string) {
    const targetBug = bugs.find((b) => b.id === bugId);
    if (!targetBug) return;
    setBoardError(null);
    setTasks((prev) => prev.filter((t) => t.id !== bugId));

    try {
      const res = await deleteTaskAction(bugId);
      if (!res.ok) {
        setTasks((prev) => [targetBug, ...prev]);
        setBoardError(res.error ?? "Bug silinemedi, değişiklik geri alındı.");
      }
    } catch {
      setTasks((prev) => [targetBug, ...prev]);
      setBoardError("Bağlantı hatası: Silme işlemi geri alındı.");
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
            Playtest Bug Raporlama
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Test sırasında bulunan hataları repro adımları, build numarası ve
            ekran görüntüsüyle kaydedip ayrı Bug panosunda takip edin.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div
            role="group"
            aria-label="Bug Görünüm Modu"
            className="inline-flex rounded-lg border border-[#242e40] bg-[#0c1018] p-0.5 text-xs"
          >
            <button
              type="button"
              onClick={() => setBugsViewMode("list")}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium transition ${
                bugsViewMode === "list"
                  ? "bg-rose-500/20 text-rose-200"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <List className="h-3.5 w-3.5" />
              <span>Liste</span>
            </button>
            <button
              type="button"
              onClick={() => setBugsViewMode("kanban")}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium transition ${
                bugsViewMode === "kanban"
                  ? "bg-rose-500/20 text-rose-200"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <KanbanSquare className="h-3.5 w-3.5" />
              <span>Kanban</span>
            </button>
          </div>
          <button
            type="button"
            disabled={!isConfigured}
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-rose-500 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Bug Bildir
          </button>
        </div>
      </div>

      {boardError && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-200">
          <span>{boardError}</span>
          <button
            type="button"
            onClick={() => setBoardError(null)}
            className="underline hover:text-white"
          >
            Kapat
          </button>
        </div>
      )}

      {/* Compact Bugs Toolbar with Inline Status Counts */}
      <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-[#1f2735] bg-[#10141d] p-3">
        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-[#242e40] bg-[#080a0f] p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setStatusFilter("open")}
            className={`rounded-md px-2.5 py-1 font-medium transition ${
              statusFilter === "open"
                ? "bg-[#1a2232] text-zinc-100"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Açık ({stats.openCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("crash")}
            className={`rounded-md px-2.5 py-1 font-medium transition ${
              statusFilter === "crash"
                ? "bg-rose-500/20 text-rose-300"
                : "text-zinc-400 hover:text-rose-300"
            }`}
          >
            Crash ({stats.crashCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("testing")}
            className={`rounded-md px-2.5 py-1 font-medium transition ${
              statusFilter === "testing"
                ? "bg-purple-500/20 text-purple-300"
                : "text-zinc-400 hover:text-purple-300"
            }`}
          >
            Testte ({stats.testingCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("done")}
            className={`rounded-md px-2.5 py-1 font-medium transition ${
              statusFilter === "done"
                ? "bg-emerald-500/20 text-emerald-300"
                : "text-zinc-400 hover:text-emerald-300"
            }`}
          >
            Çözülen ({stats.doneCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`rounded-md px-2.5 py-1 font-medium transition ${
              statusFilter === "all"
                ? "bg-[#1a2232] text-zinc-100"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Tümü ({bugs.length})
          </button>
        </div>

        <div className="relative min-w-44 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Bug, repro veya build ara..."
            className="w-full rounded-lg border border-[#242e40] bg-[#080a0f] py-1.5 pr-3 pl-8.5 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-rose-500/60 focus:outline-none"
          />
        </div>

        <select
          value={severityFilter}
          onChange={(e) =>
            setSeverityFilter(e.target.value as BugSeverity | "all")
          }
          className="rounded-lg border border-[#242e40] bg-[#080a0f] px-2.5 py-1.5 text-xs text-zinc-200 focus:border-rose-500/60 focus:outline-none"
        >
          <option value="all">Ciddiyet: Tümü</option>
          {BUG_SEVERITIES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        <select
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
          className="rounded-lg border border-[#242e40] bg-[#080a0f] px-2.5 py-1.5 text-xs text-zinc-200 focus:border-rose-500/60 focus:outline-none"
        >
          <option value="all">Atanan: Tümü</option>
          {currentUserId && <option value="mine">Bana Atananlar</option>}
          {teamProfiles.map((m) => (
            <option key={m.id} value={m.id}>
              {m.display_name}
            </option>
          ))}
        </select>
      </div>

      {/* Bug List or Bug Kanban */}
      {bugsViewMode === "kanban" ? (
        <div
          ref={boardScrollRef}
          onMouseDown={handleBoardMouseDown}
          className={`flex flex-col gap-4 pb-2 md:h-[500px] md:flex-row md:overflow-x-auto md:overflow-y-hidden ${
            isPanning ? "md:cursor-grabbing select-none" : "md:cursor-grab"
          }`}
        >
          {TASK_STATUSES.map((column) => {
            const colBugs = bugs.filter((b) => {
              if (b.status !== column.value) return false;
              if (severityFilter !== "all" && b.bug_severity !== severityFilter) {
                return false;
              }
              if (assigneeFilter === "mine" && b.assignee_id !== currentUserId) {
                return false;
              }
              if (
                assigneeFilter !== "all" &&
                assigneeFilter !== "mine" &&
                b.assignee_id !== assigneeFilter
              ) {
                return false;
              }
              const q = search.trim().toLowerCase();
              if (q) {
                const hay =
                  `${b.title} ${b.repro_steps} ${b.build_version} ${b.description_md}`.toLowerCase();
                if (!hay.includes(q)) return false;
              }
              return true;
            });
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
                  setDragOverColumn(null);
                  if (draggedBugId) {
                    const id = draggedBugId;
                    setDraggedBugId(null);
                    void handleQuickStatusChange(id, column.value);
                  }
                }}
                className={`flex max-h-[420px] min-h-[260px] w-full flex-col overflow-hidden rounded-xl border bg-[#0c1018] transition md:h-full md:max-h-none md:w-72 md:shrink-0 ${
                  isDropTarget
                    ? "border-rose-400/70 bg-rose-500/5"
                    : `border-[#1f2735] border-t-2 ${column.accentClass}`
                }`}
              >
                <div className="flex shrink-0 items-center justify-between border-b border-[#1a2130] px-3.5 py-3">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-200">
                      {column.label}
                    </h2>
                    <span className="rounded-full bg-[#171e2c] px-2 py-0.5 font-mono text-[11px] text-zinc-400">
                      {colBugs.length}
                    </span>
                  </div>
                </div>

                <div className="flex-1 space-y-2 overflow-y-auto overscroll-contain p-2.5">
                  {colBugs.length === 0 ? (
                    <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-[#1e2636] text-[11px] text-zinc-600">
                      Bug yok
                    </div>
                  ) : (
                    colBugs.map((bug) => {
                      const isPending = bug.id.startsWith("temp-");
                      const sev = bug.bug_severity ?? "gameplay";
                      const sevLabel =
                        BUG_SEVERITIES.find((s) => s.value === sev)?.label ??
                        sev;

                      return (
                        <div
                          key={bug.id}
                          data-kanban-card="true"
                          draggable={!isPending}
                          onDragStart={() => setDraggedBugId(bug.id)}
                          onDragEnd={() => {
                            setDraggedBugId(null);
                            setDragOverColumn(null);
                          }}
                          onClick={() => {
                            if (!isPending) setSelectedBugId(bug.id);
                          }}
                          className={`rounded-lg border border-[#1f2735] bg-[#121722] p-3 transition ${
                            isPending
                              ? "opacity-75"
                              : "cursor-pointer hover:border-rose-500/50 hover:bg-[#161c29]"
                          } ${draggedBugId === bug.id ? "opacity-50" : ""}`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-1.5">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${SEVERITY_BADGES[sev]}`}
                            >
                              {sev === "crash" ? (
                                <AlertTriangle className="h-2.5 w-2.5" />
                              ) : (
                                <Bug className="h-2.5 w-2.5" />
                              )}
                              {sevLabel}
                            </span>
                            {bug.build_version && (
                              <span className="rounded bg-[#080a0f] px-1.5 py-0.5 font-mono text-[10px] text-cyan-300">
                                {bug.build_version}
                              </span>
                            )}
                          </div>
                          <h3 className="mt-2 text-xs font-semibold leading-snug text-zinc-100">
                            {bug.title}
                          </h3>
                          <div className="mt-2.5 flex items-center justify-between border-t border-[#1d2534] pt-2 text-[10px] text-zinc-400">
                            <span>
                              {bug.reporter?.display_name ?? "Ekip"}
                            </span>
                            {bug.assignee && (
                              <span
                                title={bug.assignee.display_name}
                                className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-zinc-950"
                                style={{
                                  backgroundColor: bug.assignee.avatar_color,
                                }}
                              >
                                {bug.assignee.display_name
                                  .slice(0, 2)
                                  .toUpperCase()}
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
      ) : filteredBugs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#242e40] bg-[#0c1018] px-6 py-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-zinc-100">
            {bugs.length === 0
              ? "Henüz bug kaydı yok"
              : "Filtreye uyan bug bulunamadı"}
          </h3>
          <p className="mt-1 max-w-md text-xs text-zinc-400">
            Playtest sırasında karşılaştığınız hataları buradan açıp ekran
            görüntüsü ve repro adımları ekleyebilirsiniz.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredBugs.map((bug) => {
            const sev = bug.bug_severity ?? "gameplay";
            const sevLabel =
              BUG_SEVERITIES.find((s) => s.value === sev)?.label ?? sev;
            const priorityMeta =
              TASK_PRIORITIES.find((p) => p.value === bug.priority) ??
              TASK_PRIORITIES[1];

            const isPending = bug.id.startsWith("temp-");

            return (
              <div
                key={bug.id}
                onClick={() => {
                  if (!isPending) setSelectedBugId(bug.id);
                }}
                className={`rounded-xl border border-[#1f2735] bg-[#10141d] p-4 transition ${
                  isPending
                    ? "opacity-80"
                    : "cursor-pointer hover:border-rose-500/40 hover:bg-[#131823]"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${SEVERITY_BADGES[sev]}`}
                      >
                        {sev === "crash" ? (
                          <AlertTriangle className="h-3 w-3" />
                        ) : (
                          <Bug className="h-3 w-3" />
                        )}
                        {sevLabel}
                      </span>
                      <span
                        className={`rounded border px-2 py-0.5 text-[10px] font-medium ${priorityMeta.badgeClass}`}
                      >
                        {priorityMeta.label}
                      </span>
                      {bug.build_version && (
                        <span className="rounded bg-[#080a0f] px-2 py-0.5 font-mono text-[10px] text-cyan-300">
                          {bug.build_version}
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm font-semibold text-zinc-100">
                      {bug.title}
                      {isPending && (
                        <span className="ml-2 text-[11px] font-normal text-amber-300/80">
                          (Kaydediliyor...)
                        </span>
                      )}
                    </h3>

                    {bug.repro_steps && (
                      <p className="line-clamp-2 text-xs text-zinc-400">
                        {bug.repro_steps}
                      </p>
                    )}
                  </div>

                  {/* Quick Status Selector (stops card click propagation) */}
                  <div
                    className="flex w-full items-center gap-2 sm:w-auto"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <select
                      value={bug.status}
                      disabled={isPending}
                      onChange={(e) =>
                        handleQuickStatusChange(
                          bug.id,
                          e.target.value as TaskStatus
                        )
                      }
                      className="w-full rounded-lg border border-[#242e40] bg-[#080a0f] px-2.5 py-1.5 text-xs font-medium text-zinc-200 focus:border-amber-500/60 focus:outline-none disabled:opacity-50 sm:w-auto"
                    >
                      {TASK_STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#1b2230] pt-2.5 text-[11px] text-zinc-400">
                  <div className="flex flex-wrap items-center gap-3">
                    <span>
                      Bildiren:{" "}
                      <strong className="text-zinc-300">
                        {bug.reporter?.display_name ?? "Ekip"}
                      </strong>
                    </span>
                    {bug.attachment_count > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <Paperclip className="h-3 w-3" />
                        {bug.attachment_count}
                      </span>
                    )}
                    {bug.comment_count > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        {bug.comment_count}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {bug.assignee ? (
                      <span className="inline-flex items-center gap-1.5 text-zinc-200">
                        <span
                          className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-zinc-950"
                          style={{ backgroundColor: bug.assignee.avatar_color }}
                        >
                          {bug.assignee.display_name.slice(0, 2).toUpperCase()}
                        </span>
                        {bug.assignee.display_name}
                      </span>
                    ) : (
                      <span className="text-zinc-500">Atanmadı</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Bug Modal */}
      {createOpen && (
        <div
          onMouseDown={(e) => {
            if (
              e.target === e.currentTarget &&
              !title.trim() &&
              !reproSteps.trim()
            ) {
              setCreateOpen(false);
            }
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-2.5 sm:p-4 backdrop-blur-xs"
        >
          <div className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#242e40] bg-[#0e131c] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1f2735] px-6 py-4">
              <div className="flex items-center gap-2">
                <Bug className="h-4.5 w-4.5 text-rose-400" />
                <h2 className="text-base font-semibold text-zinc-100">
                  Playtest Bug Bildir
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <form
              onSubmit={handleCreateBug}
              className="flex-1 space-y-4 overflow-y-auto p-6"
            >
              {createError && (
                <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                  <span>{createError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-300">
                  Hata Başlığı
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Örn. Kanca atıp zıplayınca karakter haritanın altına düşüyor"
                  className="w-full rounded-lg border border-[#242e40] bg-[#080a0f] px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-rose-500/60 focus:outline-none"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-300">
                    Ciddiyet
                  </label>
                  <select
                    value={severity}
                    onChange={(e) => {
                      const next = e.target.value as BugSeverity;
                      setSeverity(next);
                      if (next === "crash") setPriority("critical");
                    }}
                    className="w-full rounded-lg border border-[#242e40] bg-[#080a0f] px-2.5 py-2 text-xs text-zinc-100 focus:border-rose-500/60 focus:outline-none"
                  >
                    {BUG_SEVERITIES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-300">
                    Öncelik
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as TaskPriority)}
                    className="w-full rounded-lg border border-[#242e40] bg-[#080a0f] px-2.5 py-2 text-xs text-zinc-100 focus:border-rose-500/60 focus:outline-none"
                  >
                    {TASK_PRIORITIES.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-300">
                    Build / Commit
                  </label>
                  <input
                    type="text"
                    value={buildVersion}
                    onChange={(e) => setBuildVersion(e.target.value)}
                    placeholder="Örn. v0.2.1 / #a4f1c"
                    className="w-full rounded-lg border border-[#242e40] bg-[#080a0f] px-3 py-2 font-mono text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-rose-500/60 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-300">
                  Nasıl Tekrar Edilir? (Repro Adımları)
                </label>
                <textarea
                  rows={3}
                  value={reproSteps}
                  onChange={(e) => setReproSteps(e.target.value)}
                  placeholder={`1. L_Dungeon_01 haritasını aç\n2. Duvara yakınken sağ tıkla kanca at\n3. Tam çarpma anında Space'e bas`}
                  className="w-full rounded-lg border border-[#242e40] bg-[#080a0f] px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-rose-500/60 focus:outline-none"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-300">
                    Çözecek Kişi
                  </label>
                  <select
                    value={assigneeId}
                    onChange={(e) => setAssigneeId(e.target.value)}
                    className="w-full rounded-lg border border-[#242e40] bg-[#080a0f] px-2.5 py-2 text-xs text-zinc-100 focus:border-rose-500/60 focus:outline-none"
                  >
                    <option value="">Atanmadı</option>
                    {teamProfiles.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.display_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-300">
                    Milestone
                  </label>
                  <select
                    value={milestoneId}
                    onChange={(e) => setMilestoneId(e.target.value)}
                    className="w-full rounded-lg border border-[#242e40] bg-[#080a0f] px-2.5 py-2 text-xs text-zinc-100 focus:border-rose-500/60 focus:outline-none"
                  >
                    <option value="">Milestone yok</option>
                    {milestones.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-medium text-zinc-300">
                  İlgili UE5 Sistemleri
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {UE_DISCIPLINE_TAGS.map((tag) => {
                    const active = ueTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() =>
                          setUeTags((prev) =>
                            prev.includes(tag)
                              ? prev.filter((t) => t !== tag)
                              : [...prev, tag]
                          )
                        }
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                          active
                            ? "border-rose-500/50 bg-rose-500/20 text-rose-200"
                            : "border-[#242e40] bg-[#080a0f] text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-zinc-300">
                    Ekran Görüntüsü / Video Ekle (Opsiyonel)
                  </label>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#242e40] bg-[#151b26] px-2.5 py-1 text-[11px] text-zinc-200 hover:border-rose-500/40"
                  >
                    <Upload className="h-3 w-3" />
                    Dosya Seç
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,video/mp4,video/webm"
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files ?? []);
                      if (files.length > 0) {
                        setPendingFiles((prev) => [...prev, ...files]);
                      }
                    }}
                  />
                </div>
                {pendingFiles.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {pendingFiles.map((f, idx) => (
                      <span
                        key={`${f.name}-${idx}`}
                        className="inline-flex items-center gap-1.5 rounded-md border border-[#242e40] bg-[#080a0f] px-2.5 py-1 text-[11px] text-zinc-300"
                      >
                        {f.name}
                        <button
                          type="button"
                          onClick={() =>
                            setPendingFiles((prev) =>
                              prev.filter((_, i) => i !== idx)
                            )
                          }
                          className="text-zinc-500 hover:text-rose-400"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 border-t border-[#1f2735] pt-4">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="rounded-lg border border-[#242e40] px-4 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-rose-500 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-400"
                >
                  Bug Raporu Aç
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Bug Modal (reuses TaskFormModal) */}
      {editingBug && (
        <TaskFormModal
          open
          mode="edit"
          editingTaskId={editingBug.id}
          initialValues={{
            title: editingBug.title,
            description_md: editingBug.description_md,
            status: editingBug.status,
            priority: editingBug.priority,
            ue_tags: editingBug.ue_tags,
            assignee_id: editingBug.assignee_id,
            milestone_id: editingBug.milestone_id,
            source_idea_id: editingBug.source_idea_id,
            blocked_by_task_id: editingBug.blocked_by_task_id,
          }}
          teamProfiles={teamProfiles}
          milestones={milestones}
          ideas={[]}
          allTasks={tasks}
          onClose={() => setEditingBug(null)}
          onSubmit={handleEditSubmit}
        />
      )}

      {/* Centered Detail Modal (reuses TaskDetailDrawer) */}
      <TaskDetailDrawer
        task={selectedBug}
        currentUserId={currentUserId}
        currentProfile={
          currentProfile ??
          teamProfiles.find((p) => p.id === currentUserId) ??
          null
        }
        onClose={() => setSelectedBugId(null)}
        onEdit={(bug) => {
          setSelectedBugId(null);
          setEditingBug(bug);
        }}
        onSelectTask={(id) => setSelectedBugId(id)}
        onStatusChangeOptimistic={handleQuickStatusChange}
        onDeleteTask={handleDeleteBug}
      />
    </div>
  );
}
