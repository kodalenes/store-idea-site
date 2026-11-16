import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full bg-[#080a0f] text-[#e6ebf5] flex flex-col">
        {children}
      </body>
    </html>
  );
}
