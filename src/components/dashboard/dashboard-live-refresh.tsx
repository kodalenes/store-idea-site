"use client";

import { useRealtimeRefresh } from "@/lib/use-realtime-refresh";

export function DashboardLiveRefresh() {
  useRealtimeRefresh("dashboard-live", [
    { table: "tasks" },
    { table: "ideas" },
    { table: "asset_locks" },
    { table: "milestones" },
  ]);

  return null;
}
