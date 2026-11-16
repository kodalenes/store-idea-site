"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sendDiscordNotification } from "@/lib/discord";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TaskPriority, TaskStatus } from "@/types/studio";

export interface TaskActionResult<T = undefined> {
  ok: boolean;
  error?: string;
  data?: T;
}

const taskPayloadSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "Görev başlığı en az 2 karakter olmalı.")
    .max(140, "Görev başlığı en fazla 140 karakter olabilir."),
  description_md: z.string().trim().max(15000),
  status: z.enum(["backlog", "todo", "in_progress", "testing", "done"]),
  priority: z.enum(["low", "medium", "high", "critical"]),
  ue_tags: z.array(z.string().trim().min(1)).max(10),
  assignee_id: z.string().uuid().nullable(),
  milestone_id: z.string().uuid().nullable(),
  source_idea_id: z.string().uuid().nullable(),
  blocked_by_task_id: z.string().uuid().nullable(),
});

async function requireAuthSupabase() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { supabase: null, user: null, error: "Supabase yapılandırılmamış." };
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { supabase: null, user: null, error: "Oturum bulunamadı." };
  }
  return { supabase, user, error: null };
}

function revalidateTaskViews() {
  revalidatePath("/tasks");
  revalidatePath("/milestones");
  revalidatePath("/");
}

export async function createTaskAction(input: {
  title: string;
  description_md: string;
  status: TaskStatus;
  priority: TaskPriority;
  ue_tags: string[];
  assignee_id: string | null;
  milestone_id: string | null;
  source_idea_id: string | null;
  blocked_by_task_id: string | null;
}): Promise<TaskActionResult<{ id: string }>> {
  const parsed = taskPayloadSchema.safeParse(input);
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
      status: parsed.data.status,
      priority: parsed.data.priority,
      ue_tags: parsed.data.ue_tags,
      assignee_id: parsed.data.assignee_id,
      reporter_id: user.id,
      milestone_id: parsed.data.milestone_id,
      source_idea_id: parsed.data.source_idea_id,
      blocked_by_task_id: parsed.data.blocked_by_task_id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Görev oluşturulamadı." };
  }

  let assigneeName = "Atanmadı";
  if (parsed.data.assignee_id) {
    const { data: assignee } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", parsed.data.assignee_id)
      .maybeSingle();
    if (assignee?.display_name) assigneeName = assignee.display_name;
  }

  await sendDiscordNotification({
    title: `🧩 Yeni Görev: ${parsed.data.title}`,
    color: 0x06b6d4,
    fields: [
      { name: "Atanan", value: assigneeName, inline: true },
      { name: "Öncelik", value: parsed.data.priority.toUpperCase(), inline: true },
      ...(parsed.data.ue_tags.length > 0
        ? [{ name: "UE5 Etiketleri", value: parsed.data.ue_tags.join(", ") }]
        : []),
    ],
  });

  revalidateTaskViews();
  return { ok: true, data: { id: data.id } };
}

export async function updateTaskAction(
  taskId: string,
  input: {
    title: string;
    description_md: string;
    status: TaskStatus;
    priority: TaskPriority;
    ue_tags: string[];
    assignee_id: string | null;
    milestone_id: string | null;
    source_idea_id: string | null;
    blocked_by_task_id: string | null;
  }
): Promise<TaskActionResult> {
  const parsed = taskPayloadSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Görev bilgileri geçersiz.",
    };
  }

  if (parsed.data.blocked_by_task_id === taskId) {
    return { ok: false, error: "Bir görev kendisini bekleyemez." };
  }

  const { supabase, user, error: authError } = await requireAuthSupabase();
  if (!supabase || !user) {
    return { ok: false, error: authError ?? "Yetkisiz." };
  }

  const { error } = await supabase
    .from("tasks")
    .update({
      title: parsed.data.title,
      description_md: parsed.data.description_md,
      status: parsed.data.status,
      priority: parsed.data.priority,
      ue_tags: parsed.data.ue_tags,
      assignee_id: parsed.data.assignee_id,
      milestone_id: parsed.data.milestone_id,
      source_idea_id: parsed.data.source_idea_id,
      blocked_by_task_id: parsed.data.blocked_by_task_id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidateTaskViews();
  return { ok: true };
}

export async function moveTaskStatusAction(
  taskId: string,
  status: TaskStatus
): Promise<TaskActionResult> {
  const { supabase, user, error: authError } = await requireAuthSupabase();
  if (!supabase || !user) {
    return { ok: false, error: authError ?? "Yetkisiz." };
  }

  const { data: updatedTask, error } = await supabase
    .from("tasks")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", taskId)
    .select("title, kind")
    .single();

  if (error) return { ok: false, error: error.message };

  if ((status === "testing" || status === "done") && updatedTask) {
    const label = status === "testing" ? "🧪 Test Bekliyor" : "✅ Tamamlandı";
    await sendDiscordNotification({
      title: `${label}: ${updatedTask.title}`,
      color: status === "testing" ? 0xa855f7 : 0x10b981,
    });
  }

  revalidateTaskViews();
  return { ok: true };
}

export async function deleteTaskAction(taskId: string): Promise<TaskActionResult> {
  const { supabase, user, error: authError } = await requireAuthSupabase();
  if (!supabase || !user) {
    return { ok: false, error: authError ?? "Yetkisiz." };
  }

  await Promise.all([
    supabase
      .from("comments")
      .delete()
      .eq("target_type", "task")
      .eq("target_id", taskId),
    supabase
      .from("attachments")
      .delete()
      .eq("target_type", "task")
      .eq("target_id", taskId),
  ]);

  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) return { ok: false, error: error.message };

  revalidateTaskViews();
  return { ok: true };
}

export async function addSubtaskAction(
  taskId: string,
  title: string
): Promise<TaskActionResult<{ id: string }>> {
  const clean = title.trim();
  if (clean.length < 1 || clean.length > 180) {
    return { ok: false, error: "Alt görev başlığı geçersiz." };
  }

  const { supabase, user, error: authError } = await requireAuthSupabase();
  if (!supabase || !user) {
    return { ok: false, error: authError ?? "Yetkisiz." };
  }

  const { data, error } = await supabase
    .from("subtasks")
    .insert({ task_id: taskId, title: clean, is_done: false })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Alt görev eklenemedi." };
  }

  revalidateTaskViews();
  return { ok: true, data: { id: data.id } };
}

export async function toggleSubtaskAction(
  subtaskId: string,
  isDone: boolean
): Promise<TaskActionResult> {
  const { supabase, user, error: authError } = await requireAuthSupabase();
  if (!supabase || !user) {
    return { ok: false, error: authError ?? "Yetkisiz." };
  }

  const { error } = await supabase
    .from("subtasks")
    .update({ is_done: isDone })
    .eq("id", subtaskId);

  if (error) return { ok: false, error: error.message };

  revalidateTaskViews();
  return { ok: true };
}

export async function deleteSubtaskAction(
  subtaskId: string
): Promise<TaskActionResult> {
  const { supabase, user, error: authError } = await requireAuthSupabase();
  if (!supabase || !user) {
    return { ok: false, error: authError ?? "Yetkisiz." };
  }

  const { error } = await supabase
    .from("subtasks")
    .delete()
    .eq("id", subtaskId);

  if (error) return { ok: false, error: error.message };

  revalidateTaskViews();
  return { ok: true };
}

export async function addTaskCommentAction(
  taskId: string,
  body: string
): Promise<TaskActionResult<{ id: string; created_at: string }>> {
  const clean = body.trim();
  if (clean.length < 1 || clean.length > 4000) {
    return { ok: false, error: "Yorum boş veya çok uzun." };
  }

  const { supabase, user, error: authError } = await requireAuthSupabase();
  if (!supabase || !user) {
    return { ok: false, error: authError ?? "Yetkisiz." };
  }

  const { data, error } = await supabase
    .from("comments")
    .insert({
      target_type: "task",
      target_id: taskId,
      author_id: user.id,
      body: clean,
    })
    .select("id, created_at")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Yorum eklenemedi." };
  }

  revalidateTaskViews();
  return { ok: true, data: { id: data.id, created_at: data.created_at } };
}

export async function deleteTaskCommentAction(
  commentId: string
): Promise<TaskActionResult> {
  const { supabase, user, error: authError } = await requireAuthSupabase();
  if (!supabase || !user) {
    return { ok: false, error: authError ?? "Yetkisiz." };
  }

  const { error } = await supabase
    .from("comments")
    .delete()
    .eq("id", commentId);

  if (error) return { ok: false, error: error.message };

  revalidateTaskViews();
  return { ok: true };
}

export async function registerTaskAttachmentAction(input: {
  taskId: string;
  fileName: string;
  filePath: string;
  publicUrl: string;
  mimeType: string;
  fileSize: number;
}): Promise<TaskActionResult> {
  const { supabase, user, error: authError } = await requireAuthSupabase();
  if (!supabase || !user) {
    return { ok: false, error: authError ?? "Yetkisiz." };
  }

  const { error } = await supabase.from("attachments").insert({
    target_type: "task",
    target_id: input.taskId,
    file_name: input.fileName,
    file_path: input.filePath,
    public_url: input.publicUrl,
    mime_type: input.mimeType,
    file_size: input.fileSize,
    uploaded_by: user.id,
  });

  if (error) return { ok: false, error: error.message };

  revalidateTaskViews();
  return { ok: true };
}

export async function deleteTaskAttachmentAction(
  attachmentId: string,
  filePath: string
): Promise<TaskActionResult> {
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

  revalidateTaskViews();
  return { ok: true };
}
