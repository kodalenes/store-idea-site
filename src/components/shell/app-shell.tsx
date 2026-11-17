"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Lightbulb,
  KanbanSquare,
  Flag,
  Bug,
  Settings,
  LogOut,
  Menu,
  X,
  Gamepad2,
  Bell,
  HardDrive,
  ExternalLink,
  Trash2,
  Check,
} from "lucide-react";
import { signOutAction } from "@/app/actions/auth";
import { clearDriveNotificationsAction } from "@/app/actions/settings";
import { useStudioStore } from "@/components/studio/studio-store";
import { SetupBanner } from "@/components/ui/setup-banner";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { KanbanBoard } from "@/components/tasks/kanban-board";
import { IdeasBoard } from "@/components/ideas/ideas-board";
import { BugsBoard } from "@/components/bugs/bugs-board";
import { MilestonesView } from "@/components/milestones/milestones-view";
import { SettingsForms } from "@/components/settings/settings-forms";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Genel Bakış", icon: LayoutDashboard },
  { href: "/tasks", label: "Görev Panosu", icon: KanbanSquare },
  { href: "/ideas", label: "Fikirler & GDD", icon: Lightbulb },
  { href: "/bugs", label: "Bug Raporları", icon: Bug },
  { href: "/milestones", label: "Roadmap & Sistemler", icon: Flag },
];

function formatDriveFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const {
    isConfigured,
    currentUserId,
    userEmail,
    currentProfile,
    teamProfiles,
    workspace,
    driveEvents,
    setDriveEvents,
    unreadDriveCount,
    markDriveNotificationsRead,
    driveFolderUrl,
    activeTab,
    isOnTabRoute,
    navigateTab,
  } = useStudioStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const effectivePath = isOnTabRoute ? activeTab : pathname;

  function handleBellToggle() {
    setNotificationsOpen((prev) => {
      const next = !prev;
      if (next) {
        markDriveNotificationsRead();
      }
      return next;
    });
  }

  async function handleClearDriveNotifications() {
    if (driveEvents.length === 0) return;
    const prevSnapshot = driveEvents;
    setDriveEvents([]);
    try {
      const res = await clearDriveNotificationsAction();
      if (!res.ok) {
        setDriveEvents(prevSnapshot);
      }
    } catch {
      setDriveEvents(prevSnapshot);
    }
  }

  function handleTabLinkClick(
    e: React.MouseEvent<HTMLAnchorElement>,
    href: string
  ) {
    if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      navigateTab(href);
      setMobileMenuOpen(false);
    }
  }

  const activeName =
    currentProfile?.display_name ??
    userEmail?.split("@")[0] ??
    "Önizleme Modu";
  const activeRole =
    currentProfile?.role_title ??
    (isConfigured ? "Ekip Üyesi" : "Supabase Bağlı Değil");
  const activeColor = currentProfile?.avatar_color ?? "#f59e0b";

  return (
    <div className="flex min-h-screen bg-[#0c1017] text-[#edf2f8]">
      {/* Mobile backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/70 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Left Studio Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-dvh w-64 flex-col border-r border-[#243044] bg-[#101622] transition-transform duration-200 lg:translate-x-0 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Studio Header */}
        <div className="flex items-center justify-between border-b border-[#1f2735] px-4 py-4">
          <Link
            href="/"
            prefetch={false}
            onClick={(e) => handleTabLinkClick(e, "/")}
            className="flex min-w-0 items-center gap-3"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/15 text-amber-400">
              <Gamepad2 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-zinc-100">
                {workspace.project_name}
              </p>
              <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                <span className="truncate">{workspace.studio_name}</span>
                <span>•</span>
                <span className="font-mono text-amber-400">
                  {workspace.ue_version}
                </span>
              </div>
            </div>
          </Link>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleBellToggle}
              title="Drive Asset Bildirimleri"
              aria-label="Drive Asset Bildirimleri"
              className={`relative rounded-lg p-1.5 transition ${
                notificationsOpen
                  ? "bg-cyan-500/15 text-cyan-300"
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              }`}
            >
              <Bell className="h-4.5 w-4.5" />
              {unreadDriveCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-cyan-500 px-1 text-xs font-bold text-zinc-950">
                  {unreadDriveCount > 9 ? "9+" : unreadDriveCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 lg:hidden"
              aria-label="Menüyü kapat"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Streamlined Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/"
                ? effectivePath === "/"
                : effectivePath.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                onClick={(e) => handleTabLinkClick(e, item.href)}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? "border border-amber-500/30 bg-amber-500/10 text-amber-300"
                    : "border border-transparent text-zinc-400 hover:bg-[#141a26] hover:text-zinc-100"
                }`}
              >
                <Icon
                  className={`h-4 w-4 ${
                    isActive ? "text-amber-400" : "text-zinc-500"
                  }`}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Compact Team Strip + Settings & User Footer */}
        <div className="space-y-2.5 border-t border-[#1f2735] p-3">
          {teamProfiles.length > 0 && (
            <div className="flex items-center justify-between rounded-lg bg-[#101520] px-3 py-2">
              <span className="text-xs font-medium text-zinc-400">
                Ekip ({teamProfiles.length}/3)
              </span>
              <div className="flex -space-x-1.5">
                {teamProfiles.map((member) => (
                  <span
                    key={member.id}
                    title={`${member.display_name} — ${member.role_title}`}
                    className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#101520] text-xs font-bold text-zinc-950"
                    style={{ backgroundColor: member.avatar_color }}
                  >
                    {member.display_name.slice(0, 2).toUpperCase()}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 rounded-lg border border-[#1d2534] bg-[#111622] px-3 py-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-zinc-950"
                style={{ backgroundColor: activeColor }}
              >
                {activeName.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-zinc-100">
                  {activeName}
                </p>
                <p className="truncate text-xs text-zinc-400">
                  {activeRole}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <Link
                href="/settings"
                prefetch={false}
                onClick={(e) => handleTabLinkClick(e, "/settings")}
                title="Ayarlar"
                className={`rounded-md p-1.5 transition ${
                  effectivePath.startsWith("/settings")
                    ? "bg-amber-500/15 text-amber-300"
                    : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                }`}
              >
                <Settings className="h-4 w-4" />
              </Link>

              {currentUserId ? (
                <form action={signOutAction}>
                  <button
                    type="submit"
                    title="Çıkış Yap"
                    className="rounded-md p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-rose-300"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </form>
              ) : (
                <Link
                  href="/login"
                  className="rounded-md bg-amber-500/15 px-2 py-1 text-xs font-medium text-amber-300 hover:bg-amber-500/25"
                >
                  Giriş
                </Link>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Column */}
      <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden lg:pl-64">
        {/* Top Mobile Bar */}
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-[#1f2735] bg-[#0c1018]/95 px-4 py-3 backdrop-blur-sm lg:hidden">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="rounded-lg border border-[#222b3a] p-2 text-zinc-300 hover:bg-zinc-800"
            aria-label="Menüyü aç"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold text-zinc-100">
            {workspace.project_name}
          </span>
          <div className="flex items-center gap-2">
            <span className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-mono text-xs text-amber-300">
              {workspace.ue_version}
            </span>
            <button
              type="button"
              onClick={handleBellToggle}
              title="Drive Asset Bildirimleri"
              aria-label="Drive Asset Bildirimleri"
              className={`relative rounded-lg border border-[#222b3a] p-1.5 transition ${
                notificationsOpen
                  ? "bg-cyan-500/15 text-cyan-300"
                  : "text-zinc-300 hover:bg-zinc-800"
              }`}
            >
              <Bell className="h-4.5 w-4.5" />
              {unreadDriveCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-cyan-500 px-1 text-xs font-bold text-zinc-950">
                  {unreadDriveCount > 9 ? "9+" : unreadDriveCount}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Drive Notifications Dropdown Popover */}
        {notificationsOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/40 lg:bg-transparent"
              onClick={() => setNotificationsOpen(false)}
            />
            <div className="fixed inset-x-3 top-16 z-50 overflow-hidden rounded-xl border border-[#242e40] bg-[#0e131c] shadow-2xl lg:inset-x-auto lg:top-16 lg:left-68 lg:w-96">
              <div className="flex items-center justify-between border-b border-[#1f2735] px-4 py-3">
                <div className="flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-cyan-400" />
                  <h3 className="text-xs font-semibold text-zinc-100">
                    Google Drive Asset Bildirimleri
                  </h3>
                </div>
                <div className="flex items-center gap-1.5">
                  {driveEvents.length > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={markDriveNotificationsRead}
                        title="Tümünü Okundu İşaretle"
                        className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                      >
                        <Check className="h-3 w-3" />
                        Okundu
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void handleClearDriveNotifications();
                        }}
                        title="Geçmişi Temizle"
                        className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-rose-300/80 hover:bg-rose-500/15 hover:text-rose-200"
                      >
                        <Trash2 className="h-3 w-3" />
                        Temizle
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => setNotificationsOpen(false)}
                    className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                    aria-label="Kapat"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="max-h-80 divide-y divide-[#182030] overflow-y-auto overscroll-contain">
                {driveEvents.length === 0 ? (
                  <div className="p-5 text-center text-xs text-zinc-400">
                    <p>Henüz Google Drive asset bildirimi yok.</p>
                    <button
                      type="button"
                      onClick={() => {
                        setNotificationsOpen(false);
                        navigateTab("/settings");
                      }}
                      className="mt-2.5 inline-flex items-center gap-1 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-300 hover:bg-cyan-500/20"
                    >
                      Drive Bağlantısını Ayarla →
                    </button>
                  </div>
                ) : (
                  driveEvents.map((ev) => {
                    const sizeLabel = formatDriveFileSize(ev.file_size);
                    return (
                      <div
                        key={ev.id}
                        className="flex items-start justify-between gap-3 px-4 py-3 transition hover:bg-[#131926]"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`rounded px-1.5 py-0.5 text-[12px] font-medium ${
                                ev.event_type === "updated"
                                  ? "bg-amber-500/15 text-amber-300"
                                  : "bg-cyan-500/15 text-cyan-300"
                              }`}
                            >
                              {ev.event_type === "updated"
                                ? "Güncellendi"
                                : "Yeni"}
                            </span>
                            <span className="truncate rounded bg-[#182030] px-1.5 py-0.5 text-[12px] text-zinc-300">
                              {ev.folder_name}
                            </span>
                            {sizeLabel && (
                              <span className="text-[12px] text-zinc-500">
                                {sizeLabel}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 truncate text-xs font-semibold text-zinc-100">
                            {ev.file_name}
                          </p>
                          <p className="mt-0.5 text-xs text-zinc-400">
                            {ev.uploaded_by_name}
                          </p>
                        </div>
                        <a
                          href={
                            ev.web_view_link !== "https://drive.google.com"
                              ? ev.web_view_link
                              : driveFolderUrl
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-flex shrink-0 items-center gap-1 rounded-md border border-[#242e40] bg-[#0a0e15] px-2 py-1 text-xs font-medium text-cyan-300 hover:border-cyan-500/40"
                        >
                          Aç
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </>
        )}

        <main className="flex-1 px-3 py-4 sm:px-5 sm:py-5">
          <div className="w-full space-y-5">
            {isOnTabRoute ? (
              <>
                {!isConfigured && activeTab !== "/" && <SetupBanner />}
                {activeTab === "/" && <DashboardView />}
                {activeTab === "/tasks" && <KanbanBoard />}
                {activeTab === "/ideas" && <IdeasBoard />}
                {activeTab === "/bugs" && <BugsBoard />}
                {activeTab === "/milestones" && <MilestonesView />}
                {activeTab === "/settings" && (
                  <div className="space-y-6">
                    <div>
                      <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
                        Ayarlar & Ekip Yönetimi
                      </h1>
                      <p className="mt-1 text-sm text-zinc-400">
                        Kendi geliştirici profilini, Unreal Engine proje
                        bilgilerini ve ekip üyelerini buradan yönetebilirsin.
                      </p>
                    </div>
                    <SettingsForms />
                  </div>
                )}
              </>
            ) : (
              children
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
