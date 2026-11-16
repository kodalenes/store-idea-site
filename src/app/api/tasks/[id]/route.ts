import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Attachment, Profile, StudioComment } from "@/types/studio";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [commentsRes, attachmentsRes, profilesRes] = await Promise.all([
    supabase
      .from("comments")
      .select("*")
      .eq("target_type", "task")
      .eq("target_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("attachments")
      .select("*")
      .eq("target_type", "task")
      .eq("target_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("*"),
  ]);

  const profileMap = new Map(
    ((profilesRes.data ?? []) as Profile[]).map((p) => [p.id, p])
  );

  const comments: StudioComment[] = ((commentsRes.data ?? []) as StudioComment[]).map(
    (c) => ({
      ...c,
      author: c.author_id ? profileMap.get(c.author_id) ?? null : null,
    })
  );

  return NextResponse.json({
    comments,
    attachments: (attachmentsRes.data ?? []) as Attachment[],
  });
}
