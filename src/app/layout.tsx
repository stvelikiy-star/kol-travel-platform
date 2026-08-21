import type { Metadata } from "next";
import { LanguageRuntime } from "@/components/i18n/LanguageRuntime";
import { KolAmbientBackground } from "@/components/visual/KolAmbientBackground";
import "./globals.css";

export const metadata: Metadata = {
  title: "KÖL — Иссык-Куль / Ысык-Көл Travel Platform",
  description:
    "KÖL объединяет жильё, туры, еду, магазин, доставку и рабочие кабинеты экосистемы Иссык-Куля."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className="pb-20 sm:pb-24">
        <KolAmbientBackground />
        <div className="relative z-[1]">{children}</div>
        <LanguageRuntime />
      </body>
    </html>
  );
}
