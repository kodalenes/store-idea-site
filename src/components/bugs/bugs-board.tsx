"use client";

import {
  startTransition,
  useEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
} from "lucide-react";
import {
  BUG_SEVERITIES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  UE_DISCIPLINE_TAGS,
} from "@/lib/constants";
import { uploadStudioMedia } from "@/lib/media-upload";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { createBugAction } from "@/app/actions/bugs";
import {
  moveTaskStatusAction,
  registerTaskAttachmentAction,
  updateTaskAction,
} from "@/app/actions/tasks";
import { TaskDetailDrawer } from "@/components/tasks/task-detail-drawer";
import {
  TaskFormModal,
  type TaskFormValues,
} from "@/components/tasks/task-form-modal";
import type {
  BugSeverity,
  Milestone,
  Profile,
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

export function BugsBoard({
  initialBugs,
  teamProfiles,
  milestones,
  currentUserId,
  isConfigured,
}: {
  initialBugs: TaskBoardItem[];
  teamProfiles: Profile[];
  milestones: Milestone[];
  currentUserId: string | null;
  isConfigured: boolean;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [optimisticBugs, moveBugOptimistic] = useOptimistic(
    initialBugs,
    (state, update: { bugId: string; status: TaskStatus }) =>
      state.map((b) =>
        b.id === update.bugId ? { ...b, status: update.status } : b
      )
  );

  // Filters
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<BugSeverity | "all">(
    "all"
  );
  const [statusFilter, setStatusFilter] = useState<"open" | "done" | "all">(
    "open"
  );
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
    milestones.find((m) => m.status === "active")?.id ?? ""
  );
  const [ueTags, setUeTags] = useState<string[]>(["Blueprint"]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;

    const channel = supabase
      .channel("bugs-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        () => router.refresh()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  const stats = useMemo(() => {
    const open = optimisticBugs.filter((b) => b.status !== "done");
    return {
      openCount: open.length,
      crashCount: open.filter((b) => b.bug_severity === "crash").length,
      testingCount: open.filter((b) => b.status === "testing").length,
      doneCount: optimisticBugs.filter((b) => b.status === "done").length,
    };
  }, [optimisticBugs]);

  const filteredBugs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return optimisticBugs.filter((b) => {
      if (statusFilter === "open" && b.status === "done") return false;
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
    optimisticBugs,
    search,
    severityFilter,
    statusFilter,
    assigneeFilter,
    currentUserId,
  ]);

  const selectedBug = useMemo(
    () => optimisticBugs.find((b) => b.id === selectedBugId) ?? null,
    [optimisticBugs, selectedBugId]
  );

  function handleQuickStatusChange(bugId: string, nextStatus: TaskStatus) {
    setBoardError(null);
    startTransition(async () => {
      moveBugOptimistic({ bugId, status: nextStatus });
      try {
        const res = await moveTaskStatusAction(bugId, nextStatus);
        if (!res.ok) {
          setBoardError(
            res.error ?? "Bug durumu güncellenemedi, değişiklik geri alındı."
          );
          return;
        }
        router.refresh();
      } catch {
        setBoardError("Bağlantı hatası: Bug durumu geri alındı.");
      }
    });
  }

  async function handleCreateBug(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setSubmitting(true);

    try {
      const res = await createBugAction({
        title,
        description_md: descriptionMd,
        bug_severity: severity,
        priority,
        repro_steps: reproSteps,
        build_version: buildVersion,
        ue_tags: ueTags,
        assignee_id: assigneeId || null,
        milestone_id: milestoneId || null,
      });

      if (!res.ok || !res.data?.id) {
        setCreateError(res.error ?? "Bug raporu oluşturulamadı.");
        setSubmitting(false);
        return;
      }

      if (pendingFiles.length > 0) {
        for (const file of pendingFiles) {
          const uploaded = await uploadStudioMedia("task", res.data.id, file);
          await registerTaskAttachmentAction({
            taskId: res.data.id,
            ...uploaded,
          });
        }
      }

      setTitle("");
      setBuildVersion("");
      setReproSteps("");
      setDescriptionMd("");
      setPendingFiles([]);
      setCreateOpen(false);
      router.refresh();
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "Bug raporu gönderilemedi."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEditSubmit(values: TaskFormValues) {
    if (!editingBug) return { ok: false, error: "Kayıt bulunamadı." };
    const res = await updateTaskAction(editingBug.id, values);
    if (res.ok) router.refresh();
    return res;
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
            ekran görüntüsüyle kaydedin; tüm buglar Kanban panosuna otomatik
            düşer.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/tasks"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#242e40] bg-[#10141d] px-3.5 py-2.5 text-xs font-medium text-zinc-200 hover:border-amber-500/40"
          >
            <KanbanSquare className="h-4 w-4 text-zinc-400" />
            Kanban&apos;da Gör
          </Link>
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

      {/* Summary Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-[#1f2735] bg-[#10141d] p-4">
          <p className="text-xs text-zinc-400">Açık Buglar</p>
          <p className="mt-1 text-2xl font-bold text-zinc-100">
            {stats.openCount}
          </p>
        </div>
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4">
          <p className="text-xs text-rose-300">Crash / Blocker</p>
          <p className="mt-1 text-2xl font-bold text-rose-200">
            {stats.crashCount}
          </p>
        </div>
        <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-4">
          <p className="text-xs text-purple-300">Test Bekleyen</p>
          <p className="mt-1 text-2xl font-bold text-purple-200">
            {stats.testingCount}
          </p>
        </div>
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
          <p className="text-xs text-emerald-300">Çözülen</p>
          <p className="mt-1 text-2xl font-bold text-emerald-200">
            {stats.doneCount}
          </p>
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

      {/* Filters */}
      <div className="grid gap-3 rounded-xl border border-[#1f2735] bg-[#10141d] p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Bug, repro veya build ara..."
            className="w-full rounded-lg border border-[#242e40] bg-[#080a0f] py-2 pr-3 pl-9 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-rose-500/60 focus:outline-none"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as "open" | "done" | "all")
          }
          className="rounded-lg border border-[#242e40] bg-[#080a0f] px-3 py-2 text-xs text-zinc-200 focus:border-rose-500/60 focus:outline-none"
        >
          <option value="open">Durum: Açık Buglar</option>
          <option value="done">Durum: Çözülenler</option>
          <option value="all">Durum: Tümü</option>
        </select>

        <select
          value={severityFilter}
          onChange={(e) =>
            setSeverityFilter(e.target.value as BugSeverity | "all")
          }
          className="rounded-lg border border-[#242e40] bg-[#080a0f] px-3 py-2 text-xs text-zinc-200 focus:border-rose-500/60 focus:outline-none"
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
          className="rounded-lg border border-[#242e40] bg-[#080a0f] px-3 py-2 text-xs text-zinc-200 focus:border-rose-500/60 focus:outline-none"
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

      {/* Bug List */}
      {filteredBugs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#242e40] bg-[#0c1018] px-6 py-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-zinc-100">
            {optimisticBugs.length === 0
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

            return (
              <div
                key={bug.id}
                onClick={() => setSelectedBugId(bug.id)}
                className="cursor-pointer rounded-xl border border-[#1f2735] bg-[#10141d] p-4 transition hover:border-rose-500/40 hover:bg-[#131823]"
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
                      onChange={(e) =>
                        handleQuickStatusChange(
                          bug.id,
                          e.target.value as TaskStatus
                        )
                      }
                      className="w-full rounded-lg border border-[#2a3447] bg-[#080a0f] px-2.5 py-1.5 text-xs font-medium text-zinc-200 focus:border-amber-500/60 focus:outline-none sm:w-auto"
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
                  disabled={submitting}
                  className="rounded-lg bg-rose-500 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-400 disabled:opacity-50"
                >
                  {submitting ? "Gönderiliyor..." : "Bug Raporu Aç"}
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
          allTasks={optimisticBugs}
          onClose={() => setEditingBug(null)}
          onSubmit={handleEditSubmit}
        />
      )}

      {/* Centered Detail Modal (reuses TaskDetailDrawer) */}
      <TaskDetailDrawer
        task={selectedBug}
        currentUserId={currentUserId}
        currentProfile={
          teamProfiles.find((p) => p.id === currentUserId) ?? null
        }
        onClose={() => setSelectedBugId(null)}
        onEdit={(bug) => setEditingBug(bug)}
        onSelectTask={(id) => setSelectedBugId(id)}
        onStatusChangeOptimistic={handleQuickStatusChange}
      />
    </div>
  );
}
