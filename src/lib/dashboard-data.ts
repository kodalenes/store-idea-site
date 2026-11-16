import "server-only";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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
  const { isConfigured } = getSupabaseConfig();
  if (!isConfigured || !userId) return EMPTY_DASHBOARD;

  const supabase = await createSupabaseServerClient();
  if (!supabase) return EMPTY_DASHBOARD;

  const [ideasRes, tasksRes, locksRes, milestonesRes] = await Promise.all([
    supabase
      .from("ideas")
      .select("id, title, category, status, updated_at")
      .order("updated_at", { ascending: false }),
    supabase
      .from("tasks")
      .select("id, title, kind, status, priority, ue_tags, assignee_id, milestone_id")
      .order("updated_at", { ascending: false }),
    supabase
      .from("asset_locks")
      .select("*")
      .order("locked_at", { ascending: false }),
    supabase
      .from("milestones")
      .select("*")
      .neq("status", "completed")
      .order("sort_order", { ascending: true }),
  ]);

  const allIdeas = (ideasRes.data ?? []) as Pick<
    Idea,
    "id" | "title" | "category" | "status" | "updated_at"
  >[];
  const allTasks = (tasksRes.data ?? []) as Pick<
    Task,
    | "id"
    | "title"
    | "kind"
    | "status"
    | "priority"
    | "ue_tags"
    | "assignee_id"
    | "milestone_id"
  >[];
  const allLocks = (locksRes.data ?? []) as AssetLockWithProfile[];
  const milestones = (milestonesRes.data ?? []) as Milestone[];

  const profileMap = new Map(teamProfiles.map((p) => [p.id, p]));

  const myTasks = allTasks
    .filter((t) => t.assignee_id === userId && t.status !== "done")
    .sort((a, b) => PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority])
    .slice(0, 6);

  const activeMilestones: DashboardMilestoneSummary[] = milestones
    .slice(0, 4)
    .map((m) => {
      const linked = allTasks.filter((t) => t.milestone_id === m.id);
      const total = linked.length;
      const done = linked.filter((t) => t.status === "done").length;
      return {
        id: m.id,
        title: m.title,
        status: m.status,
        target_date: m.target_date,
        total_tasks: total,
        done_tasks: done,
        progress_percent: total > 0 ? Math.round((done / total) * 100) : 0,
      };
    });

  const activeLocks: AssetLockWithProfile[] = allLocks.slice(0, 6).map((l) => ({
    ...l,
    owner: profileMap.get(l.locked_by) ?? null,
  }));

  return {
    counts: {
      ideas: allIdeas.length,
      openTasks: allTasks.filter(
        (t) => t.kind === "task" && t.status !== "done"
      ).length,
      locks: allLocks.length,
      openBugs: allTasks.filter((t) => t.kind === "bug" && t.status !== "done")
        .length,
    },
    myTasks,
    activeMilestones,
    activeLocks,
    recentIdeas: allIdeas.slice(0, 5),
  };
}
