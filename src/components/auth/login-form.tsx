"use client";

import { useActionState, useState } from "react";
import { Gamepad2, LogIn, UserPlus, AlertCircle, CheckCircle2 } from "lucide-react";
import {
  signInAction,
  signUpAction,
  type AuthActionState,
} from "@/app/actions/auth";
import { TEAM_ROLES_PRESETS } from "@/lib/constants";

export function LoginForm({ isConfigured }: { isConfigured: boolean }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [signInState, signInFormAction, signInPending] = useActionState<
    AuthActionState,
    FormData
  >(signInAction, null);
  const [signUpState, signUpFormAction, signUpPending] = useActionState<
    AuthActionState,
    FormData
  >(signUpAction, null);

  const activeState = mode === "signin" ? signInState : signUpState;

  return (
    <div className="w-full max-w-md rounded-2xl border border-[#1f2735] bg-[#0e131c] p-6 sm:p-8 shadow-2xl shadow-black/50">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/15 text-amber-400">
          <Gamepad2 className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-zinc-100">UE5 Studio Hub</h1>
          <p className="text-xs text-zinc-400">
            3 kişilik ekip çalışma alanı girişi
          </p>
        </div>
      </div>

      {!isConfigured && (
        <div className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-200">
          <p className="font-semibold text-amber-300">
            Supabase henüz bağlanmamış
          </p>
          <p className="mt-1 text-amber-200/80">
            Giriş/kayıt işlemlerinin çalışması için{" "}
            <code className="rounded bg-black/40 px-1 py-0.5 font-mono">
              .env.local
            </code>{" "}
            dosyasına Supabase anahtarlarını eklemen gerekiyor.
          </p>
        </div>
      )}

      {/* Mode Switcher */}
      <div className="mb-6 grid grid-cols-2 rounded-xl border border-[#1f2735] bg-[#080a0f] p-1 text-xs font-medium">
        <button
          type="button"
          onClick={() => setMode("signin")}
          className={`flex items-center justify-center gap-1.5 rounded-lg py-2 transition ${
            mode === "signin"
              ? "bg-[#171e2c] text-amber-300 shadow-sm"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <LogIn className="h-3.5 w-3.5" />
          Giriş Yap
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          className={`flex items-center justify-center gap-1.5 rounded-lg py-2 transition ${
            mode === "signup"
              ? "bg-[#171e2c] text-amber-300 shadow-sm"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <UserPlus className="h-3.5 w-3.5" />
          Ekibe Katıl
        </button>
      </div>

      {activeState?.error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
          <span>{activeState.error}</span>
        </div>
      )}

      {activeState?.success && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
          <span>{activeState.success}</span>
        </div>
      )}

      {mode === "signin" ? (
        <form action={signInFormAction} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="signin-email"
              className="block text-xs font-medium text-zinc-300"
            >
              E-posta
            </label>
            <input
              id="signin-email"
              name="email"
              type="email"
              required
              placeholder="dev@studio.com"
              className="w-full rounded-lg border border-[#242e40] bg-[#090c12] px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500/60 focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="signin-password"
              className="block text-xs font-medium text-zinc-300"
            >
              Şifre
            </label>
            <input
              id="signin-password"
              name="password"
              type="password"
              required
              placeholder="••••••••"
              className="w-full rounded-lg border border-[#242e40] bg-[#090c12] px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500/60 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={signInPending || !isConfigured}
            className="w-full rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {signInPending ? "Giriş yapılıyor..." : "Stüdyoya Gir"}
          </button>
        </form>
      ) : (
        <form action={signUpFormAction} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="signup-name"
              className="block text-xs font-medium text-zinc-300"
            >
              Görünen İsim / Nick
            </label>
            <input
              id="signup-name"
              name="displayName"
              type="text"
              required
              placeholder="Örn. Ahmet"
              className="w-full rounded-lg border border-[#242e40] bg-[#090c12] px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500/60 focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="signup-role"
              className="block text-xs font-medium text-zinc-300"
            >
              UE5 Uzmanlık / Rol
            </label>
            <select
              id="signup-role"
              name="roleTitle"
              defaultValue={TEAM_ROLES_PRESETS[0]}
              className="w-full rounded-lg border border-[#242e40] bg-[#090c12] px-3 py-2.5 text-sm text-zinc-100 focus:border-amber-500/60 focus:outline-none"
            >
              {TEAM_ROLES_PRESETS.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="signup-email"
              className="block text-xs font-medium text-zinc-300"
            >
              E-posta
            </label>
            <input
              id="signup-email"
              name="email"
              type="email"
              required
              placeholder="dev@studio.com"
              className="w-full rounded-lg border border-[#242e40] bg-[#090c12] px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500/60 focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="signup-password"
              className="block text-xs font-medium text-zinc-300"
            >
              Şifre (en az 6 karakter)
            </label>
            <input
              id="signup-password"
              name="password"
              type="password"
              minLength={6}
              required
              placeholder="••••••••"
              className="w-full rounded-lg border border-[#242e40] bg-[#090c12] px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500/60 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={signUpPending || !isConfigured}
            className="w-full rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {signUpPending ? "Hesap oluşturuluyor..." : "Ekip Hesabı Oluştur"}
          </button>
        </form>
      )}
    </div>
  );
}
