import type { Metadata } from "next";
import { Sora, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const sora = Sora({ subsets: ["latin"], variable: "--font-sora", weight: ["600", "700", "800"] });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jbmono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jbmono" });

export const metadata: Metadata = {
  title: "House System — Command Center",
  description: "Hệ thống quản lý House: điểm số, thông báo và liên lạc thời gian thực.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${sora.variable} ${inter.variable} ${jbmono.variable}`}>
      <body className="bg-ink-bg text-ink-text antialiased min-h-screen">{children}</body>
    </html>
  );
}
