"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Lightbulb,
  KanbanSquare,
  Bug,
  Flag,
  ArrowRight,
  CheckCircle2,
  HardDrive,
  ExternalLink,
} from "lucide-react";
import { SetupBanner } from "@/components/ui/setup-banner";
import { useStudioStore } from "@/components/studio/studio-store";
import {
  IDEA_CATEGORIES,
  IDEA_STATUSES,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from "@/lib/constants";
import type { Task } from "@/types/studio";

const PRIORITY_WEIGHT: Record<Task["priority"], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function DashboardView() {
  const {
    isConfigured,
    currentUserId,
    currentProfile,
    workspace,
    tasks,
    ideas,
    milestones,
    driveEvents,
    navigateTab,
  } = useStudioStore();

  const { counts, myTasks, activeMilestones, recentIdeas } = useMemo(() => {
    const openTasksCount = tasks.filter(
      (t) => t.kind === "task" && t.status !== "done"
    ).length;
    const openBugsCount = tasks.filter(
      (t) => t.kind === "bug" && t.status !== "done"
    ).length;

    const assignedToMe = currentUserId
      ? tasks
          .filter((t) => t.assignee_id === currentUserId && t.status !== "done")
          .sort(
            (a, b) => PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority]
          )
          .slice(0, 6)
      : [];

    const activeMs = milestones
      .filter((m) => m.status !== "completed")
      .slice(0, 4)
      .map((m) => {
        const linked = tasks.filter((t) => t.milestone_id === m.id);
        const total = linked.length;
        const done = linked.filter((t) => t.status === "done").length;
        return {
          ...m,
          total_tasks: total,
          done_tasks: done,
          progress_percent: total > 0 ? Math.round((done / total) * 100) : 0,
        };
      });

    return {
      counts: {
        ideas: ideas.length,
        openTasks: openTasksCount,
        openBugs: openBugsCount,
      },
      myTasks: assignedToMe,
      activeMilestones: activeMs,
      recentIdeas: ideas.slice(0, 5),
    };
  }, [tasks, ideas, milestones, currentUserId]);

  const cards = [
    {
      label: "Açık Görevler",
      value: counts.openTasks,
      href: "/tasks",
      icon: KanbanSquare,
      accent: "text-cyan-400 bg-cyan-500/15",
    },
    {
      label: "Fikirler & GDD",
      value: counts.ideas,
      href: "/ideas",
      icon: Lightbulb,
      accent: "text-amber-400 bg-amber-500/15",
    },
    {
      label: "Açık Buglar",
      value: counts.openBugs,
      href: "/bugs",
      icon: Bug,
      accent: "text-rose-400 bg-rose-500/15",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-amber-400">
            <span className="font-mono">{workspace.ue_version}</span>
            <span>•</span>
            <span>{workspace.studio_name}</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-100">
            {workspace.project_name}
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Hoş geldin
            {currentProfile ? `, ${currentProfile.display_name}` : ""}. Günün
            işleri ve aktif hedefler aşağıda.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => navigateTab("/tasks")}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3.5 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-amber-400"
          >
            <KanbanSquare className="h-3.5 w-3.5" />
            Görev Panosu
          </button>
          <button
            type="button"
            onClick={() => navigateTab("/ideas")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#242e40] bg-[#10141d] px-3.5 py-2 text-xs font-medium text-zinc-200 transition hover:border-amber-500/40 hover:text-amber-300"
          >
            <Lightbulb className="h-3.5 w-3.5 text-amber-400" />
            Yeni Fikir
          </button>
          <button
            type="button"
            onClick={() => navigateTab("/bugs")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3.5 py-2 text-xs font-medium text-rose-300 transition hover:bg-rose-500/20"
          >
            <Bug className="h-3.5 w-3.5" />
            Bug Bildir
          </button>
        </div>
      </div>

      {!isConfigured && <SetupBanner />}

      {/* Summary Metrics (3 clean cards) */}
      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.label}
              type="button"
              onClick={() => navigateTab(card.href)}
              className="group rounded-xl border border-[#1f2735] bg-[#10141d] p-5 text-left transition hover:border-amber-500/40 hover:bg-[#141a26]"
            >
              <div className="flex items-center justify-between">
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-lg ${card.accent}`}
                >
                  <Icon className="h-4.5 w-4.5" />
                </span>
                <ArrowRight className="h-4 w-4 text-zinc-600 transition group-hover:translate-x-0.5 group-hover:text-amber-400" />
              </div>
              <p className="mt-4 text-2xl font-bold text-zinc-100">
                {card.value}
              </p>
              <p className="mt-0.5 text-xs text-zinc-400">{card.label}</p>
            </button>
          );
        })}
      </div>

      {/* Clean 2-Column Operational Layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column: My Assigned Tasks & Bugs */}
        <section className="rounded-xl border border-[#1f2735] bg-[#10141d] p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <KanbanSquare className="h-4.5 w-4.5 text-cyan-400" />
              <h2 className="text-base font-semibold text-zinc-100">
                Bana Atanan Açık İşler
              </h2>
            </div>
            <button
              type="button"
              onClick={() => navigateTab("/tasks")}
              className="text-xs font-medium text-cyan-400 hover:text-cyan-300"
            >
              Tümünü Gör →
            </button>
          </div>

          <div className="mt-4 space-y-2.5">
            {myTasks.length === 0 ? (
              <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-[#242e40] bg-[#0a0e15] p-4 text-xs text-zinc-400">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>Şu anda sana atanmış açık görev veya bug yok.</span>
              </div>
            ) : (
              myTasks.map((task) => {
                const statusLabel =
                  TASK_STATUSES.find((s) => s.value === task.status)?.label ??
                  task.status;
                const priorityMeta =
                  TASK_PRIORITIES.find((p) => p.value === task.priority) ??
                  TASK_PRIORITIES[1];

                return (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() =>
                      navigateTab(task.kind === "bug" ? "/bugs" : "/tasks")
                    }
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-[#1b2332] bg-[#0a0e15] px-3.5 py-3 text-left transition hover:border-cyan-500/40"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {task.kind === "bug" && (
                          <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-rose-300">
                            Bug
                          </span>
                        )}
                        <span
                          className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${priorityMeta.badgeClass}`}
                        >
                          {priorityMeta.label}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-xs font-semibold text-zinc-100">
                        {task.title}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-md bg-[#151b26] px-2 py-1 text-[11px] text-zinc-300">
                      {statusLabel}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </section>

        {/* Right Column: Active Milestones + Recent Ideas stacked */}
        <div className="space-y-6">
          <section className="rounded-xl border border-[#1f2735] bg-[#10141d] p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flag className="h-4.5 w-4.5 text-amber-400" />
                <h2 className="text-base font-semibold text-zinc-100">
                  Aktif Sistemler & Roadmap
                </h2>
              </div>
              <button
                type="button"
                onClick={() => navigateTab("/milestones")}
                className="text-xs font-medium text-amber-300 hover:text-amber-200"
              >
                Tümünü Gör →
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {activeMilestones.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#242e40] bg-[#0a0e15] p-4 text-xs text-zinc-400">
                  Henüz aktif milestone oluşturulmamış.
                </div>
              ) : (
                activeMilestones.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() =>
                      navigateTab(`/tasks?milestone=${m.id}`, {
                        milestoneId: m.id,
                      })
                    }
                    className="block w-full rounded-xl border border-[#1b2332] bg-[#0a0e15] p-3.5 text-left transition hover:border-amber-500/40"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-zinc-100">
                        {m.title}
                      </span>
                      <span className="font-mono font-bold text-amber-300">
                        %{m.progress_percent} ({m.done_tasks}/{m.total_tasks})
                      </span>
                    </div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#1a2232]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-500 to-emerald-400"
                        style={{ width: `${m.progress_percent}%` }}
                      />
                    </div>
                  </button>
                ))
              )}
            </div>
          </section>

          <section className="rounded-xl border border-[#1f2735] bg-[#10141d] p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-4.5 w-4.5 text-amber-400" />
                <h2 className="text-base font-semibold text-zinc-100">
                  Son Fikirler & Mini-GDD
                </h2>
              </div>
              <button
                type="button"
                onClick={() => navigateTab("/ideas")}
                className="text-xs font-medium text-amber-300 hover:text-amber-200"
              >
                Fikirlere Git →
              </button>
            </div>

            <div className="mt-4 space-y-2.5">
              {recentIdeas.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#242e40] bg-[#0a0e15] p-4 text-xs text-zinc-400">
                  Henüz fikir eklenmemiş.
                </div>
              ) : (
                recentIdeas.map((idea) => {
                  const catMeta =
                    IDEA_CATEGORIES.find((c) => c.value === idea.category) ??
                    IDEA_CATEGORIES[0];
                  const statusMeta =
                    IDEA_STATUSES.find((s) => s.value === idea.status) ??
                    IDEA_STATUSES[0];

                  return (
                    <Link
                      key={idea.id}
                      href={`/ideas/${idea.id}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-[#1b2332] bg-[#0a0e15] px-3.5 py-2.5 transition hover:border-amber-500/40"
                    >
                      <p className="truncate text-xs font-medium text-zinc-100">
                        {idea.title}
                      </p>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${catMeta.badgeClass}`}
                        >
                          {catMeta.label}
                        </span>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusMeta.badgeClass}`}
                        >
                          {statusMeta.label}
                        </span>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </section>

          <section className="rounded-xl border border-[#1f2735] bg-[#10141d] p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HardDrive className="h-4.5 w-4.5 text-cyan-400" />
                <h2 className="text-base font-semibold text-zinc-100">
                  Son Yüklenen Drive Assetleri
                </h2>
              </div>
              <button
                type="button"
                onClick={() => navigateTab("/settings")}
                className="text-xs font-medium text-cyan-300 hover:text-cyan-200"
              >
                Bağlantı Ayarları →
              </button>
            </div>

            <div className="mt-4 space-y-2.5">
              {driveEvents.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#242e40] bg-[#0a0e15] p-4 text-xs text-zinc-400">
                  Henüz Drive asset bildirimi yok. Ayarlardan Google Drive
                  klasörünüzü bağlayarak yeni assetlerden haberdar olabilirsiniz.
                </div>
              ) : (
                driveEvents.slice(0, 5).map((ev) => (
                  <a
                    key={ev.id}
                    href={ev.web_view_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-3 rounded-xl border border-[#1b2332] bg-[#0a0e15] px-3.5 py-2.5 transition hover:border-cyan-500/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-zinc-100">
                        {ev.file_name}
                      </p>
                      <p className="truncate text-[11px] text-zinc-400">
                        {ev.folder_name} • {ev.uploaded_by_name}
                      </p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-medium text-cyan-300">
                      {ev.event_type === "updated" ? "Güncel" : "Yeni"}
                      <ExternalLink className="h-2.5 w-2.5" />
                    </span>
                  </a>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
