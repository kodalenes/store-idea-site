"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import {
  createMilestoneAction,
  deleteMilestoneAction,
  updateMilestoneAction,
} from "@/app/actions/milestones";
import type {
  MilestoneStatus,
  MilestoneWithStats,
  Profile,
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
  }) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [targetDate, setTargetDate] = useState(initial?.target_date ?? "");
  const [status, setStatus] = useState<MilestoneStatus>(
    initial?.status ?? "active"
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await onSubmit({
      title,
      description,
      target_date: targetDate || null,
      status,
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error ?? "Kaydedilemedi.");
      return;
    }
    onClose();
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
              disabled={submitting}
              className="rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
            >
              {submitting ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function MilestonesView({
  milestones,
  teamProfiles,
  isConfigured,
}: {
  milestones: MilestoneWithStats[];
  teamProfiles: Profile[];
  isConfigured: boolean;
}) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<MilestoneWithStats | null>(null);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const profileMap = new Map(teamProfiles.map((p) => [p.id, p]));

  function toggleExpand(id: string) {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div className="space-y-6">
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
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#242e40] bg-[#0a0e15] px-3 py-1.5 text-xs font-medium text-cyan-300 hover:border-cyan-500/40"
                    >
                      Kanban&apos;da Gör
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => setEditing(m)}
                      className="rounded-lg border border-[#242e40] bg-[#0a0e15] p-1.5 text-zinc-300 hover:border-amber-500/40 hover:text-amber-300"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (
                          window.confirm(
                            `"${m.title}" milestone'unu silmek istediğine emin misin? (Bağlı görevler silinmez, sadece bağlantısı kalkar.)`
                          )
                        ) {
                          await deleteMilestoneAction(m.id);
                          router.refresh();
                        }
                      }}
                      className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-1.5 text-rose-300 hover:bg-rose-500/20"
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
      <MilestoneFormModal
        open={createOpen}
        mode="create"
        onClose={() => setCreateOpen(false)}
        onSubmit={async (values) => {
          const res = await createMilestoneAction(values);
          if (res.ok) router.refresh();
          return res;
        }}
      />

      {/* Edit Modal */}
      {editing && (
        <MilestoneFormModal
          open
          mode="edit"
          initial={{
            title: editing.title,
            description: editing.description,
            target_date: editing.target_date ?? "",
            status: editing.status,
          }}
          onClose={() => setEditing(null)}
          onSubmit={async (values) => {
            const res = await updateMilestoneAction(editing.id, values);
            if (res.ok) router.refresh();
            return res;
          }}
        />
      )}
    </div>
  );
}
