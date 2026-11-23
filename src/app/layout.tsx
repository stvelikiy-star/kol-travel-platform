import type { Metadata } from "next";
import { CartProvider } from "@/components/cart/CartRuntime";
import { LanguageRuntime } from "@/components/i18n/LanguageRuntime";
import { KolAmbientBackground } from "@/components/visual/KolAmbientBackground";
import { MediaResilienceRuntime } from "@/components/visual/MediaResilienceRuntime";
import { KolVisitorAssistant } from "@/components/visitor/KolVisitorAssistant";
import "./globals.css";
import "./kol-redesign.css";

export const metadata: Metadata = {
  title: "KÖL — Иссык-Куль / Ысык-Көл · Платформа путешествий",
  description:
    "KÖL объединяет жильё, туры, доставку еды и товаров и рабочие кабинеты экосистемы Иссык-Куля."
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body id="top" className="pb-4 sm:pb-24">
        <CartProvider>
          <div aria-hidden="true" className="kol-prog" />
          <KolAmbientBackground />
          <div className="relative z-1">{children}</div>
          <MediaResilienceRuntime />
          <LanguageRuntime />
          <KolVisitorAssistant />
        </CartProvider>
      </body>
    </html>
  );
}
