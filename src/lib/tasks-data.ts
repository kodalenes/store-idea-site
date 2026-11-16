import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { getRequestAuth, getRequestProfiles } from "@/lib/studio-data";
import type {
  Idea,
  Milestone,
  MilestoneWithStats,
  Profile,
  Subtask,
  Task,
  TaskBoardItem,
} from "@/types/studio";

export interface TasksBoardData {
  isConfigured: boolean;
  currentUserId: string | null;
  tasks: TaskBoardItem[];
  teamProfiles: Profile[];
  milestones: Milestone[];
  ideas: Pick<Idea, "id" | "title">[];
}

export async function getTasksBoardData(): Promise<TasksBoardData> {
  "use cache: private";
  cacheTag("studio:tasks", "studio:milestones", "studio:ideas");
  cacheLife({ stale: 300, revalidate: 60, expire: 300 });

  const { isConfigured, supabase, user } = await getRequestAuth();
  if (!isConfigured || !supabase || !user) {
    return {
      isConfigured,
      currentUserId: null,
      tasks: [],
      teamProfiles: [],
      milestones: [],
      ideas: [],
    };
  }

  const [
    tasksRes,
    subtasksRes,
    commentsRes,
    attachmentsRes,
    teamProfiles,
    milestonesRes,
    ideasRes,
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select(
        "id, title, description_md, kind, status, priority, ue_tags, assignee_id, reporter_id, milestone_id, source_idea_id, blocked_by_task_id, bug_severity, repro_steps, build_version, position, created_at, updated_at"
      )
      .order("position", { ascending: true })
      .order("created_at", { ascending: false }),
    supabase
      .from("subtasks")
      .select("id, task_id, title, is_done, position, created_at")
      .order("position", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("comments")
      .select("target_id")
      .eq("target_type", "task"),
    supabase
      .from("attachments")
      .select("target_id")
      .eq("target_type", "task"),
    getRequestProfiles(),
    supabase
      .from("milestones")
      .select(
        "id, title, description, target_date, status, sort_order, created_by, created_at"
      )
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("ideas")
      .select("id, title")
      .order("updated_at", { ascending: false }),
  ]);

  const profileMap = new Map(teamProfiles.map((p) => [p.id, p]));

  const milestones = (milestonesRes.data ?? []) as Milestone[];
  const milestoneMap = new Map(
    milestones.map((m) => [m.id, { id: m.id, title: m.title }])
  );

  const ideas = (ideasRes.data ?? []) as Pick<Idea, "id" | "title">[];
  const ideaMap = new Map(ideas.map((i) => [i.id, { id: i.id, title: i.title }]));

  const subtasksByTask = new Map<string, Subtask[]>();
  for (const row of (subtasksRes.data ?? []) as Subtask[]) {
    const arr = subtasksByTask.get(row.task_id) ?? [];
    arr.push(row);
    subtasksByTask.set(row.task_id, arr);
  }

  const commentCountByTask = new Map<string, number>();
  for (const row of commentsRes.data ?? []) {
    commentCountByTask.set(
      row.target_id,
      (commentCountByTask.get(row.target_id) ?? 0) + 1
    );
  }

  const attachmentCountByTask = new Map<string, number>();
  for (const row of attachmentsRes.data ?? []) {
    attachmentCountByTask.set(
      row.target_id,
      (attachmentCountByTask.get(row.target_id) ?? 0) + 1
    );
  }

  const rawTasks = (tasksRes.data ?? []) as Task[];
  const taskLiteMap = new Map(
    rawTasks.map((t) => [t.id, { id: t.id, title: t.title, status: t.status }])
  );

  const tasks: TaskBoardItem[] = rawTasks.map((task) => ({
    ...task,
    ue_tags: Array.isArray(task.ue_tags) ? task.ue_tags : [],
    assignee: task.assignee_id ? profileMap.get(task.assignee_id) ?? null : null,
    reporter: task.reporter_id ? profileMap.get(task.reporter_id) ?? null : null,
    milestone: task.milestone_id
      ? milestoneMap.get(task.milestone_id) ?? null
      : null,
    source_idea: task.source_idea_id
      ? ideaMap.get(task.source_idea_id) ?? null
      : null,
    blocked_by_task: task.blocked_by_task_id
      ? taskLiteMap.get(task.blocked_by_task_id) ?? null
      : null,
    subtasks: subtasksByTask.get(task.id) ?? [],
    comment_count: commentCountByTask.get(task.id) ?? 0,
    attachment_count: attachmentCountByTask.get(task.id) ?? 0,
  }));

  return {
    isConfigured: true,
    currentUserId: user.id,
    tasks,
    teamProfiles,
    milestones,
    ideas,
  };
}

export async function getMilestonesPageData(): Promise<{
  isConfigured: boolean;
  milestones: MilestoneWithStats[];
  teamProfiles: Profile[];
}> {
  "use cache: private";
  cacheTag("studio:milestones", "studio:tasks");
  cacheLife({ stale: 300, revalidate: 60, expire: 300 });

  const { isConfigured, supabase, user } = await getRequestAuth();
  if (!isConfigured || !supabase || !user) {
    return { isConfigured, milestones: [], teamProfiles: [] };
  }

  const [milestonesRes, tasksRes, teamProfiles] = await Promise.all([
    supabase
      .from("milestones")
      .select(
        "id, title, description, target_date, status, sort_order, created_by, created_at"
      )
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("tasks")
      .select("id, title, status, priority, kind, assignee_id, milestone_id"),
    getRequestProfiles(),
  ]);

  const rawMilestones = (milestonesRes.data ?? []) as Milestone[];
  const rawTasks = (tasksRes.data ?? []) as (Pick<
    Task,
    "id" | "title" | "status" | "priority" | "kind" | "assignee_id"
  > & { milestone_id: string | null })[];

  const milestones: MilestoneWithStats[] = rawMilestones.map((m) => {
    const linked = rawTasks.filter((t) => t.milestone_id === m.id);
    const total = linked.length;
    const done = linked.filter((t) => t.status === "done").length;
    const inProgress = linked.filter(
      (t) => t.status === "in_progress" || t.status === "testing"
    ).length;
    const openBugs = linked.filter(
      (t) => t.kind === "bug" && t.status !== "done"
    ).length;
    const progressPercent = total > 0 ? Math.round((done / total) * 100) : 0;

    return {
      ...m,
      total_tasks: total,
      done_tasks: done,
      in_progress_tasks: inProgress,
      open_bugs: openBugs,
      progress_percent: progressPercent,
      tasks: linked.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        kind: t.kind,
        assignee_id: t.assignee_id,
      })),
    };
  });

  return {
    isConfigured: true,
    milestones,
    teamProfiles,
  };
}
