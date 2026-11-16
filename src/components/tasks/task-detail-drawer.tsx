"use client";

import { startTransition, useEffect, useOptimistic, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  X,
  Edit3,
  Trash2,
  CheckSquare,
  Square,
  Plus,
  AlertTriangle,
  Lightbulb,
  Flag,
  Bug,
  Upload,
  Send,
  MessageSquare,
} from "lucide-react";
import {
  BUG_SEVERITIES,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from "@/lib/constants";
import { uploadStudioMedia } from "@/lib/media-upload";
import {
  addSubtaskAction,
  addTaskCommentAction,
  deleteSubtaskAction,
  deleteTaskAction,
  deleteTaskAttachmentAction,
  deleteTaskCommentAction,
  moveTaskStatusAction,
  registerTaskAttachmentAction,
  toggleSubtaskAction,
} from "@/app/actions/tasks";
const MarkdownViewer = dynamic(
  () =>
    import("@/components/ideas/markdown-viewer").then(
      (mod) => mod.MarkdownViewer
    ),
  { ssr: false }
);

interface CachedTaskExtras {
  comments: StudioComment[];
  attachments: Attachment[];
}

const MAX_TASK_CACHE_ENTRIES = 25;
const taskExtrasCache = new Map<string, CachedTaskExtras>();

function writeTaskExtrasCache(taskId: string, value: CachedTaskExtras) {
  if (taskExtrasCache.has(taskId)) {
    taskExtrasCache.delete(taskId);
  } else if (taskExtrasCache.size >= MAX_TASK_CACHE_ENTRIES) {
    const oldestKey = taskExtrasCache.keys().next().value;
    if (oldestKey) taskExtrasCache.delete(oldestKey);
  }
  taskExtrasCache.set(taskId, value);
}
import type {
  Attachment,
  Profile,
  StudioComment,
  Subtask,
  TaskBoardItem,
  TaskStatus,
} from "@/types/studio";

type SubtaskOptimisticAction =
  | { type: "toggle"; id: string; is_done: boolean }
  | { type: "add"; subtask: Subtask }
  | { type: "delete"; id: string };

export function TaskDetailDrawer({
  task,
  currentUserId,
  currentProfile,
  onClose,
  onEdit,
  onSelectTask,
  onStatusChangeOptimistic,
}: {
  task: TaskBoardItem | null;
  currentUserId: string | null;
  currentProfile: Profile | null;
  onClose: () => void;
  onEdit: (task: TaskBoardItem) => void;
  onSelectTask: (taskId: string) => void;
  onStatusChangeOptimistic: (taskId: string, status: TaskStatus) => void;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [newSubtask, setNewSubtask] = useState("");
  const [optimisticSubtasks, applyOptimisticSubtask] = useOptimistic(
    task?.subtasks ?? [],
    (state: Subtask[], action: SubtaskOptimisticAction) => {
      if (action.type === "toggle") {
        return state.map((s) =>
          s.id === action.id ? { ...s, is_done: action.is_done } : s
        );
      }
      if (action.type === "add") {
        return [...state, action.subtask];
      }
      return state.filter((s) => s.id !== action.id);
    }
  );

  const [extrasState, setExtrasState] = useState<{
    taskId: string;
    comments: StudioComment[];
    attachments: Attachment[];
  } | null>(null);
  const [commentBody, setCommentBody] = useState("");
  const [uploading, setUploading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const taskId = task?.id ?? null;
  const cachedExtras = taskId ? taskExtrasCache.get(taskId) : undefined;
  const activeExtras =
    extrasState && extrasState.taskId === taskId ? extrasState : cachedExtras;
  const comments = activeExtras?.comments ?? [];
  const attachments = activeExtras?.attachments ?? [];
  const loadingExtras = Boolean(taskId) && !activeExtras;

  function updateTaskExtras(
    targetTaskId: string,
    updater: (prev: CachedTaskExtras) => CachedTaskExtras
  ) {
    const current =
      extrasState && extrasState.taskId === targetTaskId
        ? { comments: extrasState.comments, attachments: extrasState.attachments }
        : taskExtrasCache.get(targetTaskId) ?? {
            comments: [],
            attachments: [],
          };
    const next = updater(current);
    writeTaskExtrasCache(targetTaskId, next);
    setExtrasState({ taskId: targetTaskId, ...next });
  }
  const hasUnsavedDraft =
    newSubtask.trim().length > 0 ||
    commentBody.trim().length > 0 ||
    uploading;

  useEffect(() => {
    if (!taskId) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !hasUnsavedDraft) {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [taskId, hasUnsavedDraft, onClose]);

  useEffect(() => {
    if (!taskId) return;
    let cancelled = false;

    async function loadExtras(id: string) {
      try {
        const res = await fetch(`/api/tasks/${id}`);
        if (res.ok && !cancelled) {
          const json = await res.json();
          const next: CachedTaskExtras = {
            comments: json.comments ?? [],
            attachments: json.attachments ?? [],
          };
          writeTaskExtrasCache(id, next);
          setExtrasState({ taskId: id, ...next });
        }
      } catch {
        // Ag hatasinda cache varsa gosterilmeye devam eder
      }
    }

    loadExtras(taskId);
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  if (!task) return null;

  const doneCount = optimisticSubtasks.filter((s) => s.is_done).length;
  const totalSubtasks = optimisticSubtasks.length;
  const subtaskPct =
    totalSubtasks > 0 ? Math.round((doneCount / totalSubtasks) * 100) : 0;

  const priorityMeta =
    TASK_PRIORITIES.find((p) => p.value === task.priority) ??
    TASK_PRIORITIES[1];

  const isBlocked =
    Boolean(task.blocked_by_task) && task.blocked_by_task?.status !== "done";

  async function handleAddSubtask(e: React.FormEvent) {
    e.preventDefault();
    const title = newSubtask.trim();
    if (!task || !title) return;
    setActionError(null);
    setNewSubtask("");

    const tempSubtask: Subtask = {
      id: `temp-${Date.now()}`,
      task_id: task.id,
      title,
      is_done: false,
      position: optimisticSubtasks.length,
      created_at: new Date().toISOString(),
    };

    startTransition(async () => {
      applyOptimisticSubtask({ type: "add", subtask: tempSubtask });
      try {
        const res = await addSubtaskAction(task.id, title);
        if (!res.ok) {
          setNewSubtask(title);
          setActionError(
            res.error ?? "Alt görev kaydedilemedi, değişiklik geri alındı."
          );
          return;
        }
        router.refresh();
      } catch {
        setNewSubtask(title);
        setActionError("Bağlantı hatası: Alt görev kaydedilemedi, geri alındı.");
      }
    });
  }

  function handleToggleSubtask(subtaskId: string, nextDone: boolean) {
    setActionError(null);
    startTransition(async () => {
      applyOptimisticSubtask({ type: "toggle", id: subtaskId, is_done: nextDone });
      try {
        const res = await toggleSubtaskAction(subtaskId, nextDone);
        if (!res.ok) {
          setActionError(
            res.error ?? "Alt görev durumu güncellenemedi, geri alındı."
          );
          return;
        }
        router.refresh();
      } catch {
        setActionError("Bağlantı hatası: Alt görev durumu geri alındı.");
      }
    });
  }

  function handleDeleteSubtask(subtaskId: string) {
    setActionError(null);
    startTransition(async () => {
      applyOptimisticSubtask({ type: "delete", id: subtaskId });
      try {
        const res = await deleteSubtaskAction(subtaskId);
        if (!res.ok) {
          setActionError(
            res.error ?? "Alt görev silinemedi, değişiklik geri alındı."
          );
          return;
        }
        router.refresh();
      } catch {
        setActionError("Bağlantı hatası: Alt görev silme işlemi geri alındı.");
      }
    });
  }

  async function handleUploadFiles(files: FileList | null) {
    if (!task || !files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const uploaded = await uploadStudioMedia("task", task.id, file);
        await registerTaskAttachmentAction({
          taskId: task.id,
          ...uploaded,
        });
      }
      const res = await fetch(`/api/tasks/${task.id}`);
      if (res.ok) {
        const json = await res.json();
        updateTaskExtras(task.id, (prev) => ({
          ...prev,
          attachments: json.attachments ?? [],
        }));
      }
      router.refresh();
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    const cleanBody = commentBody.trim();
    if (!task || !cleanBody) return;
    setActionError(null);

    const tempId = `temp-comment-${Date.now()}`;
    const optimisticComment: StudioComment = {
      id: tempId,
      target_type: "task",
      target_id: task.id,
      author_id: currentUserId,
      body: cleanBody,
      created_at: new Date().toISOString(),
      author: currentProfile,
    };

    setCommentBody("");
    updateTaskExtras(task.id, (prev) => ({
      ...prev,
      comments: [...prev.comments, optimisticComment],
    }));

    try {
      const res = await addTaskCommentAction(task.id, cleanBody);
      if (res.ok && res.data) {
        updateTaskExtras(task.id, (prev) => ({
          ...prev,
          comments: prev.comments.map((c) =>
            c.id === tempId
              ? { ...c, id: res.data!.id, created_at: res.data!.created_at }
              : c
          ),
        }));
        startTransition(() => {
          router.refresh();
        });
      } else {
        updateTaskExtras(task.id, (prev) => ({
          ...prev,
          comments: prev.comments.filter((c) => c.id !== tempId),
        }));
        setCommentBody(cleanBody);
        setActionError(
          res.error ?? "Yorum veritabanına kaydedilemedi, geri alındı."
        );
      }
    } catch {
      updateTaskExtras(task.id, (prev) => ({
        ...prev,
        comments: prev.comments.filter((c) => c.id !== tempId),
      }));
      setCommentBody(cleanBody);
      setActionError("Bağlantı hatası: Yorum kaydedilemedi, geri alındı.");
    }
  }

  function handleBackdropMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget && !hasUnsavedDraft) {
      onClose();
    }
  }

  return (
    <div
      onMouseDown={handleBackdropMouseDown}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-2.5 sm:p-4 backdrop-blur-xs"
    >
      <div className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#242e40] bg-[#0c1018] shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#1f2735] px-6 py-4">
          <div className="flex items-center gap-2">
            {task.kind === "bug" && (
              <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/40 bg-rose-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-rose-300">
                <Bug className="h-3 w-3" />
                Bug
              </span>
            )}
            <span
              className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${priorityMeta.badgeClass}`}
            >
              {priorityMeta.label} Öncelik
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onEdit(task)}
              className="rounded-lg border border-[#242e40] bg-[#131926] p-2 text-zinc-300 hover:border-amber-500/40 hover:text-amber-300"
              title="Düzenle"
            >
              <Edit3 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={async () => {
                if (
                  window.confirm("Bu görevi kalıcı olarak silmek istiyor musun?")
                ) {
                  await deleteTaskAction(task.id);
                  onClose();
                  router.refresh();
                }
              }}
              className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2 text-rose-300 hover:bg-rose-500/20"
              title="Sil"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {actionError && (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-200">
              <span>{actionError}</span>
              <button
                type="button"
                onClick={() => setActionError(null)}
                className="text-rose-300 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Title & Status Switcher */}
          <div>
            <h2 className="text-xl font-bold text-zinc-100">{task.title}</h2>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <select
                value={task.status}
                onChange={async (e) => {
                  const nextStatus = e.target.value as TaskStatus;
                  onStatusChangeOptimistic(task.id, nextStatus);
                  await moveTaskStatusAction(task.id, nextStatus);
                  router.refresh();
                }}
                className="rounded-lg border border-[#2a3447] bg-[#131926] px-3 py-1.5 text-xs font-medium text-zinc-100 focus:border-amber-500/60 focus:outline-none"
              >
                {TASK_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    Durum: {s.label}
                  </option>
                ))}
              </select>

              {task.assignee && (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#242e40] bg-[#10141d] px-2.5 py-1 text-xs text-zinc-200">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: task.assignee.avatar_color }}
                  />
                  {task.assignee.display_name}
                </span>
              )}

              {task.milestone && (
                <Link
                  href="/milestones"
                  className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-xs text-cyan-300"
                >
                  <Flag className="h-3 w-3" />
                  {task.milestone.title}
                </Link>
              )}

              {task.source_idea && (
                <Link
                  href={`/ideas/${task.source_idea.id}`}
                  className="inline-flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-300"
                >
                  <Lightbulb className="h-3 w-3" />
                  Fikir: {task.source_idea.title}
                </Link>
              )}
            </div>

            {task.ue_tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {task.ue_tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-[#263042] bg-[#131926] px-2.5 py-0.5 text-[11px] font-medium text-zinc-300"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Dependency Alert */}
          {task.blocked_by_task && (
            <div
              className={`flex items-center justify-between gap-3 rounded-xl border p-3.5 text-xs ${
                isBlocked
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
                  : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
              }`}
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                  {isBlocked ? "Şu görevi bekliyor: " : "Bağımlılık tamamlandı: "}
                  <strong>{task.blocked_by_task.title}</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={() => onSelectTask(task.blocked_by_task!.id)}
                className="shrink-0 underline underline-offset-2"
              >
                Görevi Aç
              </button>
            </div>
          )}

          {/* Bug Metadata if Bug */}
          {task.kind === "bug" && (
            <div className="space-y-2 rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 text-xs">
              <div className="flex flex-wrap gap-3 text-rose-200">
                {task.bug_severity && (
                  <span>
                    Ciddiyet:{" "}
                    <strong>
                      {BUG_SEVERITIES.find((b) => b.value === task.bug_severity)
                        ?.label ?? task.bug_severity}
                    </strong>
                  </span>
                )}
                {task.build_version && (
                  <span className="font-mono">
                    Build: <strong>{task.build_version}</strong>
                  </span>
                )}
              </div>
              {task.repro_steps && (
                <div>
                  <p className="font-semibold text-rose-300">
                    Nasıl Tekrar Edilir?
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-zinc-300">
                    {task.repro_steps}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Description */}
          <div className="rounded-xl border border-[#1f2735] bg-[#090c12] p-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Açıklama
            </p>
            <MarkdownViewer
              content={task.description_md}
              emptyText="Açıklama girilmemiş."
            />
          </div>

          {/* Subtasks Checklist */}
          <div className="rounded-xl border border-[#1f2735] bg-[#10141d] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-zinc-200">
                Alt Görevler ({doneCount}/{totalSubtasks})
              </p>
              {totalSubtasks > 0 && (
                <span className="font-mono text-[11px] text-amber-300">
                  %{subtaskPct}
                </span>
              )}
            </div>

            {totalSubtasks > 0 && (
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#1a2232]">
                <div
                  className="h-full bg-amber-500 transition-all duration-300"
                  style={{ width: `${subtaskPct}%` }}
                />
              </div>
            )}

            <div className="space-y-1.5">
              {optimisticSubtasks.map((sub) => (
                <div
                  key={sub.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-[#1a2130] bg-[#0a0e15] px-3 py-2 text-xs"
                >
                  <button
                    type="button"
                    onClick={() => handleToggleSubtask(sub.id, !sub.is_done)}
                    className="flex flex-1 items-center gap-2 text-left"
                  >
                    {sub.is_done ? (
                      <CheckSquare className="h-4 w-4 shrink-0 text-emerald-400" />
                    ) : (
                      <Square className="h-4 w-4 shrink-0 text-zinc-500" />
                    )}
                    <span
                      className={
                        sub.is_done
                          ? "text-zinc-500 line-through"
                          : "text-zinc-200"
                      }
                    >
                      {sub.title}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteSubtask(sub.id)}
                    className="text-zinc-600 hover:text-rose-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <form onSubmit={handleAddSubtask} className="flex gap-2 pt-1">
              <input
                type="text"
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                placeholder="Alt adım ekle (ör. Input Action tanımla)..."
                className="flex-1 rounded-lg border border-[#242e40] bg-[#080a0f] px-3 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500/60 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!newSubtask.trim()}
                className="inline-flex items-center gap-1 rounded-lg bg-[#192130] px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-[#222d42] disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
                Ekle
              </button>
            </form>
          </div>

          {/* Attachments */}
          <div className="rounded-xl border border-[#1f2735] bg-[#10141d] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-zinc-200">
                Ekran Görüntüleri & Dosyalar ({attachments.length})
              </p>
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1 rounded-lg border border-[#242e40] bg-[#151b26] px-2.5 py-1 text-[11px] font-medium text-zinc-200 hover:border-amber-500/40"
              >
                <Upload className="h-3 w-3" />
                {uploading ? "Yükleniyor..." : "Görsel Ekle"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/mp4,video/webm"
                className="hidden"
                onChange={(e) => handleUploadFiles(e.target.files)}
              />
            </div>

            {loadingExtras ? (
              <p className="text-xs text-zinc-500">Yükleniyor...</p>
            ) : attachments.length === 0 ? (
              <p className="text-xs text-zinc-500">Ek dosya yok.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                {attachments.map((att) => (
                  <div
                    key={att.id}
                    className="group relative overflow-hidden rounded-lg border border-[#1f2735] bg-[#080a0f]"
                  >
                    <a
                      href={att.public_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="relative block h-28 w-full"
                    >
                      <Image
                        src={att.public_url}
                        alt={att.file_name}
                        fill
                        unoptimized
                        className="object-cover"
                      />
                    </a>
                    <div className="flex items-center justify-between px-2 py-1.5 text-[10px] text-zinc-400">
                      <span className="truncate">{att.file_name}</span>
                      <button
                        type="button"
                        onClick={async () => {
                          updateTaskExtras(task.id, (prev) => ({
                            ...prev,
                            attachments: prev.attachments.filter(
                              (a) => a.id !== att.id
                            ),
                          }));
                          await deleteTaskAttachmentAction(att.id, att.file_path);
                          router.refresh();
                        }}
                        className="text-zinc-500 hover:text-rose-400"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Comments */}
          <div className="rounded-xl border border-[#1f2735] bg-[#10141d] p-4 space-y-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-amber-400" />
              <p className="text-xs font-semibold text-zinc-200">
                Yorumlar ({comments.length})
              </p>
            </div>

            <div className="space-y-2">
              {comments.map((comment) => (
                <div
                  key={comment.id}
                  className="rounded-lg border border-[#1b2230] bg-[#090c12] p-3 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-zinc-200">
                      {comment.author?.display_name ?? "Ekip Üyesi"}
                    </span>
                    {comment.author_id === currentUserId && (
                      <button
                        type="button"
                        onClick={async () => {
                          setActionError(null);
                          const snapshot = comments;
                          updateTaskExtras(task.id, (prev) => ({
                            ...prev,
                            comments: prev.comments.filter(
                              (c) => c.id !== comment.id
                            ),
                          }));
                          try {
                            const res = await deleteTaskCommentAction(comment.id);
                            if (!res.ok) {
                              updateTaskExtras(task.id, (prev) => ({
                                ...prev,
                                comments: snapshot,
                              }));
                              setActionError(
                                res.error ?? "Yorum silinemedi, geri alındı."
                              );
                              return;
                            }
                            startTransition(() => {
                              router.refresh();
                            });
                          } catch {
                            updateTaskExtras(task.id, (prev) => ({
                              ...prev,
                              comments: snapshot,
                            }));
                            setActionError(
                              "Bağlantı hatası: Yorum silme işlemi geri alındı."
                            );
                          }
                        }}
                        className="text-zinc-500 hover:text-rose-400"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-zinc-300">
                    {comment.body}
                  </p>
                </div>
              ))}
            </div>

            <form onSubmit={handleAddComment} className="flex gap-2">
              <input
                type="text"
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                placeholder="Göreve not düş..."
                className="flex-1 rounded-lg border border-[#242e40] bg-[#080a0f] px-3 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500/60 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!commentBody.trim()}
                className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                Gönder
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
