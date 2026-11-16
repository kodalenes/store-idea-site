import Link from "next/link";
import { Database, Terminal, KeyRound, ArrowRight } from "lucide-react";

export function SetupBanner() {
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 text-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/15 px-3 py-1 text-xs font-medium text-amber-300">
            <Database className="h-3.5 w-3.5" />
            Supabase Bağlantısı Bekleniyor (Önizleme Modu)
          </div>
          <h2 className="text-base font-semibold text-zinc-100">
            3 kişilik ekibi bağlamak için son 3 adım kaldı
          </h2>
          <p className="max-w-2xl text-zinc-300">
            Şu anda arayüz iskeletini önizliyorsun. Gerçek giriş, veritabanı ve
            canlı senkronizasyonu açmak için:
          </p>
          <ol className="space-y-1.5 pt-1 text-xs text-zinc-300">
            <li className="flex items-center gap-2">
              <Terminal className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              <span>
                Proje kökündeki{" "}
                <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-amber-300">
                  .env.example
                </code>{" "}
                dosyasını{" "}
                <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-amber-300">
                  .env.local
                </code>{" "}
                olarak kopyalayıp Supabase URL ve Anon Key değerlerini gir.
              </span>
            </li>
            <li className="flex items-center gap-2">
              <Database className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              <span>
                Supabase SQL Editor içinde{" "}
                <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-amber-300">
                  supabase/migrations/001_initial_schema.sql
                </code>{" "}
                dosyasını çalıştır.
              </span>
            </li>
            <li className="flex items-center gap-2">
              <KeyRound className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              <span>
                Dev sunucusunu yeniden başlat ve{" "}
                <Link
                  href="/login"
                  className="underline decoration-amber-400/60 underline-offset-2 hover:text-amber-200"
                >
                  /login
                </Link>{" "}
                sayfasından 3 ekip hesabını oluştur.
              </span>
            </li>
          </ol>
        </div>

        <Link
          href="/login"
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-amber-400"
        >
          Giriş / Kurulum Ekranı
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
