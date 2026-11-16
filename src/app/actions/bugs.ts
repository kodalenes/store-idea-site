"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { queueDiscordNotification } from "@/lib/discord";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { BugSeverity, TaskPriority } from "@/types/studio";

export interface BugActionResult<T = undefined> {
  ok: boolean;
  error?: string;
  data?: T;
}

const createBugSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "Bug başlığı en az 2 karakter olmalı.")
    .max(140),
  description_md: z.string().trim().max(10000),
  bug_severity: z.enum(["crash", "gameplay", "visual", "audio", "minor"]),
  priority: z.enum(["low", "medium", "high", "critical"]),
  repro_steps: z.string().trim().max(5000),
  build_version: z.string().trim().max(60),
  ue_tags: z.array(z.string().trim().min(1)).max(10),
  assignee_id: z.string().uuid().nullable(),
  milestone_id: z.string().uuid().nullable(),
});

export async function createBugAction(input: {
  title: string;
  description_md: string;
  bug_severity: BugSeverity;
  priority: TaskPriority;
  repro_steps: string;
  build_version: string;
  ue_tags: string[];
  assignee_id: string | null;
  milestone_id: string | null;
}): Promise<BugActionResult<{ id: string; created_at: string }>> {
  const parsed = createBugSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Bug bilgileri geçersiz.",
    };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Supabase yapılandırılmamış." };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) {
    return { ok: false, error: "Oturum bulunamadı." };
  }

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      title: parsed.data.title,
      description_md: parsed.data.description_md,
      kind: "bug",
      status: "todo",
      priority: parsed.data.priority,
      ue_tags: parsed.data.ue_tags,
      assignee_id: parsed.data.assignee_id,
      reporter_id: user.id,
      milestone_id: parsed.data.milestone_id,
      bug_severity: parsed.data.bug_severity,
      repro_steps: parsed.data.repro_steps,
      build_version: parsed.data.build_version,
    })
    .select("id, created_at")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Bug raporu oluşturulamadı." };
  }

  queueDiscordNotification({
    title: `🐞 Yeni Bug: ${parsed.data.title}`,
    description: parsed.data.repro_steps
      ? parsed.data.repro_steps.slice(0, 300)
      : undefined,
    color: parsed.data.bug_severity === "crash" ? 0xf43f5e : 0xf59e0b,
    fields: [
      {
        name: "Ciddiyet",
        value: parsed.data.bug_severity.toUpperCase(),
        inline: true,
      },
      {
        name: "Build",
        value: parsed.data.build_version || "Belirtilmedi",
        inline: true,
      },
    ],
  });

  updateTag("studio:bugs");
  updateTag("studio:tasks");
  updateTag("studio:milestones");
  updateTag("studio:dashboard");
  revalidatePath("/bugs");
  revalidatePath("/tasks");
  revalidatePath("/milestones");
  revalidatePath("/");
  return { ok: true, data: { id: data.id, created_at: data.created_at } };
}
