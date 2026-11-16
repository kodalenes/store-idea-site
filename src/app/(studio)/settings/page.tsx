import { Suspense } from "react";
import { SetupBanner } from "@/components/ui/setup-banner";
import { SettingsForms } from "@/components/settings/settings-forms";
import { getStudioContext } from "@/lib/studio-data";

async function SettingsContent() {
  const context = await getStudioContext();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
          Ayarlar & Ekip Yönetimi
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Kendi geliştirici profilini, Unreal Engine proje bilgilerini ve ekip
          üyelerini buradan yönetebilirsin.
        </p>
      </div>

      {!context.isConfigured && <SetupBanner />}

      <SettingsForms
        isConfigured={context.isConfigured}
        currentProfile={context.currentProfile}
        workspace={context.workspace}
        teamProfiles={context.teamProfiles}
      />
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="h-64 animate-pulse rounded-xl bg-[#10141d]" />
      }
    >
      <SettingsContent />
    </Suspense>
  );
}
