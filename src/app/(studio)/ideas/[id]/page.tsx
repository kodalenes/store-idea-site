import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getIdeaDetailData } from "@/lib/ideas-data";
import { IdeaDetailView } from "@/components/ideas/idea-detail-view";

async function IdeaDetailContent({ id }: { id: string }) {
  const data = await getIdeaDetailData(id);

  if (!data.idea || !data.currentUserId) {
    return (
      <div className="rounded-xl border border-[#1f2735] bg-[#10141d] p-8 text-center">
        <h1 className="text-lg font-semibold text-zinc-100">
          Fikir bulunamadı
        </h1>
        <p className="mt-1 text-xs text-zinc-400">
          Bu fikir silinmiş olabilir veya henüz erişim yetkin yok.
        </p>
        <Link
          href="/ideas"
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-zinc-950"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Fikirlere Dön
        </Link>
      </div>
    );
  }

  return (
    <IdeaDetailView
      initialIdea={data.idea}
      currentUserId={data.currentUserId}
      teamProfiles={data.teamProfiles}
      milestones={data.milestones}
    />
  );
}

export default async function IdeaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <div className="h-8 w-44 animate-pulse rounded-lg bg-[#10141d]" />
          <div className="h-96 animate-pulse rounded-xl bg-[#10141d]" />
        </div>
      }
    >
      <IdeaDetailContent id={id} />
    </Suspense>
  );
}
