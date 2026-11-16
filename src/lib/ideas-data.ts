import "server-only";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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
  teamProfiles: Profile[];
  milestones: Milestone[];
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
  const { isConfigured } = getSupabaseConfig();
  if (!isConfigured) {
    return {
      isConfigured: false,
      currentUserId: null,
      ideas: [],
      teamProfiles: [],
      milestones: [],
    };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      isConfigured: false,
      currentUserId: null,
      ideas: [],
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
      ideas: [],
      teamProfiles: [],
      milestones: [],
    };
  }

  const [ideasRes, votesRes, commentsRes, attachmentsRes, tasksRes, profilesRes, milestonesRes] =
    await Promise.all([
      supabase.from("ideas").select("*").order("updated_at", { ascending: false }),
      supabase.from("idea_votes").select("idea_id, user_id"),
      supabase
        .from("comments")
        .select("id, target_id")
        .eq("target_type", "idea"),
      supabase
        .from("attachments")
        .select("id, target_id, public_url, mime_type")
        .eq("target_type", "idea")
        .order("created_at", { ascending: false }),
      supabase
        .from("tasks")
        .select("id, source_idea_id")
        .not("source_idea_id", "is", null),
      supabase.from("profiles").select("*").order("created_at", { ascending: true }),
      supabase.from("milestones").select("*").order("sort_order", { ascending: true }),
    ]);

  const teamProfiles = (profilesRes.data ?? []) as Profile[];
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

  const ideas: IdeaListItem[] = ((ideasRes.data ?? []) as Idea[]).map((idea) => {
    const voters = votesByIdea.get(idea.id) ?? new Set<string>();
    return {
      ...idea,
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
    teamProfiles,
    milestones: (milestonesRes.data ?? []) as Milestone[],
  };
}

export async function getIdeaDetailData(ideaId: string): Promise<{
  isConfigured: boolean;
  currentUserId: string | null;
  idea: IdeaDetail | null;
  teamProfiles: Profile[];
  milestones: Milestone[];
}> {
  const { isConfigured } = getSupabaseConfig();
  if (!isConfigured) {
    return {
      isConfigured: false,
      currentUserId: null,
      idea: null,
      teamProfiles: [],
      milestones: [],
    };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      isConfigured: false,
      currentUserId: null,
      idea: null,
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
      idea: null,
      teamProfiles: [],
      milestones: [],
    };
  }

  const [ideaRes, votesRes, commentsRes, attachmentsRes, tasksRes, profilesRes, milestonesRes] =
    await Promise.all([
      supabase.from("ideas").select("*").eq("id", ideaId).maybeSingle(),
      supabase.from("idea_votes").select("user_id").eq("idea_id", ideaId),
      supabase
        .from("comments")
        .select("*")
        .eq("target_type", "idea")
        .eq("target_id", ideaId)
        .order("created_at", { ascending: true }),
      supabase
        .from("attachments")
        .select("*")
        .eq("target_type", "idea")
        .eq("target_id", ideaId)
        .order("created_at", { ascending: false }),
      supabase
        .from("tasks")
        .select("id, title, status, priority, assignee_id, ue_tags")
        .eq("source_idea_id", ideaId)
        .order("created_at", { ascending: false }),
      supabase.from("profiles").select("*").order("created_at", { ascending: true }),
      supabase.from("milestones").select("*").order("sort_order", { ascending: true }),
    ]);

  const teamProfiles = (profilesRes.data ?? []) as Profile[];
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

  const comments: StudioComment[] = ((commentsRes.data ?? []) as StudioComment[]).map(
    (comment) => ({
      ...comment,
      author: comment.author_id
        ? profileMap.get(comment.author_id) ?? null
        : null,
    })
  );

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
