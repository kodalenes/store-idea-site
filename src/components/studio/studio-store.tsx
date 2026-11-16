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
import { ExternalLink, HardDrive, X } from "lucide-react";
import { useRealtimeRefresh } from "@/lib/use-realtime-refresh";
import type { StudioSnapshot } from "@/lib/workspace-snapshot";
import type {
  DriveAssetEvent,
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
  driveEvents: DriveAssetEvent[];
  setDriveEvents: Dispatch<SetStateAction<DriveAssetEvent[]>>;
  unreadDriveCount: number;
  markDriveNotificationsRead: () => void;
  liveDriveToast: DriveAssetEvent | null;
  dismissDriveToast: () => void;
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
  const [driveEvents, setDriveEvents] = useState<DriveAssetEvent[]>(
    initialSnapshot.driveEvents
  );
  const [lastSeenDriveAt, setLastSeenDriveAt] = useState<string>("");
  const [liveDriveToast, setLiveDriveToast] =
    useState<DriveAssetEvent | null>(null);
  const [prevTopDriveId, setPrevTopDriveId] = useState<string | undefined>(
    initialSnapshot.driveEvents[0]?.id
  );

  // Sunucu snapshot'i Realtime veya router.refresh() ile yenilendiginde store'u guncelle
  if (prevSnapshot !== initialSnapshot) {
    setPrevSnapshot(initialSnapshot);
    setTasks(initialSnapshot.tasks);
    setIdeas(initialSnapshot.ideas);
    setMilestones(initialSnapshot.milestones);
    setTeamProfiles(initialSnapshot.teamProfiles);
    setWorkspace(initialSnapshot.workspace);
    setDriveEvents(initialSnapshot.driveEvents);
  }

  const latestDriveEvent = driveEvents[0];
  if (latestDriveEvent && latestDriveEvent.id !== prevTopDriveId) {
    setPrevTopDriveId(latestDriveEvent.id);
    setLiveDriveToast(latestDriveEvent);
  } else if (!latestDriveEvent && prevTopDriveId !== undefined) {
    setPrevTopDriveId(undefined);
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
        const savedSeen = window.localStorage.getItem(
          "studio-last-seen-drive-at"
        );
        if (savedSeen) {
          setLastSeenDriveAt(savedSeen);
        }
      } catch {
        // localStorage erisim hatasinda sessiz kal
      }
    }

    syncFromLocation();
    window.addEventListener("popstate", syncFromLocation);
    return () => window.removeEventListener("popstate", syncFromLocation);
  }, []);

  useEffect(() => {
    if (!liveDriveToast) return;
    const timer = setTimeout(() => {
      setLiveDriveToast(null);
    }, 6500);
    return () => clearTimeout(timer);
  }, [liveDriveToast]);

  // Tek merkezi Realtime dinleyicisi (ekip arkadaslarinin yaptigi degisiklikleri ve Drive olaylarini ceker)
  useRealtimeRefresh("studio-global-live", [
    { table: "tasks" },
    { table: "subtasks" },
    { table: "ideas" },
    { table: "idea_votes" },
    { table: "milestones" },
    { table: "drive_events" },
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

  const unreadDriveCount = useMemo(() => {
    if (driveEvents.length === 0) return 0;
    if (!lastSeenDriveAt) return driveEvents.length;
    const seenTs = Date.parse(lastSeenDriveAt);
    if (Number.isNaN(seenTs)) return driveEvents.length;
    return driveEvents.filter((ev) => Date.parse(ev.created_at) > seenTs).length;
  }, [driveEvents, lastSeenDriveAt]);

  const markDriveNotificationsRead = useCallback(() => {
    const latest = driveEvents[0]?.created_at ?? new Date().toISOString();
    setLastSeenDriveAt(latest);
    try {
      window.localStorage.setItem("studio-last-seen-drive-at", latest);
    } catch {
      // localStorage erisim hatasinda sessiz kal
    }
  }, [driveEvents]);

  const dismissDriveToast = useCallback(() => {
    setLiveDriveToast(null);
  }, []);

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
      driveEvents,
      setDriveEvents,
      unreadDriveCount,
      markDriveNotificationsRead,
      liveDriveToast,
      dismissDriveToast,
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
      driveEvents,
      unreadDriveCount,
      markDriveNotificationsRead,
      liveDriveToast,
      dismissDriveToast,
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
      {liveDriveToast && (
        <div className="fixed top-4 right-4 z-[70] w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-cyan-500/40 bg-[#0d131e]/95 p-3.5 shadow-2xl backdrop-blur-md">
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-300">
              <HardDrive className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-cyan-300">
                  {liveDriveToast.event_type === "updated"
                    ? "Drive Asset Güncellendi"
                    : "Yeni Drive Asset"}
                </span>
                <button
                  type="button"
                  onClick={dismissDriveToast}
                  className="rounded p-0.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                  aria-label="Bildirimi kapat"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="mt-0.5 truncate text-xs font-semibold text-zinc-100">
                {liveDriveToast.file_name}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-zinc-400">
                {liveDriveToast.folder_name} • {liveDriveToast.uploaded_by_name}
              </p>
              <a
                href={liveDriveToast.web_view_link}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-amber-300 hover:text-amber-200"
              >
                Google Drive&apos;da Aç
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      )}
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
