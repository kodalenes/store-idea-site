"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useEffect,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { useRealtimeRefresh } from "@/lib/use-realtime-refresh";
import type { StudioSnapshot } from "@/lib/workspace-snapshot";
import type {
  IdeaListItem,
  Milestone,
  Profile,
  TaskBoardItem,
  WorkspaceSettings,
} from "@/types/studio";

export type StudioTabPath =
  | "/"
  | "/tasks"
  | "/ideas"
  | "/bugs"
  | "/milestones"
  | "/settings";

const STUDIO_TAB_SET = new Set<string>([
  "/",
  "/tasks",
  "/ideas",
  "/bugs",
  "/milestones",
  "/settings",
]);

export function isStudioTabPath(path: string): path is StudioTabPath {
  return STUDIO_TAB_SET.has(path);
}

interface StudioStoreValue {
  isConfigured: boolean;
  currentUserId: string | null;
  userEmail: string | null;
  currentProfile: Profile | null;
  teamProfiles: Profile[];
  setTeamProfiles: Dispatch<SetStateAction<Profile[]>>;
  workspace: WorkspaceSettings;
  setWorkspace: Dispatch<SetStateAction<WorkspaceSettings>>;
  tasks: TaskBoardItem[];
  setTasks: Dispatch<SetStateAction<TaskBoardItem[]>>;
  ideas: IdeaListItem[];
  setIdeas: Dispatch<SetStateAction<IdeaListItem[]>>;
  milestones: Milestone[];
  setMilestones: Dispatch<SetStateAction<Milestone[]>>;
  activeTab: StudioTabPath;
  isOnTabRoute: boolean;
  tasksMilestoneFilter: string;
  setTasksMilestoneFilter: Dispatch<SetStateAction<string>>;
  navigateTab: (href: string, options?: { milestoneId?: string }) => void;
}

const StudioStoreContext = createContext<StudioStoreValue | null>(null);

export function StudioStoreProvider({
  initialSnapshot,
  children,
}: {
  initialSnapshot: StudioSnapshot;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [prevSnapshot, setPrevSnapshot] = useState(initialSnapshot);
  const [tasks, setTasks] = useState<TaskBoardItem[]>(initialSnapshot.tasks);
  const [ideas, setIdeas] = useState<IdeaListItem[]>(initialSnapshot.ideas);
  const [milestones, setMilestones] = useState<Milestone[]>(
    initialSnapshot.milestones
  );
  const [teamProfiles, setTeamProfiles] = useState<Profile[]>(
    initialSnapshot.teamProfiles
  );
  const [workspace, setWorkspace] = useState<WorkspaceSettings>(
    initialSnapshot.workspace
  );

  // Sunucu snapshot'i Realtime veya router.refresh() ile yenilendiginde store'u guncelle
  if (prevSnapshot !== initialSnapshot) {
    setPrevSnapshot(initialSnapshot);
    setTasks(initialSnapshot.tasks);
    setIdeas(initialSnapshot.ideas);
    setMilestones(initialSnapshot.milestones);
    setTeamProfiles(initialSnapshot.teamProfiles);
    setWorkspace(initialSnapshot.workspace);
  }

  const isOnTabRoute = isStudioTabPath(pathname);
  const [clientTab, setClientTab] = useState<StudioTabPath>(
    isStudioTabPath(pathname) ? pathname : "/"
  );
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    if (isStudioTabPath(pathname)) {
      setClientTab(pathname);
    }
  }

  const [tasksMilestoneFilter, setTasksMilestoneFilter] =
    useState<string>("all");

  // Tarayici geri/ileri (popstate) ve ilk URL ?milestone= parametresi senkronizasyonu
  useEffect(() => {
    function syncFromLocation() {
      const path = window.location.pathname;
      if (isStudioTabPath(path)) {
        setClientTab(path);
      }
      const params = new URLSearchParams(window.location.search);
      const ms = params.get("milestone");
      if (ms) {
        setTasksMilestoneFilter(ms);
      }
    }

    syncFromLocation();
    window.addEventListener("popstate", syncFromLocation);
    return () => window.removeEventListener("popstate", syncFromLocation);
  }, []);

  // Tek merkezi Realtime dinleyicisi (ekip arkadaslarinin yaptigi degisiklikleri ceker)
  useRealtimeRefresh("studio-global-live", [
    { table: "tasks" },
    { table: "subtasks" },
    { table: "ideas" },
    { table: "idea_votes" },
    { table: "milestones" },
  ]);

  const navigateTab = useCallback(
    (href: string, options?: { milestoneId?: string }) => {
      const [basePath, queryStr] = href.split("?");
      if (!isStudioTabPath(basePath)) {
        router.push(href);
        return;
      }

      if (!isStudioTabPath(window.location.pathname)) {
        router.push(href);
        return;
      }

      if (options?.milestoneId !== undefined) {
        setTasksMilestoneFilter(options.milestoneId);
      } else if (queryStr) {
        const params = new URLSearchParams(queryStr);
        const ms = params.get("milestone");
        if (ms) setTasksMilestoneFilter(ms);
      } else if (basePath === "/tasks" && clientTab !== "/tasks") {
        // Sadece normal Kanban gecislerinde filtre korunur
      }

      setClientTab(basePath);
      if (window.location.pathname + window.location.search !== href) {
        window.history.pushState(null, "", href);
      }
    },
    [clientTab, router]
  );

  const currentProfile = useMemo(() => {
    if (!initialSnapshot.userId) return initialSnapshot.currentProfile;
    return (
      teamProfiles.find((p) => p.id === initialSnapshot.userId) ??
      initialSnapshot.currentProfile
    );
  }, [initialSnapshot.userId, initialSnapshot.currentProfile, teamProfiles]);

  const value = useMemo<StudioStoreValue>(
    () => ({
      isConfigured: initialSnapshot.isConfigured,
      currentUserId: initialSnapshot.userId,
      userEmail: initialSnapshot.userEmail,
      currentProfile,
      teamProfiles,
      setTeamProfiles,
      workspace,
      setWorkspace,
      tasks,
      setTasks,
      ideas,
      setIdeas,
      milestones,
      setMilestones,
      activeTab: isOnTabRoute ? clientTab : "/",
      isOnTabRoute,
      tasksMilestoneFilter,
      setTasksMilestoneFilter,
      navigateTab,
    }),
    [
      initialSnapshot.isConfigured,
      initialSnapshot.userId,
      initialSnapshot.userEmail,
      currentProfile,
      teamProfiles,
      workspace,
      tasks,
      ideas,
      milestones,
      isOnTabRoute,
      clientTab,
      tasksMilestoneFilter,
      navigateTab,
    ]
  );

  return (
    <StudioStoreContext.Provider value={value}>
      {children}
    </StudioStoreContext.Provider>
  );
}

export function useStudioStore() {
  const ctx = useContext(StudioStoreContext);
  if (!ctx) {
    throw new Error("useStudioStore must be used inside StudioStoreProvider");
  }
  return ctx;
}
