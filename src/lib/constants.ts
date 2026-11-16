import type {
  BugSeverity,
  IdeaCategory,
  IdeaStatus,
  TaskPriority,
  TaskStatus,
} from "@/types/studio";

export const UE_DISCIPLINE_TAGS = [
  "Blueprint",
  "C++",
  "3D / Rig",
  "Animasyon",
  "Level / Lighting",
  "UI (UMG)",
  "Material / Shader",
  "VFX (Niagara)",
  "Audio",
  "AI / Behavior",
  "Networking",
  "Optimization",
] as const;

export const IDEA_CATEGORIES: {
  value: IdeaCategory;
  label: string;
  badgeClass: string;
}[] = [
  {
    value: "mechanic",
    label: "Mekanik",
    badgeClass: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  },
  {
    value: "system",
    label: "Sistem",
    badgeClass: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  },
  {
    value: "level",
    label: "Level Design",
    badgeClass: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  },
  {
    value: "lore",
    label: "Hikaye / Lore",
    badgeClass: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  },
  {
    value: "vfx",
    label: "Görsel / VFX",
    badgeClass: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  },
  {
    value: "audio",
    label: "Ses / Müzik",
    badgeClass: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
  },
  {
    value: "ui",
    label: "UI / UX",
    badgeClass: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  },
];

export const IDEA_STATUSES: {
  value: IdeaStatus;
  label: string;
  badgeClass: string;
}[] = [
  {
    value: "raw",
    label: "Ham Fikir",
    badgeClass: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
  },
  {
    value: "discussing",
    label: "Tartışılıyor",
    badgeClass: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  },
  {
    value: "approved",
    label: "Onaylandı",
    badgeClass: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  },
  {
    value: "shelved",
    label: "Rafa Kaldırıldı",
    badgeClass: "bg-slate-500/15 text-slate-400 border-slate-500/30",
  },
];

export const TASK_STATUSES: {
  value: TaskStatus;
  label: string;
  accentClass: string;
}[] = [
  { value: "backlog", label: "Backlog", accentClass: "border-zinc-700" },
  { value: "todo", label: "Yapılacak", accentClass: "border-sky-500/40" },
  {
    value: "in_progress",
    label: "Yapılıyor",
    accentClass: "border-amber-500/50",
  },
  { value: "testing", label: "Testte", accentClass: "border-purple-500/50" },
  { value: "done", label: "Bitti", accentClass: "border-emerald-500/50" },
];

export const TASK_PRIORITIES: {
  value: TaskPriority;
  label: string;
  badgeClass: string;
}[] = [
  {
    value: "low",
    label: "Düşük",
    badgeClass: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
  },
  {
    value: "medium",
    label: "Orta",
    badgeClass: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  },
  {
    value: "high",
    label: "Yüksek",
    badgeClass: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  },
  {
    value: "critical",
    label: "Kritik",
    badgeClass: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  },
];

export const BUG_SEVERITIES: { value: BugSeverity; label: string }[] = [
  { value: "crash", label: "Crash / Blocker" },
  { value: "gameplay", label: "Oynanış Hatası" },
  { value: "visual", label: "Görsel / Shader" },
  { value: "audio", label: "Ses Hatası" },
  { value: "minor", label: "Küçük Kusur" },
];

export const AVATAR_COLORS = [
  "#f59e0b", // Amber
  "#06b6d4", // Cyan
  "#10b981", // Emerald
  "#8b5cf6", // Violet
  "#f43f5e", // Rose
  "#3b82f6", // Blue
] as const;

export const TEAM_ROLES_PRESETS = [
  "Gameplay / C++ & Blueprint",
  "3D Art / Rig & Animasyon",
  "Level Design / Lighting",
  "Tech Art / Shader & VFX",
  "UI / Audio / Game Design",
] as const;
