import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const interSans = Inter({
  variable: "--font-inter-sans",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "UE5 Studio Hub — Fikir, Görev & Asset Yönetimi",
  description:
    "3 kişilik Unreal Engine 5 oyun geliştirme ekibi için fikir panosu, Kanban görev yönetimi, milestone takibi ve asset kilit merkezi.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="tr"
      suppressHydrationWarning
      className={`${interSans.variable} ${jetbrainsMono.variable} dark h-full antialiased`}
    >
      <head>
        <meta name="darkreader-lock" />
        <meta name="color-scheme" content="dark" />
      </head>
      <body
        suppressHydrationWarning
        className="min-h-full bg-[#0c1017] text-[#edf2f8] flex flex-col"
      >
        {children}
      </body>
    </html>
  );
}
