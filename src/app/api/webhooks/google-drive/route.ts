import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { queueDiscordNotification } from "@/lib/discord";

const driveFileSchema = z.object({
  id: z.string().trim().max(200).optional(),
  name: z.string().trim().min(1).max(260),
  mimeType: z.string().trim().max(180).optional(),
  size: z.coerce.number().nonnegative().optional(),
  folderName: z.string().trim().max(160).optional(),
  url: z.string().trim().max(500).optional(),
  uploadedBy: z.string().trim().max(120).optional(),
  eventType: z.enum(["created", "updated"]).optional(),
});

const drivePayloadSchema = z.object({
  secret: z.string().optional(),
  files: z.array(driveFileSchema).min(1).max(15).optional(),
  // Tekli dosya gonderim destegi
  id: z.string().trim().max(200).optional(),
  name: z.string().trim().min(1).max(260).optional(),
  mimeType: z.string().trim().max(180).optional(),
  size: z.coerce.number().nonnegative().optional(),
  folderName: z.string().trim().max(160).optional(),
  url: z.string().trim().max(500).optional(),
  uploadedBy: z.string().trim().max(120).optional(),
  eventType: z.enum(["created", "updated"]).optional(),
});

function formatBytesForDiscord(bytes: number): string {
  if (!bytes || bytes <= 0) return "—";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function POST(request: Request) {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Geçersiz JSON gövdesi." },
      { status: 400 }
    );
  }

  const parsed = drivePayloadSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Eksik veya hatalı veri.",
      },
      { status: 400 }
    );
  }

  const expectedSecret =
    process.env.DRIVE_WEBHOOK_SECRET?.trim() || "ue5-studio-drive-secret";
  const providedSecret =
    request.headers.get("x-drive-webhook-secret")?.trim() ||
    parsed.data.secret?.trim() ||
    "";

  if (providedSecret !== expectedSecret) {
    return NextResponse.json(
      { ok: false, error: "Geçersiz webhook gizli anahtarı." },
      { status: 401 }
    );
  }

  const fileItems = parsed.data.files?.length
    ? parsed.data.files
    : parsed.data.name
      ? [
          {
            id: parsed.data.id,
            name: parsed.data.name,
            mimeType: parsed.data.mimeType,
            size: parsed.data.size,
            folderName: parsed.data.folderName,
            url: parsed.data.url,
            uploadedBy: parsed.data.uploadedBy,
            eventType: parsed.data.eventType,
          },
        ]
      : [];

  if (fileItems.length === 0) {
    return NextResponse.json(
      { ok: false, error: "En az bir dosya bilgisi gerekli." },
      { status: 400 }
    );
  }

  const { url, anonKey, isConfigured } = getSupabaseConfig();
  if (!isConfigured) {
    return NextResponse.json(
      { ok: false, error: "Supabase yapılandırılmamış." },
      { status: 503 }
    );
  }

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let insertedCount = 0;
  for (const file of fileItems) {
    const safeUrl =
      file.url && file.url.startsWith("https://")
        ? file.url
        : "https://drive.google.com";

    const { error } = await supabase.rpc("record_drive_event", {
      p_drive_file_id: file.id || crypto.randomUUID(),
      p_file_name: file.name,
      p_mime_type: file.mimeType ?? "",
      p_file_size: Math.round(file.size ?? 0),
      p_folder_name: file.folderName || "Ana Klasör",
      p_web_view_link: safeUrl,
      p_uploaded_by_name: file.uploadedBy || "Google Drive",
      p_event_type: file.eventType === "updated" ? "updated" : "created",
    });

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: `Drive kaydı yazılamadı: ${error.message}`,
        },
        { status: 500 }
      );
    }

    insertedCount += 1;
  }

  revalidateTag("studio:snapshot", { expire: 0 });

  const first = fileItems[0];
  const extraCount = fileItems.length - 1;
  queueDiscordNotification({
    title:
      fileItems.length > 1
        ? `📦 Google Drive'a ${fileItems.length} Asset Yüklendi`
        : first.eventType === "updated"
          ? `🔄 Drive Asset Güncellendi: ${first.name}`
          : `📦 Yeni Drive Asset: ${first.name}`,
    description:
      extraCount > 0
        ? fileItems
            .slice(0, 5)
            .map((f) => `• **${f.name}** (${f.folderName || "Ana Klasör"})`)
            .join("\n") +
          (fileItems.length > 5 ? `\n• +${fileItems.length - 5} dosya daha` : "")
        : first.url && first.url.startsWith("https://")
          ? `[Google Drive'da Aç](${first.url})`
          : undefined,
    color: 0x06b6d4,
    fields: [
      {
        name: "Klasör",
        value: first.folderName || "Ana Klasör",
        inline: true,
      },
      {
        name: "Yükleyen",
        value: first.uploadedBy || "Google Drive",
        inline: true,
      },
      ...(fileItems.length === 1
        ? [
            {
              name: "Boyut",
              value: formatBytesForDiscord(first.size ?? 0),
              inline: true,
            },
          ]
        : []),
    ],
  });

  return NextResponse.json({ ok: true, inserted: insertedCount });
}
