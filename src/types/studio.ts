export type IdeaCategory =
  | "mechanic"
  | "lore"
  | "level"
  | "vfx"
  | "audio"
  | "ui"
  | "system";

export type IdeaStatus = "raw" | "discussing" | "approved" | "shelved";

export type TaskKind = "task" | "bug";

export type TaskStatus =
  | "backlog"
  | "todo"
  | "in_progress"
  | "testing"
  | "done";

export type TaskPriority = "low" | "medium" | "high" | "critical";

export type BugSeverity = "crash" | "gameplay" | "visual" | "audio" | "minor";

export type MilestoneStatus = "planned" | "active" | "completed";

export interface Profile {
  id: string;
  email: string;
  display_name: string;
  role_title: string;
  avatar_color: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceSettings {
  id: number;
  studio_name: string;
  project_name: string;
  ue_version: string;
  discord_webhook_url: string | null;
  updated_at: string;
}

export interface Milestone {
  id: string;
  title: string;
  description: string;
  target_date: string | null;
  status: MilestoneStatus;
  sort_order: number;
  created_by: string | null;
  created_at: string;
}

export interface IdeaReferenceLink {
  label: string;
  url: string;
}

export interface Idea {
  id: string;
  title: string;
  summary: string;
  content_md: string;
  category: IdeaCategory;
  status: IdeaStatus;
  reference_links: IdeaReferenceLink[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface StudioComment {
  id: string;
  target_type: "idea" | "task";
  target_id: string;
  author_id: string | null;
  body: string;
  created_at: string;
  author?: Profile | null;
}

export interface Attachment {
  id: string;
  target_type: "idea" | "task";
  target_id: string;
  file_name: string;
  file_path: string;
  public_url: string;
  mime_type: string;
  file_size: number;
  uploaded_by: string | null;
  created_at: string;
}

export interface IdeaListItem extends Idea {
  author: Profile | null;
  vote_count: number;
  has_voted: boolean;
  comment_count: number;
  attachment_count: number;
  linked_task_count: number;
  preview_image_url: string | null;
}

export interface Task {
  id: string;
  title: string;
  description_md: string;
  kind: TaskKind;
  status: TaskStatus;
  priority: TaskPriority;
  ue_tags: string[];
  assignee_id: string | null;
  reporter_id: string | null;
  milestone_id: string | null;
  source_idea_id: string | null;
  blocked_by_task_id: string | null;
  bug_severity: BugSeverity | null;
  repro_steps: string;
  build_version: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface Subtask {
  id: string;
  task_id: string;
  title: string;
  is_done: boolean;
  position: number;
  created_at: string;
}

export interface IdeaDetail extends Idea {
  author: Profile | null;
  vote_count: number;
  has_voted: boolean;
  voter_profiles: Profile[];
  comments: StudioComment[];
  attachments: Attachment[];
  linked_tasks: Pick<
    Task,
    "id" | "title" | "status" | "priority" | "assignee_id" | "ue_tags"
  >[];
}

export interface TaskBoardItem extends Task {
  assignee: Profile | null;
  reporter: Profile | null;
  milestone: Pick<Milestone, "id" | "title"> | null;
  source_idea: Pick<Idea, "id" | "title"> | null;
  blocked_by_task: Pick<Task, "id" | "title" | "status"> | null;
  subtasks: Subtask[];
  comment_count: number;
  attachment_count: number;
}

export interface MilestoneWithStats extends Milestone {
  total_tasks: number;
  done_tasks: number;
  in_progress_tasks: number;
  open_bugs: number;
  progress_percent: number;
  tasks: Pick<
    Task,
    "id" | "title" | "status" | "priority" | "kind" | "assignee_id"
  >[];
}

