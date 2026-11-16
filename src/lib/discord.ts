import "server-only";
import { after } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface DiscordNotificationPayload {
  title: string;
  description?: string;
  color?: number;
  fields?: DiscordEmbedField[];
}

async function resolveDiscordConfig(): Promise<{
  webhookUrl: string | null;
  projectName: string;
  ueVersion: string;
}> {
  const envFallback = process.env.DISCORD_WEBHOOK_URL?.trim() || null;

  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      return {
        webhookUrl: envFallback,
        projectName: "UE5 Studio Hub",
        ueVersion: "UE 5",
      };
    }

    const { data } = await supabase
      .from("workspace_settings")
      .select("project_name, ue_version, discord_webhook_url")
      .eq("id", 1)
      .maybeSingle();

    return {
      webhookUrl: data?.discord_webhook_url?.trim() || envFallback,
      projectName: data?.project_name || "UE5 Studio Hub",
      ueVersion: data?.ue_version || "UE 5",
    };
  } catch {
    return {
      webhookUrl: envFallback,
      projectName: "UE5 Studio Hub",
      ueVersion: "UE 5",
    };
  }
}

export async function sendDiscordNotification(
  payload: DiscordNotificationPayload
): Promise<{ ok: boolean; error?: string }> {
  const { webhookUrl, projectName, ueVersion } = await resolveDiscordConfig();
  if (!webhookUrl) {
    return { ok: false, error: "Discord Webhook URL tanımlanmamış." };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(3000),
      body: JSON.stringify({
        username: `${projectName} (${ueVersion})`,
        embeds: [
          {
            title: payload.title,
            description: payload.description,
            color: payload.color ?? 0xf59e0b,
            fields: payload.fields ?? [],
            footer: {
              text: `${projectName} • ${ueVersion}`,
            },
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `Discord HTTP ${response.status} döndü.`,
      };
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Discord bildirimi gönderilemedi.",
    };
  }
}

export function queueDiscordNotification(
  payload: DiscordNotificationPayload
): void {
  after(async () => {
    await sendDiscordNotification(payload);
  });
}
