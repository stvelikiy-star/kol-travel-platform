import type { Metadata } from "next";
import { CartProvider } from "@/components/cart/CartRuntime";
import { LanguageRuntime } from "@/components/i18n/LanguageRuntime";
import { KolAmbientBackground } from "@/components/visual/KolAmbientBackground";
import { MediaResilienceRuntime } from "@/components/visual/MediaResilienceRuntime";
import "./globals.css";

export const metadata: Metadata = {
  title: "КӨЛ — Всё рядом",
  description:
    "КӨЛ — современный сервис для отдыха в Кыргызстане: проживание, туры и отдых, доставка и трансфер в одном месте."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className="pb-4 sm:pb-24">
        <CartProvider>
          <KolAmbientBackground />
          <div className="relative z-[1]">{children}</div>
          <MediaResilienceRuntime />
          <LanguageRuntime />
        </CartProvider>
      </body>
    </html>
  );
}
