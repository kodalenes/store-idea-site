"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  X,
  Upload,
  FileCode2,
  FileText,
  Sparkles,
  AlertCircle,
  AlertTriangle,
  CheckSquare,
  Flag,
  Trash2,
} from "lucide-react";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/constants";
import {
  parseBulkTaskInput,
  SAMPLE_JSON_IMPORT,
  SAMPLE_MARKDOWN_IMPORT,
  type ImportFormatMode,
  type ParsedImportTask,
  type TaskImportDefaults,
} from "@/lib/task-import-parser";
import type {
  BulkImportCreatedItem,
  BulkImportTaskInput,
} from "@/app/actions/tasks";
import type { Milestone, Profile, TaskPriority, TaskStatus } from "@/types/studio";

export function BulkTaskImportModal({
  open,
  teamProfiles,
  milestones,
  onClose,
  onImportSubmit,
}: {
  open: boolean;
  teamProfiles: Profile[];
  milestones: Milestone[];
  onClose: () => void;
  onImportSubmit: (
    items: BulkImportTaskInput[]
  ) => Promise<{ ok: boolean; error?: string; created?: BulkImportCreatedItem[] }>;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [rawText, setRawText] = useState("");
  const [formatMode, setFormatMode] = useState<ImportFormatMode>("auto");

  const [defaultStatus, setDefaultStatus] = useState<TaskStatus>("todo");
  const [overrideStatus, setOverrideStatus] = useState(false);
  const [defaultPriority, setDefaultPriority] =
    useState<TaskPriority>("medium");
  const [overridePriority, setOverridePriority] = useState(false);
  const [defaultMilestoneId, setDefaultMilestoneId] = useState<string>("");
  const [overrideMilestone, setOverrideMilestone] = useState(false);
  const [defaultAssigneeId, setDefaultAssigneeId] = useState<string>("");

  const [excludedKeys, setExcludedKeys] = useState<Set<string>>(new Set());
  const [statusEdits, setStatusEdits] = useState<Record<string, TaskStatus>>({});
  const [priorityEdits, setPriorityEdits] = useState<
    Record<string, TaskPriority>
  >({});

  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [importing, setImporting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !importing) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, importing, onClose]);

  const defaults: TaskImportDefaults = useMemo(
    () => ({
      defaultStatus,
      overrideStatus,
      defaultPriority,
      overridePriority,
      defaultMilestoneId: defaultMilestoneId || null,
      overrideMilestone,
      defaultAssigneeId: defaultAssigneeId || null,
    }),
    [
      defaultStatus,
      overrideStatus,
      defaultPriority,
      overridePriority,
      defaultMilestoneId,
      overrideMilestone,
      defaultAssigneeId,
    ]
  );

  const parsedResult = useMemo(
    () =>
      parseBulkTaskInput(
        rawText,
        formatMode,
        defaults,
        teamProfiles,
        milestones
      ),
    [rawText, formatMode, defaults, teamProfiles, milestones]
  );

  const effectiveTasks: ParsedImportTask[] = useMemo(
    () =>
      parsedResult.tasks.map((t) => ({
        ...t,
        status: statusEdits[t.tempKey] ?? t.status,
        priority: priorityEdits[t.tempKey] ?? t.priority,
      })),
    [parsedResult.tasks, statusEdits, priorityEdits]
  );

  const selectedTasks = useMemo(
    () => effectiveTasks.filter((t) => !excludedKeys.has(t.tempKey)),
    [effectiveTasks, excludedKeys]
  );

  const totalSelectedSubtasks = useMemo(
    () => selectedTasks.reduce((acc, t) => acc + t.subtasks.length, 0),
    [selectedTasks]
  );

  if (!open) return null;

  function resetRowOverrides() {
    setExcludedKeys(new Set());
    setStatusEdits({});
    setPriorityEdits({});
    setSubmitError(null);
  }

  function loadFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === "string" ? reader.result : "";
      setRawText(content);
      if (file.name.toLowerCase().endsWith(".json")) {
        setFormatMode("json");
      } else if (
        file.name.toLowerCase().endsWith(".md") ||
        file.name.toLowerCase().endsWith(".markdown")
      ) {
        setFormatMode("markdown");
      } else {
        setFormatMode("auto");
      }
      resetRowOverrides();
    };
    reader.readAsText(file, "utf-8");
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      loadFile(file);
    }
    e.target.value = "";
  }

  function toggleTaskSelection(key: string) {
    setExcludedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleAllSelections() {
    if (selectedTasks.length === effectiveTasks.length) {
      setExcludedKeys(new Set(effectiveTasks.map((t) => t.tempKey)));
    } else {
      setExcludedKeys(new Set());
    }
  }

  async function handleConfirmImport() {
    if (selectedTasks.length === 0) return;
    if (selectedTasks.length > 100) {
      setSubmitError("Tek seferde en fazla 100 görev içe aktarılabilir.");
      return;
    }

    setImporting(true);
    setSubmitError(null);

    const payload: BulkImportTaskInput[] = selectedTasks.map((t) => ({
      title: t.title,
      description_md: t.description_md,
      status: t.status,
      priority: t.priority,
      ue_tags: t.ue_tags,
      assignee_id: t.assignee_id,
      milestone_id: t.milestone_id,
      subtasks: t.subtasks,
    }));

    const res = await onImportSubmit(payload);
    setImporting(false);

    if (!res.ok) {
      setSubmitError(res.error ?? "Görevler içe aktarılamadı.");
      return;
    }

    onClose();
  }

  return (
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !importing) {
          onClose();
        }
      }}
      className="fixed inset-0 z-60 flex items-center justify-center bg-black/75 p-2.5 sm:p-4 backdrop-blur-xs"
    >
      <div className="flex max-h-[93dvh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-[#243044] bg-[#0e131c] shadow-2xl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1f2735] px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-300">
              <Upload className="h-4.5 w-4.5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-100">
                JSON / Markdown Toplu Görev İçe Aktar
              </h2>
              <p className="text-xs text-zinc-400">
                JSON dosyası veya Markdown görev listesi / GDD başlıkları
                yapıştırın; önizleyip tek tıkla panoya aktarın.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={importing}
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="grid flex-1 gap-5 overflow-y-auto p-5 lg:grid-cols-12">
          {/* Left: Raw Input + File Drop + Defaults */}
          <div className="flex flex-col gap-3.5 lg:col-span-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex rounded-lg border border-[#242e40] bg-[#090d14] p-0.5 text-xs">
                {(
                  [
                    { value: "auto", label: "Otomatik" },
                    { value: "json", label: "JSON" },
                    { value: "markdown", label: "Markdown" },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => setFormatMode(tab.value)}
                    className={`rounded-md px-2.5 py-1 font-medium transition ${
                      formatMode === tab.value
                        ? "bg-amber-500/20 text-amber-300"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.md,.markdown,.txt,application/json,text/markdown,text/plain"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#242e40] bg-[#131926] px-2.5 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-cyan-500/40 hover:text-cyan-300"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Dosya Yükle
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRawText(SAMPLE_JSON_IMPORT);
                    setFormatMode("json");
                    resetRowOverrides();
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#242e40] bg-[#131926] px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-amber-500/40 hover:text-amber-300"
                >
                  <FileCode2 className="h-3.5 w-3.5" />
                  JSON Örnek
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRawText(SAMPLE_MARKDOWN_IMPORT);
                    setFormatMode("markdown");
                    resetRowOverrides();
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#242e40] bg-[#131926] px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-amber-500/40 hover:text-amber-300"
                >
                  <FileText className="h-3.5 w-3.5" />
                  MD Örnek
                </button>
                {rawText && (
                  <button
                    type="button"
                    onClick={() => {
                      setRawText("");
                      resetRowOverrides();
                    }}
                    title="Temizle"
                    className="inline-flex items-center gap-1 rounded-lg border border-[#242e40] bg-[#131926] px-2 py-1.5 text-xs text-zinc-400 transition hover:border-rose-500/40 hover:text-rose-300"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingFile(true);
              }}
              onDragLeave={() => setIsDraggingFile(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDraggingFile(false);
                const file = e.dataTransfer.files?.[0];
                if (file) loadFile(file);
              }}
              className={`relative flex-1 rounded-xl border transition ${
                isDraggingFile
                  ? "border-cyan-400 bg-cyan-500/5"
                  : "border-[#242e40] bg-[#090d14]"
              }`}
            >
              <textarea
                value={rawText}
                onChange={(e) => {
                  setRawText(e.target.value);
                  setSubmitError(null);
                }}
                rows={13}
                placeholder={`Buraya JSON veya Markdown yapıştırın ya da .json / .md dosyası sürükleyin...\n\nDesteklenen Markdown örnekleri:\n## [Yüksek] Görev Başlığı [Blueprint, C++]\n- Durum: Yapılacak\n- [ ] Alt görev 1\n- [ ] Alt görev 2\nAçıklama satırı...\n\nveya düz liste:\n- [ ] Oyuncu Sprint Mekanigi [Orta] #Blueprint`}
                className="h-full min-h-64 w-full resize-y rounded-xl bg-transparent p-3.5 font-mono text-xs leading-relaxed text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
              />
              {parsedResult.detectedFormat !== "empty" && (
                <span className="pointer-events-none absolute right-3 bottom-3 rounded-md border border-[#243044] bg-[#111724]/90 px-2 py-0.5 text-[11px] font-medium text-cyan-300">
                  {parsedResult.detectedFormat === "json"
                    ? "JSON Algılandı"
                    : "Markdown Algılandı"}
                </span>
              )}
            </div>

            {/* Defaults & Override Controls */}
            <div className="space-y-2.5 rounded-xl border border-[#1f2735] bg-[#101520] p-3.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                Varsayılan Alanlar (Belirtilmeyen görevlere uygulanır)
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-zinc-400">Durum</label>
                    <label className="inline-flex cursor-pointer items-center gap-1 text-[11px] text-zinc-400">
                      <input
                        type="checkbox"
                        checked={overrideStatus}
                        onChange={(e) => setOverrideStatus(e.target.checked)}
                        className="accent-amber-500"
                      />
                      Tümünü zorla
                    </label>
                  </div>
                  <select
                    value={defaultStatus}
                    onChange={(e) =>
                      setDefaultStatus(e.target.value as TaskStatus)
                    }
                    className="w-full rounded-lg border border-[#242e40] bg-[#090d14] px-2.5 py-1.5 text-xs text-zinc-100 focus:border-amber-500/60 focus:outline-none"
                  >
                    {TASK_STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-zinc-400">Öncelik</label>
                    <label className="inline-flex cursor-pointer items-center gap-1 text-[11px] text-zinc-400">
                      <input
                        type="checkbox"
                        checked={overridePriority}
                        onChange={(e) => setOverridePriority(e.target.checked)}
                        className="accent-amber-500"
                      />
                      Tümünü zorla
                    </label>
                  </div>
                  <select
                    value={defaultPriority}
                    onChange={(e) =>
                      setDefaultPriority(e.target.value as TaskPriority)
                    }
                    className="w-full rounded-lg border border-[#242e40] bg-[#090d14] px-2.5 py-1.5 text-xs text-zinc-100 focus:border-amber-500/60 focus:outline-none"
                  >
                    {TASK_PRIORITIES.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-zinc-400">
                      Sistem / Hedef
                    </label>
                    <label className="inline-flex cursor-pointer items-center gap-1 text-[11px] text-zinc-400">
                      <input
                        type="checkbox"
                        checked={overrideMilestone}
                        onChange={(e) => setOverrideMilestone(e.target.checked)}
                        className="accent-amber-500"
                      />
                      Tümünü zorla
                    </label>
                  </div>
                  <select
                    value={defaultMilestoneId}
                    onChange={(e) => setDefaultMilestoneId(e.target.value)}
                    className="w-full rounded-lg border border-[#242e40] bg-[#090d14] px-2.5 py-1.5 text-xs text-zinc-100 focus:border-amber-500/60 focus:outline-none"
                  >
                    <option value="">Bağlı Sistem Yok</option>
                    {milestones.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs text-zinc-400">
                    Varsayılan Kişi
                  </label>
                  <select
                    value={defaultAssigneeId}
                    onChange={(e) => setDefaultAssigneeId(e.target.value)}
                    className="w-full rounded-lg border border-[#242e40] bg-[#090d14] px-2.5 py-1.5 text-xs text-zinc-100 focus:border-amber-500/60 focus:outline-none"
                  >
                    <option value="">Atanmamış</option>
                    {teamProfiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.display_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Live Parsed Preview */}
          <div className="flex flex-col gap-3 lg:col-span-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-zinc-100">
                  Önizleme
                </h3>
                <span className="rounded-full bg-[#192130] px-2.5 py-0.5 font-mono text-xs text-amber-300">
                  {selectedTasks.length} / {effectiveTasks.length} görev
                </span>
                {totalSelectedSubtasks > 0 && (
                  <span className="rounded-full bg-[#192130] px-2.5 py-0.5 font-mono text-xs text-emerald-300">
                    {totalSelectedSubtasks} alt görev
                  </span>
                )}
              </div>

              {effectiveTasks.length > 0 && (
                <button
                  type="button"
                  onClick={toggleAllSelections}
                  className="text-xs font-medium text-cyan-300 hover:text-cyan-200"
                >
                  {selectedTasks.length === effectiveTasks.length
                    ? "Tümünü Kaldır"
                    : "Tümünü Seç"}
                </button>
              )}
            </div>

            {parsedResult.errors.length > 0 && (
              <div className="space-y-1 rounded-xl border border-rose-500/35 bg-rose-500/10 p-3 text-xs text-rose-200">
                {parsedResult.errors.slice(0, 5).map((err, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
                    <span>{err}</span>
                  </div>
                ))}
                {parsedResult.errors.length > 5 && (
                  <p className="text-rose-300">
                    ...ve {parsedResult.errors.length - 5} uyarı daha.
                  </p>
                )}
              </div>
            )}

            <div className="flex-1 space-y-2.5 overflow-y-auto rounded-xl border border-[#1f2735] bg-[#0a0e15] p-3 min-h-64 max-h-[54vh]">
              {effectiveTasks.length === 0 ? (
                <div className="flex h-full min-h-56 flex-col items-center justify-center px-4 text-center">
                  <p className="text-sm font-medium text-zinc-300">
                    Henüz ayrıştırılan görev yok
                  </p>
                  <p className="mt-1 max-w-sm text-xs text-zinc-500">
                    Soldaki alana JSON veya Markdown görev listenizi
                    yapıştırın, dosya sürükleyin ya da üstteki örneklerden
                    birini deneyin.
                  </p>
                </div>
              ) : (
                effectiveTasks.map((task) => {
                  const isSelected = !excludedKeys.has(task.tempKey);
                  return (
                    <div
                      key={task.tempKey}
                      className={`rounded-xl border p-3 transition ${
                        isSelected
                          ? "border-[#263247] bg-[#121823]"
                          : "border-[#1a2130] bg-[#0e131c]/60 opacity-50"
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleTaskSelection(task.tempKey)}
                          className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-amber-500"
                        />

                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <p className="text-sm font-semibold leading-snug text-zinc-100">
                              {task.title}
                            </p>

                            <div className="flex shrink-0 items-center gap-1.5">
                              <select
                                aria-label="Sütun"
                                value={task.status}
                                onChange={(e) =>
                                  setStatusEdits((prev) => ({
                                    ...prev,
                                    [task.tempKey]: e.target
                                      .value as TaskStatus,
                                  }))
                                }
                                className="rounded-md border border-[#242e40] bg-[#090d14] px-2 py-1 text-xs text-zinc-200 focus:border-amber-500/60 focus:outline-none"
                              >
                                {TASK_STATUSES.map((s) => (
                                  <option key={s.value} value={s.value}>
                                    {s.label}
                                  </option>
                                ))}
                              </select>

                              <select
                                aria-label="Öncelik"
                                value={task.priority}
                                onChange={(e) =>
                                  setPriorityEdits((prev) => ({
                                    ...prev,
                                    [task.tempKey]: e.target
                                      .value as TaskPriority,
                                  }))
                                }
                                className="rounded-md border border-[#242e40] bg-[#090d14] px-2 py-1 text-xs text-zinc-200 focus:border-amber-500/60 focus:outline-none"
                              >
                                {TASK_PRIORITIES.map((p) => (
                                  <option key={p.value} value={p.value}>
                                    {p.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {task.description_md && (
                            <p className="line-clamp-2 text-xs leading-relaxed text-zinc-400">
                              {task.description_md}
                            </p>
                          )}

                          <div className="flex flex-wrap items-center gap-1.5">
                            {task.milestone_label && (
                              <span className="inline-flex items-center gap-1 rounded bg-[#182234] px-2 py-0.5 text-xs text-cyan-300">
                                <Flag className="h-3 w-3" />
                                {task.milestone_label}
                              </span>
                            )}
                            {task.assignee_label && (
                              <span className="rounded bg-[#1b2232] px-2 py-0.5 text-xs text-amber-200">
                                @{task.assignee_label}
                              </span>
                            )}
                            {task.ue_tags.map((tag) => (
                              <span
                                key={tag}
                                className="rounded bg-[#1b2232] px-2 py-0.5 text-xs text-zinc-300"
                              >
                                {tag}
                              </span>
                            ))}
                            {task.subtasks.length > 0 && (
                              <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300">
                                <CheckSquare className="h-3 w-3" />
                                {task.subtasks.length} alt görev
                              </span>
                            )}
                          </div>

                          {task.warnings.length > 0 && (
                            <div className="flex flex-wrap items-center gap-2 text-xs text-amber-300">
                              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                              <span>{task.warnings.join(" • ")}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#1f2735] px-5 py-3.5">
          <div className="text-xs text-zinc-400">
            {submitError ? (
              <span className="inline-flex items-center gap-1.5 text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {submitError}
              </span>
            ) : (
              <span>
                Tek seferde en fazla 100 görev ve her görev için en fazla 25 alt
                görev içe aktarılabilir.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              disabled={importing}
              onClick={onClose}
              className="rounded-lg border border-[#242e40] px-4 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
            >
              Vazgeç
            </button>
            <button
              type="button"
              disabled={
                importing ||
                selectedTasks.length === 0 ||
                selectedTasks.length > 100
              }
              onClick={() => void handleConfirmImport()}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              {importing
                ? "İçe Aktarılıyor..."
                : `${selectedTasks.length} Görevi İçe Aktar`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
