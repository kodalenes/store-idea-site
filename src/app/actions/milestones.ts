"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { MilestoneStatus } from "@/types/studio";

export interface MilestoneActionResult {
  ok: boolean;
  error?: string;
}

const milestoneSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "Milestone adı en az 2 karakter olmalı.")
    .max(80),
  description: z.string().trim().max(500),
  target_date: z.string().trim().nullable(),
  status: z.enum(["planned", "active", "completed"]),
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

export async function createMilestoneAction(input: {
  title: string;
  description: string;
  target_date: string | null;
  status: MilestoneStatus;
}): Promise<MilestoneActionResult> {
  const parsed = milestoneSchema.safeParse(input);
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

  const { error } = await supabase.from("milestones").insert({
    title: parsed.data.title,
    description: parsed.data.description,
    target_date: parsed.data.target_date || null,
    status: parsed.data.status,
    created_by: user.id,
  });

  if (error) return { ok: false, error: error.message };

  updateTag("studio:milestones");
  updateTag("studio:tasks");
  updateTag("studio:dashboard");
  revalidatePath("/milestones");
  revalidatePath("/tasks");
  revalidatePath("/");
  return { ok: true };
}

export async function updateMilestoneAction(
  id: string,
  input: {
    title: string;
    description: string;
    target_date: string | null;
    status: MilestoneStatus;
  }
): Promise<MilestoneActionResult> {
  const parsed = milestoneSchema.safeParse(input);
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
    .from("milestones")
    .update({
      title: parsed.data.title,
      description: parsed.data.description,
      target_date: parsed.data.target_date || null,
      status: parsed.data.status,
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  updateTag("studio:milestones");
  updateTag("studio:tasks");
  updateTag("studio:dashboard");
  revalidatePath("/milestones");
  revalidatePath("/tasks");
  return { ok: true };
}

export async function deleteMilestoneAction(
  id: string
): Promise<MilestoneActionResult> {
  const { supabase, user, error: authError } = await requireAuthSupabase();
  if (!supabase || !user) {
    return { ok: false, error: authError ?? "Yetkisiz." };
  }

  const { error } = await supabase.from("milestones").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  updateTag("studio:milestones");
  updateTag("studio:tasks");
  updateTag("studio:dashboard");
  revalidatePath("/milestones");
  revalidatePath("/tasks");
  return { ok: true };
}
