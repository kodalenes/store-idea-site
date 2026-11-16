"use client";

import {
  startTransition,
  useEffect,
  useMemo,
  useOptimistic,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  Lock,
  Unlock,
  Search,
  Copy,
  Check,
  AlertCircle,
  Clock,
  ShieldAlert,
} from "lucide-react";
import { ASSET_LOCK_TYPES } from "@/lib/constants";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { lockAssetAction, unlockAssetAction } from "@/app/actions/locks";
import type {
  AssetLockType,
  AssetLockWithProfile,
  Profile,
} from "@/types/studio";

const QUICK_PATH_PREFIXES = [
  { label: "Maps (.umap)", prefix: "Content/Maps/L_", type: "level" as const },
  {
    label: "Blueprints",
    prefix: "Content/Blueprints/BP_",
    type: "blueprint" as const,
  },
  {
    label: "Characters",
    prefix: "Content/Characters/",
    type: "mesh" as const,
  },
  {
    label: "UI (UMG)",
    prefix: "Content/UI/WBP_",
    type: "other" as const,
  },
];

type LockOptimisticAction =
  | { type: "add"; lock: AssetLockWithProfile }
  | { type: "remove"; id: string };

function formatElapsed(isoDate: string): string {
  const diffMs = Math.max(0, Date.now() - new Date(isoDate).getTime());
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "az önce";
  if (mins < 60) return `${mins} dk önce`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} sa önce`;
  const days = Math.floor(hours / 24);
  return `${days} gün önce`;
}

export function AssetLocksBoard({
  initialLocks,
  teamProfiles,
  currentUserId,
  isConfigured,
}: {
  initialLocks: AssetLockWithProfile[];
  teamProfiles: Profile[];
  currentUserId: string | null;
  isConfigured: boolean;
}) {
  const router = useRouter();
  const currentProfile = useMemo(
    () => teamProfiles.find((p) => p.id === currentUserId) ?? null,
    [teamProfiles, currentUserId]
  );

  const [optimisticLocks, applyOptimisticLock] = useOptimistic(
    initialLocks,
    (state: AssetLockWithProfile[], action: LockOptimisticAction) => {
      if (action.type === "add") {
        return [action.lock, ...state];
      }
      return state.filter((l) => l.id !== action.id);
    }
  );

  // Quick lock form
  const [assetPath, setAssetPath] = useState("");
  const [lockType, setLockType] = useState<AssetLockType>("blueprint");
  const [note, setNote] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters & Copy feedback
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<AssetLockType | "all">("all");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;

    const channel = supabase
      .channel("asset-locks-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "asset_locks" },
        () => router.refresh()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  const filteredLocks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return optimisticLocks.filter((l) => {
      if (typeFilter !== "all" && l.lock_type !== typeFilter) return false;
      if (ownerFilter === "mine" && l.locked_by !== currentUserId) return false;
      if (
        ownerFilter !== "all" &&
        ownerFilter !== "mine" &&
        l.locked_by !== ownerFilter
      ) {
        return false;
      }
      if (q) {
        const hay = `${l.asset_path} ${l.note} ${l.owner?.display_name ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [optimisticLocks, search, typeFilter, ownerFilter, currentUserId]);

  function handleLockSubmit(e: React.FormEvent) {
    e.preventDefault();
    const rawPath = assetPath.trim().replaceAll("\\", "/");
    const cleanNote = note.trim();
    if (!rawPath || !currentUserId) return;

    setErrorMsg(null);
    setAssetPath("");
    setNote("");

    const tempLock: AssetLockWithProfile = {
      id: `temp-lock-${Date.now()}`,
      asset_path: rawPath,
      lock_type: lockType,
      locked_by: currentUserId,
      note: cleanNote,
      locked_at: new Date().toISOString(),
      owner: currentProfile,
    };

    startTransition(async () => {
      applyOptimisticLock({ type: "add", lock: tempLock });
      try {
        const res = await lockAssetAction({
          asset_path: rawPath,
          lock_type: lockType,
          note: cleanNote,
        });
        if (!res.ok) {
          setAssetPath(rawPath);
          setNote(cleanNote);
          setErrorMsg(
            res.error ?? "Asset kilitlenemedi, işlem geri alındı."
          );
          return;
        }
        router.refresh();
      } catch {
        setAssetPath(rawPath);
        setNote(cleanNote);
        setErrorMsg("Bağlantı hatası: Asset kilitlenemedi, geri alındı.");
      }
    });
  }

  function handleUnlock(lock: AssetLockWithProfile) {
    const isMine = lock.locked_by === currentUserId;
    if (
      !isMine &&
      !window.confirm(
        `Bu dosya ${lock.owner?.display_name ?? "başka bir ekip üyesi"} tarafından kilitli. Kilidi yine de açmak istiyor musun?`
      )
    ) {
      return;
    }

    setErrorMsg(null);
    startTransition(async () => {
      applyOptimisticLock({ type: "remove", id: lock.id });
      try {
        const res = await unlockAssetAction(lock.id);
        if (!res.ok) {
          setErrorMsg(res.error ?? "Kilit açılamadı, işlem geri alındı.");
          return;
        }
        router.refresh();
      } catch {
        setErrorMsg("Bağlantı hatası: Kilit açma işlemi geri alındı.");
      }
    });
  }

  async function handleCopyPath(id: string, path: string) {
    try {
      await navigator.clipboard.writeText(path);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // Clipboard API engelliyse sessizce gec
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
          UE5 Asset & Level Kilit Panosu
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Binary <code className="font-mono text-amber-300">.uasset</code> ve{" "}
          <code className="font-mono text-amber-300">.umap</code> dosyalarında
          çakışma yaşamamak için düzenlemeye başlamadan önce dosyayı kilitleyin.
        </p>
      </div>

      {errorMsg && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            {errorMsg}
          </span>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="underline hover:text-white"
          >
            Kapat
          </button>
        </div>
      )}

      {/* Quick Lock Form */}
      <form
        onSubmit={handleLockSubmit}
        className="space-y-3 rounded-xl border border-[#1f2735] bg-[#10141d] p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
            Dosya / Level Kilitle
          </p>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_PATH_PREFIXES.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  setAssetPath(preset.prefix);
                  setLockType(preset.type);
                }}
                className="rounded-md border border-[#242e40] bg-[#0a0e15] px-2 py-1 text-[11px] text-zinc-300 hover:border-amber-500/40 hover:text-amber-300"
              >
                + {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <input
              type="text"
              required
              value={assetPath}
              onChange={(e) => setAssetPath(e.target.value)}
              placeholder="Content/Maps/L_Dungeon_01.umap"
              className="w-full rounded-lg border border-[#242e40] bg-[#080a0f] px-3 py-2.5 font-mono text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500/60 focus:outline-none"
            />
          </div>

          <div className="lg:col-span-2">
            <select
              value={lockType}
              onChange={(e) => setLockType(e.target.value as AssetLockType)}
              className="w-full rounded-lg border border-[#242e40] bg-[#080a0f] px-2.5 py-2.5 text-xs text-zinc-100 focus:border-amber-500/60 focus:outline-none"
            >
              {ASSET_LOCK_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-3">
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Not (ör. Lighting bake alıyorum)"
              className="w-full rounded-lg border border-[#242e40] bg-[#080a0f] px-3 py-2.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500/60 focus:outline-none"
            />
          </div>

          <div className="lg:col-span-2">
            <button
              type="submit"
              disabled={!isConfigured || !assetPath.trim()}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2.5 text-xs font-semibold text-zinc-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Lock className="h-3.5 w-3.5" />
              Kilitle
            </button>
          </div>
        </div>
      </form>

      {/* Filters */}
      <div className="flex flex-col gap-3 rounded-xl border border-[#1f2735] bg-[#10141d] p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Dosya yolu, not veya kişi ara..."
            className="w-full rounded-lg border border-[#242e40] bg-[#080a0f] py-2 pr-3 pl-9 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-amber-500/60 focus:outline-none"
          />
        </div>

        <select
          value={typeFilter}
          onChange={(e) =>
            setTypeFilter(e.target.value as AssetLockType | "all")
          }
          className="rounded-lg border border-[#242e40] bg-[#080a0f] px-3 py-2 text-xs text-zinc-200 focus:border-amber-500/60 focus:outline-none"
        >
          <option value="all">Tür: Tümü</option>
          {ASSET_LOCK_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>

        <select
          value={ownerFilter}
          onChange={(e) => setOwnerFilter(e.target.value)}
          className="rounded-lg border border-[#242e40] bg-[#080a0f] px-3 py-2 text-xs text-zinc-200 focus:border-amber-500/60 focus:outline-none"
        >
          <option value="all">Kilit Sahibi: Tümü</option>
          {currentUserId && <option value="mine">Benim Kilitlediklerim</option>}
          {teamProfiles.map((m) => (
            <option key={m.id} value={m.id}>
              {m.display_name}
            </option>
          ))}
        </select>
      </div>

      {/* Active Locks List */}
      {filteredLocks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#242e40] bg-[#0c1018] px-6 py-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
            <Unlock className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-zinc-100">
            {optimisticLocks.length === 0
              ? "Şu anda kilitli UE5 dosyası yok"
              : "Filtrelere uyan kilitli dosya bulunamadı"}
          </h3>
          <p className="mt-1 max-w-md text-xs text-zinc-400">
            Tüm Level ve Blueprint dosyaları şu an serbest. Bir dosya üzerinde
            çalışmaya başlamadan önce yukarıdan kilitleyebilirsin.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filteredLocks.map((lock) => {
            const isMine = lock.locked_by === currentUserId;
            const typeLabel =
              ASSET_LOCK_TYPES.find((t) => t.value === lock.lock_type)?.label ??
              lock.lock_type;

            return (
              <div
                key={lock.id}
                className={`flex flex-col justify-between rounded-xl border p-4 transition ${
                  isMine
                    ? "border-amber-500/40 bg-amber-500/5"
                    : "border-[#1f2735] bg-[#10141d]"
                }`}
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#2a3447] bg-[#080a0f] px-2.5 py-0.5 text-[11px] font-medium text-zinc-300">
                      <Lock className="h-3 w-3 text-amber-400" />
                      {typeLabel}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500">
                      <Clock className="h-3 w-3" />
                      {formatElapsed(lock.locked_at)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 rounded-lg border border-[#1b2230] bg-[#080a0f] px-3 py-2">
                    <code className="truncate font-mono text-xs text-amber-200">
                      {lock.asset_path}
                    </code>
                    <button
                      type="button"
                      onClick={() => handleCopyPath(lock.id, lock.asset_path)}
                      className="shrink-0 rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                      title="Yolu kopyala"
                    >
                      {copiedId === lock.id ? (
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>

                  {lock.note && (
                    <p className="text-xs text-zinc-300">{lock.note}</p>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-[#1c2433] pt-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-zinc-950"
                      style={{
                        backgroundColor: lock.owner?.avatar_color ?? "#f59e0b",
                      }}
                    >
                      {(lock.owner?.display_name ?? "EK")
                        .slice(0, 2)
                        .toUpperCase()}
                    </span>
                    <span className="text-xs font-medium text-zinc-200">
                      {lock.owner?.display_name ?? "Ekip Üyesi"}
                      {isMine && (
                        <span className="ml-1.5 text-[10px] text-amber-300">
                          (Sen)
                        </span>
                      )}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleUnlock(lock)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                      isMine
                        ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                        : "border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
                    }`}
                  >
                    {isMine ? (
                      <>
                        <Unlock className="h-3.5 w-3.5" />
                        Kilidi Bırak
                      </>
                    ) : (
                      <>
                        <ShieldAlert className="h-3.5 w-3.5" />
                        Kilidi Aç
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
