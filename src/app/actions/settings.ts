"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import {
  queueDiscordNotification,
  sendDiscordNotification,
} from "@/lib/discord";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { DriveAssetEvent } from "@/types/studio";

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
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;

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
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;

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
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
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

export async function resetWorkspaceDataAction(): Promise<{
  ok: boolean;
  error?: string;
}> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Supabase yapılandırılmamış." };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) {
    return { ok: false, error: "Bu işlem için giriş yapmalısınız." };
  }

  const { data: attRows } = await supabase
    .from("attachments")
    .select("file_path");

  if (attRows && attRows.length > 0) {
    const paths = attRows.map((a) => a.file_path).filter(Boolean);
    if (paths.length > 0) {
      await supabase.storage.from("studio-media").remove(paths);
    }
  }

  const tablesWithId = [
    "attachments",
    "comments",
    "subtasks",
    "tasks",
    "ideas",
    "milestones",
  ] as const;

  // idea_votes bilesik anahtara sahip (idea_id, user_id)
  const { error: votesError } = await supabase
    .from("idea_votes")
    .delete()
    .not("idea_id", "is", null);

  if (votesError) {
    return {
      ok: false,
      error: `Fikir oyları silinemedi: ${votesError.message}`,
    };
  }

  for (const table of tablesWithId) {
    const { error } = await supabase.from(table).delete().not("id", "is", null);
    if (error) {
      return {
        ok: false,
        error: `${table} verileri temizlenemedi: ${error.message}`,
      };
    }
  }

  // Eski kurulumlardan kalan asset_locks ve drive_events tablolarini da temizle (yoksa sessiz gec)
  await supabase.from("asset_locks").delete().not("id", "is", null);
  await supabase.from("drive_events").delete().not("id", "is", null);

  updateTag("studio:snapshot");
  updateTag("studio:context");
  updateTag("studio:dashboard");
  updateTag("studio:tasks");
  updateTag("studio:bugs");
  updateTag("studio:ideas");
  updateTag("studio:milestones");
  revalidatePath("/", "layout");

  return { ok: true };
}

const DEFAULT_DRIVE_FOLDER_URL =
  "https://drive.google.com/drive/folders/1_eG_uHfIqArDnBMCAR_0ExyM8pcefctH";

export async function sendDriveTestNotificationAction(
  folderUrl?: string
): Promise<{
  ok: boolean;
  message: string;
  event?: DriveAssetEvent;
}> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, message: "Supabase yapılandırılmamış." };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) {
    return { ok: false, message: "Bu işlem için giriş yapmalısınız." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  const uploaderName =
    profile?.display_name ?? user.email?.split("@")[0] ?? "Ekip Üyesi";

  const trimmedFolderUrl = folderUrl?.trim() ?? "";
  const safeFolderUrl =
    trimmedFolderUrl.startsWith("https://drive.google.com/") &&
    trimmedFolderUrl !== "https://drive.google.com/"
      ? trimmedFolderUrl
      : DEFAULT_DRIVE_FOLDER_URL;

  // Daha once genel linkle olusmus test kayitlarini da dogru klasore guncelle
  await supabase
    .from("drive_events")
    .update({ web_view_link: safeFolderUrl })
    .eq("web_view_link", "https://drive.google.com");

  const { data: inserted, error } = await supabase
    .from("drive_events")
    .insert({
      drive_file_id: `test-${Date.now()}`,
      file_name: "SM_HeroSword_HighPoly.fbx",
      mime_type: "application/octet-stream",
      file_size: 14820352,
      folder_name: "Meshes / Weapons",
      web_view_link: safeFolderUrl,
      uploaded_by_name: uploaderName,
      event_type: "created",
    })
    .select("*")
    .single();

  if (error) {
    return {
      ok: false,
      message:
        "Drive tablosu henüz oluşturulmamış görünüyor. Lütfen supabase/migrations/002_drive_notifications.sql dosyasını Supabase SQL Editor'de çalıştırın.",
    };
  }

  updateTag("studio:snapshot");
  queueDiscordNotification({
    title: "📦 Test Drive Asset: SM_HeroSword_HighPoly.fbx",
    description: `[Google Drive Klasörünü Aç](${safeFolderUrl})`,
    color: 0x06b6d4,
    fields: [
      { name: "Klasör", value: "Meshes / Weapons", inline: true },
      { name: "Yükleyen", value: uploaderName, inline: true },
      { name: "Boyut", value: "14.1 MB", inline: true },
    ],
  });

  return {
    ok: true,
    message: "Test Drive asset bildirimi kaydedildi ve yayına alındı!",
    event: inserted as DriveAssetEvent,
  };
}

export async function clearDriveNotificationsAction(): Promise<{
  ok: boolean;
  error?: string;
}> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Supabase yapılandırılmamış." };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) {
    return { ok: false, error: "Oturum bulunamadı." };
  }

  const { error } = await supabase
    .from("drive_events")
    .delete()
    .not("id", "is", null);

  if (error) {
    return { ok: false, error: error.message };
  }

  updateTag("studio:snapshot");
  revalidatePath("/", "layout");
  return { ok: true };
}
