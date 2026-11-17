"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { queueDiscordNotification } from "@/lib/discord";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { IdeaCategory, IdeaStatus, TaskPriority } from "@/types/studio";

function revalidateIdeasCache(ideaId?: string) {
  updateTag("studio:ideas");
  updateTag("studio:dashboard");
  if (ideaId) {
    updateTag(`idea:${ideaId}`);
    revalidatePath(`/ideas/${ideaId}`);
  }
  revalidatePath("/ideas");
  revalidatePath("/");
}

export interface ActionResult<T = undefined> {
  ok: boolean;
  error?: string;
  data?: T;
}

const referenceLinkSchema = z.object({
  label: z.string().trim().min(1).max(80),
  url: z.string().trim().url("Geçerli bir URL girin (https://...)"),
});

const ideaPayloadSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "Başlık en az 2 karakter olmalı.")
    .max(120, "Başlık en fazla 120 karakter olabilir."),
  summary: z.string().trim().max(300, "Kısa özet en fazla 300 karakter olabilir."),
  content_md: z.string().trim().max(20000),
  category: z.enum([
    "mechanic",
    "lore",
    "level",
    "vfx",
    "audio",
    "ui",
    "system",
  ]),
  status: z.enum(["raw", "discussing", "approved", "shelved"]),
  reference_links: z.array(referenceLinkSchema).max(12),
});

const convertToTaskSchema = z.object({
  ideaId: z.string().uuid(),
  title: z.string().trim().min(2, "Görev başlığı en az 2 karakter olmalı.").max(140),
  description_md: z.string().trim().max(10000),
  priority: z.enum(["low", "medium", "high", "critical"]),
  ue_tags: z.array(z.string().trim().min(1)).max(8),
  assignee_id: z.string().uuid().nullable(),
  milestone_id: z.string().uuid().nullable(),
});

async function requireAuthSupabase() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { supabase: null, user: null, error: "Supabase yapılandırılmamış." };
  }
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) {
    return { supabase: null, user: null, error: "Oturum bulunamadı." };
  }
  return { supabase, user: session.user, error: null };
}

export async function createIdeaAction(input: {
  title: string;
  summary: string;
  content_md: string;
  category: IdeaCategory;
  status: IdeaStatus;
  reference_links: { label: string; url: string }[];
}): Promise<ActionResult<{ id: string; created_at: string }>> {
  const parsed = ideaPayloadSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Form verisi geçersiz.",
    };
  }

  const { supabase, user, error: authError } = await requireAuthSupabase();
  if (!supabase || !user) {
    return { ok: false, error: authError ?? "Yetkisiz." };
  }

  const { data, error } = await supabase
    .from("ideas")
    .insert({
      title: parsed.data.title,
      summary: parsed.data.summary,
      content_md: parsed.data.content_md,
      category: parsed.data.category,
      status: parsed.data.status,
      reference_links: parsed.data.reference_links,
      created_by: user.id,
    })
    .select("id, created_at")
    .single();

  if (error || !data) {
    return {
      ok: false,
      error: error?.message ?? "Fikir oluşturulamadı.",
    };
  }

  queueDiscordNotification({
    title: `💡 Yeni Fikir: ${parsed.data.title}`,
    description: parsed.data.summary || undefined,
    color: 0xf59e0b,
    fields: [
      { name: "Kategori", value: parsed.data.category, inline: true },
      { name: "Durum", value: parsed.data.status, inline: true },
    ],
  });

  revalidateIdeasCache(data.id);
  return { ok: true, data: { id: data.id, created_at: data.created_at } };
}

export async function updateIdeaAction(
  ideaId: string,
  input: {
    title: string;
    summary: string;
    content_md: string;
    category: IdeaCategory;
    status: IdeaStatus;
    reference_links: { label: string; url: string }[];
  }
): Promise<ActionResult> {
  const parsed = ideaPayloadSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Form verisi geçersiz.",
    };
  }

  const { supabase, user, error: authError } = await requireAuthSupabase();
  if (!supabase || !user) {
    return { ok: false, error: authError ?? "Yetkisiz." };
  }

  const { error } = await supabase
    .from("ideas")
    .update({
      title: parsed.data.title,
      summary: parsed.data.summary,
      content_md: parsed.data.content_md,
      category: parsed.data.category,
      status: parsed.data.status,
      reference_links: parsed.data.reference_links,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ideaId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidateIdeasCache(ideaId);
  return { ok: true };
}

export async function updateIdeaStatusAction(
  ideaId: string,
  status: IdeaStatus
): Promise<ActionResult> {
  const { supabase, user, error: authError } = await requireAuthSupabase();
  if (!supabase || !user) {
    return { ok: false, error: authError ?? "Yetkisiz." };
  }

  const { data: updatedIdea, error } = await supabase
    .from("ideas")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", ideaId)
    .select("title")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  if (status === "approved" && updatedIdea) {
    queueDiscordNotification({
      title: `✨ Fikir Tam Sürüm Hedefine Alındı: ${updatedIdea.title}`,
      description: "Ekip bu fikri çıkış sürümü (v1.0) kapsamına ekledi!",
      color: 0x10b981,
    });
  }

  revalidateIdeasCache(ideaId);
  return { ok: true };
}

export async function deleteIdeaAction(ideaId: string): Promise<void> {
  const { supabase, user } = await requireAuthSupabase();
  if (!supabase || !user) return;

  await Promise.all([
    supabase
      .from("comments")
      .delete()
      .eq("target_type", "idea")
      .eq("target_id", ideaId),
    supabase
      .from("attachments")
      .delete()
      .eq("target_type", "idea")
      .eq("target_id", ideaId),
  ]);

  await supabase.from("ideas").delete().eq("id", ideaId);

  revalidateIdeasCache();
  redirect("/ideas");
}

export async function toggleIdeaVoteAction(
  ideaId: string
): Promise<ActionResult<{ voted: boolean }>> {
  const { supabase, user, error: authError } = await requireAuthSupabase();
  if (!supabase || !user) {
    return { ok: false, error: authError ?? "Yetkisiz." };
  }

  const { data: existing } = await supabase
    .from("idea_votes")
    .select("idea_id")
    .eq("idea_id", ideaId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("idea_votes")
      .delete()
      .eq("idea_id", ideaId)
      .eq("user_id", user.id);
    if (error) return { ok: false, error: error.message };
    revalidateIdeasCache(ideaId);
    return { ok: true, data: { voted: false } };
  }

  const { error } = await supabase
    .from("idea_votes")
    .insert({ idea_id: ideaId, user_id: user.id });

  if (error) return { ok: false, error: error.message };

  revalidateIdeasCache(ideaId);
  return { ok: true, data: { voted: true } };
}

export async function addIdeaCommentAction(
  ideaId: string,
  body: string
): Promise<ActionResult> {
  const clean = body.trim();
  if (clean.length < 1 || clean.length > 4000) {
    return { ok: false, error: "Yorum boş veya çok uzun." };
  }

  const { supabase, user, error: authError } = await requireAuthSupabase();
  if (!supabase || !user) {
    return { ok: false, error: authError ?? "Yetkisiz." };
  }

  const { error } = await supabase.from("comments").insert({
    target_type: "idea",
    target_id: ideaId,
    author_id: user.id,
    body: clean,
  });

  if (error) return { ok: false, error: error.message };

  revalidateIdeasCache(ideaId);
  return { ok: true };
}

export async function deleteIdeaCommentAction(
  ideaId: string,
  commentId: string
): Promise<ActionResult> {
  const { supabase, user, error: authError } = await requireAuthSupabase();
  if (!supabase || !user) {
    return { ok: false, error: authError ?? "Yetkisiz." };
  }

  const { error } = await supabase
    .from("comments")
    .delete()
    .eq("id", commentId);

  if (error) return { ok: false, error: error.message };

  revalidateIdeasCache(ideaId);
  return { ok: true };
}

export async function registerIdeaAttachmentAction(input: {
  ideaId: string;
  fileName: string;
  filePath: string;
  publicUrl: string;
  mimeType: string;
  fileSize: number;
}): Promise<ActionResult> {
  const { supabase, user, error: authError } = await requireAuthSupabase();
  if (!supabase || !user) {
    return { ok: false, error: authError ?? "Yetkisiz." };
  }

  const { error } = await supabase.from("attachments").insert({
    target_type: "idea",
    target_id: input.ideaId,
    file_name: input.fileName,
    file_path: input.filePath,
    public_url: input.publicUrl,
    mime_type: input.mimeType,
    file_size: input.fileSize,
    uploaded_by: user.id,
  });

  if (error) return { ok: false, error: error.message };

  revalidateIdeasCache(input.ideaId);
  return { ok: true };
}

export async function deleteIdeaAttachmentAction(
  ideaId: string,
  attachmentId: string,
  filePath: string
): Promise<ActionResult> {
  const { supabase, user, error: authError } = await requireAuthSupabase();
  if (!supabase || !user) {
    return { ok: false, error: authError ?? "Yetkisiz." };
  }

  await supabase.storage.from("studio-media").remove([filePath]);
  const { error } = await supabase
    .from("attachments")
    .delete()
    .eq("id", attachmentId);

  if (error) return { ok: false, error: error.message };

  revalidateIdeasCache(ideaId);
  return { ok: true };
}

export async function convertIdeaToTaskAction(input: {
  ideaId: string;
  title: string;
  description_md: string;
  priority: TaskPriority;
  ue_tags: string[];
  assignee_id: string | null;
  milestone_id: string | null;
}): Promise<ActionResult<{ taskId: string }>> {
  const parsed = convertToTaskSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Görev bilgileri geçersiz.",
    };
  }

  const { supabase, user, error: authError } = await requireAuthSupabase();
  if (!supabase || !user) {
    return { ok: false, error: authError ?? "Yetkisiz." };
  }

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      title: parsed.data.title,
      description_md: parsed.data.description_md,
      kind: "task",
      status: "todo",
      priority: parsed.data.priority,
      ue_tags: parsed.data.ue_tags,
      assignee_id: parsed.data.assignee_id,
      reporter_id: user.id,
      milestone_id: parsed.data.milestone_id,
      source_idea_id: parsed.data.ideaId,
    })
    .select("id")
    .single();

  if (error || !data) {
    return {
      ok: false,
      error: error?.message ?? "Görev oluşturulamadı.",
    };
  }

  queueDiscordNotification({
    title: `🚀 Fikirden Göreve Dönüştürüldü: ${parsed.data.title}`,
    color: 0x06b6d4,
    fields: [
      { name: "Öncelik", value: parsed.data.priority.toUpperCase(), inline: true },
      ...(parsed.data.ue_tags.length > 0
        ? [{ name: "UE5 Etiketleri", value: parsed.data.ue_tags.join(", ") }]
        : []),
    ],
  });

  updateTag("studio:tasks");
  updateTag("studio:milestones");
  revalidateIdeasCache(parsed.data.ideaId);
  revalidatePath("/tasks");
  revalidatePath("/milestones");
  return { ok: true, data: { taskId: data.id } };
}
