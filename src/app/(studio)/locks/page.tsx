import { Suspense } from "react";
import { SetupBanner } from "@/components/ui/setup-banner";
import { AssetLocksBoard } from "@/components/locks/asset-locks-board";
import { getAssetLocksData } from "@/lib/locks-bugs-data";

async function LocksContent() {
  const data = await getAssetLocksData();

  return (
    <div className="space-y-6">
      {!data.isConfigured && <SetupBanner />}
      <AssetLocksBoard
        initialLocks={data.locks}
        teamProfiles={data.teamProfiles}
        currentUserId={data.currentUserId}
        isConfigured={data.isConfigured}
      />
    </div>
  );
}

export default function LocksPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <div className="h-10 w-64 animate-pulse rounded-lg bg-[#10141d]" />
          <div className="h-28 animate-pulse rounded-xl bg-[#10141d]" />
          <div className="grid gap-3 md:grid-cols-2">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-36 animate-pulse rounded-xl bg-[#10141d]"
              />
            ))}
          </div>
        </div>
      }
    >
      <LocksContent />
    </Suspense>
  );
}
