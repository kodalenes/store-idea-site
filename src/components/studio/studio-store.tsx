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

export type TaskBoardViewMode = "kanban" | "compact" | "list";

function isTaskBoardViewMode(
  value: string | null
): value is TaskBoardViewMode {
  return value === "kanban" || value === "compact" || value === "list";
}

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
  tasksViewMode: TaskBoardViewMode;
  setTasksViewMode: Dispatch<SetStateAction<TaskBoardViewMode>>;
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
  const [tasksViewMode, setTasksViewModeState] =
    useState<TaskBoardViewMode>("kanban");

  const setTasksViewMode: Dispatch<SetStateAction<TaskBoardViewMode>> =
    useCallback((next) => {
      setTasksViewModeState((prev) => {
        const resolved = typeof next === "function" ? next(prev) : next;
        try {
          window.localStorage.setItem("studio-tasks-view", resolved);
        } catch {
          // localStorage erisim hatasinda sessiz kal
        }
        return resolved;
      });
    }, []);

  // Tarayici geri/ileri (popstate), gorunum tercihi ve URL ?milestone= senkronizasyonu
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
      try {
        const savedView = window.localStorage.getItem("studio-tasks-view");
        if (isTaskBoardViewMode(savedView)) {
          setTasksViewModeState(savedView);
        }
      } catch {
        // localStorage erisim hatasinda sessiz kal
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
      tasksViewMode,
      setTasksViewMode,
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
      tasksViewMode,
      setTasksViewMode,
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
