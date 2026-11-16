"use client";

import { useMemo, useState } from "react";
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
} from "lucide-react";
import { TASK_STATUSES } from "@/lib/constants";
import { useStudioStore } from "@/components/studio/studio-store";
import {
  createMilestoneAction,
  deleteMilestoneAction,
  updateMilestoneAction,
} from "@/app/actions/milestones";
import type {
  Milestone,
  MilestoneStatus,
  MilestoneWithStats,
} from "@/types/studio";

const MILESTONE_STATUS_LABELS: Record<
  MilestoneStatus,
  { label: string; badgeClass: string }
> = {
  planned: {
    label: "Planlandı",
    badgeClass: "border-zinc-500/30 bg-zinc-500/15 text-zinc-300",
  },
  active: {
    label: "Aktif Hedef",
    badgeClass: "border-amber-500/40 bg-amber-500/15 text-amber-300",
  },
  completed: {
    label: "Tamamlandı",
    badgeClass: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
  },
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
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [targetDate, setTargetDate] = useState(initial?.target_date ?? "");
  const [status, setStatus] = useState<MilestoneStatus>(
    initial?.status ?? "active"
  );
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Milestone adı zorunludur.");
      return;
    }
    setError(null);
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
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-[#242e40] bg-[#0e131c] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#1f2735] px-6 py-4">
          <h2 className="text-base font-semibold text-zinc-100">
            {mode === "create" ? "Yeni Milestone Oluştur" : "Milestone Düzenle"}
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
              Milestone Adı
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Örn. Vertical Slice v0.1"
              className="w-full rounded-lg border border-[#242e40] bg-[#080a0f] px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500/60 focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-zinc-300">
              Hedef Açıklaması
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Bu sürümde oynanabilir olması gereken sistemler..."
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
                <option value="active">Aktif Hedef</option>
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
    currentUserId,
    isConfigured,
    navigateTab,
  } = useStudioStore();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<MilestoneWithStats | null>(null);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [milestoneError, setMilestoneError] = useState<string | null>(null);

  const profileMap = useMemo(
    () => new Map(teamProfiles.map((p) => [p.id, p])),
    [teamProfiles]
  );

  const milestones = useMemo<MilestoneWithStats[]>(() => {
    return rawMilestones.map((m) => {
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
        total_tasks,
        done_tasks,
        in_progress_tasks,
        open_bugs,
        progress_percent,
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

  function toggleExpand(id: string) {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function handleCreateMilestone(values: {
    title: string;
    description: string;
    target_date: string | null;
    status: MilestoneStatus;
  }) {
    setMilestoneError(null);
    const cleanTitle = values.title.trim();
    const tempId = `temp-ms-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
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

    try {
      const res = await createMilestoneAction(values);
      if (!res.ok || !res.data?.id) {
        setMilestones((prev) => prev.filter((item) => item.id !== tempId));
        setMilestoneError(
          res.error ?? "Milestone oluşturulamadı, değişiklik geri alındı."
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
      return res;
    } catch {
      setMilestones((prev) => prev.filter((item) => item.id !== tempId));
      setMilestoneError(
        "Bağlantı hatası: Milestone oluşturulamadı, değişiklik geri alındı."
      );
      return { ok: false, error: "Bağlantı hatası." };
    }
  }

  async function handleEditMilestone(
    target: MilestoneWithStats,
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
      return { ok: false, error: "Milestone bulunamadı." };
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
          res.error ?? "Milestone güncellenemedi, değişiklik geri alındı."
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
      setMilestoneError(
        "Bağlantı hatası: Milestone değişikliği geri alındı."
      );
      return { ok: false, error: "Bağlantı hatası." };
    }
  }

  async function handleDeleteMilestone(m: MilestoneWithStats) {
    if (m.id.startsWith("temp-")) return;
    if (
      !window.confirm(
        `"${m.title}" milestone'unu silmek istediğine emin misin? (Bağlı görevler silinmez, sadece bağlantısı kalkar.)`
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
          res.error ?? "Milestone silinemedi, değişiklik geri alındı."
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

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
            Milestones & Sürüm Hedefleri
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Prototype, Vertical Slice veya Demo hedeflerinize bağlı görevlerin
            ilerleme yüzdesini buradan takip edin.
          </p>
        </div>

        <button
          type="button"
          disabled={!isConfigured}
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-xs font-semibold text-zinc-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Yeni Milestone
        </button>
      </div>

      {milestones.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#242e40] bg-[#0c1018] px-6 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
            <Flag className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-zinc-100">
            Henüz Milestone oluşturulmamış
          </h3>
          <p className="mt-1 max-w-md text-xs text-zinc-400">
            Örneğin &quot;Prototype v0.1&quot; veya &quot;Vertical Slice&quot;
            hedefi oluşturup görevleri ona bağlayabilirsiniz.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {milestones.map((m) => {
            const statusMeta = MILESTONE_STATUS_LABELS[m.status];
            const isExpanded = Boolean(expandedIds[m.id]);

            return (
              <div
                key={m.id}
                className="rounded-xl border border-[#1f2735] bg-[#10141d] p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
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
                      {m.id.startsWith("temp-") && (
                        <span className="ml-2 text-xs font-normal text-amber-300/80">
                          (Kaydediliyor...)
                        </span>
                      )}
                    </h2>
                    {m.description && (
                      <p className="max-w-2xl text-xs text-zinc-400">
                        {m.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
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
                      Kanban&apos;da Gör
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                    <button
                      type="button"
                      disabled={m.id.startsWith("temp-")}
                      onClick={() => setEditing(m)}
                      className="rounded-lg border border-[#242e40] bg-[#0a0e15] p-1.5 text-zinc-300 hover:border-amber-500/40 hover:text-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={m.id.startsWith("temp-")}
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
                        Devam Eden:{" "}
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

                {/* Expandable Tasks List */}
                {m.tasks.length > 0 && (
                  <div className="mt-4 border-t border-[#1b2230] pt-3">
                    <button
                      type="button"
                      onClick={() => toggleExpand(m.id)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="h-4 w-4" />
                          Görevleri Gizle
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-4 w-4" />
                          Bağlı Görevleri Göster ({m.tasks.length})
                        </>
                      )}
                    </button>

                    {isExpanded && (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {m.tasks.map((task) => {
                          const statusLabel =
                            TASK_STATUSES.find((s) => s.value === task.status)
                              ?.label ?? task.status;
                          const assignee = task.assignee_id
                            ? profileMap.get(task.assignee_id)
                            : null;

                          return (
                            <div
                              key={task.id}
                              className="flex items-center justify-between gap-2 rounded-lg border border-[#1a2130] bg-[#0a0e15] px-3 py-2 text-xs"
                            >
                              <span className="truncate text-zinc-200">
                                {task.kind === "bug" ? "🐞 " : ""}
                                {task.title}
                              </span>
                              <div className="flex shrink-0 items-center gap-2">
                                <span className="rounded bg-[#151b26] px-1.5 py-0.5 text-[10px] text-zinc-300">
                                  {statusLabel}
                                </span>
                                {assignee && (
                                  <span
                                    className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-zinc-950"
                                    style={{
                                      backgroundColor: assignee.avatar_color,
                                    }}
                                  >
                                    {assignee.display_name
                                      .slice(0, 2)
                                      .toUpperCase()}
                                  </span>
                                )}
                              </div>
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

      {/* Create Modal */}
      {createOpen && (
        <MilestoneFormModal
          open
          mode="create"
          onClose={() => setCreateOpen(false)}
          onSubmit={handleCreateMilestone}
        />
      )}

      {/* Edit Modal */}
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
    </div>
  );
}
