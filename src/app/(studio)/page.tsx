import { Suspense } from "react";
import Link from "next/link";
import {
  Lightbulb,
  KanbanSquare,
  Lock,
  Bug,
  Flag,
  ArrowRight,
  Settings,
  CheckCircle2,
  Unlock,
} from "lucide-react";
import { SetupBanner } from "@/components/ui/setup-banner";
import { DashboardLiveRefresh } from "@/components/dashboard/dashboard-live-refresh";
import {
  IDEA_CATEGORIES,
  IDEA_STATUSES,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from "@/lib/constants";
import { getStudioContext } from "@/lib/studio-data";
import { getDashboardData } from "@/lib/dashboard-data";

async function DashboardContent() {
  const context = await getStudioContext();
  const dashboard = await getDashboardData(context.userId, context.teamProfiles);

  const cards = [
    {
      label: "Fikir & GDD Kartı",
      value: dashboard.counts.ideas,
      href: "/ideas",
      icon: Lightbulb,
      accent: "text-amber-400 bg-amber-500/15",
    },
    {
      label: "Açık Görev",
      value: dashboard.counts.openTasks,
      href: "/tasks",
      icon: KanbanSquare,
      accent: "text-cyan-400 bg-cyan-500/15",
    },
    {
      label: "Kilitli UE5 Dosyası",
      value: dashboard.counts.locks,
      href: "/locks",
      icon: Lock,
      accent: "text-purple-400 bg-purple-500/15",
    },
    {
      label: "Açık Playtest Bug",
      value: dashboard.counts.openBugs,
      href: "/bugs",
      icon: Bug,
      accent: "text-rose-400 bg-rose-500/15",
    },
  ];

  return (
    <div className="space-y-6">
      <DashboardLiveRefresh />

      {/* Hero Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-amber-400">
            <span className="font-mono">{context.workspace.ue_version}</span>
            <span>•</span>
            <span>{context.workspace.studio_name}</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-100">
            {context.workspace.project_name} — Stüdyo Merkezi
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Hoş geldin
            {context.currentProfile
              ? `, ${context.currentProfile.display_name}`
              : ""}
            . Ekip içi fikirler, UE5 görevleri ve dosya kilitleri canlı yayında.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/bugs"
            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3.5 py-2 text-xs font-medium text-rose-300 transition hover:bg-rose-500/20"
          >
            <Bug className="h-3.5 w-3.5" />
            Bug Bildir
          </Link>
          <Link
            href="/settings"
            className="inline-flex items-center gap-2 rounded-lg border border-[#242e40] bg-[#10141d] px-3.5 py-2 text-xs font-medium text-zinc-200 transition hover:border-amber-500/40 hover:text-amber-300"
          >
            <Settings className="h-3.5 w-3.5" />
            Ayarlar
          </Link>
        </div>
      </div>

      {!context.isConfigured && <SetupBanner />}

      {/* Summary Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.label}
              href={card.href}
              className="group rounded-xl border border-[#1f2735] bg-[#10141d] p-5 transition hover:border-amber-500/40 hover:bg-[#141a26]"
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
            </Link>
          );
        })}
      </div>

      {/* Main 2x2 Operational Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* 1. My Assigned Tasks & Bugs */}
        <section className="rounded-xl border border-[#1f2735] bg-[#10141d] p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <KanbanSquare className="h-4.5 w-4.5 text-cyan-400" />
              <h2 className="text-base font-semibold text-zinc-100">
                Bana Atanan Açık İşler
              </h2>
            </div>
            <Link
              href="/tasks"
              className="text-xs font-medium text-cyan-400 hover:text-cyan-300"
            >
              Kanban&apos;a Git →
            </Link>
          </div>

          <div className="mt-4 space-y-2.5">
            {dashboard.myTasks.length === 0 ? (
              <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-[#242e40] bg-[#0a0e15] p-4 text-xs text-zinc-400">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>Şu anda sana atanmış açık görev veya bug yok.</span>
              </div>
            ) : (
              dashboard.myTasks.map((task) => {
                const statusLabel =
                  TASK_STATUSES.find((s) => s.value === task.status)?.label ??
                  task.status;
                const priorityMeta =
                  TASK_PRIORITIES.find((p) => p.value === task.priority) ??
                  TASK_PRIORITIES[1];

                return (
                  <Link
                    key={task.id}
                    href={task.kind === "bug" ? "/bugs" : "/tasks"}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[#1b2332] bg-[#0a0e15] px-3.5 py-3 transition hover:border-cyan-500/40"
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
                  </Link>
                );
              })
            )}
          </div>
        </section>

        {/* 2. Active UE5 Asset Locks */}
        <section className="rounded-xl border border-[#1f2735] bg-[#10141d] p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="h-4.5 w-4.5 text-purple-400" />
              <h2 className="text-base font-semibold text-zinc-100">
                Şu An Kilitli UE5 Dosyaları
              </h2>
            </div>
            <Link
              href="/locks"
              className="text-xs font-medium text-purple-300 hover:text-purple-200"
            >
              Kilitle / Yönet →
            </Link>
          </div>

          <div className="mt-4 space-y-2.5">
            {dashboard.activeLocks.length === 0 ? (
              <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-[#242e40] bg-[#0a0e15] p-4 text-xs text-zinc-400">
                <Unlock className="h-4 w-4 text-emerald-400" />
                <span>Tüm .uasset ve .umap dosyaları şu an serbest.</span>
              </div>
            ) : (
              dashboard.activeLocks.map((lock) => (
                <Link
                  key={lock.id}
                  href="/locks"
                  className="flex items-center justify-between gap-3 rounded-xl border border-[#1b2332] bg-[#0a0e15] px-3.5 py-2.5 transition hover:border-purple-500/40"
                >
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs text-amber-200">
                      {lock.asset_path}
                    </p>
                    {lock.note && (
                      <p className="mt-0.5 truncate text-[11px] text-zinc-400">
                        {lock.note}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-zinc-950"
                      style={{
                        backgroundColor: lock.owner?.avatar_color ?? "#f59e0b",
                      }}
                    >
                      {(lock.owner?.display_name ?? "EK")
                        .slice(0, 2)
                        .toUpperCase()}
                    </span>
                    <span className="text-xs text-zinc-300">
                      {lock.owner?.display_name ?? "Ekip"}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>

        {/* 3. Active Milestones Progress */}
        <section className="rounded-xl border border-[#1f2735] bg-[#10141d] p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flag className="h-4.5 w-4.5 text-amber-400" />
              <h2 className="text-base font-semibold text-zinc-100">
                Aktif Milestones
              </h2>
            </div>
            <Link
              href="/milestones"
              className="text-xs font-medium text-amber-300 hover:text-amber-200"
            >
              Tümünü Gör →
            </Link>
          </div>

          <div className="mt-4 space-y-3">
            {dashboard.activeMilestones.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#242e40] bg-[#0a0e15] p-4 text-xs text-zinc-400">
                Henüz aktif milestone oluşturulmamış.
              </div>
            ) : (
              dashboard.activeMilestones.map((m) => (
                <Link
                  key={m.id}
                  href={`/tasks?milestone=${m.id}`}
                  className="block rounded-xl border border-[#1b2332] bg-[#0a0e15] p-3.5 transition hover:border-amber-500/40"
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
                </Link>
              ))
            )}
          </div>
        </section>

        {/* 4. Recent Ideas */}
        <section className="rounded-xl border border-[#1f2735] bg-[#10141d] p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4.5 w-4.5 text-amber-400" />
              <h2 className="text-base font-semibold text-zinc-100">
                Son Fikirler & Mini-GDD
              </h2>
            </div>
            <Link
              href="/ideas"
              className="text-xs font-medium text-amber-300 hover:text-amber-200"
            >
              Fikirlere Git →
            </Link>
          </div>

          <div className="mt-4 space-y-2.5">
            {dashboard.recentIdeas.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#242e40] bg-[#0a0e15] p-4 text-xs text-zinc-400">
                Henüz fikir eklenmemiş.
              </div>
            ) : (
              dashboard.recentIdeas.map((idea) => {
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
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <div className="h-10 w-64 animate-pulse rounded-lg bg-[#10141d]" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-28 animate-pulse rounded-xl bg-[#10141d]"
              />
            ))}
          </div>
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
