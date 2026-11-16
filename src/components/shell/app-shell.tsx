"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Lightbulb,
  KanbanSquare,
  Flag,
  Lock,
  Bug,
  Settings,
  LogOut,
  Menu,
  X,
  Gamepad2,
  CircleDot,
} from "lucide-react";
import { signOutAction } from "@/app/actions/auth";
import type { StudioSessionContext } from "@/lib/studio-data";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/ideas", label: "Fikirler & Mini-GDD", icon: Lightbulb },
  { href: "/tasks", label: "Görevler / Kanban", icon: KanbanSquare },
  { href: "/milestones", label: "Milestones", icon: Flag },
  { href: "/locks", label: "Asset Kilitleri", icon: Lock },
  { href: "/bugs", label: "Bug Raporu", icon: Bug },
  { href: "/settings", label: "Ayarlar & Ekip", icon: Settings },
];

export function AppShell({
  context,
  children,
}: {
  context: StudioSessionContext;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const effectivePath =
    pendingHref && pendingHref !== pathname ? pendingHref : pathname;

  const activeName =
    context.currentProfile?.display_name ??
    context.userEmail?.split("@")[0] ??
    "Önizleme Modu";
  const activeRole =
    context.currentProfile?.role_title ??
    (context.isConfigured ? "Ekip Üyesi" : "Supabase Bağlı Değil");
  const activeColor = context.currentProfile?.avatar_color ?? "#f59e0b";

  return (
    <div className="flex min-h-screen bg-[#080a0f] text-[#e6ebf5]">
      {/* Mobile backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/70 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Left Studio Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-68 flex-col border-r border-[#1f2735] bg-[#0c1018] transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Studio Header */}
        <div className="flex items-center justify-between border-b border-[#1f2735] px-4 py-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/15 text-amber-400">
              <Gamepad2 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-zinc-100">
                {context.workspace.project_name}
              </p>
              <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                <span className="truncate">{context.workspace.studio_name}</span>
                <span>•</span>
                <span className="font-mono text-amber-400">
                  {context.workspace.ue_version}
                </span>
              </div>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 lg:hidden"
            aria-label="Menüyü kapat"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Stüdyo Modülleri
          </p>
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
                prefetch={true}
                onClick={() => {
                  setPendingHref(item.href);
                  setMobileMenuOpen(false);
                }}
                className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? "border border-amber-500/30 bg-amber-500/10 text-amber-300"
                    : "border border-transparent text-zinc-400 hover:bg-[#141a26] hover:text-zinc-100"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon
                    className={`h-4 w-4 ${
                      isActive ? "text-amber-400" : "text-zinc-500"
                    }`}
                  />
                  {item.label}
                </span>
                {item.badge && (
                  <span className="rounded border border-zinc-700/80 bg-zinc-800/70 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}

          {/* Team Roster Snapshot */}
          <div className="pt-5">
            <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Ekip ({context.teamProfiles.length || 0}/3)
            </p>
            <div className="space-y-1.5 px-2">
              {context.teamProfiles.length > 0 ? (
                context.teamProfiles.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-2.5 rounded-lg border border-[#1a2130] bg-[#101520] px-2.5 py-2"
                  >
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-zinc-950"
                      style={{ backgroundColor: member.avatar_color }}
                    >
                      {member.display_name.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-zinc-200">
                        {member.display_name}
                      </p>
                      <p className="truncate text-[11px] text-zinc-500">
                        {member.role_title}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-[#242e40] px-3 py-2.5 text-xs text-zinc-500">
                  Ekip üyeleri giriş yaptığında burada görünecek.
                </div>
              )}
            </div>
          </div>
        </nav>

        {/* Connection & User Footer */}
        <div className="border-t border-[#1f2735] p-3 space-y-2.5">
          <div className="flex items-center justify-between rounded-lg bg-[#101520] px-3 py-2 text-xs">
            <span className="flex items-center gap-2 text-zinc-400">
              <CircleDot
                className={`h-3.5 w-3.5 ${
                  context.isConfigured ? "text-emerald-400" : "text-amber-400"
                }`}
              />
              {context.isConfigured ? "Supabase Bağlı" : "Önizleme Modu"}
            </span>
            <span className="font-mono text-[10px] text-zinc-500">v0.1</span>
          </div>

          <div className="flex items-center justify-between gap-2 rounded-lg border border-[#1d2534] bg-[#111622] px-3 py-2.5">
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
                <p className="truncate text-[11px] text-zinc-400">
                  {activeRole}
                </p>
              </div>
            </div>

            {context.userId ? (
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
                className="rounded-md bg-amber-500/15 px-2.5 py-1 text-[11px] font-medium text-amber-300 hover:bg-amber-500/25"
              >
                Giriş
              </Link>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Column */}
      <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden">
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
            {context.workspace.project_name}
          </span>
          <span className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-mono text-xs text-amber-300">
            {context.workspace.ue_version}
          </span>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-6xl space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
