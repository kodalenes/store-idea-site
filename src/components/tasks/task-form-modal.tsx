"use client";

import { useState } from "react";
import { X, AlertCircle } from "lucide-react";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  UE_DISCIPLINE_TAGS,
} from "@/lib/constants";
import type {
  Idea,
  Milestone,
  Profile,
  TaskBoardItem,
  TaskPriority,
  TaskStatus,
} from "@/types/studio";

export interface TaskFormValues {
  title: string;
  description_md: string;
  status: TaskStatus;
  priority: TaskPriority;
  ue_tags: string[];
  assignee_id: string | null;
  milestone_id: string | null;
  source_idea_id: string | null;
  blocked_by_task_id: string | null;
}

export function TaskFormModal({
  open,
  mode,
  editingTaskId,
  initialValues,
  teamProfiles,
  milestones,
  ideas,
  allTasks,
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: "create" | "edit";
  editingTaskId?: string;
  initialValues?: TaskFormValues;
  teamProfiles: Profile[];
  milestones: Milestone[];
  ideas: Pick<Idea, "id" | "title">[];
  allTasks: TaskBoardItem[];
  onClose: () => void;
  onSubmit: (values: TaskFormValues) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [descriptionMd, setDescriptionMd] = useState(
    initialValues?.description_md ?? ""
  );
  const [status, setStatus] = useState<TaskStatus>(
    initialValues?.status ?? "todo"
  );
  const [priority, setPriority] = useState<TaskPriority>(
    initialValues?.priority ?? "medium"
  );
  const [assigneeId, setAssigneeId] = useState<string>(
    initialValues?.assignee_id ?? ""
  );
  const [milestoneId, setMilestoneId] = useState<string>(
    initialValues?.milestone_id ?? ""
  );
  const [sourceIdeaId, setSourceIdeaId] = useState<string>(
    initialValues?.source_idea_id ?? ""
  );
  const [blockedById, setBlockedById] = useState<string>(
    initialValues?.blocked_by_task_id ?? ""
  );
  const [ueTags, setUeTags] = useState<string[]>(
    initialValues?.ue_tags ?? ["Blueprint"]
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  function toggleTag(tag: string) {
    setUeTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const res = await onSubmit({
      title,
      description_md: descriptionMd,
      status,
      priority,
      ue_tags: ueTags,
      assignee_id: assigneeId || null,
      milestone_id: milestoneId || null,
      source_idea_id: sourceIdeaId || null,
      blocked_by_task_id: blockedById || null,
    });

    setSubmitting(false);
    if (!res.ok) {
      setError(res.error ?? "Bir hata oluştu.");
      return;
    }
    onClose();
  }

  const dependencyCandidates = allTasks.filter((t) => t.id !== editingTaskId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-2.5 sm:p-4 backdrop-blur-xs">
      <div className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#242e40] bg-[#0e131c] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#1f2735] px-6 py-4">
          <h2 className="text-base font-semibold text-zinc-100">
            {mode === "create" ? "Yeni UE5 Görevi Oluştur" : "Görevi Düzenle"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex-1 space-y-4 overflow-y-auto p-6"
        >
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-zinc-300">
              Görev Başlığı
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Örn. Player Character için Gas Stamina Component ekle"
              className="w-full rounded-lg border border-[#242e40] bg-[#080a0f] px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500/60 focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-zinc-300">
              Açıklama / Teknik Notlar (Markdown)
            </label>
            <textarea
              rows={4}
              value={descriptionMd}
              onChange={(e) => setDescriptionMd(e.target.value)}
              placeholder="İlgili Blueprint/C++ sınıfları, beklenen davranış veya kabul kriterleri..."
              className="w-full rounded-lg border border-[#242e40] bg-[#080a0f] px-3 py-2 font-mono text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500/60 focus:outline-none"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-300">
                Sütun / Durum
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full rounded-lg border border-[#242e40] bg-[#080a0f] px-2.5 py-2 text-xs text-zinc-100 focus:border-amber-500/60 focus:outline-none"
              >
                {TASK_STATUSES.map((s) => (
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
                className="w-full rounded-lg border border-[#242e40] bg-[#080a0f] px-2.5 py-2 text-xs text-zinc-100 focus:border-amber-500/60 focus:outline-none"
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
                Atanan Kişi
              </label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full rounded-lg border border-[#242e40] bg-[#080a0f] px-2.5 py-2 text-xs text-zinc-100 focus:border-amber-500/60 focus:outline-none"
              >
                <option value="">Atanmadı</option>
                {teamProfiles.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.display_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-300">
                Milestone
              </label>
              <select
                value={milestoneId}
                onChange={(e) => setMilestoneId(e.target.value)}
                className="w-full rounded-lg border border-[#242e40] bg-[#080a0f] px-2.5 py-2 text-xs text-zinc-100 focus:border-amber-500/60 focus:outline-none"
              >
                <option value="">Milestone yok</option>
                {milestones.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-300">
                Şu Görevi Bekliyor (Bağımlılık)
              </label>
              <select
                value={blockedById}
                onChange={(e) => setBlockedById(e.target.value)}
                className="w-full rounded-lg border border-[#242e40] bg-[#080a0f] px-2.5 py-2 text-xs text-zinc-100 focus:border-amber-500/60 focus:outline-none"
              >
                <option value="">Bağımlılık yok</option>
                {dependencyCandidates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title} ({t.status === "done" ? "Bitti" : "Açık"})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-zinc-300">
              Bağlı Fikir (Opsiyonel)
            </label>
            <select
              value={sourceIdeaId}
              onChange={(e) => setSourceIdeaId(e.target.value)}
              className="w-full rounded-lg border border-[#242e40] bg-[#080a0f] px-2.5 py-2 text-xs text-zinc-100 focus:border-amber-500/60 focus:outline-none"
            >
              <option value="">Bağlı fikir yok</option>
              {ideas.map((idea) => (
                <option key={idea.id} value={idea.id}>
                  {idea.title}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-zinc-300">
              UE5 Disiplin Etiketleri
            </label>
            <div className="flex flex-wrap gap-1.5">
              {UE_DISCIPLINE_TAGS.map((tag) => {
                const active = ueTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                      active
                        ? "border-amber-500/50 bg-amber-500/20 text-amber-200"
                        : "border-[#242e40] bg-[#080a0f] text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
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
              {submitting
                ? "Kaydediliyor..."
                : mode === "create"
                  ? "Görevi Oluştur"
                  : "Kaydet"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
