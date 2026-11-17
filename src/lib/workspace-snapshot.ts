import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { resolveIdeaStatusAndLinks } from "@/lib/constants";
import { getRequestAuth } from "@/lib/studio-data";
import type {
  DriveAssetEvent,
  Idea,
  IdeaListItem,
  Milestone,
  Profile,
  Subtask,
  Task,
  TaskBoardItem,
  WorkspaceSettings,
} from "@/types/studio";

export interface StudioSnapshot {
  isConfigured: boolean;
  userId: string | null;
  userEmail: string | null;
  currentProfile: Profile | null;
  teamProfiles: Profile[];
  workspace: WorkspaceSettings;
  tasks: TaskBoardItem[];
  ideas: IdeaListItem[];
  milestones: Milestone[];
  driveEvents: DriveAssetEvent[];
}

const DEFAULT_WORKSPACE: WorkspaceSettings = {
  id: 1,
  studio_name: "Indie UE5 Studio",
  project_name: "Project Phoenix",
  ue_version: "UE 5.5",
  discord_webhook_url: null,
  updated_at: new Date().toISOString(),
};

export async function getInitialStudioSnapshot(): Promise<StudioSnapshot> {
  "use cache: private";
  cacheTag(
    "studio:snapshot",
    "studio:context",
    "studio:dashboard",
    "studio:tasks",
    "studio:bugs",
    "studio:ideas",
    "studio:milestones"
  );
  cacheLife({ stale: 300, revalidate: 60, expire: 300 });

  const { isConfigured, supabase, user } = await getRequestAuth();

  if (!isConfigured || !supabase || !user) {
    return {
      isConfigured,
      userId: null,
      userEmail: null,
      currentProfile: null,
      teamProfiles: [],
      workspace: DEFAULT_WORKSPACE,
      tasks: [],
      ideas: [],
      milestones: [],
      driveEvents: [],
    };
  }

  const [
    profilesRes,
    workspaceRes,
    tasksRes,
    subtasksRes,
    commentsRes,
    attachmentsRes,
    milestonesRes,
    ideasRes,
    votesRes,
    driveEventsRes,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, email, display_name, role_title, avatar_color, avatar_url, created_at, updated_at"
      )
      .order("created_at", { ascending: true }),
    supabase
      .from("workspace_settings")
      .select("id, studio_name, project_name, ue_version, discord_webhook_url, updated_at")
      .eq("id", 1)
      .maybeSingle(),
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
    supabase.from("comments").select("target_type, target_id"),
    supabase
      .from("attachments")
      .select("target_type, target_id, public_url, mime_type")
      .order("created_at", { ascending: false }),
    supabase
      .from("milestones")
      .select(
        "id, title, description, target_date, status, sort_order, created_by, created_at"
      )
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("ideas")
      .select(
        "id, title, summary, category, status, reference_links, created_by, created_at, updated_at"
      )
      .order("updated_at", { ascending: false }),
    supabase.from("idea_votes").select("idea_id, user_id"),
    supabase
      .from("drive_events")
      .select(
        "id, drive_file_id, file_name, mime_type, file_size, folder_name, web_view_link, uploaded_by_name, event_type, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(25),
  ]);

  const teamProfiles = (profilesRes.data ?? []) as Profile[];
  const profileMap = new Map(teamProfiles.map((p) => [p.id, p]));
  const currentProfile = profileMap.get(user.id) ?? null;

  const milestones = (milestonesRes.data ?? []) as Milestone[];
  const milestoneMap = new Map(
    milestones.map((m) => [m.id, { id: m.id, title: m.title }])
  );

  const rawIdeas = (ideasRes.data ?? []) as Omit<Idea, "content_md">[];
  const ideaMap = new Map(
    rawIdeas.map((i) => [i.id, { id: i.id, title: i.title }])
  );

  const subtasksByTask = new Map<string, Subtask[]>();
  for (const row of (subtasksRes.data ?? []) as Subtask[]) {
    const arr = subtasksByTask.get(row.task_id) ?? [];
    arr.push(row);
    subtasksByTask.set(row.task_id, arr);
  }

  const taskCommentCounts = new Map<string, number>();
  const ideaCommentCounts = new Map<string, number>();
  for (const row of commentsRes.data ?? []) {
    if (row.target_type === "task") {
      taskCommentCounts.set(
        row.target_id,
        (taskCommentCounts.get(row.target_id) ?? 0) + 1
      );
    } else if (row.target_type === "idea") {
      ideaCommentCounts.set(
        row.target_id,
        (ideaCommentCounts.get(row.target_id) ?? 0) + 1
      );
    }
  }

  const taskAttachmentCounts = new Map<string, number>();
  const ideaAttachmentCounts = new Map<string, number>();
  const ideaPreviewImages = new Map<string, string>();
  for (const row of attachmentsRes.data ?? []) {
    if (row.target_type === "task") {
      taskAttachmentCounts.set(
        row.target_id,
        (taskAttachmentCounts.get(row.target_id) ?? 0) + 1
      );
    } else if (row.target_type === "idea") {
      ideaAttachmentCounts.set(
        row.target_id,
        (ideaAttachmentCounts.get(row.target_id) ?? 0) + 1
      );
      if (
        !ideaPreviewImages.has(row.target_id) &&
        typeof row.mime_type === "string" &&
        row.mime_type.startsWith("image/")
      ) {
        ideaPreviewImages.set(row.target_id, row.public_url);
      }
    }
  }

  const rawTasks = (tasksRes.data ?? []) as Task[];
  const taskLiteMap = new Map(
    rawTasks.map((t) => [t.id, { id: t.id, title: t.title, status: t.status }])
  );

  const linkedTaskCountByIdea = new Map<string, number>();
  for (const t of rawTasks) {
    if (t.source_idea_id) {
      linkedTaskCountByIdea.set(
        t.source_idea_id,
        (linkedTaskCountByIdea.get(t.source_idea_id) ?? 0) + 1
      );
    }
  }

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
    comment_count: taskCommentCounts.get(task.id) ?? 0,
    attachment_count: taskAttachmentCounts.get(task.id) ?? 0,
  }));

  const votesByIdea = new Map<string, Set<string>>();
  for (const row of votesRes.data ?? []) {
    const set = votesByIdea.get(row.idea_id) ?? new Set<string>();
    set.add(row.user_id);
    votesByIdea.set(row.idea_id, set);
  }

  const ideas: IdeaListItem[] = rawIdeas.map((idea) => {
    const voters = votesByIdea.get(idea.id) ?? new Set<string>();
    const resolved = resolveIdeaStatusAndLinks(
      idea.status,
      idea.reference_links
    );
    return {
      ...idea,
      status: resolved.status,
      content_md: "",
      reference_links: resolved.links,
      author: idea.created_by ? profileMap.get(idea.created_by) ?? null : null,
      vote_count: voters.size,
      has_voted: voters.has(user.id),
      comment_count: ideaCommentCounts.get(idea.id) ?? 0,
      attachment_count: ideaAttachmentCounts.get(idea.id) ?? 0,
      linked_task_count: linkedTaskCountByIdea.get(idea.id) ?? 0,
      preview_image_url: ideaPreviewImages.get(idea.id) ?? null,
    };
  });

  return {
    isConfigured: true,
    userId: user.id,
    userEmail: user.email ?? null,
    currentProfile,
    teamProfiles,
    workspace: (workspaceRes.data as WorkspaceSettings | null) ?? DEFAULT_WORKSPACE,
    tasks,
    ideas,
    milestones,
    driveEvents: (driveEventsRes.data ?? []) as DriveAssetEvent[],
  };
}
