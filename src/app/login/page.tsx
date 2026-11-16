import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";
import { getSupabaseConfig } from "@/lib/supabase/config";

export default function LoginPage() {
  const { isConfigured } = getSupabaseConfig();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#080a0f] px-4 py-12">
      <div className="mb-6 w-full max-w-md">
        {!isConfigured && (
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-amber-300"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Önizleme paneline dön
          </Link>
        )}
      </div>
      <LoginForm isConfigured={isConfigured} />
    </div>
  );
}
