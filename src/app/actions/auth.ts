"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { isEmailAllowedForTeam } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AuthActionState = {
  error?: string;
  success?: string;
} | null;

const signInSchema = z.object({
  email: z.string().email("Geçerli bir e-posta adresi girin.").trim(),
  password: z.string().min(6, "Şifre en az 6 karakter olmalı."),
});

const signUpSchema = z.object({
  displayName: z
    .string()
    .min(2, "İsim en az 2 karakter olmalı.")
    .max(40, "İsim en fazla 40 karakter olabilir.")
    .trim(),
  roleTitle: z
    .string()
    .min(2, "Uzmanlık/rol seçin veya yazın.")
    .max(50)
    .trim(),
  email: z.string().email("Geçerli bir e-posta adresi girin.").trim(),
  password: z.string().min(6, "Şifre en az 6 karakter olmalı."),
});

export async function signInAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form bilgilerini kontrol edin." };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { error: "Supabase ortam değişkenleri (.env.local) henüz ayarlanmamış." };
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { error: "E-posta veya şifre hatalı, ya da e-posta henüz doğrulanmamış." };
  }

  redirect("/");
}

export async function signUpAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = signUpSchema.safeParse({
    displayName: formData.get("displayName"),
    roleTitle: formData.get("roleTitle"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form bilgilerini kontrol edin." };
  }

  if (!isEmailAllowedForTeam(parsed.data.email)) {
    return {
      error:
        "Bu e-posta adresi ALLOWED_TEAM_EMAILS ekip listesinde yer almıyor.",
    };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { error: "Supabase ortam değişkenleri (.env.local) henüz ayarlanmamış." };
  }

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        display_name: parsed.data.displayName,
        role_title: parsed.data.roleTitle,
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (data.session) {
    redirect("/");
  }

  return {
    success:
      "Kayıt oluşturuldu! Supabase ayarlarında e-posta onayı açıksa gelen kutunu kontrol et, ardından giriş yap.",
  };
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  if (supabase) {
    await supabase.auth.signOut();
  }
  redirect("/login");
}
