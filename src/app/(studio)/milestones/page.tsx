import { Suspense } from "react";
import { SetupBanner } from "@/components/ui/setup-banner";
import { MilestonesView } from "@/components/milestones/milestones-view";
import { getMilestonesPageData } from "@/lib/tasks-data";

async function MilestonesContent() {
  const data = await getMilestonesPageData();

  return (
    <div className="space-y-6">
      {!data.isConfigured && <SetupBanner />}
      <MilestonesView
        milestones={data.milestones}
        teamProfiles={data.teamProfiles}
        isConfigured={data.isConfigured}
      />
    </div>
  );
}

export default function MilestonesPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <div className="h-10 w-64 animate-pulse rounded-lg bg-[#10141d]" />
          <div className="h-44 animate-pulse rounded-xl bg-[#10141d]" />
          <div className="h-44 animate-pulse rounded-xl bg-[#10141d]" />
        </div>
      }
    >
      <MilestonesContent />
    </Suspense>
  );
}
