import "server-only";
import { getRequestAuth } from "@/lib/studio-data";
import type {
  AssetLockWithProfile,
  Idea,
  Milestone,
  Profile,
  Task,
} from "@/types/studio";

export interface DashboardMilestoneSummary {
  id: string;
  title: string;
  status: Milestone["status"];
  target_date: string | null;
  total_tasks: number;
  done_tasks: number;
  progress_percent: number;
}

export interface DashboardData {
  counts: {
    ideas: number;
    openTasks: number;
    locks: number;
    openBugs: number;
  };
  myTasks: Pick<
    Task,
    "id" | "title" | "kind" | "status" | "priority" | "ue_tags"
  >[];
  activeMilestones: DashboardMilestoneSummary[];
  activeLocks: AssetLockWithProfile[];
  recentIdeas: Pick<
    Idea,
    "id" | "title" | "category" | "status" | "updated_at"
  >[];
}

const EMPTY_DASHBOARD: DashboardData = {
  counts: { ideas: 0, openTasks: 0, locks: 0, openBugs: 0 },
  myTasks: [],
  activeMilestones: [],
  activeLocks: [],
  recentIdeas: [],
};

const PRIORITY_WEIGHT: Record<Task["priority"], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export async function getDashboardData(
  userId: string | null,
  teamProfiles: Profile[]
): Promise<DashboardData> {
  const { isConfigured, supabase } = await getRequestAuth();
  if (!isConfigured || !supabase || !userId) return EMPTY_DASHBOARD;

  const [
    ideasCountRes,
    openTasksCountRes,
    locksCountRes,
    openBugsCountRes,
    myTasksRes,
    activeMilestonesRes,
    milestoneTasksRes,
    activeLocksRes,
    recentIdeasRes,
  ] = await Promise.all([
    supabase.from("ideas").select("id", { count: "exact", head: true }),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("kind", "task")
      .neq("status", "done"),
    supabase.from("asset_locks").select("id", { count: "exact", head: true }),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("kind", "bug")
      .neq("status", "done"),
    supabase
      .from("tasks")
      .select("id, title, kind, status, priority, ue_tags")
      .eq("assignee_id", userId)
      .neq("status", "done")
      .order("updated_at", { ascending: false })
      .limit(20),
    supabase
      .from("milestones")
      .select("id, title, status, target_date")
      .neq("status", "completed")
      .order("sort_order", { ascending: true })
      .limit(4),
    supabase
      .from("tasks")
      .select("milestone_id, status")
      .not("milestone_id", "is", null),
    supabase
      .from("asset_locks")
      .select("id, asset_path, lock_type, locked_by, note, locked_at")
      .order("locked_at", { ascending: false })
      .limit(6),
    supabase
      .from("ideas")
      .select("id, title, category, status, updated_at")
      .order("updated_at", { ascending: false })
      .limit(5),
  ]);

  const profileMap = new Map(teamProfiles.map((p) => [p.id, p]));

  const myTasks = ((myTasksRes.data ?? []) as Pick<
    Task,
    "id" | "title" | "kind" | "status" | "priority" | "ue_tags"
  >[])
    .sort((a, b) => PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority])
    .slice(0, 6);

  const milestoneRows = (activeMilestonesRes.data ?? []) as Pick<
    Milestone,
    "id" | "title" | "status" | "target_date"
  >[];
  const milestoneTaskStats = new Map<
    string,
    { total: number; done: number }
  >();
  for (const row of milestoneTasksRes.data ?? []) {
    if (!row.milestone_id) continue;
    const current = milestoneTaskStats.get(row.milestone_id) ?? {
      total: 0,
      done: 0,
    };
    current.total += 1;
    if (row.status === "done") current.done += 1;
    milestoneTaskStats.set(row.milestone_id, current);
  }

  const activeMilestones: DashboardMilestoneSummary[] = milestoneRows.map(
    (m) => {
      const stat = milestoneTaskStats.get(m.id) ?? { total: 0, done: 0 };
      return {
        id: m.id,
        title: m.title,
        status: m.status,
        target_date: m.target_date,
        total_tasks: stat.total,
        done_tasks: stat.done,
        progress_percent:
          stat.total > 0 ? Math.round((stat.done / stat.total) * 100) : 0,
      };
    }
  );

  const activeLocks: AssetLockWithProfile[] = (
    (activeLocksRes.data ?? []) as AssetLockWithProfile[]
  ).map((l) => ({
    ...l,
    owner: profileMap.get(l.locked_by) ?? null,
  }));

  return {
    counts: {
      ideas: ideasCountRes.count ?? 0,
      openTasks: openTasksCountRes.count ?? 0,
      locks: locksCountRes.count ?? 0,
      openBugs: openBugsCountRes.count ?? 0,
    },
    myTasks,
    activeMilestones,
    activeLocks,
    recentIdeas: (recentIdeasRes.data ?? []) as Pick<
      Idea,
      "id" | "title" | "category" | "status" | "updated_at"
    >[],
  };
}
