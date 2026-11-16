"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { sendDiscordNotification } from "@/lib/discord";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AssetLockType } from "@/types/studio";

export interface LockActionResult<T = undefined> {
  ok: boolean;
  error?: string;
  data?: T;
}

const lockSchema = z.object({
  asset_path: z
    .string()
    .trim()
    .min(2, "Asset veya Level yolu en az 2 karakter olmalı.")
    .max(220, "Dosya yolu en fazla 220 karakter olabilir."),
  lock_type: z.enum([
    "level",
    "blueprint",
    "mesh",
    "animation",
    "material",
    "other",
  ]),
  note: z.string().trim().max(240),
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

export async function lockAssetAction(input: {
  asset_path: string;
  lock_type: AssetLockType;
  note: string;
}): Promise<LockActionResult<{ id: string; locked_at: string }>> {
  const parsed = lockSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Kilit bilgileri geçersiz.",
    };
  }

  const { supabase, user, error: authError } = await requireAuthSupabase();
  if (!supabase || !user) {
    return { ok: false, error: authError ?? "Yetkisiz." };
  }

  const normalizedPath = parsed.data.asset_path.replaceAll("\\", "/");

  const { data: existing } = await supabase
    .from("asset_locks")
    .select("id, locked_by")
    .eq("asset_path", normalizedPath)
    .maybeSingle();

  if (existing) {
    return {
      ok: false,
      error: `"${normalizedPath}" zaten şu anda başka bir ekip üyesi tarafından kilitli!`,
    };
  }

  const { data, error } = await supabase
    .from("asset_locks")
    .insert({
      asset_path: normalizedPath,
      lock_type: parsed.data.lock_type,
      locked_by: user.id,
      note: parsed.data.note,
    })
    .select("id, locked_at")
    .single();

  if (error || !data) {
    return {
      ok: false,
      error: error?.message ?? "Asset kilitlenemedi.",
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  await sendDiscordNotification({
    title: `🔒 Asset Kilitlendi`,
    description: `\`${normalizedPath}\``,
    color: 0xf59e0b,
    fields: [
      {
        name: "Kilitleyen",
        value: profile?.display_name ?? user.email ?? "Ekip",
        inline: true,
      },
      ...(parsed.data.note
        ? [{ name: "Not", value: parsed.data.note, inline: true }]
        : []),
    ],
  });

  updateTag("studio:locks");
  updateTag("studio:dashboard");
  updateTag("studio:locks");
  revalidatePath("/locks");
  revalidatePath("/");
  return { ok: true, data: { id: data.id, locked_at: data.locked_at } };
}

export async function unlockAssetAction(
  lockId: string
): Promise<LockActionResult> {
  const { supabase, user, error: authError } = await requireAuthSupabase();
  if (!supabase || !user) {
    return { ok: false, error: authError ?? "Yetkisiz." };
  }

  const { error } = await supabase
    .from("asset_locks")
    .delete()
    .eq("id", lockId);

  if (error) {
    return { ok: false, error: error.message };
  }

  updateTag("studio:locks");
  updateTag("studio:dashboard");
  updateTag("studio:locks");
  revalidatePath("/locks");
  revalidatePath("/");
  return { ok: true };
}

export async function updateLockNoteAction(
  lockId: string,
  note: string
): Promise<LockActionResult> {
  const cleanNote = note.trim().slice(0, 240);
  const { supabase, user, error: authError } = await requireAuthSupabase();
  if (!supabase || !user) {
    return { ok: false, error: authError ?? "Yetkisiz." };
  }

  const { error } = await supabase
    .from("asset_locks")
    .update({ note: cleanNote })
    .eq("id", lockId);

  if (error) return { ok: false, error: error.message };

  updateTag("studio:locks");
  revalidatePath("/locks");
  return { ok: true };
}
