"use client";

import { startTransition, useOptimistic, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ThumbsUp,
  Edit3,
  Trash2,
  ExternalLink,
  Upload,
  Image as ImageIcon,
  Film,
  KanbanSquare,
  MessageSquare,
  Send,
  X,
  Plus,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import {
  IDEA_CATEGORIES,
  IDEA_STATUSES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  UE_DISCIPLINE_TAGS,
} from "@/lib/constants";
import { uploadStudioMedia } from "@/lib/media-upload";
import { useRealtimeRefresh } from "@/lib/use-realtime-refresh";
import {
  addIdeaCommentAction,
  convertIdeaToTaskAction,
  deleteIdeaAction,
  deleteIdeaAttachmentAction,
  deleteIdeaCommentAction,
  registerIdeaAttachmentAction,
  toggleIdeaVoteAction,
  updateIdeaAction,
  updateIdeaStatusAction,
} from "@/app/actions/ideas";
import type { IdeaFormValues } from "@/components/ideas/idea-form-modal";
import { MarkdownViewer } from "@/components/ideas/markdown-viewer";
import { useStudioStore } from "@/components/studio/studio-store";

const IdeaFormModal = dynamic(
  () =>
    import("@/components/ideas/idea-form-modal").then(
      (mod) => mod.IdeaFormModal
    ),
  { ssr: false }
);
import type {
  Attachment,
  IdeaDetail,
  IdeaStatus,
  Milestone,
  Profile,
  TaskPriority,
} from "@/types/studio";

export function IdeaDetailView({
  initialIdea,
  currentUserId,
  teamProfiles,
  milestones,
}: {
  initialIdea: IdeaDetail;
  currentUserId: string;
  teamProfiles: Profile[];
  milestones: Milestone[];
}) {
  const router = useRouter();
  const { setIdeas, setTasks, currentProfile } = useStudioStore();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [idea, applyOptimisticIdea] = useOptimistic(
    initialIdea,
    (
      state,
      action:
        | { type: "vote" }
        | { type: "status"; status: IdeaStatus }
        | { type: "removeAttachment"; id: string }
    ): IdeaDetail => {
      if (action.type === "vote") {
        const nextVoted = !state.has_voted;
        return {
          ...state,
          has_voted: nextVoted,
          vote_count: Math.max(0, state.vote_count + (nextVoted ? 1 : -1)),
        };
      }
      if (action.type === "status") {
        return { ...state, status: action.status };
      }
      return {
        ...state,
        attachments: state.attachments.filter((a) => a.id !== action.id),
      };
    }
  );
  const [editOpen, setEditOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [lightboxMedia, setLightboxMedia] = useState<Attachment | null>(null);

  // Media upload state
  const [draggingFiles, setDraggingFiles] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Comment state
  const [commentText, setCommentText] = useState("");
  const [commentSending, setCommentSending] = useState(false);

  // Convert-to-task modal state
  const [taskTitle, setTaskTitle] = useState(initialIdea.title);
  const [taskDesc, setTaskDesc] = useState(
    initialIdea.summary || initialIdea.content_md.slice(0, 600)
  );
  const [taskPriority, setTaskPriority] = useState<TaskPriority>("medium");
  const [taskAssignee, setTaskAssignee] = useState<string>("");
  const [taskMilestone, setTaskMilestone] = useState<string>(
    milestones.find((m) => m.status === "active")?.id ?? ""
  );
  const [taskTags, setTaskTags] = useState<string[]>(["Blueprint"]);
  const [converting, setConverting] = useState(false);
  const [convertSuccess, setConvertSuccess] = useState<string | null>(null);
  const [convertError, setConvertError] = useState<string | null>(null);

  useRealtimeRefresh(`idea-detail-${idea.id}`, [
    { table: "comments", filter: `target_id=eq.${idea.id}` },
    { table: "attachments", filter: `target_id=eq.${idea.id}` },
  ]);

  const catMeta =
    IDEA_CATEGORIES.find((c) => c.value === idea.category) ??
    IDEA_CATEGORIES[0];

  async function handleOptimisticVote() {
    const nextVoted = !idea.has_voted;
    const delta = nextVoted ? 1 : -1;
    startTransition(() => {
      applyOptimisticIdea({ type: "vote" });
    });
    setIdeas((prev) =>
      prev.map((item) =>
        item.id === idea.id
          ? {
              ...item,
              has_voted: nextVoted,
              vote_count: Math.max(0, item.vote_count + delta),
            }
          : item
      )
    );
    await toggleIdeaVoteAction(idea.id);
    router.refresh();
  }

  async function handleStatusChange(nextStatus: IdeaStatus) {
    startTransition(() => {
      applyOptimisticIdea({ type: "status", status: nextStatus });
    });
    setIdeas((prev) =>
      prev.map((item) =>
        item.id === idea.id
          ? { ...item, status: nextStatus, updated_at: new Date().toISOString() }
          : item
      )
    );
    await updateIdeaStatusAction(idea.id, nextStatus);
    router.refresh();
  }

  async function handleEditSubmit(values: IdeaFormValues) {
    setIdeas((prev) =>
      prev.map((item) =>
        item.id === idea.id
          ? {
              ...item,
              title: values.title.trim() || item.title,
              summary: values.summary.trim(),
              content_md: values.content_md,
              category: values.category,
              status: values.status,
              reference_links: values.reference_links,
              updated_at: new Date().toISOString(),
            }
          : item
      )
    );
    const res = await updateIdeaAction(idea.id, values);
    router.refresh();
    return res;
  }

  async function handleFilesUpload(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setUploadError(null);
    setUploading(true);

    try {
      for (const file of Array.from(fileList)) {
        if (file.size > 25 * 1024 * 1024) {
          throw new Error(`${file.name} 25MB limitini aşıyor.`);
        }
        const uploaded = await uploadStudioMedia("idea", idea.id, file);
        const regRes = await registerIdeaAttachmentAction({
          ideaId: idea.id,
          ...uploaded,
        });
        if (!regRes.ok) {
          throw new Error(regRes.error ?? "Dosya kaydedilemedi.");
        }
      }
      router.refresh();
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "Dosya yükleme başarısız."
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDeleteAttachment(att: Attachment) {
    startTransition(() => {
      applyOptimisticIdea({ type: "removeAttachment", id: att.id });
    });
    await deleteIdeaAttachmentAction(idea.id, att.id, att.file_path);
    router.refresh();
  }

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentText.trim()) return;
    setCommentSending(true);
    const res = await addIdeaCommentAction(idea.id, commentText);
    setCommentSending(false);
    if (res.ok) {
      setCommentText("");
      router.refresh();
    }
  }

  async function handleConvertSubmit(e: React.FormEvent) {
    e.preventDefault();
    setConvertError(null);
    setConverting(true);

    const payload = {
      ideaId: idea.id,
      title: taskTitle,
      description_md: taskDesc,
      priority: taskPriority,
      ue_tags: taskTags,
      assignee_id: taskAssignee || null,
      milestone_id: taskMilestone || null,
    };

    const res = await convertIdeaToTaskAction(payload);

    setConverting(false);
    if (!res.ok) {
      setConvertError(res.error ?? "Görev oluşturulamadı.");
      return;
    }

    const now = new Date().toISOString();
    const assignee = payload.assignee_id
      ? teamProfiles.find((p) => p.id === payload.assignee_id) ?? null
      : null;
    const milestone = payload.milestone_id
      ? milestones.find((m) => m.id === payload.milestone_id) ?? null
      : null;
    setTasks((prev) => [
      {
        id: `temp-conv-${Date.now()}`,
        title: payload.title.trim() || idea.title,
        description_md: payload.description_md,
        kind: "task",
        status: "backlog",
        priority: payload.priority,
        ue_tags: payload.ue_tags,
        assignee_id: payload.assignee_id,
        reporter_id: currentUserId,
        milestone_id: payload.milestone_id,
        source_idea_id: idea.id,
        blocked_by_task_id: null,
        bug_severity: null,
        repro_steps: "",
        build_version: "",
        position: Date.now(),
        created_at: now,
        updated_at: now,
        assignee,
        reporter:
          currentProfile ??
          teamProfiles.find((p) => p.id === currentUserId) ??
          null,
        milestone: milestone
          ? { id: milestone.id, title: milestone.title }
          : null,
        source_idea: { id: idea.id, title: idea.title },
        blocked_by_task: null,
        subtasks: [],
        comment_count: 0,
        attachment_count: 0,
      },
      ...prev,
    ]);
    setIdeas((prev) =>
      prev.map((item) =>
        item.id === idea.id
          ? { ...item, linked_task_count: item.linked_task_count + 1 }
          : item
      )
    );

    setConvertOpen(false);
    setConvertSuccess(
      "Görev oluşturuldu ve bu fikre bağlandı! (Kanban panosunda görünüyor)"
    );
    router.refresh();
  }

  function toggleTaskTag(tag: string) {
    setTaskTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  const profileMap = new Map(teamProfiles.map((p) => [p.id, p]));

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/ideas"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-amber-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Fikirler Panosuna Dön
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setTaskTitle(idea.title);
              setTaskDesc(idea.summary || idea.content_md.slice(0, 600));
              setConvertError(null);
              setConvertOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3.5 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-cyan-400"
          >
            <KanbanSquare className="h-3.5 w-3.5" />
            Göreve Dönüştür
          </button>

          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#242e40] bg-[#10141d] px-3 py-2 text-xs font-medium text-zinc-200 hover:border-amber-500/40 hover:text-amber-300"
          >
            <Edit3 className="h-3.5 w-3.5" />
            Düzenle
          </button>

          <form
            action={async () => {
              setIdeas((prev) => prev.filter((item) => item.id !== idea.id));
              await deleteIdeaAction(idea.id);
            }}
            onSubmit={(e) => {
              if (
                !window.confirm(
                  "Bu fikri ve yorumlarını kalıcı olarak silmek istediğine emin misin?"
                )
              ) {
                e.preventDefault();
              }
            }}
          >
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-300 hover:bg-rose-500/20"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Sil
            </button>
          </form>
        </div>
      </div>

      {convertSuccess && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-200">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            {convertSuccess}
          </span>
          <Link
            href="/tasks"
            className="font-semibold text-emerald-300 underline underline-offset-2"
          >
            Kanban&apos;a Git →
          </Link>
        </div>
      )}

      {/* Main Layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left 2 cols: Mini-GDD + Media + Comments */}
        <div className="space-y-6 lg:col-span-2">
          {/* Title & GDD Content */}
          <section className="rounded-xl border border-[#1f2735] bg-[#10141d] p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${catMeta.badgeClass}`}
                >
                  {catMeta.label}
                </span>
                <select
                  value={idea.status}
                  onChange={(e) =>
                    handleStatusChange(e.target.value as IdeaStatus)
                  }
                  className="rounded-full border border-[#2a3447] bg-[#080a0f] px-3 py-0.5 text-xs font-medium text-zinc-200 focus:border-amber-500/60 focus:outline-none"
                >
                  {IDEA_STATUSES.map((st) => (
                    <option key={st.value} value={st.value}>
                      Durum: {st.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={handleOptimisticVote}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                  idea.has_voted
                    ? "border-amber-500/50 bg-amber-500/20 text-amber-300"
                    : "border-[#242e40] bg-[#080a0f] text-zinc-300 hover:border-amber-500/40"
                }`}
              >
                <ThumbsUp className="h-3.5 w-3.5" />
                Onayla / Oy Ver ({idea.vote_count})
              </button>
            </div>

            <h1 className="mt-4 text-2xl font-bold text-zinc-100">
              {idea.title}
            </h1>

            {idea.summary && (
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                {idea.summary}
              </p>
            )}

            <div className="mt-5 border-t border-[#1b2230] pt-5">
              <MarkdownViewer content={idea.content_md} />
            </div>
          </section>

          {/* Media & Screenshots Uploader / Gallery */}
          <section className="rounded-xl border border-[#1f2735] bg-[#10141d] p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-zinc-100">
                  Görseller, GIF & UE5 Referansları ({idea.attachments.length})
                </h2>
                <p className="text-xs text-zinc-400">
                  Büyük PNG/JPG ekran görüntüleri yüklenmeden önce otomatik
                  WebP olarak sıkıştırılır.
                </p>
              </div>
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#242e40] bg-[#151b26] px-3 py-1.5 text-xs font-medium text-zinc-200 hover:border-amber-500/40 hover:text-amber-300 disabled:opacity-50"
              >
                <Upload className="h-3.5 w-3.5" />
                {uploading ? "Yükleniyor..." : "Dosya Seç"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/mp4,video/webm"
                className="hidden"
                onChange={(e) => handleFilesUpload(e.target.files)}
              />
            </div>

            {/* Dropzone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDraggingFiles(true);
              }}
              onDragLeave={() => setDraggingFiles(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDraggingFiles(false);
                handleFilesUpload(e.dataTransfer.files);
              }}
              className={`mt-4 flex flex-col items-center justify-center rounded-xl border border-dashed px-4 py-6 text-center transition ${
                draggingFiles
                  ? "border-amber-400 bg-amber-500/10"
                  : "border-[#263145] bg-[#090c12]"
              }`}
            >
              <ImageIcon className="h-6 w-6 text-zinc-500" />
              <p className="mt-2 text-xs text-zinc-400">
                UE5 ekran görüntüsü, konsept çizim, GIF veya MP4 videoyu buraya
                sürükleyip bırakabilirsin (maks. 25MB).
              </p>
            </div>

            {uploadError && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{uploadError}</span>
              </div>
            )}

            {idea.attachments.length > 0 && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {idea.attachments.map((att) => {
                  const isVideo = att.mime_type.startsWith("video/");
                  return (
                    <div
                      key={att.id}
                      className="group relative overflow-hidden rounded-xl border border-[#1f2735] bg-[#080a0f]"
                    >
                      {isVideo ? (
                        <video
                          src={att.public_url}
                          controls
                          className="h-44 w-full object-cover"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setLightboxMedia(att)}
                          className="relative block h-44 w-full overflow-hidden text-left"
                        >
                          <Image
                            src={att.public_url}
                            alt={att.file_name}
                            fill
                            unoptimized
                            className="object-cover transition duration-300 group-hover:scale-105"
                          />
                        </button>
                      )}

                      <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                        <span className="flex min-w-0 items-center gap-1.5 truncate text-zinc-300">
                          {isVideo ? (
                            <Film className="h-3.5 w-3.5 shrink-0 text-cyan-400" />
                          ) : (
                            <ImageIcon className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                          )}
                          <span className="truncate">{att.file_name}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteAttachment(att)}
                          className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-rose-400"
                          title="Ek dosyayı sil"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Team Comments */}
          <section className="rounded-xl border border-[#1f2735] bg-[#10141d] p-6">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4.5 w-4.5 text-amber-400" />
              <h2 className="text-base font-semibold text-zinc-100">
                Ekip Tartışması ({idea.comments.length})
              </h2>
            </div>

            <div className="mt-4 space-y-3">
              {idea.comments.length === 0 ? (
                <p className="text-xs text-zinc-500">
                  Henüz yorum yapılmamış. İlk geri bildirimi sen yaz.
                </p>
              ) : (
                idea.comments.map((comment) => (
                  <div
                    key={comment.id}
                    className="rounded-xl border border-[#1b2230] bg-[#0a0e15] p-3.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-bold text-zinc-950"
                          style={{
                            backgroundColor:
                              comment.author?.avatar_color ?? "#f59e0b",
                          }}
                        >
                          {(comment.author?.display_name ?? "EK")
                            .slice(0, 2)
                            .toUpperCase()}
                        </span>
                        <span className="text-xs font-semibold text-zinc-200">
                          {comment.author?.display_name ?? "Ekip Üyesi"}
                        </span>
                        <span className="text-xs text-zinc-500">
                          {new Date(comment.created_at).toLocaleString("tr-TR", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>

                      {comment.author_id === currentUserId && (
                        <button
                          type="button"
                          onClick={async () => {
                            await deleteIdeaCommentAction(idea.id, comment.id);
                            router.refresh();
                          }}
                          className="text-zinc-500 hover:text-rose-400"
                          title="Yorumu sil"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-zinc-300">
                      {comment.body}
                    </p>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleAddComment} className="mt-4 flex gap-2">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Fikir hakkında yorum veya teknik not yaz..."
                className="flex-1 rounded-lg border border-[#242e40] bg-[#080a0f] px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-amber-500/60 focus:outline-none"
              />
              <button
                type="submit"
                disabled={commentSending || !commentText.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3.5 py-2 text-xs font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                Gönder
              </button>
            </form>
          </section>
        </div>

        {/* Right Sidebar: Author, Voters, Links, Linked Tasks */}
        <aside className="space-y-5">
          {/* Meta Info */}
          <div className="rounded-xl border border-[#1f2735] bg-[#10141d] p-5 space-y-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Fikri Ekleyen
              </p>
              <div className="mt-2 flex items-center gap-2.5">
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-zinc-950"
                  style={{
                    backgroundColor: idea.author?.avatar_color ?? "#f59e0b",
                  }}
                >
                  {(idea.author?.display_name ?? "EK")
                    .slice(0, 2)
                    .toUpperCase()}
                </span>
                <div>
                  <p className="text-xs font-semibold text-zinc-100">
                    {idea.author?.display_name ?? "Ekip Üyesi"}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {idea.author?.role_title ?? "UE5 Developer"}
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-[#1b2230] pt-3">
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Onaylayanlar ({idea.vote_count}/3)
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {idea.voter_profiles.length > 0 ? (
                  idea.voter_profiles.map((voter) => (
                    <span
                      key={voter.id}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#242e40] bg-[#0a0e15] px-2.5 py-1 text-xs text-zinc-200"
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: voter.avatar_color }}
                      />
                      {voter.display_name}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-zinc-500">Henüz oy yok.</span>
                )}
              </div>
            </div>
          </div>

          {/* Reference Links */}
          <div className="rounded-xl border border-[#1f2735] bg-[#10141d] p-5">
            <h3 className="text-sm font-semibold text-zinc-100">
              Referans Linkleri ({idea.reference_links.length})
            </h3>
            {idea.reference_links.length === 0 ? (
              <p className="mt-2 text-xs text-zinc-500">
                Henüz dış referans linki eklenmemiş.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {idea.reference_links.map((link, idx) => (
                  <a
                    key={`${link.url}-${idx}`}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-2 rounded-lg border border-[#1f2735] bg-[#0a0e15] px-3 py-2 text-xs text-zinc-200 transition hover:border-cyan-500/40 hover:text-cyan-300"
                  >
                    <span className="truncate font-medium">{link.label}</span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Linked Kanban Tasks */}
          <div className="rounded-xl border border-[#1f2735] bg-[#10141d] p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-100">
                Bu Fikirden Doğan Görevler ({idea.linked_tasks.length})
              </h3>
              <button
                type="button"
                onClick={() => setConvertOpen(true)}
                className="inline-flex items-center gap-1 text-xs font-medium text-cyan-400 hover:text-cyan-300"
              >
                <Plus className="h-3 w-3" />
                Ekle
              </button>
            </div>

            {idea.linked_tasks.length === 0 ? (
              <p className="mt-2 text-xs text-zinc-500">
                Bu fikir henüz bir Kanban görevine dönüştürülmedi.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {idea.linked_tasks.map((task) => {
                  const statusLabel =
                    TASK_STATUSES.find((s) => s.value === task.status)?.label ??
                    task.status;
                  const assignee = task.assignee_id
                    ? profileMap.get(task.assignee_id)
                    : null;

                  return (
                    <Link
                      key={task.id}
                      href="/tasks"
                      className="block rounded-lg border border-[#1f2735] bg-[#0a0e15] p-3 transition hover:border-cyan-500/40"
                    >
                      <p className="text-xs font-medium text-zinc-200">
                        {task.title}
                      </p>
                      <div className="mt-1.5 flex items-center justify-between text-xs text-zinc-400">
                        <span className="rounded bg-[#151b26] px-1.5 py-0.5 text-zinc-300">
                          {statusLabel}
                        </span>
                        <span>
                          {assignee ? assignee.display_name : "Atanmadı"}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Edit Idea Modal */}
      <IdeaFormModal
        open={editOpen}
        mode="edit"
        initialValues={{
          title: idea.title,
          summary: idea.summary,
          content_md: idea.content_md,
          category: idea.category,
          status: idea.status,
          reference_links: idea.reference_links,
        }}
        onClose={() => setEditOpen(false)}
        onSubmit={handleEditSubmit}
      />

      {/* Convert Idea to Task Modal */}
      {convertOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-2.5 sm:p-4 backdrop-blur-xs">
          <div className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[#242e40] bg-[#0e131c] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1f2735] px-6 py-4">
              <div className="flex items-center gap-2">
                <KanbanSquare className="h-4.5 w-4.5 text-cyan-400" />
                <h2 className="text-base font-semibold text-zinc-100">
                  Fikri Kanban Görevine Dönüştür
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setConvertOpen(false)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <form
              onSubmit={handleConvertSubmit}
              className="flex-1 space-y-4 overflow-y-auto p-6"
            >
              {convertError && (
                <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
                  {convertError}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-300">
                  Görev Başlığı
                </label>
                <input
                  type="text"
                  required
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="w-full rounded-lg border border-[#242e40] bg-[#080a0f] px-3 py-2 text-sm text-zinc-100 focus:border-cyan-500/60 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-300">
                  Görev Notu
                </label>
                <textarea
                  rows={3}
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                  className="w-full rounded-lg border border-[#242e40] bg-[#080a0f] px-3 py-2 text-xs text-zinc-100 focus:border-cyan-500/60 focus:outline-none"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-300">
                    Atanan Kişi
                  </label>
                  <select
                    value={taskAssignee}
                    onChange={(e) => setTaskAssignee(e.target.value)}
                    className="w-full rounded-lg border border-[#242e40] bg-[#080a0f] px-2.5 py-2 text-xs text-zinc-100 focus:border-cyan-500/60 focus:outline-none"
                  >
                    <option value="">Atanmadı</option>
                    {teamProfiles.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.display_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-300">
                    Öncelik
                  </label>
                  <select
                    value={taskPriority}
                    onChange={(e) =>
                      setTaskPriority(e.target.value as TaskPriority)
                    }
                    className="w-full rounded-lg border border-[#242e40] bg-[#080a0f] px-2.5 py-2 text-xs text-zinc-100 focus:border-cyan-500/60 focus:outline-none"
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
                    Milestone
                  </label>
                  <select
                    value={taskMilestone}
                    onChange={(e) => setTaskMilestone(e.target.value)}
                    className="w-full rounded-lg border border-[#242e40] bg-[#080a0f] px-2.5 py-2 text-xs text-zinc-100 focus:border-cyan-500/60 focus:outline-none"
                  >
                    <option value="">Seçilmedi</option>
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
                  UE5 Disiplin Etiketleri
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {UE_DISCIPLINE_TAGS.map((tag) => {
                    const active = taskTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTaskTag(tag)}
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                          active
                            ? "border-cyan-500/50 bg-cyan-500/20 text-cyan-200"
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
                  onClick={() => setConvertOpen(false)}
                  className="rounded-lg border border-[#242e40] px-4 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={converting}
                  className="rounded-lg bg-cyan-500 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-cyan-400 disabled:opacity-50"
                >
                  {converting ? "Oluşturuluyor..." : "Kanban'a Görev Aç"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lightbox Image Preview */}
      {lightboxMedia && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightboxMedia(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxMedia(null)}
            className="absolute top-4 right-4 rounded-full bg-zinc-900/80 p-2 text-zinc-200 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
          <div
            className="relative h-[85vh] w-[90vw]"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={lightboxMedia.public_url}
              alt={lightboxMedia.file_name}
              fill
              unoptimized
              className="rounded-lg object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
