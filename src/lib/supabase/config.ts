export function getSupabaseConfig() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";

  let url = "";
  if (rawUrl.startsWith("https://") && !rawUrl.includes("your-project-ref")) {
    try {
      url = new URL(rawUrl).origin;
    } catch {
      url = "";
    }
  }

  const isConfigured =
    url.length > 0 &&
    anonKey.length > 20 &&
    !anonKey.includes("your-anon-public-key");

  return {
    url,
    anonKey,
    isConfigured,
  };
}

export function isEmailAllowedForTeam(email: string): boolean {
  const raw = process.env.ALLOWED_TEAM_EMAILS?.trim();
  if (!raw) return true;

  const allowed = raw
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  if (allowed.length === 0) return true;
  return allowed.includes(email.trim().toLowerCase());
}
