"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Plus,
  Flag,
  Calendar,
  Edit3,
  Trash2,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Bug,
  X,
  AlertCircle,
  Layers,
  CheckSquare,
  ListPlus,
} from "lucide-react";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  UE_DISCIPLINE_TAGS,
} from "@/lib/constants";
import { useStudioStore } from "@/components/studio/studio-store";
import {
  createMilestoneAction,
  deleteMilestoneAction,
  updateMilestoneAction,
} from "@/app/actions/milestones";
import {
  createTaskAction,
  deleteTaskAction,
  moveTaskStatusAction,
  updateTaskAction,
} from "@/app/actions/tasks";
import type { TaskFormValues } from "@/components/tasks/task-form-modal";
import type {
  Milestone,
  MilestoneStatus,
  MilestoneWithStats,
  TaskBoardItem,
  TaskPriority,
  TaskStatus,
} from "@/types/studio";

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

const ROADMAP_PHASES = [
  "Pre-Production",
  "Prototype v0.1",
  "Vertical Slice",
  "Alpha / Playtest",
  "Steam Demo",
  "Early Access / Tam Sürüm",
] as const;

const SYSTEM_CATEGORIES = [
  "Gameplay & Mekanik",
  "Combat & Karakter",
  "AI & NPC",
  "UI / Envanter",
  "Dünya & Level",
  "Ses / VFX / Sanat",
  "Altyapı & Save/Net",
] as const;

const MILESTONE_STATUS_LABELS: Record<
  MilestoneStatus,
  { label: string; badgeClass: string }
> = {
  planned: {
    label: "Planlandı",
    badgeClass: "border-zinc-500/30 bg-zinc-500/15 text-zinc-300",
  },
  active: {
    label: "Geliştiriliyor",
    badgeClass: "border-amber-500/40 bg-amber-500/15 text-amber-300",
  },
  completed: {
    label: "Tamamlandı",
    badgeClass: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
  },
};

function parseSystemDescription(raw: string): {
  phase: string;
  category: string;
  summary: string;
} {
  const match = raw.match(
    /^\[Faz:\s*([^|\]]+)\|\s*Kategori:\s*([^\]]+)\]\n?([\s\S]*)$/
  );
  if (match) {
    return {
      phase: match[1].trim() || ROADMAP_PHASES[2],
      category: match[2].trim() || SYSTEM_CATEGORIES[0],
      summary: (match[3] ?? "").trim(),
    };
  }
  return {
    phase: ROADMAP_PHASES[2],
    category: SYSTEM_CATEGORIES[0],
    summary: raw,
  };
}

function serializeSystemDescription(
  phase: string,
  category: string,
  summary: string
): string {
  const cleanSummary = summary.trim();
  return `[Faz: ${phase} | Kategori: ${category}]${
    cleanSummary ? `\n${cleanSummary}` : ""
  }`;
}

interface SystemRoadmapItem extends MilestoneWithStats {
  phase: string;
  category: string;
  summary: string;
  fullTasks: TaskBoardItem[];
}

interface QuickTaskDraft {
  title: string;
  priority: TaskPriority;
  tag: string;
  assigneeId: string;
}

const DEFAULT_QUICK_DRAFT: QuickTaskDraft = {
  title: "",
  priority: "medium",
  tag: "Blueprint",
  assigneeId: "",
};

function MilestoneFormModal({
  open,
  mode,
  initial,
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: "create" | "edit";
  initial?: {
    title: string;
    description: string;
    target_date: string;
    status: MilestoneStatus;
  };
  onClose: () => void;
  onSubmit: (values: {
    title: string;
    description: string;
    target_date: string | null;
    status: MilestoneStatus;
  }) => Promise<{ ok: boolean; error?: string }> | void;
}) {
  const parsedInitial = useMemo(
    () => parseSystemDescription(initial?.description ?? ""),
    [initial?.description]
  );

  const [title, setTitle] = useState(initial?.title ?? "");
  const [phase, setPhase] = useState(parsedInitial.phase);
  const [category, setCategory] = useState(parsedInitial.category);
  const [summary, setSummary] = useState(parsedInitial.summary);
  const [targetDate, setTargetDate] = useState(initial?.target_date ?? "");
  const [status, setStatus] = useState<MilestoneStatus>(
    initial?.status ?? "active"
  );
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Sistem / hedef adı zorunludur.");
      return;
    }
    setError(null);
    const description = serializeSystemDescription(phase, category, summary);
    onClose();
    void onSubmit({
      title,
      description,
      target_date: targetDate || null,
      status,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-[#242e40] bg-[#0e131c] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#1f2735] px-6 py-4">
          <h2 className="text-base font-semibold text-zinc-100">
            {mode === "create"
              ? "Yeni Oyun Sistemi / Roadmap Hedefi"
              : "Oyun Sistemini Düzenle"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-zinc-300">
              Sistem veya Hedef Adı
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Örn. Yakın Dövüş (Combat) Sistemi, Envanter & Crafting"
              className="w-full rounded-lg border border-[#242e40] bg-[#080a0f] px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500/60 focus:outline-none"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-300">
                Roadmap Fazı
              </label>
              <select
                value={phase}
                onChange={(e) => setPhase(e.target.value)}
                className="w-full rounded-lg border border-[#242e40] bg-[#080a0f] px-2.5 py-2 text-xs text-zinc-100 focus:border-amber-500/60 focus:outline-none"
              >
                {ROADMAP_PHASES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-300">
                Sistem Kategorisi
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-[#242e40] bg-[#080a0f] px-2.5 py-2 text-xs text-zinc-100 focus:border-amber-500/60 focus:outline-none"
              >
                {SYSTEM_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-zinc-300">
              Sistem Kapsamı & Notlar
            </label>
            <textarea
              rows={3}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Bu sistemde hangi mekanikler, GAS ability'ler veya sahneler yer alacak..."
              className="w-full rounded-lg border border-[#242e40] bg-[#080a0f] px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500/60 focus:outline-none"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-300">
                Durum
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as MilestoneStatus)}
                className="w-full rounded-lg border border-[#242e40] bg-[#080a0f] px-2.5 py-2 text-xs text-zinc-100 focus:border-amber-500/60 focus:outline-none"
              >
                <option value="planned">Planlandı</option>
                <option value="active">Geliştiriliyor (Aktif)</option>
                <option value="completed">Tamamlandı</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-300">
                Hedef Tarih (Opsiyonel)
              </label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full rounded-lg border border-[#242e40] bg-[#080a0f] px-2.5 py-2 text-xs text-zinc-100 focus:border-amber-500/60 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-[#1f2735] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[#242e40] px-4 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
            >
              İptal
            </button>
            <button
              type="submit"
              className="rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-amber-400"
            >
              Kaydet
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function MilestonesView() {
  const {
    milestones: rawMilestones,
    setMilestones,
    tasks,
    setTasks,
    teamProfiles,
    ideas,
    currentUserId,
    currentProfile,
    isConfigured,
    navigateTab,
  } = useStudioStore();

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<SystemRoadmapItem | null>(null);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [quickAddOpenIds, setQuickAddOpenIds] = useState<
    Record<string, boolean>
  >({});
  const [drafts, setDrafts] = useState<Record<string, QuickTaskDraft>>({});

  const [phaseFilter, setPhaseFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<MilestoneStatus | "all">(
    "all"
  );

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<TaskBoardItem | null>(null);
  const [milestoneError, setMilestoneError] = useState<string | null>(null);

  const profileMap = useMemo(
    () => new Map(teamProfiles.map((p) => [p.id, p])),
    [teamProfiles]
  );

  const systems = useMemo<SystemRoadmapItem[]>(() => {
    return rawMilestones.map((m) => {
      const parsed = parseSystemDescription(m.description);
      const linked = tasks.filter((t) => t.milestone_id === m.id);
      const total_tasks = linked.length;
      const done_tasks = linked.filter((t) => t.status === "done").length;
      const in_progress_tasks = linked.filter(
        (t) => t.status === "in_progress"
      ).length;
      const open_bugs = linked.filter(
        (t) => t.kind === "bug" && t.status !== "done"
      ).length;
      const progress_percent =
        total_tasks > 0 ? Math.round((done_tasks / total_tasks) * 100) : 0;

      return {
        ...m,
        ...parsed,
        total_tasks,
        done_tasks,
        in_progress_tasks,
        open_bugs,
        progress_percent,
        fullTasks: linked,
        tasks: linked.map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          kind: t.kind,
          assignee_id: t.assignee_id,
        })),
      };
    });
  }, [rawMilestones, tasks]);

  const roadmapStats = useMemo(() => {
    const totalTasks = systems.reduce((acc, s) => acc + s.total_tasks, 0);
    const doneTasks = systems.reduce((acc, s) => acc + s.done_tasks, 0);
    return {
      totalSystems: systems.length,
      activeSystems: systems.filter((s) => s.status === "active").length,
      completedSystems: systems.filter((s) => s.status === "completed").length,
      totalTasks,
      doneTasks,
      overallPercent:
        totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0,
    };
  }, [systems]);

  const filteredSystems = useMemo(() => {
    return systems.filter((s) => {
      if (phaseFilter !== "all" && s.phase !== phaseFilter) return false;
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      return true;
    });
  }, [systems, phaseFilter, statusFilter]);

  const selectedTask = useMemo(
    () => tasks.find((t) => t.id === selectedTaskId) ?? null,
    [tasks, selectedTaskId]
  );

  function getDraft(systemId: string): QuickTaskDraft {
    return drafts[systemId] ?? DEFAULT_QUICK_DRAFT;
  }

  function updateDraft(systemId: string, patch: Partial<QuickTaskDraft>) {
    setDrafts((prev) => ({
      ...prev,
      [systemId]: { ...(prev[systemId] ?? DEFAULT_QUICK_DRAFT), ...patch },
    }));
  }

  async function handleCreateMilestone(values: {
    title: string;
    description: string;
    target_date: string | null;
    status: MilestoneStatus;
  }) {
    setMilestoneError(null);
    const cleanTitle = values.title.trim();
    const tempId = `temp-ms-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 7)}`;
    const now = new Date().toISOString();

    const optimisticMs: Milestone = {
      id: tempId,
      title: cleanTitle,
      description: values.description.trim(),
      target_date: values.target_date,
      status: values.status,
      sort_order: rawMilestones.length,
      created_by: currentUserId,
      created_at: now,
    };

    setMilestones((prev) => [...prev, optimisticMs]);
    setQuickAddOpenIds((prev) => ({ ...prev, [tempId]: true }));

    try {
      const res = await createMilestoneAction(values);
      if (!res.ok || !res.data?.id) {
        setMilestones((prev) => prev.filter((item) => item.id !== tempId));
        setMilestoneError(
          res.error ?? "Sistem oluşturulamadı, değişiklik geri alındı."
        );
        return res;
      }

      const realId = res.data.id;
      const realCreatedAt = res.data.created_at || now;
      setMilestones((prev) =>
        prev.map((item) =>
          item.id === tempId
            ? { ...item, id: realId, created_at: realCreatedAt }
            : item
        )
      );
      setQuickAddOpenIds((prev) => {
        if (!prev[tempId]) return prev;
        const next = { ...prev, [realId]: true };
        delete next[tempId];
        return next;
      });
      return res;
    } catch {
      setMilestones((prev) => prev.filter((item) => item.id !== tempId));
      setMilestoneError(
        "Bağlantı hatası: Sistem oluşturulamadı, değişiklik geri alındı."
      );
      return { ok: false, error: "Bağlantı hatası." };
    }
  }

  async function handleEditMilestone(
    target: SystemRoadmapItem,
    values: {
      title: string;
      description: string;
      target_date: string | null;
      status: MilestoneStatus;
    }
  ) {
    setMilestoneError(null);
    const prevMilestone = rawMilestones.find((item) => item.id === target.id);
    if (!prevMilestone) {
      return { ok: false, error: "Sistem bulunamadı." };
    }

    const nextTitle = values.title.trim() || prevMilestone.title;
    setMilestones((prev) =>
      prev.map((item) =>
        item.id === target.id
          ? {
              ...item,
              title: nextTitle,
              description: values.description.trim(),
              target_date: values.target_date,
              status: values.status,
            }
          : item
      )
    );
    setTasks((prev) =>
      prev.map((t) =>
        t.milestone_id === target.id
          ? { ...t, milestone: { id: target.id, title: nextTitle } }
          : t
      )
    );

    try {
      const res = await updateMilestoneAction(target.id, values);
      if (!res.ok) {
        setMilestones((prev) =>
          prev.map((item) => (item.id === target.id ? prevMilestone : item))
        );
        setTasks((prev) =>
          prev.map((t) =>
            t.milestone_id === target.id
              ? {
                  ...t,
                  milestone: { id: target.id, title: prevMilestone.title },
                }
              : t
          )
        );
        setMilestoneError(
          res.error ?? "Sistem güncellenemedi, değişiklik geri alındı."
        );
      }
      return res;
    } catch {
      setMilestones((prev) =>
        prev.map((item) => (item.id === target.id ? prevMilestone : item))
      );
      setTasks((prev) =>
        prev.map((t) =>
          t.milestone_id === target.id
            ? { ...t, milestone: { id: target.id, title: prevMilestone.title } }
            : t
        )
      );
      setMilestoneError("Bağlantı hatası: Sistem değişikliği geri alındı.");
      return { ok: false, error: "Bağlantı hatası." };
    }
  }

  async function handleDeleteMilestone(m: SystemRoadmapItem) {
    if (m.id.startsWith("temp-")) return;
    if (
      !window.confirm(
        `"${m.title}" sistemini silmek istediğine emin misin? (Bağlı görevler silinmez, sadece sistem bağlantısı kalkar.)`
      )
    ) {
      return;
    }

    setMilestoneError(null);
    const prevSnapshot = [...rawMilestones];
    const affectedTaskIds = new Set(
      tasks.filter((t) => t.milestone_id === m.id).map((t) => t.id)
    );

    setMilestones((prev) => prev.filter((item) => item.id !== m.id));
    if (affectedTaskIds.size > 0) {
      setTasks((prev) =>
        prev.map((t) =>
          affectedTaskIds.has(t.id)
            ? { ...t, milestone_id: null, milestone: null }
            : t
        )
      );
    }

    try {
      const res = await deleteMilestoneAction(m.id);
      if (!res.ok) {
        setMilestones(prevSnapshot);
        if (affectedTaskIds.size > 0) {
          setTasks((prev) =>
            prev.map((t) =>
              affectedTaskIds.has(t.id)
                ? {
                    ...t,
                    milestone_id: m.id,
                    milestone: { id: m.id, title: m.title },
                  }
                : t
            )
          );
        }
        setMilestoneError(
          res.error ?? "Sistem silinemedi, değişiklik geri alındı."
        );
      }
    } catch {
      setMilestones(prevSnapshot);
      if (affectedTaskIds.size > 0) {
        setTasks((prev) =>
          prev.map((t) =>
            affectedTaskIds.has(t.id)
              ? {
                  ...t,
                  milestone_id: m.id,
                  milestone: { id: m.id, title: m.title },
                }
              : t
          )
        );
      }
      setMilestoneError("Bağlantı hatası: Silme işlemi geri alındı.");
    }
  }

  async function handleQuickAddTask(
    system: SystemRoadmapItem,
    e: React.FormEvent
  ) {
    e.preventDefault();
    if (system.id.startsWith("temp-")) return;
    const draft = getDraft(system.id);
    const cleanTitle = draft.title.trim();
    if (!cleanTitle) return;

    setMilestoneError(null);
    updateDraft(system.id, { title: "" });
    setExpandedIds((prev) => ({ ...prev, [system.id]: true }));

    const tempId = `temp-task-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 6)}`;
    const nowIso = new Date().toISOString();
    const assigneeId = draft.assigneeId || null;
    const assignee = assigneeId
      ? teamProfiles.find((p) => p.id === assigneeId) ?? null
      : null;
    const tags = draft.tag ? [draft.tag] : ["Blueprint"];

    const optimisticTask: TaskBoardItem = {
      id: tempId,
      title: cleanTitle,
      description_md: "",
      kind: "task",
      status: "todo",
      priority: draft.priority,
      ue_tags: tags,
      assignee_id: assigneeId,
      reporter_id: currentUserId,
      milestone_id: system.id,
      source_idea_id: null,
      blocked_by_task_id: null,
      bug_severity: null,
      repro_steps: "",
      build_version: "",
      position: Date.now(),
      created_at: nowIso,
      updated_at: nowIso,
      assignee,
      reporter: currentProfile,
      milestone: { id: system.id, title: system.title },
      source_idea: null,
      blocked_by_task: null,
      subtasks: [],
      comment_count: 0,
      attachment_count: 0,
    };

    // 0 ms Optimistic UI (hem Roadmap'e hem Kanban'a anında yansır)
    setTasks((prev) => [optimisticTask, ...prev]);

    try {
      const res = await createTaskAction({
        title: cleanTitle,
        description_md: "",
        status: "todo",
        priority: draft.priority,
        ue_tags: tags,
        assignee_id: assigneeId,
        milestone_id: system.id,
        source_idea_id: null,
        blocked_by_task_id: null,
      });

      if (!res.ok || !res.data?.id) {
        setTasks((prev) => prev.filter((t) => t.id !== tempId));
        updateDraft(system.id, { title: cleanTitle });
        setMilestoneError(
          res.error ?? "Görev sisteme eklenemedi, değişiklik geri alındı."
        );
        return;
      }

      const realId = res.data.id;
      const realCreatedAt = res.data.created_at || nowIso;
      setTasks((prev) =>
        prev.map((t) =>
          t.id === tempId
            ? { ...t, id: realId, created_at: realCreatedAt }
            : t
        )
      );
      setSelectedTaskId((cur) => (cur === tempId ? realId : cur));
    } catch {
      setTasks((prev) => prev.filter((t) => t.id !== tempId));
      updateDraft(system.id, { title: cleanTitle });
      setMilestoneError("Bağlantı hatası: Görev oluşturulamadı, geri alındı.");
    }
  }

  async function handleMoveTaskStatus(
    taskId: string,
    targetStatus: TaskStatus
  ) {
    if (taskId.startsWith("temp-")) return;
    const prevTask = tasks.find((t) => t.id === taskId);
    if (!prevTask || prevTask.status === targetStatus) return;

    const prevStatus = prevTask.status;
    setMilestoneError(null);
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
        setMilestoneError(
          res.error ?? "Görev durumu güncellenemedi, geri alındı."
        );
      }
    } catch {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: prevStatus } : t))
      );
      setMilestoneError("Bağlantı hatası: Görev durumu geri alındı.");
    }
  }

  async function handleEditTaskSubmit(values: TaskFormValues) {
    if (!editingTask) return { ok: false, error: "Görev bulunamadı." };
    const targetId = editingTask.id;
    const prevSnapshot = tasks.find((t) => t.id === targetId);
    if (!prevSnapshot) return { ok: false, error: "Görev bulunamadı." };

    setMilestoneError(null);
    const assignee = values.assignee_id
      ? teamProfiles.find((p) => p.id === values.assignee_id) ?? null
      : null;
    const ms = values.milestone_id
      ? rawMilestones.find((m) => m.id === values.milestone_id) ?? null
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
        setMilestoneError(
          res.error ?? "Görev güncellenemedi, değişiklik geri alındı."
        );
        return { ok: false, error: res.error };
      }
      return { ok: true };
    } catch {
      setTasks((prev) =>
        prev.map((t) => (t.id === targetId ? prevSnapshot : t))
      );
      setMilestoneError("Bağlantı hatası: Görev güncellemesi geri alındı.");
      return { ok: false, error: "Bağlantı hatası." };
    }
  }

  async function handleDeleteTaskOptimistic(taskId: string) {
    const prevSnapshot = tasks.find((t) => t.id === taskId);
    if (!prevSnapshot) return;
    setMilestoneError(null);
    setTasks((prev) => prev.filter((t) => t.id !== taskId));

    try {
      const res = await deleteTaskAction(taskId);
      if (!res.ok) {
        setTasks((prev) => [prevSnapshot, ...prev]);
        setMilestoneError(res.error ?? "Görev silinemedi, geri yüklendi.");
      }
    } catch {
      setTasks((prev) => [prevSnapshot, ...prev]);
      setMilestoneError("Bağlantı hatası: Silme işlemi geri alındı.");
    }
  }

  return (
    <div className="space-y-6">
      {milestoneError && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-200">
          <span className="inline-flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            {milestoneError}
          </span>
          <button
            type="button"
            onClick={() => setMilestoneError(null)}
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
            Proje Roadmap & Oyun Sistemleri
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Oyununuzda geliştirilecek sistemleri fazlara göre tanımlayın ve
            sistemlere bağlı görevleri doğrudan buradan oluşturup Kanban&apos;a
            aktarın.
          </p>
        </div>

        <button
          type="button"
          disabled={!isConfigured}
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-xs font-semibold text-zinc-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Yeni Oyun Sistemi
        </button>
      </div>

      {/* Proje Roadmap Özeti */}
      {systems.length > 0 && (
        <div className="space-y-3 rounded-xl border border-[#1f2735] bg-[#10141d] p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-300">
              <span className="inline-flex items-center gap-1.5 font-medium text-zinc-100">
                <Layers className="h-4 w-4 text-amber-400" />
                {roadmapStats.totalSystems} Sistem
              </span>
              <span className="text-zinc-500">•</span>
              <span>
                Geliştiriliyor:{" "}
                <strong className="text-amber-300">
                  {roadmapStats.activeSystems}
                </strong>
              </span>
              <span>
                Tamamlanan Sistem:{" "}
                <strong className="text-emerald-300">
                  {roadmapStats.completedSystems}
                </strong>
              </span>
              <span>
                Görev İlerlemesi:{" "}
                <strong className="text-zinc-100">
                  {roadmapStats.doneTasks}/{roadmapStats.totalTasks}
                </strong>
              </span>
            </div>
            <span className="font-mono text-sm font-bold text-amber-300">
              Genel %{roadmapStats.overallPercent}
            </span>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-[#1a2232]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all duration-300"
              style={{ width: `${roadmapStats.overallPercent}%` }}
            />
          </div>

          {/* Phase & Status Filter Pills */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#1a2232] pt-3">
            <div className="flex flex-wrap items-center gap-1 text-[11px]">
              <button
                type="button"
                onClick={() => setPhaseFilter("all")}
                className={`rounded-md px-2.5 py-1 font-medium transition ${
                  phaseFilter === "all"
                    ? "bg-amber-500/20 text-amber-300"
                    : "text-zinc-400 hover:bg-[#161c29] hover:text-zinc-200"
                }`}
              >
                Tüm Fazlar
              </button>
              {ROADMAP_PHASES.map((ph) => {
                const count = systems.filter((s) => s.phase === ph).length;
                if (count === 0) return null;
                return (
                  <button
                    key={ph}
                    type="button"
                    onClick={() => setPhaseFilter(ph)}
                    className={`rounded-md px-2.5 py-1 font-medium transition ${
                      phaseFilter === ph
                        ? "bg-violet-500/20 text-violet-300"
                        : "text-zinc-400 hover:bg-[#161c29] hover:text-zinc-200"
                    }`}
                  >
                    {ph} ({count})
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-1 rounded-lg border border-[#242e40] bg-[#080a0f] p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={`rounded-md px-2 py-1 font-medium transition ${
                  statusFilter === "all"
                    ? "bg-[#1a2232] text-zinc-100"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Tümü
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("active")}
                className={`rounded-md px-2 py-1 font-medium transition ${
                  statusFilter === "active"
                    ? "bg-amber-500/20 text-amber-300"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Geliştiriliyor
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("planned")}
                className={`rounded-md px-2 py-1 font-medium transition ${
                  statusFilter === "planned"
                    ? "bg-zinc-500/20 text-zinc-200"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Planlandı
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("completed")}
                className={`rounded-md px-2 py-1 font-medium transition ${
                  statusFilter === "completed"
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Bitti
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Systems List */}
      {systems.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#242e40] bg-[#0c1018] px-6 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
            <Flag className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-zinc-100">
            Henüz Oyun Sistemi eklenmemiş
          </h3>
          <p className="mt-1 max-w-md text-xs text-zinc-400">
            Örneğin &quot;Yakın Dövüş (Combat) Sistemi&quot;, &quot;Envanter &amp;
            Loot&quot; veya &quot;Boss AI&quot; gibi modüller oluşturup
            altına yapılacak görevleri ekleyebilirsiniz.
          </p>
        </div>
      ) : filteredSystems.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#242e40] bg-[#0c1018] px-6 py-12 text-center text-xs text-zinc-400">
          Seçili faz veya durum filtresine uyan oyun sistemi bulunamadı.
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSystems.map((m) => {
            const isTempSystem = m.id.startsWith("temp-");
            const statusMeta = MILESTONE_STATUS_LABELS[m.status];
            const isExpanded = expandedIds[m.id] ?? m.fullTasks.length > 0;
            const isQuickAddOpen = Boolean(quickAddOpenIds[m.id]);
            const draft = getDraft(m.id);

            return (
              <div
                key={m.id}
                className="rounded-xl border border-[#1f2735] bg-[#10141d] p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-violet-500/40 bg-violet-500/15 px-2.5 py-0.5 text-[11px] font-medium text-violet-300">
                        {m.phase}
                      </span>
                      <span className="rounded-full border border-cyan-500/35 bg-cyan-500/10 px-2.5 py-0.5 text-[11px] font-medium text-cyan-300">
                        {m.category}
                      </span>
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${statusMeta.badgeClass}`}
                      >
                        {statusMeta.label}
                      </span>
                      {m.target_date && (
                        <span className="inline-flex items-center gap-1 text-xs text-zinc-400">
                          <Calendar className="h-3.5 w-3.5 text-zinc-500" />
                          Hedef:{" "}
                          {new Date(m.target_date).toLocaleDateString("tr-TR")}
                        </span>
                      )}
                    </div>
                    <h2 className="text-lg font-bold text-zinc-100">
                      {m.title}
                      {isTempSystem && (
                        <span className="ml-2 text-xs font-normal text-amber-300/80">
                          (Kaydediliyor...)
                        </span>
                      )}
                    </h2>
                    {m.summary && (
                      <p className="max-w-2xl text-xs text-zinc-400">
                        {m.summary}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={!isConfigured || isTempSystem}
                      onClick={() => {
                        setQuickAddOpenIds((prev) => ({
                          ...prev,
                          [m.id]: !prev[m.id],
                        }));
                        setExpandedIds((prev) => ({ ...prev, [m.id]: true }));
                      }}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
                        isQuickAddOpen
                          ? "border-amber-500/50 bg-amber-500/15 text-amber-300"
                          : "border-[#242e40] bg-[#0a0e15] text-zinc-200 hover:border-amber-500/40 hover:text-amber-300"
                      }`}
                    >
                      <ListPlus className="h-3.5 w-3.5" />
                      Görev Ekle
                    </button>

                    <Link
                      href={`/tasks?milestone=${m.id}`}
                      onClick={(e) => {
                        if (
                          !e.metaKey &&
                          !e.ctrlKey &&
                          !e.shiftKey &&
                          !e.altKey
                        ) {
                          e.preventDefault();
                          navigateTab(`/tasks?milestone=${m.id}`, {
                            milestoneId: m.id,
                          });
                        }
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#242e40] bg-[#0a0e15] px-3 py-1.5 text-xs font-medium text-cyan-300 hover:border-cyan-500/40"
                    >
                      Panoda Filtrele
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>

                    <button
                      type="button"
                      disabled={isTempSystem}
                      onClick={() => setEditing(m)}
                      title="Sistemi Düzenle"
                      className="rounded-lg border border-[#242e40] bg-[#0a0e15] p-1.5 text-zinc-300 hover:border-amber-500/40 hover:text-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>

                    <button
                      type="button"
                      disabled={isTempSystem}
                      title="Sistemi Sil"
                      onClick={() => {
                        void handleDeleteMilestone(m);
                      }}
                      className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-1.5 text-rose-300 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Progress Bar & Counters */}
                <div className="mt-4 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex flex-wrap items-center gap-4 text-zinc-400">
                      <span>
                        Tamamlanan:{" "}
                        <strong className="text-zinc-100">
                          {m.done_tasks}/{m.total_tasks}
                        </strong>
                      </span>
                      <span>
                        Geliştirilen:{" "}
                        <strong className="text-amber-300">
                          {m.in_progress_tasks}
                        </strong>
                      </span>
                      {m.open_bugs > 0 && (
                        <span className="inline-flex items-center gap-1 text-rose-300">
                          <Bug className="h-3.5 w-3.5" />
                          {m.open_bugs} Açık Bug
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-sm font-bold text-amber-300">
                      %{m.progress_percent}
                    </span>
                  </div>

                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#1a2232]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all duration-300"
                      style={{ width: `${m.progress_percent}%` }}
                    />
                  </div>
                </div>

                {/* 0 ms Inline Quick-Add Task Form */}
                {isQuickAddOpen && !isTempSystem && (
                  <form
                    onSubmit={(e) => void handleQuickAddTask(m, e)}
                    className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/25 bg-[#0b0f17] p-2.5"
                  >
                    <input
                      type="text"
                      required
                      value={draft.title}
                      onChange={(e) =>
                        updateDraft(m.id, { title: e.target.value })
                      }
                      placeholder="Bu sisteme ait yeni görev yaz (ör. Kılıç kombo hitbox trace ekle)..."
                      className="min-w-52 flex-1 rounded-lg border border-[#242e40] bg-[#080a0f] px-3 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-amber-500/60 focus:outline-none"
                    />
                    <select
                      aria-label="Öncelik"
                      value={draft.priority}
                      onChange={(e) =>
                        updateDraft(m.id, {
                          priority: e.target.value as TaskPriority,
                        })
                      }
                      className="rounded-lg border border-[#242e40] bg-[#080a0f] px-2 py-1.5 text-xs text-zinc-200 focus:border-amber-500/60 focus:outline-none"
                    >
                      {TASK_PRIORITIES.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="Disiplin"
                      value={draft.tag}
                      onChange={(e) =>
                        updateDraft(m.id, { tag: e.target.value })
                      }
                      className="rounded-lg border border-[#242e40] bg-[#080a0f] px-2 py-1.5 text-xs text-zinc-200 focus:border-amber-500/60 focus:outline-none"
                    >
                      {UE_DISCIPLINE_TAGS.map((tag) => (
                        <option key={tag} value={tag}>
                          {tag}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="Kişi"
                      value={draft.assigneeId}
                      onChange={(e) =>
                        updateDraft(m.id, { assigneeId: e.target.value })
                      }
                      className="rounded-lg border border-[#242e40] bg-[#080a0f] px-2 py-1.5 text-xs text-zinc-200 focus:border-amber-500/60 focus:outline-none"
                    >
                      <option value="">Atanmadı</option>
                      {teamProfiles.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.display_name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-amber-400"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Sisteme Ekle
                    </button>
                  </form>
                )}

                {/* System's Linked Tasks (Single-Line Interactive Rows) */}
                {m.fullTasks.length > 0 && (
                  <div className="mt-4 border-t border-[#1b2230] pt-3">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedIds((prev) => ({
                          ...prev,
                          [m.id]: !isExpanded,
                        }))
                      }
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="h-4 w-4" />
                          Görevleri Gizle ({m.fullTasks.length})
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-4 w-4" />
                          Sistemin Görevlerini Göster ({m.fullTasks.length})
                        </>
                      )}
                    </button>

                    {isExpanded && (
                      <div className="mt-3 divide-y divide-[#182030] overflow-hidden rounded-lg border border-[#1a2130] bg-[#0a0e15]">
                        {m.fullTasks.map((task) => {
                          const isPending = task.id.startsWith("temp-");
                          const priorityMeta =
                            TASK_PRIORITIES.find(
                              (p) => p.value === task.priority
                            ) ?? TASK_PRIORITIES[1];
                          const assignee = task.assignee_id
                            ? profileMap.get(task.assignee_id)
                            : null;
                          const doneSubs = task.subtasks.filter(
                            (s) => s.is_done
                          ).length;

                          return (
                            <div
                              key={task.id}
                              onClick={() => {
                                if (!isPending) setSelectedTaskId(task.id);
                              }}
                              className={`flex items-center gap-2.5 px-3 py-2 text-xs transition ${
                                isPending
                                  ? "opacity-75"
                                  : "cursor-pointer hover:bg-[#121824]"
                              }`}
                            >
                              <div
                                className="shrink-0"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <select
                                  aria-label="Görev durumu"
                                  value={task.status}
                                  disabled={isPending}
                                  onChange={(e) =>
                                    void handleMoveTaskStatus(
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
                                className={`hidden w-14 shrink-0 rounded border px-1.5 py-0.5 text-center text-[10px] font-medium sm:inline-block ${priorityMeta.badgeClass}`}
                              >
                                {priorityMeta.label}
                              </span>

                              {task.kind === "bug" && (
                                <Bug
                                  aria-label="Bug"
                                  className="h-3.5 w-3.5 shrink-0 text-rose-400"
                                />
                              )}

                              <span className="min-w-0 flex-1 truncate font-medium text-zinc-200">
                                {task.title}
                                {isPending && (
                                  <span className="ml-2 text-[10px] font-normal text-amber-300/80">
                                    (Kaydediliyor...)
                                  </span>
                                )}
                              </span>

                              {task.ue_tags[0] && (
                                <span className="hidden rounded bg-[#151c29] px-1.5 py-0.5 text-[10px] text-zinc-400 md:inline">
                                  {task.ue_tags[0]}
                                </span>
                              )}

                              {task.subtasks.length > 0 && (
                                <span className="hidden items-center gap-1 text-[11px] text-zinc-400 sm:inline-flex">
                                  <CheckSquare className="h-3 w-3 text-emerald-400" />
                                  {doneSubs}/{task.subtasks.length}
                                </span>
                              )}

                              {assignee ? (
                                <span
                                  title={assignee.display_name}
                                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-zinc-950"
                                  style={{
                                    backgroundColor: assignee.avatar_color,
                                  }}
                                >
                                  {assignee.display_name
                                    .slice(0, 2)
                                    .toUpperCase()}
                                </span>
                              ) : (
                                <span className="shrink-0 text-[10px] text-zinc-600">
                                  Boşta
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create System Modal */}
      {createOpen && (
        <MilestoneFormModal
          open
          mode="create"
          onClose={() => setCreateOpen(false)}
          onSubmit={handleCreateMilestone}
        />
      )}

      {/* Edit System Modal */}
      {editing && (
        <MilestoneFormModal
          key={editing.id}
          open
          mode="edit"
          initial={{
            title: editing.title,
            description: editing.description,
            target_date: editing.target_date ?? "",
            status: editing.status,
          }}
          onClose={() => setEditing(null)}
          onSubmit={(values) => handleEditMilestone(editing, values)}
        />
      )}

      {/* Edit Linked Task Modal */}
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
          milestones={rawMilestones}
          ideas={ideas}
          allTasks={tasks}
          onClose={() => setEditingTask(null)}
          onSubmit={handleEditTaskSubmit}
        />
      )}

      {/* Task Detail Modal directly from Roadmap */}
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
        onStatusChangeOptimistic={handleMoveTaskStatus}
        onDeleteTask={handleDeleteTaskOptimistic}
      />
    </div>
  );
}
