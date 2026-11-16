import "server-only";
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

export async function getStudioContext(): Promise<StudioSessionContext> {
  const { isConfigured } = getSupabaseConfig();

  if (!isConfigured) {
    return {
      isConfigured: false,
      userId: null,
      userEmail: null,
      currentProfile: null,
      teamProfiles: [],
      workspace: DEFAULT_WORKSPACE,
    };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      isConfigured: false,
      userId: null,
      userEmail: null,
      currentProfile: null,
      teamProfiles: [],
      workspace: DEFAULT_WORKSPACE,
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  const [{ data: profilesData }, { data: workspaceData }] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: true }),
    supabase
      .from("workspace_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle(),
  ]);

  const teamProfiles = (profilesData ?? []) as Profile[];
  const currentProfile =
    teamProfiles.find((profile) => profile.id === user.id) ?? null;

  return {
    isConfigured: true,
    userId: user.id,
    userEmail: user.email ?? null,
    currentProfile,
    teamProfiles,
    workspace: (workspaceData as WorkspaceSettings | null) ?? DEFAULT_WORKSPACE,
  };
}
