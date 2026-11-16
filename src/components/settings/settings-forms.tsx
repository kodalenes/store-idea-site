"use client";

import { useState } from "react";
import { UserCog, Sliders, CheckCircle2, AlertCircle, Send } from "lucide-react";
import {
  sendDiscordTestAction,
  updateMyProfileAction,
  updateWorkspaceSettingsAction,
  type SettingsActionState,
} from "@/app/actions/settings";
import { AVATAR_COLORS, TEAM_ROLES_PRESETS } from "@/lib/constants";
import { useStudioStore } from "@/components/studio/studio-store";
import type { Profile, WorkspaceSettings } from "@/types/studio";

export function SettingsForms() {
  const {
    isConfigured,
    currentProfile,
    workspace,
    setWorkspace,
    teamProfiles,
    setTeamProfiles,
  } = useStudioStore();

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
                  <p className="truncate font-mono text-[11px] text-zinc-500">
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
    </div>
  );
}
