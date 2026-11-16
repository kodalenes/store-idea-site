import "server-only";
import { cache } from "react";
import { cacheLife, cacheTag } from "next/cache";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Profile, WorkspaceSettings } from "@/types/studio";

export interface StudioSessionContext {
  isConfigured: boolean;
  userId: string | null;
  userEmail: string | null;
  currentProfile: Profile | null;
  teamProfiles: Profile[];
  workspace: WorkspaceSettings;
}

const DEFAULT_WORKSPACE: WorkspaceSettings = {
  id: 1,
  studio_name: "Indie UE5 Studio",
  project_name: "Project Phoenix",
  ue_version: "UE 5.5",
  discord_webhook_url: null,
  updated_at: new Date().toISOString(),
};

/**
 * Tek bir HTTP istegi icinde Supabase istemcisini ve auth.getUser() sonucunu
 * React cache() ile tekillestirir (Layout + Sayfa arasinda cift sorgu atilmaz).
 */
export const getRequestAuth = cache(async () => {
  const { isConfigured } = getSupabaseConfig();
  if (!isConfigured) {
    return {
      isConfigured: false as const,
      supabase: null,
      user: null,
    };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      isConfigured: false as const,
      supabase: null,
      user: null,
    };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  return {
    isConfigured: true as const,
    supabase,
    user: session?.user ?? null,
  };
});

/**
 * Ekip profillerini istek basina tek bir sorguda getirir ve paylasir.
 */
export const getRequestProfiles = cache(async (): Promise<Profile[]> => {
  const { supabase, user } = await getRequestAuth();
  if (!supabase || !user) return [];

  const { data } = await supabase
    .from("profiles")
    .select(
      "id, email, display_name, role_title, avatar_color, avatar_url, created_at, updated_at"
    )
    .order("created_at", { ascending: true });

  return (data ?? []) as Profile[];
});

export const getStudioContext = cache(
  async (): Promise<StudioSessionContext> => {
    "use cache: private";
    cacheTag("studio:context");
    cacheLife({ stale: 300, revalidate: 60, expire: 300 });

    const { isConfigured, supabase, user } = await getRequestAuth();

    if (!isConfigured || !supabase) {
      return {
        isConfigured,
        userId: null,
        userEmail: null,
        currentProfile: null,
        teamProfiles: [],
        workspace: DEFAULT_WORKSPACE,
      };
    }

    if (!user) {
      return {
        isConfigured: true,
        userId: null,
        userEmail: null,
        currentProfile: null,
        teamProfiles: [],
        workspace: DEFAULT_WORKSPACE,
      };
    }

    const [teamProfiles, { data: workspaceData }] = await Promise.all([
      getRequestProfiles(),
      supabase
        .from("workspace_settings")
        .select("id, studio_name, project_name, ue_version, updated_at")
        .eq("id", 1)
        .maybeSingle(),
    ]);

    const currentProfile =
      teamProfiles.find((profile) => profile.id === user.id) ?? null;

    const workspace: WorkspaceSettings = workspaceData
      ? {
          ...workspaceData,
          discord_webhook_url: null,
        }
      : DEFAULT_WORKSPACE;

    return {
      isConfigured: true,
      userId: user.id,
      userEmail: user.email ?? null,
      currentProfile,
      teamProfiles,
      workspace,
    };
  }
);

export async function getWorkspaceSettingsFull(): Promise<WorkspaceSettings> {
  const { supabase, user } = await getRequestAuth();
  if (!supabase || !user) return DEFAULT_WORKSPACE;

  const { data } = await supabase
    .from("workspace_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  return (data as WorkspaceSettings | null) ?? DEFAULT_WORKSPACE;
}
