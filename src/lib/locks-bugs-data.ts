import "server-only";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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
  const { isConfigured } = getSupabaseConfig();
  if (!isConfigured) {
    return {
      isConfigured: false,
      currentUserId: null,
      locks: [],
      teamProfiles: [],
    };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      isConfigured: false,
      currentUserId: null,
      locks: [],
      teamProfiles: [],
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      isConfigured: true,
      currentUserId: null,
      locks: [],
      teamProfiles: [],
    };
  }

  const [locksRes, profilesRes] = await Promise.all([
    supabase
      .from("asset_locks")
      .select("*")
      .order("locked_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: true }),
  ]);

  const teamProfiles = (profilesRes.data ?? []) as Profile[];
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
  const { isConfigured } = getSupabaseConfig();
  if (!isConfigured) {
    return {
      isConfigured: false,
      currentUserId: null,
      bugs: [],
      teamProfiles: [],
      milestones: [],
    };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      isConfigured: false,
      currentUserId: null,
      bugs: [],
      teamProfiles: [],
      milestones: [],
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      isConfigured: true,
      currentUserId: null,
      bugs: [],
      teamProfiles: [],
      milestones: [],
    };
  }

  const [bugsRes, subtasksRes, commentsRes, attachmentsRes, profilesRes, milestonesRes] =
    await Promise.all([
      supabase
        .from("tasks")
        .select("*")
        .eq("kind", "bug")
        .order("created_at", { ascending: false }),
      supabase
        .from("subtasks")
        .select("*")
        .order("position", { ascending: true }),
      supabase
        .from("comments")
        .select("id, target_id")
        .eq("target_type", "task"),
      supabase
        .from("attachments")
        .select("id, target_id")
        .eq("target_type", "task"),
      supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: true }),
      supabase
        .from("milestones")
        .select("*")
        .order("sort_order", { ascending: true }),
    ]);

  const teamProfiles = (profilesRes.data ?? []) as Profile[];
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
