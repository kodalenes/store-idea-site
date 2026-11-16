import { Suspense } from "react";
import { SetupBanner } from "@/components/ui/setup-banner";
import { BugsBoard } from "@/components/bugs/bugs-board";
import { getBugsPageData } from "@/lib/locks-bugs-data";

async function BugsContent() {
  const data = await getBugsPageData();

  return (
    <div className="space-y-6">
      {!data.isConfigured && <SetupBanner />}
      <BugsBoard
        initialBugs={data.bugs}
        teamProfiles={data.teamProfiles}
        milestones={data.milestones}
        currentUserId={data.currentUserId}
        isConfigured={data.isConfigured}
      />
    </div>
  );
}

export default function BugsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <div className="h-10 w-64 animate-pulse rounded-lg bg-[#10141d]" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-xl bg-[#10141d]"
              />
            ))}
          </div>
          <div className="h-44 animate-pulse rounded-xl bg-[#10141d]" />
        </div>
      }
    >
      <BugsContent />
    </Suspense>
  );
}
