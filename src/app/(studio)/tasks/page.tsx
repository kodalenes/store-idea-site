import { Suspense } from "react";
import { SetupBanner } from "@/components/ui/setup-banner";
import { KanbanBoard } from "@/components/tasks/kanban-board";
import { getTasksBoardData } from "@/lib/tasks-data";

async function TasksContent({
  searchParamsPromise,
}: {
  searchParamsPromise: Promise<{ milestone?: string }>;
}) {
  const [data, sp] = await Promise.all([
    getTasksBoardData(),
    searchParamsPromise,
  ]);

  return (
    <div className="space-y-6">
      {!data.isConfigured && <SetupBanner />}
      <KanbanBoard
        initialTasks={data.tasks}
        teamProfiles={data.teamProfiles}
        milestones={data.milestones}
        ideas={data.ideas}
        currentUserId={data.currentUserId}
        isConfigured={data.isConfigured}
        initialMilestoneFilter={sp.milestone ?? "all"}
      />
    </div>
  );
}

export default function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ milestone?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <div className="h-10 w-64 animate-pulse rounded-lg bg-[#10141d]" />
          <div className="h-16 animate-pulse rounded-xl bg-[#10141d]" />
          <div className="flex gap-4 overflow-hidden">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-96 w-72 shrink-0 animate-pulse rounded-xl bg-[#10141d]"
              />
            ))}
          </div>
        </div>
      }
    >
      <TasksContent searchParamsPromise={searchParams} />
    </Suspense>
  );
}
