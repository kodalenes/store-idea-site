import type { ReactNode } from "react";
import { getInitialStudioSnapshot } from "@/lib/workspace-snapshot";
import { StudioStoreProvider } from "@/components/studio/studio-store";
import { AppShell } from "./app-shell";

export async function StudioShellLoader({
  children,
}: {
  children: ReactNode;
}) {
  const snapshot = await getInitialStudioSnapshot();
  return (
    <StudioStoreProvider initialSnapshot={snapshot}>
      <AppShell>{children}</AppShell>
    </StudioStoreProvider>
  );
}
