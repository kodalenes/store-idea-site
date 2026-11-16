import "server-only";
import { getRequestAuth, getRequestProfiles } from "@/lib/studio-data";
import type {
  Attachment,
  Idea,
  IdeaDetail,
  IdeaListItem,
  IdeaReferenceLink,
  Milestone,
  Profile,
  StudioComment,
  Task,
} from "@/types/studio";

export interface IdeasPageData {
  isConfigured: boolean;
  currentUserId: string | null;
  ideas: IdeaListItem[];
}

function normalizeLinks(raw: unknown): IdeaReferenceLink[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is IdeaReferenceLink =>
      Boolean(item) &&
      typeof item === "object" &&
      typeof (item as IdeaReferenceLink).url === "string" &&
      typeof (item as IdeaReferenceLink).label === "string"
  );
}

export async function getIdeasPageData(): Promise<IdeasPageData> {
  const { isConfigured, supabase, user } = await getRequestAuth();
  if (!isConfigured || !supabase || !user) {
    return {
      isConfigured,
      currentUserId: null,
      ideas: [],
    };
  }

  const [
    ideasRes,
    votesRes,
    commentsRes,
    attachmentsRes,
    tasksRes,
    teamProfiles,
  ] = await Promise.all([
    supabase
      .from("ideas")
      .select(
        "id, title, summary, category, status, reference_links, created_by, created_at, updated_at"
      )
      .order("updated_at", { ascending: false }),
    supabase.from("idea_votes").select("idea_id, user_id"),
    supabase.from("comments").select("target_id").eq("target_type", "idea"),
    supabase
      .from("attachments")
      .select("target_id, public_url, mime_type")
      .eq("target_type", "idea")
      .order("created_at", { ascending: false }),
    supabase
      .from("tasks")
      .select("source_idea_id")
      .not("source_idea_id", "is", null),
    getRequestProfiles(),
  ]);

  const profileMap = new Map(teamProfiles.map((p) => [p.id, p]));

  const votesByIdea = new Map<string, Set<string>>();
  for (const row of votesRes.data ?? []) {
    const set = votesByIdea.get(row.idea_id) ?? new Set<string>();
    set.add(row.user_id);
    votesByIdea.set(row.idea_id, set);
  }

  const commentCountByIdea = new Map<string, number>();
  for (const row of commentsRes.data ?? []) {
    commentCountByIdea.set(
      row.target_id,
      (commentCountByIdea.get(row.target_id) ?? 0) + 1
    );
  }

  const attachmentCountByIdea = new Map<string, number>();
  const previewImageByIdea = new Map<string, string>();
  for (const row of attachmentsRes.data ?? []) {
    attachmentCountByIdea.set(
      row.target_id,
      (attachmentCountByIdea.get(row.target_id) ?? 0) + 1
    );
    if (
      !previewImageByIdea.has(row.target_id) &&
      typeof row.mime_type === "string" &&
      row.mime_type.startsWith("image/")
    ) {
      previewImageByIdea.set(row.target_id, row.public_url);
    }
  }

  const linkedTaskCountByIdea = new Map<string, number>();
  for (const row of tasksRes.data ?? []) {
    if (row.source_idea_id) {
      linkedTaskCountByIdea.set(
        row.source_idea_id,
        (linkedTaskCountByIdea.get(row.source_idea_id) ?? 0) + 1
      );
    }
  }

  const ideas: IdeaListItem[] = (
    (ideasRes.data ?? []) as Omit<Idea, "content_md">[]
  ).map((idea) => {
    const voters = votesByIdea.get(idea.id) ?? new Set<string>();
    return {
      ...idea,
      content_md: "",
      reference_links: normalizeLinks(idea.reference_links),
      author: idea.created_by ? profileMap.get(idea.created_by) ?? null : null,
      vote_count: voters.size,
      has_voted: voters.has(user.id),
      comment_count: commentCountByIdea.get(idea.id) ?? 0,
      attachment_count: attachmentCountByIdea.get(idea.id) ?? 0,
      linked_task_count: linkedTaskCountByIdea.get(idea.id) ?? 0,
      preview_image_url: previewImageByIdea.get(idea.id) ?? null,
    };
  });

  return {
    isConfigured: true,
    currentUserId: user.id,
    ideas,
  };
}

export async function getIdeaDetailData(ideaId: string): Promise<{
  isConfigured: boolean;
  currentUserId: string | null;
  idea: IdeaDetail | null;
  teamProfiles: Profile[];
  milestones: Milestone[];
}> {
  const { isConfigured, supabase, user } = await getRequestAuth();
  if (!isConfigured || !supabase || !user) {
    return {
      isConfigured,
      currentUserId: null,
      idea: null,
      teamProfiles: [],
      milestones: [],
    };
  }

  const [
    ideaRes,
    votesRes,
    commentsRes,
    attachmentsRes,
    tasksRes,
    teamProfiles,
    milestonesRes,
  ] = await Promise.all([
    supabase
      .from("ideas")
      .select(
        "id, title, summary, content_md, category, status, reference_links, created_by, created_at, updated_at"
      )
      .eq("id", ideaId)
      .maybeSingle(),
    supabase.from("idea_votes").select("user_id").eq("idea_id", ideaId),
    supabase
      .from("comments")
      .select("id, target_type, target_id, author_id, body, created_at")
      .eq("target_type", "idea")
      .eq("target_id", ideaId)
      .order("created_at", { ascending: true }),
    supabase
      .from("attachments")
      .select(
        "id, target_type, target_id, file_name, file_path, public_url, mime_type, file_size, uploaded_by, created_at"
      )
      .eq("target_type", "idea")
      .eq("target_id", ideaId)
      .order("created_at", { ascending: false }),
    supabase
      .from("tasks")
      .select("id, title, status, priority, assignee_id, ue_tags")
      .eq("source_idea_id", ideaId)
      .order("created_at", { ascending: false }),
    getRequestProfiles(),
    supabase
      .from("milestones")
      .select("id, title, description, target_date, status, sort_order, created_by, created_at")
      .order("sort_order", { ascending: true }),
  ]);

  const profileMap = new Map(teamProfiles.map((p) => [p.id, p]));

  if (!ideaRes.data) {
    return {
      isConfigured: true,
      currentUserId: user.id,
      idea: null,
      teamProfiles,
      milestones: (milestonesRes.data ?? []) as Milestone[],
    };
  }

  const rawIdea = ideaRes.data as Idea;
  const voterIds = (votesRes.data ?? []).map((v) => v.user_id as string);
  const voterProfiles = voterIds
    .map((id) => profileMap.get(id))
    .filter((p): p is Profile => Boolean(p));

  const comments: StudioComment[] = (
    (commentsRes.data ?? []) as StudioComment[]
  ).map((comment) => ({
    ...comment,
    author: comment.author_id
      ? profileMap.get(comment.author_id) ?? null
      : null,
  }));

  const detail: IdeaDetail = {
    ...rawIdea,
    reference_links: normalizeLinks(rawIdea.reference_links),
    author: rawIdea.created_by ? profileMap.get(rawIdea.created_by) ?? null : null,
    vote_count: voterIds.length,
    has_voted: voterIds.includes(user.id),
    voter_profiles: voterProfiles,
    comments,
    attachments: (attachmentsRes.data ?? []) as Attachment[],
    linked_tasks: (tasksRes.data ?? []) as Pick<
      Task,
      "id" | "title" | "status" | "priority" | "assignee_id" | "ue_tags"
    >[],
  };

  return {
    isConfigured: true,
    currentUserId: user.id,
    idea: detail,
    teamProfiles,
    milestones: (milestonesRes.data ?? []) as Milestone[],
  };
}
