"use client";

import { startTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export interface RealtimeWatchTable {
  table: string;
  filter?: string;
}

/**
 * Birden fazla Supabase Realtime degisikligini 350ms penceresinde birlestirerek
 * gereksiz arka arkaya router.refresh() cagrilarini ve sunucu/bellek yukunu onler.
 */
export function useRealtimeRefresh(
  channelName: string,
  tables: RealtimeWatchTable[]
) {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tablesKey = JSON.stringify(tables);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;

    const parsedTables = JSON.parse(tablesKey) as RealtimeWatchTable[];
    const scheduleRefresh = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        startTransition(() => {
          router.refresh();
        });
      }, 350);
    };

    let channel = supabase.channel(channelName);
    for (const item of parsedTables) {
      channel = channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: item.table,
          ...(item.filter ? { filter: item.filter } : {}),
        },
        scheduleRefresh
      );
    }

    channel.subscribe();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      supabase.removeChannel(channel);
    };
  }, [channelName, tablesKey, router]);
}
