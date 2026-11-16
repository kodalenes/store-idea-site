import { Suspense } from "react";
import { SetupBanner } from "@/components/ui/setup-banner";
import { IdeasBoard } from "@/components/ideas/ideas-board";
import { getIdeasPageData } from "@/lib/ideas-data";

async function IdeasContent() {
  const data = await getIdeasPageData();

  return (
    <div className="space-y-6">
      {!data.isConfigured && <SetupBanner />}
      <IdeasBoard initialIdeas={data.ideas} isConfigured={data.isConfigured} />
    </div>
  );
}

export default function IdeasPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <div className="h-10 w-64 animate-pulse rounded-lg bg-[#10141d]" />
          <div className="h-32 animate-pulse rounded-xl bg-[#10141d]" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-56 animate-pulse rounded-xl bg-[#10141d]"
              />
            ))}
          </div>
        </div>
      }
    >
      <IdeasContent />
    </Suspense>
  );
}
