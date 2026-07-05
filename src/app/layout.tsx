import type { Metadata } from "next";
import { Sora, Inter, JetBrains_Mono } from "next/font/google";
import { I18nProvider } from "@/components/I18nProvider";
import { getServerLanguage } from "@/lib/i18n-server";
import "./globals.css";

const sora = Sora({ subsets: ["latin"], variable: "--font-sora", weight: ["600", "700", "800"] });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jbmono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jbmono" });

export const metadata: Metadata = {
  title: "FKS System",
  description: "House management system for scores, announcements, and realtime communication.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const language = getServerLanguage();

  return (
    <html lang={language} className={`${sora.variable} ${inter.variable} ${jbmono.variable}`}>
      <body className="bg-ink-bg text-ink-text antialiased min-h-screen">
        <I18nProvider initialLanguage={language}>{children}</I18nProvider>
      </body>
    </html>
  );
}
