import type { ReactNode } from "react";
import { getStudioContext } from "@/lib/studio-data";
import { AppShell } from "./app-shell";

export async function StudioShellLoader({
  children,
}: {
  children: ReactNode;
}) {
  const context = await getStudioContext();
  return <AppShell context={context}>{children}</AppShell>;
}
