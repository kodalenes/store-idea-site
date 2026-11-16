import { Suspense, type ReactNode } from "react";
import { StudioShellLoader } from "@/components/shell/studio-shell-loader";

function ShellFallback() {
  return (
    <div className="flex min-h-screen bg-[#080a0f]">
      <div className="hidden w-68 border-r border-[#1f2735] bg-[#0c1018] lg:block" />
      <div className="flex-1 p-8">
        <div className="mx-auto max-w-6xl space-y-4">
          <div className="h-8 w-56 animate-pulse rounded-lg bg-[#151b26]" />
          <div className="h-36 animate-pulse rounded-xl bg-[#10141d]" />
        </div>
      </div>
    </div>
  );
}

export default function StudioLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<ShellFallback />}>
      <StudioShellLoader>{children}</StudioShellLoader>
    </Suspense>
  );
}
