import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KÖL / Issyk-Kul Travel & Delivery Platform",
  description:
    "Travel, stays, food delivery, shop and partner cabinets for Issyk-Kul."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
