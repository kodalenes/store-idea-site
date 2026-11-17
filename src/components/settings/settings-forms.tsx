"use client";

import { useState, useSyncExternalStore } from "react";
import {
  UserCog,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Send,
  Trash2,
  HardDrive,
  Copy,
  Check,
  Info,
} from "lucide-react";
import {
  resetWorkspaceDataAction,
  sendDiscordTestAction,
  sendDriveTestNotificationAction,
  updateMyProfileAction,
  updateWorkspaceSettingsAction,
  type SettingsActionState,
} from "@/app/actions/settings";
import { AVATAR_COLORS, TEAM_ROLES_PRESETS } from "@/lib/constants";
import { useStudioStore } from "@/components/studio/studio-store";
import type { DriveAssetEvent, Profile, WorkspaceSettings } from "@/types/studio";

const emptySubscribe = () => () => {};

function extractDriveFolderId(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "BURAYA_GOOGLE_DRIVE_KLASOR_ID_YAZIN";
  const match = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : trimmed;
}

export function SettingsForms() {
  const {
    isConfigured,
    currentProfile,
    workspace,
    setWorkspace,
    teamProfiles,
    setTeamProfiles,
    tasks,
    setTasks,
    ideas,
    setIdeas,
    milestones,
    setMilestones,
    setDriveEvents,
    driveFolderId,
    setDriveFolderId,
    driveFolderUrl,
  } = useStudioStore();

  const siteOrigin = useSyncExternalStore(
    emptySubscribe,
    () => window.location.origin,
    () => "https://SIZIN_SITE_ADRESINIZ"
  );

  const [prevProfileColor, setPrevProfileColor] = useState(
    currentProfile?.avatar_color
  );
  const [selectedColor, setSelectedColor] = useState(
    currentProfile?.avatar_color ?? AVATAR_COLORS[0]
  );
  if (prevProfileColor !== currentProfile?.avatar_color) {
    setPrevProfileColor(currentProfile?.avatar_color);
    if (currentProfile?.avatar_color) {
      setSelectedColor(currentProfile.avatar_color);
    }
  }

  const [profileState, setProfileState] = useState<SettingsActionState>(null);
  const [workspaceState, setWorkspaceState] =
    useState<SettingsActionState>(null);

  const [discordTestStatus, setDiscordTestStatus] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [testingDiscord, setTestingDiscord] = useState(false);

  const [resetStatus, setResetStatus] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [resettingDb, setResettingDb] = useState(false);

  const [driveSecretInput, setDriveSecretInput] = useState(
    "ue5-studio-drive-secret"
  );
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedVersion, setCopiedVersion] = useState(false);
  const [driveTestStatus, setDriveTestStatus] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [testingDrive, setTestingDrive] = useState(false);

  const resolvedDriveFolderId = extractDriveFolderId(driveFolderId);
  const resolvedDriveSecret =
    driveSecretInput.trim() || "ue5-studio-drive-secret";
  const appsScriptCode = `const DRIVE_FOLDER_ID = "${resolvedDriveFolderId}";
const WEBHOOK_URL = "${siteOrigin}/api/webhooks/google-drive";
const WEBHOOK_SECRET = "${resolvedDriveSecret}";

function checkDriveFolderForNewAssets() {
  const props = PropertiesService.getScriptProperties();
  const nowMs = Date.now();
  const lastRaw = props.getProperty("LAST_CHECK_TIME");
  const sinceMs = lastRaw ? Number(lastRaw) : nowMs - 5 * 60 * 1000;

  const rootFolder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  const changedFiles = [];
  collectChangedFiles_(rootFolder, rootFolder.getName(), sinceMs, changedFiles);

  if (changedFiles.length === 0) {
    props.setProperty("LAST_CHECK_TIME", String(nowMs));
    return;
  }

  for (let i = 0; i < changedFiles.length; i += 15) {
    const batch = changedFiles.slice(i, i + 15);
    const res = UrlFetchApp.fetch(WEBHOOK_URL, {
      method: "post",
      contentType: "application/json",
      headers: { "x-drive-webhook-secret": WEBHOOK_SECRET },
      payload: JSON.stringify({ files: batch }),
      muteHttpExceptions: true,
    });
    if (res.getResponseCode() >= 300) {
      throw new Error("Webhook hatasi: HTTP " + res.getResponseCode() + " - " + res.getContentText());
    }
  }

  props.setProperty("LAST_CHECK_TIME", String(nowMs));
}

function collectChangedFiles_(folder, folderPath, sinceMs, out) {
  const files = folder.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    const createdMs = file.getDateCreated().getTime();
    const updatedMs = file.getLastUpdated().getTime();
    if (createdMs > sinceMs || updatedMs > sinceMs) {
      let ownerName = "Google Drive";
      try {
        const owner = file.getOwner();
        if (owner) ownerName = owner.getName() || owner.getEmail() || "Google Drive";
      } catch (e) {}

      out.push({
        id: file.getId(),
        name: file.getName(),
        mimeType: file.getMimeType(),
        size: file.getSize(),
        folderName: folderPath,
        url: file.getUrl() || folder.getUrl(),
        uploadedBy: ownerName,
        eventType: createdMs > sinceMs ? "created" : "updated",
      });
    }
  }

  const subFolders = folder.getFolders();
  while (subFolders.hasNext()) {
    const sub = subFolders.next();
    collectChangedFiles_(sub, folderPath + " / " + sub.getName(), sinceMs, out);
  }
}`;

  async function handleCopyAppsScript() {
    try {
      await navigator.clipboard.writeText(appsScriptCode);
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 2000);
    } catch {
      // Kopyalama desteklenmiyorsa sessiz gec
    }
  }

  async function handleSendDriveTest() {
    setDriveTestStatus(null);
    setTestingDrive(true);

    const tempId = `temp-drive-${Date.now()}`;
    const optimisticEvent: DriveAssetEvent = {
      id: tempId,
      drive_file_id: tempId,
      file_name: "SM_HeroSword_HighPoly.fbx",
      mime_type: "application/octet-stream",
      file_size: 14820352,
      folder_name: "Meshes / Weapons",
      web_view_link: driveFolderUrl,
      uploaded_by_name: currentProfile?.display_name ?? "Ekip Üyesi",
      event_type: "created",
      created_at: new Date().toISOString(),
    };

    // 0 ms Optimistic UI (bildirim cani + canli toast + dashboard kartini hemen goster)
    setDriveEvents((prev) => [optimisticEvent, ...prev.slice(0, 24)]);

    try {
      const res = await sendDriveTestNotificationAction(driveFolderUrl);
      if (!res.ok) {
        setDriveEvents((prev) => prev.filter((ev) => ev.id !== tempId));
        setDriveTestStatus({ ok: false, message: res.message });
        return;
      }
      if (res.event) {
        const realEvent = res.event;
        setDriveEvents((prev) =>
          prev.map((ev) => (ev.id === tempId ? realEvent : ev))
        );
      }
      setDriveTestStatus({ ok: true, message: res.message });
    } catch {
      setDriveEvents((prev) => prev.filter((ev) => ev.id !== tempId));
      setDriveTestStatus({
        ok: false,
        message: "Bağlantı hatası: Test Drive bildirimi gönderilemedi.",
      });
    } finally {
      setTestingDrive(false);
    }
  }

  async function handleResetWorkspaceData() {
    if (
      !window.confirm(
        "Tüm görevler, bug raporları, fikirler, oylar, yorumlar, ek dosyalar ve roadmap sistemleri kalıcı olarak silinecek (hesaplar ve proje ayarları korunur). Emin misiniz?"
      )
    ) {
      return;
    }

    setResetStatus(null);
    setResettingDb(true);

    const prevTasks = tasks;
    const prevIdeas = ideas;
    const prevMilestones = milestones;

    setTasks([]);
    setIdeas([]);
    setMilestones([]);

    try {
      const res = await resetWorkspaceDataAction();
      if (!res.ok) {
        setTasks(prevTasks);
        setIdeas(prevIdeas);
        setMilestones(prevMilestones);
        setResetStatus({
          ok: false,
          message:
            res.error ?? "Veriler sıfırlanamadı, değişiklikler geri alındı.",
        });
        return;
      }

      setResetStatus({
        ok: true,
        message:
          "Tüm görev, bug, fikir, yorum ve sistem verileri veritabanından temizlendi.",
      });
    } catch {
      setTasks(prevTasks);
      setIdeas(prevIdeas);
      setMilestones(prevMilestones);
      setResetStatus({
        ok: false,
        message: "Bağlantı hatası: Sıfırlama işlemi geri alındı.",
      });
    } finally {
      setResettingDb(false);
    }
  }

  async function handleProfileSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!currentProfile) return;

    const formData = new FormData(e.currentTarget);
    const displayName = String(formData.get("displayName") ?? "").trim();
    const roleTitle = String(formData.get("roleTitle") ?? "").trim();
    const avatarColor = String(formData.get("avatarColor") ?? selectedColor);

    const prevTeam = teamProfiles;
    const prevColor = currentProfile.avatar_color;
    const optimisticProfile: Profile = {
      ...currentProfile,
      display_name: displayName || currentProfile.display_name,
      role_title: roleTitle || currentProfile.role_title,
      avatar_color: avatarColor,
      updated_at: new Date().toISOString(),
    };

    // 0 ms Optimistic UI
    setTeamProfiles((prev) =>
      prev.map((p) => (p.id === currentProfile.id ? optimisticProfile : p))
    );
    setProfileState({ success: "Profilin güncellendi." });

    try {
      const res = await updateMyProfileAction(null, formData);
      if (!res || res.error) {
        setTeamProfiles(prevTeam);
        setSelectedColor(prevColor);
        setProfileState({
          error: res?.error ?? "Profil güncellenemedi, değişiklik geri alındı.",
        });
        return;
      }
      setProfileState(res);
    } catch {
      setTeamProfiles(prevTeam);
      setSelectedColor(prevColor);
      setProfileState({
        error: "Bağlantı hatası: Profil değişikliği geri alındı.",
      });
    }
  }

  async function handleWorkspaceSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const studioName = String(formData.get("studioName") ?? "").trim();
    const projectName = String(formData.get("projectName") ?? "").trim();
    const ueVersion = String(formData.get("ueVersion") ?? "").trim();
    const discordWebhookUrl = String(
      formData.get("discordWebhookUrl") ?? ""
    ).trim();

    const prevWorkspace: WorkspaceSettings = workspace;

    // 0 ms Optimistic UI
    setWorkspace({
      ...workspace,
      studio_name: studioName || workspace.studio_name,
      project_name: projectName || workspace.project_name,
      ue_version: ueVersion || workspace.ue_version,
      discord_webhook_url: discordWebhookUrl || null,
      updated_at: new Date().toISOString(),
    });
    setWorkspaceState({ success: "Proje ve stüdyo ayarları kaydedildi." });

    try {
      const res = await updateWorkspaceSettingsAction(null, formData);
      if (!res || res.error) {
        setWorkspace(prevWorkspace);
        setWorkspaceState({
          error:
            res?.error ?? "Proje ayarları kaydedilemedi, değişiklik geri alındı.",
        });
        return;
      }
      setWorkspaceState(res);
    } catch {
      setWorkspace(prevWorkspace);
      setWorkspaceState({
        error: "Bağlantı hatası: Stüdyo ayarları değişikliği geri alındı.",
      });
    }
  }

  async function handleTestDiscord() {
    setTestingDiscord(true);
    setDiscordTestStatus(null);
    const res = await sendDiscordTestAction();
    setDiscordTestStatus(res);
    setTestingDiscord(false);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* My Profile Card */}
      <section className="rounded-xl border border-[#1f2735] bg-[#10141d] p-6">
        <div className="mb-5 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
            <UserCog className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-zinc-100">
              Profilim & UE5 Rolüm
            </h2>
            <p className="text-xs text-zinc-400">
              Görev kartlarında ve asset kilitlerinde görünecek bilgiler
            </p>
          </div>
        </div>

        {profileState?.error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{profileState.error}</span>
          </div>
        )}
        {profileState?.success && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>{profileState.success}</span>
          </div>
        )}

        <form onSubmit={handleProfileSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="displayName"
              className="block text-xs font-medium text-zinc-300"
            >
              Görünen İsim
            </label>
            <input
              id="displayName"
              name="displayName"
              type="text"
              required
              defaultValue={currentProfile?.display_name ?? ""}
              placeholder="Örn. Ahmet"
              className="w-full rounded-lg border border-[#242e40] bg-[#080a0f] px-3 py-2 text-sm text-zinc-100 focus:border-amber-500/60 focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="roleTitle"
              className="block text-xs font-medium text-zinc-300"
            >
              Uzmanlık / Rol
            </label>
            <input
              id="roleTitle"
              name="roleTitle"
              type="text"
              required
              list="role-presets"
              defaultValue={currentProfile?.role_title ?? TEAM_ROLES_PRESETS[0]}
              className="w-full rounded-lg border border-[#242e40] bg-[#080a0f] px-3 py-2 text-sm text-zinc-100 focus:border-amber-500/60 focus:outline-none"
            />
            <datalist id="role-presets">
              {TEAM_ROLES_PRESETS.map((preset) => (
                <option key={preset} value={preset} />
              ))}
            </datalist>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-zinc-300">
              Ekip Rengin
            </label>
            <input type="hidden" name="avatarColor" value={selectedColor} />
            <div className="flex flex-wrap gap-2.5">
              {AVATAR_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className={`h-8 w-8 rounded-full border-2 transition ${
                    selectedColor === color
                      ? "scale-110 border-white"
                      : "border-transparent opacity-75 hover:opacity-100"
                  }`}
                  style={{ backgroundColor: color }}
                  aria-label={`Renk ${color}`}
                />
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={!isConfigured || !currentProfile}
            className="rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Profili Kaydet
          </button>
        </form>
      </section>

      {/* Studio & Project Card */}
      <section className="rounded-xl border border-[#1f2735] bg-[#10141d] p-6">
        <div className="mb-5 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-400">
            <Sliders className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-zinc-100">
              Stüdyo & Oyun Projesi
            </h2>
            <p className="text-xs text-zinc-400">
              Proje adı, UE5 sürümü ve Discord bildirim kanalı
            </p>
          </div>
        </div>

        {workspaceState?.error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{workspaceState.error}</span>
          </div>
        )}
        {workspaceState?.success && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>{workspaceState.success}</span>
          </div>
        )}

        <form onSubmit={handleWorkspaceSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="studioName"
              className="block text-xs font-medium text-zinc-300"
            >
              Stüdyo / Ekip Adı
            </label>
            <input
              id="studioName"
              name="studioName"
              type="text"
              required
              defaultValue={workspace.studio_name}
              className="w-full rounded-lg border border-[#242e40] bg-[#080a0f] px-3 py-2 text-sm text-zinc-100 focus:border-cyan-500/60 focus:outline-none"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor="projectName"
                className="block text-xs font-medium text-zinc-300"
              >
                Oyun / Kod Adı
              </label>
              <input
                id="projectName"
                name="projectName"
                type="text"
                required
                defaultValue={workspace.project_name}
                className="w-full rounded-lg border border-[#242e40] bg-[#080a0f] px-3 py-2 text-sm text-zinc-100 focus:border-cyan-500/60 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="ueVersion"
                className="block text-xs font-medium text-zinc-300"
              >
                Unreal Engine Sürümü
              </label>
              <input
                id="ueVersion"
                name="ueVersion"
                type="text"
                required
                defaultValue={workspace.ue_version}
                placeholder="UE 5.5"
                className="w-full rounded-lg border border-[#242e40] bg-[#080a0f] px-3 py-2 font-mono text-sm text-zinc-100 focus:border-cyan-500/60 focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="discordWebhookUrl"
              className="block text-xs font-medium text-zinc-300"
            >
              Discord Webhook URL{" "}
              <span className="text-zinc-500">
                (Görev, bug, fikir ve kilit bildirimleri)
              </span>
            </label>
            <input
              id="discordWebhookUrl"
              name="discordWebhookUrl"
              type="url"
              defaultValue={workspace.discord_webhook_url ?? ""}
              placeholder="https://discord.com/api/webhooks/..."
              className="w-full rounded-lg border border-[#242e40] bg-[#080a0f] px-3 py-2 font-mono text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500/60 focus:outline-none"
            />
          </div>

          {discordTestStatus && (
            <div
              className={`rounded-lg border px-3 py-2 text-xs ${
                discordTestStatus.ok
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                  : "border-rose-500/30 bg-rose-500/10 text-rose-200"
              }`}
            >
              {discordTestStatus.message}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="submit"
              disabled={!isConfigured || !currentProfile}
              className="rounded-lg bg-cyan-500 px-4 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Proje Ayarlarını Kaydet
            </button>

            <button
              type="button"
              onClick={handleTestDiscord}
              disabled={testingDiscord || !isConfigured || !currentProfile}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#242e40] bg-[#0a0e15] px-3.5 py-2 text-xs font-medium text-zinc-200 transition hover:border-cyan-500/40 hover:text-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              {testingDiscord ? "Gönderiliyor..." : "Discord Test Gönder"}
            </button>
          </div>
        </form>
      </section>

      {/* Team Members Roster */}
      <section className="rounded-xl border border-[#1f2735] bg-[#10141d] p-6 lg:col-span-2">
        <h2 className="text-base font-semibold text-zinc-100">
          Kayıtlı Ekip Üyeleri ({teamProfiles.length}/3)
        </h2>
        <p className="mt-1 text-xs text-zinc-400">
          Dışarıdan kayıtları engellemek için{" "}
          <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-amber-300">
            ALLOWED_TEAM_EMAILS
          </code>{" "}
          ortam değişkenine 3 kişinin e-postasını ekleyebilirsin.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {teamProfiles.length > 0 ? (
            teamProfiles.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-3 rounded-xl border border-[#1d2534] bg-[#0b0f17] p-3.5"
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-zinc-950"
                  style={{ backgroundColor: member.avatar_color }}
                >
                  {member.display_name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-zinc-100">
                    {member.display_name}
                  </p>
                  <p className="truncate text-xs text-zinc-400">
                    {member.role_title}
                  </p>
                  <p className="truncate font-mono text-xs text-zinc-500">
                    {member.email}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-[#242e40] p-4 text-xs text-zinc-500 sm:col-span-3">
              Henüz kayıtlı ekip üyesi yok. Supabase bağlantısını tamamladıktan
              sonra ekip arkadaşların hesap oluşturduğunda burada listelenir.
            </div>
          )}
        </div>
      </section>

      {/* Google Drive Asset Notification Integration */}
      <section className="rounded-xl border border-cyan-500/25 bg-[#10141d] p-6 lg:col-span-2">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-400">
              <HardDrive className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-100">
                Google Drive Asset Bildirim Entegrasyonu
              </h2>
              <p className="text-xs text-zinc-400">
                Drive asset klasörünüze yeni dosya yüklendiğinde hem site içi
                bildirim çanına/ekranına hem Discord&apos;a otomatik bildirim
                düşürün.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={testingDrive || !isConfigured || !currentProfile}
            onClick={() => {
              void handleSendDriveTest();
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-3.5 py-2 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
            {testingDrive ? "Gönderiliyor..." : "Drive Test Bildirimi Gönder"}
          </button>
        </div>

        {driveTestStatus && (
          <div
            className={`mt-4 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
              driveTestStatus.ok
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                : "border-rose-500/30 bg-rose-500/10 text-rose-200"
            }`}
          >
            {driveTestStatus.ok ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            )}
            <span>{driveTestStatus.message}</span>
          </div>
        )}

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label
              htmlFor="driveFolderId"
              className="block text-xs font-medium text-zinc-300"
            >
              Google Drive Klasör Linki veya ID&apos;si
            </label>
            <input
              id="driveFolderId"
              type="text"
              value={driveFolderId}
              onChange={(e) => setDriveFolderId(e.target.value)}
              placeholder="https://drive.google.com/drive/folders/1AbC..."
              className="w-full rounded-lg border border-[#242e40] bg-[#080a0f] px-3 py-2 font-mono text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500/60 focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="driveSecret"
              className="block text-xs font-medium text-zinc-300"
            >
              Webhook Gizli Anahtarı (DRIVE_WEBHOOK_SECRET)
            </label>
            <input
              id="driveSecret"
              type="text"
              value={driveSecretInput}
              onChange={(e) => setDriveSecretInput(e.target.value)}
              placeholder="ue5-studio-drive-secret"
              className="w-full rounded-lg border border-[#242e40] bg-[#080a0f] px-3 py-2 font-mono text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500/60 focus:outline-none"
            />
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium text-zinc-300">
              Hazır Google Apps Script Kodu (Alt klasörler dahil tarar)
            </span>
            <button
              type="button"
              onClick={() => {
                void handleCopyAppsScript();
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#242e40] bg-[#0a0e15] px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-cyan-500/40 hover:text-cyan-300"
            >
              {copiedScript ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  Kopyalandı
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Kodu Kopyala
                </>
              )}
            </button>
          </div>

          <pre className="max-h-56 overflow-auto rounded-lg border border-[#1d2534] bg-[#080a0f] p-3 font-mono text-xs leading-relaxed text-zinc-300">
            <code>{appsScriptCode}</code>
          </pre>

          <ol className="list-inside list-decimal space-y-1 text-xs text-zinc-400">
            <li>
              Önce{" "}
              <code className="rounded bg-black/40 px-1 py-0.5 font-mono text-amber-300">
                supabase/migrations/002_drive_notifications.sql
              </code>{" "}
              dosyasını Supabase SQL Editor&apos;de bir kez çalıştırın.
            </li>
            <li>
              <code className="rounded bg-black/40 px-1 py-0.5 font-mono text-cyan-300">
                script.google.com
              </code>{" "}
              adresinde yeni proje açıp yukarıdaki kodu yapıştırın (gerçek Drive
              bildirimi için sitenin yayındaki URL&apos;i gerekir;{" "}
              <code className="rounded bg-black/40 px-1 py-0.5 font-mono text-zinc-300">
                localhost
              </code>{" "}
              yerine Vercel adresinizi kullanın).
            </li>
            <li>
              Soldan <strong>Tetikleyiciler (Triggers) → Tetikleyici Ekle</strong>{" "}
              menüsünden{" "}
              <code className="rounded bg-black/40 px-1 py-0.5 font-mono text-cyan-300">
                checkDriveFolderForNewAssets
              </code>{" "}
              fonksiyonunu <strong>Dakika zamanlayıcı → Her 1 dakikada bir</strong>{" "}
              olarak kaydedip Drive okuma iznini onaylayın.
            </li>
          </ol>
        </div>
      </section>

      {/* Database Data Reset Card */}
      <section className="rounded-xl border border-rose-500/25 bg-[#10141d] p-6 lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-zinc-100">
              Test & Proje Verilerini Sıfırla
            </h2>
            <p className="text-xs text-zinc-400">
              Eklenen tüm görevleri, bug raporlarını, fikirleri, yorumları,
              yüklenen medyaları ve roadmap sistemlerini temizler; ekip
              hesaplarını ve stüdyo ayarlarını korur.
            </p>
          </div>

          <button
            type="button"
            disabled={resettingDb || !isConfigured || !currentProfile}
            onClick={() => {
              void handleResetWorkspaceData();
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/15 px-4 py-2 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            {resettingDb ? "Temizleniyor..." : "Proje Verilerini Sıfırla"}
          </button>
        </div>

        {resetStatus && (
          <div
            className={`mt-4 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
              resetStatus.ok
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                : "border-rose-500/30 bg-rose-500/10 text-rose-200"
            }`}
          >
            {resetStatus.ok ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            )}
            <span>{resetStatus.message}</span>
          </div>
        )}
      </section>

      {/* Site Version & Build Info Card */}
      <section className="rounded-xl border border-[#1f2735] bg-[#10141d] p-6 lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-400">
              <Info className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-100">
                Site Sürümü & Sistem Bilgisi
              </h2>
              <p className="text-xs text-zinc-400">
                Şu anda açık olan derleme, commit ve altyapı sürüm bilgileri
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              const summary = `UE5 Studio Hub v${process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0"} (#${process.env.NEXT_PUBLIC_GIT_COMMIT ?? "local"}) • ${process.env.NEXT_PUBLIC_GIT_BRANCH ?? "main"} • Next.js ${process.env.NEXT_PUBLIC_NEXT_VERSION ?? "16.4.6"}`;
              void navigator.clipboard.writeText(summary).then(() => {
                setCopiedVersion(true);
                setTimeout(() => setCopiedVersion(false), 2000);
              });
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#242e40] bg-[#0a0e15] px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-cyan-500/40 hover:text-cyan-300"
          >
            {copiedVersion ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                Kopyalandı
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                Sürümü Kopyala
              </>
            )}
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-[#1d2534] bg-[#0b0f17] px-3.5 py-2.5">
            <p className="text-xs text-zinc-500">Uygulama Sürümü</p>
            <p className="mt-1 font-mono text-sm font-semibold text-amber-300">
              v{process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0"}{" "}
              <span className="text-xs font-normal text-zinc-400">
                (#{process.env.NEXT_PUBLIC_GIT_COMMIT ?? "local"})
              </span>
            </p>
          </div>

          <div className="rounded-lg border border-[#1d2534] bg-[#0b0f17] px-3.5 py-2.5">
            <p className="text-xs text-zinc-500">Ortam & Dal</p>
            <p className="mt-1 font-mono text-sm font-medium text-zinc-100">
              {process.env.NEXT_PUBLIC_GIT_BRANCH ?? "main"}{" "}
              <span className="text-xs text-cyan-300">
                · {process.env.NEXT_PUBLIC_DEPLOY_ENV ?? "local"}
              </span>
            </p>
          </div>

          <div className="rounded-lg border border-[#1d2534] bg-[#0b0f17] px-3.5 py-2.5">
            <p className="text-xs text-zinc-500">Altyapı</p>
            <p className="mt-1 font-mono text-sm font-medium text-zinc-100">
              Next.js {process.env.NEXT_PUBLIC_NEXT_VERSION ?? "16.4.6"}{" "}
              <span className="text-xs text-zinc-400">
                · React {process.env.NEXT_PUBLIC_REACT_VERSION ?? "19.3.0"}
              </span>
            </p>
          </div>

          <div className="rounded-lg border border-[#1d2534] bg-[#0b0f17] px-3.5 py-2.5">
            <p className="text-xs text-zinc-500">Son Derleme Zamanı</p>
            <p className="mt-1 font-mono text-sm font-medium text-zinc-200">
              {process.env.NEXT_PUBLIC_BUILD_TIME ?? "—"}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
