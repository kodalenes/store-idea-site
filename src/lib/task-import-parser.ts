import { TASK_PRIORITIES, TASK_STATUSES, UE_DISCIPLINE_TAGS } from "@/lib/constants";
import type { Milestone, Profile, TaskPriority, TaskStatus } from "@/types/studio";

export type ImportFormatMode = "auto" | "json" | "markdown";

export interface ParsedSubtaskInput {
  title: string;
  is_done: boolean;
}

export interface ParsedImportTask {
  tempKey: string;
  title: string;
  description_md: string;
  status: TaskStatus;
  priority: TaskPriority;
  ue_tags: string[];
  assignee_id: string | null;
  assignee_label: string | null;
  milestone_id: string | null;
  milestone_label: string | null;
  subtasks: ParsedSubtaskInput[];
  warnings: string[];
}

export interface TaskImportDefaults {
  defaultStatus: TaskStatus;
  overrideStatus: boolean;
  defaultPriority: TaskPriority;
  overridePriority: boolean;
  defaultMilestoneId: string | null;
  overrideMilestone: boolean;
  defaultAssigneeId: string | null;
}

export interface ParseImportResult {
  detectedFormat: "json" | "markdown" | "empty";
  tasks: ParsedImportTask[];
  errors: string[];
}

function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^\w\s+/#-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeTaskStatus(raw?: string | null): TaskStatus | null {
  if (!raw) return null;
  const n = normalizeText(raw).replace(/[-_\s]+/g, "");
  if (!n) return null;
  if (["backlog", "beklemede", "havuz", "planlanan"].includes(n)) {
    return "backlog";
  }
  if (
    ["todo", "yapilacak", "yapilacaklar", "to-do", "open", "acik"].includes(n)
  ) {
    return "todo";
  }
  if (
    [
      "inprogress",
      "doing",
      "wip",
      "yapiliyor",
      "devamediyor",
      "active",
      "aktif",
    ].includes(n)
  ) {
    return "in_progress";
  }
  if (["testing", "test", "testte", "qa", "review", "inceleme"].includes(n)) {
    return "testing";
  }
  if (
    ["done", "bitti", "tamamlandi", "completed", "closed", "kapandi"].includes(
      n
    )
  ) {
    return "done";
  }
  for (const st of TASK_STATUSES) {
    if (normalizeText(st.label).replace(/\s+/g, "") === n) return st.value;
  }
  return null;
}

export function normalizeTaskPriority(
  raw?: string | null
): TaskPriority | null {
  if (!raw) return null;
  const n = normalizeText(raw).replace(/[-_\s]+/g, "");
  if (!n) return null;
  if (["low", "dusuk", "min", "minor", "p3"].includes(n)) return "low";
  if (["medium", "med", "orta", "normal", "p2"].includes(n)) return "medium";
  if (["high", "yuksek", "onemli", "p1"].includes(n)) return "high";
  if (["critical", "kritik", "acil", "urgent", "blocker", "p0"].includes(n)) {
    return "critical";
  }
  for (const pr of TASK_PRIORITIES) {
    if (normalizeText(pr.label).replace(/\s+/g, "") === n) return pr.value;
  }
  return null;
}

const TAG_SYNONYMS: Record<string, string> = {
  bp: "Blueprint",
  blueprint: "Blueprint",
  blueprints: "Blueprint",
  cpp: "C++",
  "c++": "C++",
  "3d": "3D / Rig",
  rig: "3D / Rig",
  model: "3D / Rig",
  modeling: "3D / Rig",
  mesh: "3D / Rig",
  anim: "Animasyon",
  animation: "Animasyon",
  animasyon: "Animasyon",
  level: "Level / Lighting",
  lighting: "Level / Lighting",
  leveldesign: "Level / Lighting",
  ui: "UI (UMG)",
  umg: "UI (UMG)",
  ux: "UI (UMG)",
  hud: "UI (UMG)",
  material: "Material / Shader",
  shader: "Material / Shader",
  vfx: "VFX (Niagara)",
  niagara: "VFX (Niagara)",
  particle: "VFX (Niagara)",
  audio: "Audio",
  sound: "Audio",
  ses: "Audio",
  sfx: "Audio",
  ai: "AI / Behavior",
  behavior: "AI / Behavior",
  behaviortree: "AI / Behavior",
  net: "Networking",
  network: "Networking",
  networking: "Networking",
  multiplayer: "Networking",
  replication: "Networking",
  opt: "Optimization",
  optimization: "Optimization",
  perf: "Optimization",
  performance: "Optimization",
};

export function resolveTagName(raw: string): string | null {
  const trimmed = raw.trim().replace(/^#/, "");
  if (!trimmed) return null;

  const exact = UE_DISCIPLINE_TAGS.find(
    (t) => t.toLowerCase() === trimmed.toLowerCase()
  );
  if (exact) return exact;

  const compact = normalizeText(trimmed).replace(/[\s/()_-]+/g, "");
  if (TAG_SYNONYMS[compact]) return TAG_SYNONYMS[compact];

  const partial = UE_DISCIPLINE_TAGS.find((t) =>
    normalizeText(t).includes(normalizeText(trimmed))
  );
  if (partial) return partial;

  return trimmed.slice(0, 32);
}

function resolveTagsList(raw: unknown): string[] {
  let parts: string[] = [];
  if (Array.isArray(raw)) {
    parts = raw
      .map((item) => (typeof item === "string" ? item : String(item ?? "")))
      .flatMap((s) => s.split(/[,;]/));
  } else if (typeof raw === "string") {
    parts = raw.split(/[,;|]/);
  }

  const out: string[] = [];
  for (const part of parts) {
    const resolved = resolveTagName(part);
    if (resolved && !out.includes(resolved)) {
      out.push(resolved);
    }
    if (out.length >= 10) break;
  }
  return out;
}

function resolveAssignee(
  raw: string | null | undefined,
  teamProfiles: Profile[]
): { id: string | null; label: string | null; warning?: string } {
  if (!raw || !raw.trim()) return { id: null, label: null };
  const clean = raw.trim().replace(/^@/, "");
  const norm = normalizeText(clean);

  const byId = teamProfiles.find((p) => p.id === clean);
  if (byId) return { id: byId.id, label: byId.display_name };

  const byName = teamProfiles.find(
    (p) =>
      normalizeText(p.display_name) === norm ||
      normalizeText(p.email) === norm ||
      normalizeText(p.email.split("@")[0] ?? "") === norm
  );
  if (byName) return { id: byName.id, label: byName.display_name };

  const partial = teamProfiles.find((p) =>
    normalizeText(p.display_name).includes(norm)
  );
  if (partial) return { id: partial.id, label: partial.display_name };

  return {
    id: null,
    label: null,
    warning: `Kişi eşleşmedi: "${clean}"`,
  };
}

function resolveMilestone(
  raw: string | null | undefined,
  milestones: Milestone[]
): { id: string | null; label: string | null; warning?: string } {
  if (!raw || !raw.trim()) return { id: null, label: null };
  const clean = raw.trim();
  const norm = normalizeText(clean);

  const byId = milestones.find((m) => m.id === clean);
  if (byId) return { id: byId.id, label: byId.title };

  const byTitle = milestones.find((m) => normalizeText(m.title) === norm);
  if (byTitle) return { id: byTitle.id, label: byTitle.title };

  const partial = milestones.find(
    (m) =>
      normalizeText(m.title).includes(norm) ||
      norm.includes(normalizeText(m.title))
  );
  if (partial) return { id: partial.id, label: partial.title };

  return {
    id: null,
    label: null,
    warning: `Sistem / Hedef eşleşmedi: "${clean}"`,
  };
}

function pickField(
  obj: Record<string, unknown>,
  keys: string[]
): unknown {
  const lowerMap = new Map<string, unknown>();
  for (const [k, v] of Object.entries(obj)) {
    lowerMap.set(normalizeText(k).replace(/\s+/g, "_"), v);
    lowerMap.set(k.toLowerCase(), v);
  }
  for (const key of keys) {
    if (lowerMap.has(key)) return lowerMap.get(key);
    const normKey = normalizeText(key).replace(/\s+/g, "_");
    if (lowerMap.has(normKey)) return lowerMap.get(normKey);
  }
  return undefined;
}

function parseSubtasksField(raw: unknown): ParsedSubtaskInput[] {
  if (!raw) return [];
  const items = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? raw.split(/\r?\n/)
      : [];

  const out: ParsedSubtaskInput[] = [];
  for (const item of items) {
    if (typeof item === "string") {
      const m = item.match(/^\s*(?:[-*]|\d+\.)?\s*(?:\[( |x|X)\]\s*)?(.+)$/);
      const title = (m?.[2] ?? item).trim();
      if (title) {
        out.push({
          title: title.slice(0, 180),
          is_done: Boolean(m?.[1] && m[1].toLowerCase() === "x"),
        });
      }
    } else if (item && typeof item === "object") {
      const rec = item as Record<string, unknown>;
      const rawTitle = pickField(rec, [
        "title",
        "baslik",
        "name",
        "text",
        "label",
      ]);
      const rawDone = pickField(rec, [
        "is_done",
        "done",
        "completed",
        "tamamlandi",
      ]);
      if (typeof rawTitle === "string" && rawTitle.trim()) {
        out.push({
          title: rawTitle.trim().slice(0, 180),
          is_done: Boolean(rawDone),
        });
      }
    }
    if (out.length >= 25) break;
  }
  return out;
}

function stripJsonCodeFence(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*\r?\n([\s\S]*?)\r?\n```$/i);
  return fenceMatch ? fenceMatch[1].trim() : trimmed;
}

function parseJsonTasks(
  rawText: string,
  defaults: TaskImportDefaults,
  teamProfiles: Profile[],
  milestones: Milestone[]
): ParseImportResult {
  const cleaned = stripJsonCodeFence(rawText);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    return {
      detectedFormat: "json",
      tasks: [],
      errors: [
        `JSON ayrıştırılamadı: ${
          err instanceof Error ? err.message : "Geçersiz sözdizimi"
        }`,
      ],
    };
  }

  let items: unknown[] = [];
  if (Array.isArray(parsed)) {
    items = parsed;
  } else if (parsed && typeof parsed === "object") {
    const rec = parsed as Record<string, unknown>;
    const candidate = pickField(rec, [
      "tasks",
      "gorevler",
      "items",
      "list",
      "data",
    ]);
    if (Array.isArray(candidate)) {
      items = candidate;
    } else if (
      typeof pickField(rec, ["title", "baslik", "name", "task", "gorev"]) ===
      "string"
    ) {
      items = [rec];
    }
  }

  if (items.length === 0) {
    return {
      detectedFormat: "json",
      tasks: [],
      errors: [
        'JSON içinde görev dizisi bulunamadı. Kök dizi `[...]` veya `{ "tasks": [...] }` formatını kullanın.',
      ],
    };
  }

  const tasks: ParsedImportTask[] = [];
  const errors: string[] = [];

  items.forEach((entry, idx) => {
    if (typeof entry === "string") {
      const title = entry.trim();
      if (title.length < 2) {
        errors.push(`#${idx + 1}: Görev başlığı en az 2 karakter olmalı.`);
        return;
      }
      const defMs = defaults.defaultMilestoneId
        ? milestones.find((m) => m.id === defaults.defaultMilestoneId) ?? null
        : null;
      const defAsg = defaults.defaultAssigneeId
        ? teamProfiles.find((p) => p.id === defaults.defaultAssigneeId) ?? null
        : null;

      tasks.push({
        tempKey: `import-${idx}-${title.slice(0, 12)}`,
        title: title.slice(0, 140),
        description_md: "",
        status: defaults.defaultStatus,
        priority: defaults.defaultPriority,
        ue_tags: [],
        assignee_id: defAsg?.id ?? null,
        assignee_label: defAsg?.display_name ?? null,
        milestone_id: defMs?.id ?? null,
        milestone_label: defMs?.title ?? null,
        subtasks: [],
        warnings: [],
      });
      return;
    }

    if (!entry || typeof entry !== "object") {
      errors.push(`#${idx + 1}: Geçersiz görev nesnesi.`);
      return;
    }

    const rec = entry as Record<string, unknown>;
    const rawTitle = pickField(rec, ["title", "baslik", "name", "task", "gorev"]);
    const title = typeof rawTitle === "string" ? rawTitle.trim() : "";
    if (title.length < 2) {
      errors.push(`#${idx + 1}: Görev başlığı eksik veya 2 karakterden kısa.`);
      return;
    }

    const warnings: string[] = [];
    if (title.length > 140) {
      warnings.push("Başlık 140 karaktere kısaltıldı.");
    }

    const rawDesc = pickField(rec, [
      "description_md",
      "description",
      "aciklama",
      "details",
      "detay",
      "body",
    ]);
    const description_md =
      typeof rawDesc === "string" ? rawDesc.trim().slice(0, 15000) : "";

    const rawStatus = pickField(rec, ["status", "durum", "column", "sutun"]);
    const parsedStatus =
      typeof rawStatus === "string" ? normalizeTaskStatus(rawStatus) : null;
    if (typeof rawStatus === "string" && rawStatus.trim() && !parsedStatus) {
      warnings.push(`Bilinmeyen durum "${rawStatus}", varsayılan kullanıldı.`);
    }
    const status = defaults.overrideStatus
      ? defaults.defaultStatus
      : parsedStatus ?? defaults.defaultStatus;

    const rawPriority = pickField(rec, ["priority", "oncelik"]);
    const parsedPriority =
      typeof rawPriority === "string"
        ? normalizeTaskPriority(rawPriority)
        : null;
    if (
      typeof rawPriority === "string" &&
      rawPriority.trim() &&
      !parsedPriority
    ) {
      warnings.push(
        `Bilinmeyen öncelik "${rawPriority}", varsayılan kullanıldı.`
      );
    }
    const priority = defaults.overridePriority
      ? defaults.defaultPriority
      : parsedPriority ?? defaults.defaultPriority;

    const rawTags = pickField(rec, [
      "ue_tags",
      "tags",
      "etiketler",
      "etiket",
      "disiplin",
    ]);
    const ue_tags = resolveTagsList(rawTags);

    const rawAssignee = pickField(rec, [
      "assignee_id",
      "assignee",
      "atanan",
      "kisi",
      "owner",
    ]);
    const assigneeRes =
      typeof rawAssignee === "string"
        ? resolveAssignee(rawAssignee, teamProfiles)
        : { id: null, label: null };
    if (assigneeRes.warning) warnings.push(assigneeRes.warning);

    const defAssignee = defaults.defaultAssigneeId
      ? teamProfiles.find((p) => p.id === defaults.defaultAssigneeId) ?? null
      : null;

    const rawMilestone = pickField(rec, [
      "milestone_id",
      "milestone",
      "sistem",
      "hedef",
      "system",
      "phase",
    ]);
    const milestoneRes =
      typeof rawMilestone === "string"
        ? resolveMilestone(rawMilestone, milestones)
        : { id: null, label: null };
    if (milestoneRes.warning) warnings.push(milestoneRes.warning);

    const defMilestone = defaults.defaultMilestoneId
      ? milestones.find((m) => m.id === defaults.defaultMilestoneId) ?? null
      : null;

    const milestone_id = defaults.overrideMilestone
      ? defMilestone?.id ?? null
      : milestoneRes.id ?? defMilestone?.id ?? null;
    const milestone_label = defaults.overrideMilestone
      ? defMilestone?.title ?? null
      : milestoneRes.label ?? defMilestone?.title ?? null;

    const subtasks = parseSubtasksField(
      pickField(rec, ["subtasks", "alt_gorevler", "checklist"])
    );

    tasks.push({
      tempKey: `import-${idx}-${title.slice(0, 12)}`,
      title: title.slice(0, 140),
      description_md,
      status,
      priority,
      ue_tags,
      assignee_id: assigneeRes.id ?? defAssignee?.id ?? null,
      assignee_label: assigneeRes.label ?? defAssignee?.display_name ?? null,
      milestone_id,
      milestone_label,
      subtasks,
      warnings,
    });
  });

  return {
    detectedFormat: "json",
    tasks,
    errors,
  };
}

function extractInlineTokens(
  rawText: string,
  defaults: TaskImportDefaults,
  teamProfiles: Profile[],
  milestones: Milestone[]
): {
  cleanTitle: string;
  status: TaskStatus | null;
  priority: TaskPriority | null;
  tags: string[];
  assigneeId: string | null;
  assigneeLabel: string | null;
  milestoneId: string | null;
  milestoneLabel: string | null;
} {
  let text = rawText.trim();
  let status: TaskStatus | null = null;
  let priority: TaskPriority | null = null;
  const tags: string[] = [];
  let assigneeId: string | null = null;
  let assigneeLabel: string | null = null;
  let milestoneId: string | null = null;
  let milestoneLabel: string | null = null;

  // Bracket metadata like [Yüksek] [Blueprint, C++] [Todo]
  text = text.replace(/\[([^\]]+)\]/g, (full, inner: string) => {
    const pieces = inner.split(/[,;|]/).map((s) => s.trim()).filter(Boolean);
    let consumedAll = true;
    const leftover: string[] = [];

    for (const piece of pieces) {
      const p = normalizeTaskPriority(piece);
      if (p) {
        priority = p;
        continue;
      }
      const st = normalizeTaskStatus(piece);
      if (st) {
        status = st;
        continue;
      }
      const ms = resolveMilestone(piece, milestones);
      if (ms.id) {
        milestoneId = ms.id;
        milestoneLabel = ms.label;
        continue;
      }
      const asg = resolveAssignee(piece, teamProfiles);
      if (asg.id) {
        assigneeId = asg.id;
        assigneeLabel = asg.label;
        continue;
      }
      const resolvedTag = resolveTagName(piece);
      const isKnownTag = UE_DISCIPLINE_TAGS.some(
        (t) => t === resolvedTag
      );
      if (resolvedTag && isKnownTag) {
        if (!tags.includes(resolvedTag) && tags.length < 10) {
          tags.push(resolvedTag);
        }
        continue;
      }
      consumedAll = false;
      leftover.push(piece);
    }

    return consumedAll ? "" : `[${leftover.join(", ")}]`;
  });

  // Inline #hashtags like #Blueprint #VFX
  text = text.replace(/(?:^|\s)#([A-Za-z0-9_+ğüşıöçĞÜŞİÖÇ-]{2,24})/g, (m, token: string) => {
    const p = normalizeTaskPriority(token);
    if (p) {
      priority = p;
      return "";
    }
    const resolved = resolveTagName(token);
    if (resolved && !tags.includes(resolved) && tags.length < 10) {
      tags.push(resolved);
    }
    return "";
  });

  // Inline @mention for assignee
  text = text.replace(/(?:^|\s)@([A-Za-z0-9_.-ğüşıöçĞÜŞİÖÇ]{2,32})/g, (m, token: string) => {
    const asg = resolveAssignee(token, teamProfiles);
    if (asg.id) {
      assigneeId = asg.id;
      assigneeLabel = asg.label;
      return "";
    }
    return m;
  });

  const cleanTitle = text.replace(/\s+/g, " ").trim();
  void defaults;
  return {
    cleanTitle,
    status,
    priority,
    tags,
    assigneeId,
    assigneeLabel,
    milestoneId,
    milestoneLabel,
  };
}

function parseMetadataLine(
  line: string
): { key: string; value: string } | null {
  const m = line.match(
    /^\s*(?:[-*]\s*)?(?:\*\*)?([A-Za-zÇĞIİÖŞÜçğıiöşü\s/_-]+?)(?:\*\*)?\s*:\s*(.+?)\s*$/
  );
  if (!m) return null;
  const keyNorm = normalizeText(m[1]).replace(/\s+/g, "_");
  const known = new Set([
    "durum",
    "status",
    "sutun",
    "column",
    "oncelik",
    "priority",
    "etiket",
    "etiketler",
    "tag",
    "tags",
    "ue_tags",
    "disiplin",
    "kisi",
    "atanan",
    "assignee",
    "owner",
    "sistem",
    "hedef",
    "milestone",
    "phase",
    "aciklama",
    "description",
  ]);
  if (!known.has(keyNorm)) return null;
  return { key: keyNorm, value: m[2].trim() };
}

function parseMarkdownTasks(
  rawText: string,
  defaults: TaskImportDefaults,
  teamProfiles: Profile[],
  milestones: Milestone[]
): ParseImportResult {
  const lines = rawText.replace(/\r\n/g, "\n").split("\n");

  const headingIndices: { index: number; level: number; text: string }[] = [];
  let inFence = false;
  lines.forEach((line, idx) => {
    if (line.trim().startsWith("```")) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;
    const h = line.match(/^(#{1,4})\s+(.+)$/);
    if (h) {
      headingIndices.push({
        index: idx,
        level: h[1].length,
        text: h[2].trim(),
      });
    }
  });

  // Decide if this document uses headings as individual tasks (## or ###)
  // A heading is a "task heading" if it's >= 2 and doesn't immediately wrap deeper headings.
  const taskHeadingLines = new Set<number>();
  const contextHeadingLines = new Set<number>();

  for (let i = 0; i < headingIndices.length; i++) {
    const cur = headingIndices[i];
    const next = headingIndices[i + 1];
    if (cur.level === 1) {
      contextHeadingLines.add(cur.index);
      continue;
    }

    // Check if there is non-empty non-heading content before next heading
    const endLine = next ? next.index : lines.length;
    const slice = lines.slice(cur.index + 1, endLine);
    const hasContent = slice.some((l) => l.trim().length > 0);
    const hasDeeperChildHeading = Boolean(next && next.level > cur.level);

    // If this heading wraps deeper subheadings without its own checklist/metadata or looks like a status/milestone group
    const asStatus = normalizeTaskStatus(cur.text);
    const asMilestone = resolveMilestone(cur.text, milestones).id;
    const isGroupHeader =
      hasDeeperChildHeading &&
      (!hasContent || Boolean(asStatus || asMilestone) || slice.every((l) => !l.trim().startsWith("-")));

    if (isGroupHeader) {
      contextHeadingLines.add(cur.index);
    } else if (!hasDeeperChildHeading && (hasContent || headingIndices.length >= 1)) {
      // Wait: if there are NO sub-headings anywhere AND bullets exist directly under a single ## status/milestone header, prefer flat bullets!
      if ((asStatus || asMilestone) && hasContent && slice.some((l) => /^\s*(?:[-*]|\d+\.)\s+/.test(l))) {
        // If it's literally "## Yapılacaklar" or "## Core Combat" followed by a checklist of tasks, treat bullets as tasks!
        const hasSubheadingsAnywhere = headingIndices.some((x) => x.level > cur.level);
        if (!hasSubheadingsAnywhere && !slice.some((l) => parseMetadataLine(l))) {
          contextHeadingLines.add(cur.index);
          continue;
        }
      }
      taskHeadingLines.add(cur.index);
    } else {
      contextHeadingLines.add(cur.index);
    }
  }

  const tasks: ParsedImportTask[] = [];
  const errors: string[] = [];

  const defMilestone = defaults.defaultMilestoneId
    ? milestones.find((m) => m.id === defaults.defaultMilestoneId) ?? null
    : null;
  const defAssignee = defaults.defaultAssigneeId
    ? teamProfiles.find((p) => p.id === defaults.defaultAssigneeId) ?? null
    : null;

  if (taskHeadingLines.size > 0) {
    let ctxStatus: TaskStatus | null = null;
    let ctxMilestoneId: string | null = null;
    let ctxMilestoneLabel: string | null = null;

    let current: ParsedImportTask | null = null;
    let descLines: string[] = [];

    const flushCurrent = () => {
      if (!current) return;
      const desc = descLines.join("\n").trim().slice(0, 15000);
      current.description_md = desc;
      if (current.title.length >= 2) {
        tasks.push(current);
      } else {
        errors.push(`Başlık çok kısa olduğu için atlandı: "${current.title}"`);
      }
      current = null;
      descLines = [];
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (contextHeadingLines.has(i)) {
        flushCurrent();
        const headingText = line.replace(/^#{1,4}\s+/, "").trim();
        const st = normalizeTaskStatus(headingText);
        if (st) ctxStatus = st;
        const ms = resolveMilestone(headingText, milestones);
        if (ms.id) {
          ctxMilestoneId = ms.id;
          ctxMilestoneLabel = ms.label;
        }
        continue;
      }

      if (taskHeadingLines.has(i)) {
        flushCurrent();
        const rawHeading = line.replace(/^#{1,4}\s+/, "").trim();
        const tokens = extractInlineTokens(
          rawHeading,
          defaults,
          teamProfiles,
          milestones
        );

        const resolvedStatus = defaults.overrideStatus
          ? defaults.defaultStatus
          : tokens.status ?? ctxStatus ?? defaults.defaultStatus;
        const resolvedPriority = defaults.overridePriority
          ? defaults.defaultPriority
          : tokens.priority ?? defaults.defaultPriority;
        const resolvedMilestoneId = defaults.overrideMilestone
          ? defMilestone?.id ?? null
          : tokens.milestoneId ?? ctxMilestoneId ?? defMilestone?.id ?? null;
        const resolvedMilestoneLabel = defaults.overrideMilestone
          ? defMilestone?.title ?? null
          : tokens.milestoneLabel ?? ctxMilestoneLabel ?? defMilestone?.title ?? null;

        current = {
          tempKey: `md-h-${i}-${tokens.cleanTitle.slice(0, 12)}`,
          title: (tokens.cleanTitle || rawHeading).slice(0, 140),
          description_md: "",
          status: resolvedStatus,
          priority: resolvedPriority,
          ue_tags: tokens.tags,
          assignee_id: tokens.assigneeId ?? defAssignee?.id ?? null,
          assignee_label:
            tokens.assigneeLabel ?? defAssignee?.display_name ?? null,
          milestone_id: resolvedMilestoneId,
          milestone_label: resolvedMilestoneLabel,
          subtasks: [],
          warnings:
            rawHeading.length > 140
              ? ["Başlık 140 karaktere kısaltıldı."]
              : [],
        };
        continue;
      }

      if (!current) continue;

      const meta = parseMetadataLine(line);
      if (meta) {
        if (
          ["durum", "status", "sutun", "column"].includes(meta.key) &&
          !defaults.overrideStatus
        ) {
          const st = normalizeTaskStatus(meta.value);
          if (st) current.status = st;
          else current.warnings.push(`Durum anlaşılmadı: "${meta.value}"`);
        } else if (
          ["oncelik", "priority"].includes(meta.key) &&
          !defaults.overridePriority
        ) {
          const pr = normalizeTaskPriority(meta.value);
          if (pr) current.priority = pr;
          else current.warnings.push(`Öncelik anlaşılmadı: "${meta.value}"`);
        } else if (
          ["etiket", "etiketler", "tag", "tags", "ue_tags", "disiplin"].includes(
            meta.key
          )
        ) {
          const parsedTags = resolveTagsList(meta.value);
          for (const t of parsedTags) {
            if (!current.ue_tags.includes(t) && current.ue_tags.length < 10) {
              current.ue_tags.push(t);
            }
          }
        } else if (
          ["kisi", "atanan", "assignee", "owner"].includes(meta.key)
        ) {
          const asg = resolveAssignee(meta.value, teamProfiles);
          if (asg.id) {
            current.assignee_id = asg.id;
            current.assignee_label = asg.label;
          } else if (asg.warning) {
            current.warnings.push(asg.warning);
          }
        } else if (
          ["sistem", "hedef", "milestone", "phase"].includes(meta.key) &&
          !defaults.overrideMilestone
        ) {
          const ms = resolveMilestone(meta.value, milestones);
          if (ms.id) {
            current.milestone_id = ms.id;
            current.milestone_label = ms.label;
          } else if (ms.warning) {
            current.warnings.push(ms.warning);
          }
        } else if (["aciklama", "description"].includes(meta.key)) {
          descLines.push(meta.value);
        }
        continue;
      }

      const checkboxMatch = line.match(/^\s*[-*]\s+\[( |x|X)\]\s+(.+)$/);
      if (checkboxMatch && current.subtasks.length < 25) {
        current.subtasks.push({
          title: checkboxMatch[2].trim().slice(0, 180),
          is_done: checkboxMatch[1].toLowerCase() === "x",
        });
        continue;
      }

      descLines.push(line);
    }

    flushCurrent();
  } else {
    // Flat Markdown bullet/numbered/checkbox mode
    let ctxStatus: TaskStatus | null = null;
    let ctxMilestoneId: string | null = null;
    let ctxMilestoneLabel: string | null = null;
    let lastTask: ParsedImportTask | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const heading = line.match(/^#{1,4}\s+(.+)$/);
      if (heading) {
        lastTask = null;
        const headingText = heading[1].trim();
        const st = normalizeTaskStatus(headingText);
        if (st) ctxStatus = st;
        const ms = resolveMilestone(headingText, milestones);
        if (ms.id) {
          ctxMilestoneId = ms.id;
          ctxMilestoneLabel = ms.label;
        }
        continue;
      }

      const bullet = line.match(
        /^(\s*)(?:[-*]|\d+\.)\s+(?:\[( |x|X)\]\s+)?(.+)$/
      );
      if (!bullet) continue;

      const indent = bullet[1].length;
      const checked = bullet[2];
      const rawContent = bullet[3].trim();

      if (indent >= 2 && lastTask) {
        if (lastTask.subtasks.length < 25) {
          lastTask.subtasks.push({
            title: rawContent.slice(0, 180),
            is_done: Boolean(checked && checked.toLowerCase() === "x"),
          });
        }
        continue;
      }

      const tokens = extractInlineTokens(
        rawContent,
        defaults,
        teamProfiles,
        milestones
      );

      if (tokens.cleanTitle.length < 2) {
        errors.push(`Satır ${i + 1}: Görev başlığı 2 karakterden kısa.`);
        continue;
      }

      const checkboxStatus: TaskStatus | null =
        checked && checked.toLowerCase() === "x" ? "done" : null;

      const resolvedStatus = defaults.overrideStatus
        ? defaults.defaultStatus
        : tokens.status ?? checkboxStatus ?? ctxStatus ?? defaults.defaultStatus;
      const resolvedPriority = defaults.overridePriority
        ? defaults.defaultPriority
        : tokens.priority ?? defaults.defaultPriority;
      const resolvedMilestoneId = defaults.overrideMilestone
        ? defMilestone?.id ?? null
        : tokens.milestoneId ?? ctxMilestoneId ?? defMilestone?.id ?? null;
      const resolvedMilestoneLabel = defaults.overrideMilestone
        ? defMilestone?.title ?? null
        : tokens.milestoneLabel ?? ctxMilestoneLabel ?? defMilestone?.title ?? null;

      const item: ParsedImportTask = {
        tempKey: `md-b-${i}-${tokens.cleanTitle.slice(0, 12)}`,
        title: tokens.cleanTitle.slice(0, 140),
        description_md: "",
        status: resolvedStatus,
        priority: resolvedPriority,
        ue_tags: tokens.tags,
        assignee_id: tokens.assigneeId ?? defAssignee?.id ?? null,
        assignee_label: tokens.assigneeLabel ?? defAssignee?.display_name ?? null,
        milestone_id: resolvedMilestoneId,
        milestone_label: resolvedMilestoneLabel,
        subtasks: [],
        warnings: [],
      };

      tasks.push(item);
      lastTask = item;
    }
  }

  return {
    detectedFormat: "markdown",
    tasks,
    errors,
  };
}

export function parseBulkTaskInput(
  rawText: string,
  mode: ImportFormatMode,
  defaults: TaskImportDefaults,
  teamProfiles: Profile[],
  milestones: Milestone[]
): ParseImportResult {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return {
      detectedFormat: "empty",
      tasks: [],
      errors: [],
    };
  }

  let effectiveFormat: "json" | "markdown";
  if (mode === "json" || mode === "markdown") {
    effectiveFormat = mode;
  } else {
    const unfenced = stripJsonCodeFence(trimmed);
    effectiveFormat =
      unfenced.startsWith("[") || unfenced.startsWith("{")
        ? "json"
        : "markdown";
  }

  if (effectiveFormat === "json") {
    return parseJsonTasks(trimmed, defaults, teamProfiles, milestones);
  }
  return parseMarkdownTasks(trimmed, defaults, teamProfiles, milestones);
}

export const SAMPLE_JSON_IMPORT = `[
  {
    "title": "Kanca (Grappling Hook) Çekiş Fiziği",
    "description_md": "Spring tabanlı hızlanma eğrisi ve duvar çarpışma iptali eklenecek.",
    "status": "todo",
    "priority": "high",
    "ue_tags": ["Blueprint", "C++"],
    "subtasks": [
      "CableComponent görsel ip bağlantısı",
      "Çekiş sırasında FOV kamera geçişi",
      "Havada zıplama iptali (cancel impulse)"
    ]
  },
  {
    "title": "Düşman Saldırı Uyarı VFX & Ses Senkronu",
    "description_md": "Parry penceresi açılmadan 0.25s önce kırmızı göz parlaması.",
    "status": "backlog",
    "priority": "medium",
    "ue_tags": ["VFX (Niagara)", "Audio"],
    "subtasks": [
      "Niagara flash emitter",
      "MetaSound parry cue tetiklemesi"
    ]
  }
]`;

export const SAMPLE_MARKDOWN_IMPORT = `## [Yüksek] Kanca (Grappling Hook) Çekiş Fiziği [Blueprint, C++]
- Durum: Yapılacak
- [ ] CableComponent görsel ip bağlantısı
- [ ] Çekiş sırasında FOV kamera geçişi
- [ ] Havada zıplama iptali
Spring tabanlı hızlanma eğrisi ve duvar çarpışma iptali eklenecek.

## [Orta] Düşman Saldırı Uyarı VFX & Ses Senkronu #VFX #Audio
- Durum: Backlog
- [ ] Niagara flash emitter
- [ ] MetaSound parry cue tetiklemesi
Parry penceresi açılmadan 0.25s önce kırmızı göz parlaması.`;
