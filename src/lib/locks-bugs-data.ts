import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { getRequestAuth, getRequestProfiles } from "@/lib/studio-data";
import type {
  AssetLock,
  AssetLockWithProfile,
  Milestone,
  Profile,
  Subtask,
  Task,
  TaskBoardItem,
} from "@/types/studio";

export async function getAssetLocksData(): Promise<{
  isConfigured: boolean;
  currentUserId: string | null;
  locks: AssetLockWithProfile[];
  teamProfiles: Profile[];
}> {
  "use cache: private";
  cacheTag("studio:locks");
  cacheLife({ stale: 300, revalidate: 60, expire: 300 });

  const { isConfigured, supabase, user } = await getRequestAuth();
  if (!isConfigured || !supabase || !user) {
    return {
      isConfigured,
      currentUserId: null,
      locks: [],
      teamProfiles: [],
    };
  }

  const [locksRes, teamProfiles] = await Promise.all([
    supabase
      .from("asset_locks")
      .select("id, asset_path, lock_type, locked_by, note, locked_at")
      .order("locked_at", { ascending: false }),
    getRequestProfiles(),
  ]);

  const profileMap = new Map(teamProfiles.map((p) => [p.id, p]));

  const locks: AssetLockWithProfile[] = ((locksRes.data ?? []) as AssetLock[]).map(
    (lock) => ({
      ...lock,
      owner: profileMap.get(lock.locked_by) ?? null,
    })
  );

  return {
    isConfigured: true,
    currentUserId: user.id,
    locks,
    teamProfiles,
  };
}

export async function getBugsPageData(): Promise<{
  isConfigured: boolean;
  currentUserId: string | null;
  bugs: TaskBoardItem[];
  teamProfiles: Profile[];
  milestones: Milestone[];
}> {
  "use cache: private";
  cacheTag("studio:bugs", "studio:tasks", "studio:milestones");
  cacheLife({ stale: 300, revalidate: 60, expire: 300 });

  const { isConfigured, supabase, user } = await getRequestAuth();
  if (!isConfigured || !supabase || !user) {
    return {
      isConfigured,
      currentUserId: null,
      bugs: [],
      teamProfiles: [],
      milestones: [],
    };
  }

  const [
    bugsRes,
    subtasksRes,
    commentsRes,
    attachmentsRes,
    teamProfiles,
    milestonesRes,
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select(
        "id, title, description_md, kind, status, priority, ue_tags, assignee_id, reporter_id, milestone_id, source_idea_id, blocked_by_task_id, bug_severity, repro_steps, build_version, position, created_at, updated_at"
      )
      .eq("kind", "bug")
      .order("created_at", { ascending: false }),
    supabase
      .from("subtasks")
      .select("id, task_id, title, is_done, position, created_at")
      .order("position", { ascending: true }),
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
      .order("sort_order", { ascending: true }),
  ]);

  const profileMap = new Map(teamProfiles.map((p) => [p.id, p]));
  const milestones = (milestonesRes.data ?? []) as Milestone[];
  const milestoneMap = new Map(
    milestones.map((m) => [m.id, { id: m.id, title: m.title }])
  );

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

  const bugs: TaskBoardItem[] = ((bugsRes.data ?? []) as Task[]).map((task) => ({
    ...task,
    ue_tags: Array.isArray(task.ue_tags) ? task.ue_tags : [],
    assignee: task.assignee_id ? profileMap.get(task.assignee_id) ?? null : null,
    reporter: task.reporter_id ? profileMap.get(task.reporter_id) ?? null : null,
    milestone: task.milestone_id
      ? milestoneMap.get(task.milestone_id) ?? null
      : null,
    source_idea: null,
    blocked_by_task: null,
    subtasks: subtasksByTask.get(task.id) ?? [],
    comment_count: commentCountByTask.get(task.id) ?? 0,
    attachment_count: attachmentCountByTask.get(task.id) ?? 0,
  }));

  return {
    isConfigured: true,
    currentUserId: user.id,
    bugs,
    teamProfiles,
    milestones,
  };
}
