"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { sendDiscordNotification } from "@/lib/discord";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SettingsActionState = {
  error?: string;
  success?: string;
} | null;

const profileSchema = z.object({
  displayName: z
    .string()
    .min(2, "İsim en az 2 karakter olmalı.")
    .max(40, "İsim en fazla 40 karakter olabilir.")
    .trim(),
  roleTitle: z.string().min(2, "Rol alanı boş bırakılamaz.").max(60).trim(),
  avatarColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Geçerli bir renk kodu seçin."),
});

const workspaceSchema = z.object({
  studioName: z.string().min(2, "Stüdyo adı en az 2 karakter olmalı.").max(60).trim(),
  projectName: z.string().min(2, "Oyun/Proje adı en az 2 karakter olmalı.").max(60).trim(),
  ueVersion: z.string().min(2, "UE sürümü girin (ör. UE 5.5).").max(25).trim(),
  discordWebhookUrl: z
    .string()
    .trim()
    .refine(
      (val) =>
        val === "" ||
        val.startsWith("https://discord.com/api/webhooks/") ||
        val.startsWith("https://discordapp.com/api/webhooks/"),
      "Geçerli bir Discord Webhook URL'i girin veya boş bırakın."
    ),
});

export async function updateMyProfileAction(
  _prevState: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  const parsed = profileSchema.safeParse({
    displayName: formData.get("displayName"),
    roleTitle: formData.get("roleTitle"),
    avatarColor: formData.get("avatarColor"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Bilgileri kontrol edin." };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { error: "Supabase bağlantısı henüz yapılandırılmamış." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Oturum bulunamadı. Lütfen tekrar giriş yapın." };
  }

  const { error } = await supabase
    .from("profiles")
    .upsert({
      id: user.id,
      email: user.email ?? "",
      display_name: parsed.data.displayName,
      role_title: parsed.data.roleTitle,
      avatar_color: parsed.data.avatarColor,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    return { error: `Profil güncellenemedi: ${error.message}` };
  }

  updateTag("studio:context");
  revalidatePath("/", "layout");
  return { success: "Profilin güncellendi." };
}

export async function updateWorkspaceSettingsAction(
  _prevState: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  const parsed = workspaceSchema.safeParse({
    studioName: formData.get("studioName"),
    projectName: formData.get("projectName"),
    ueVersion: formData.get("ueVersion"),
    discordWebhookUrl: formData.get("discordWebhookUrl") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ayarları kontrol edin." };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { error: "Supabase bağlantısı henüz yapılandırılmamış." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Oturum bulunamadı." };
  }

  const { error } = await supabase.from("workspace_settings").upsert({
    id: 1,
    studio_name: parsed.data.studioName,
    project_name: parsed.data.projectName,
    ue_version: parsed.data.ueVersion,
    discord_webhook_url: parsed.data.discordWebhookUrl || null,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    return { error: `Proje ayarları kaydedilemedi: ${error.message}` };
  }

  updateTag("studio:context");
  revalidatePath("/", "layout");
  return { success: "Proje ayarları kaydedildi." };
}

export async function sendDiscordTestAction(): Promise<{
  ok: boolean;
  message: string;
}> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, message: "Supabase yapılandırılmamış." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "Oturum bulunamadı." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  const res = await sendDiscordNotification({
    title: "🔔 Discord Bildirim Testi Başarılı!",
    description:
      "UE5 Studio Hub bildirimleri artık bu kanala otomatik düşecek.",
    color: 0x22d3ee,
    fields: [
      {
        name: "Testi Gönderen",
        value: profile?.display_name ?? user.email ?? "Ekip Üyesi",
        inline: true,
      },
    ],
  });

  if (!res.ok) {
    return {
      ok: false,
      message: res.error ?? "Test mesajı gönderilemedi.",
    };
  }

  return {
    ok: true,
    message: "Test mesajı Discord kanalına gönderildi!",
  };
}
