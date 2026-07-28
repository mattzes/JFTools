import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "@phosphor-icons/web/regular";
import "@phosphor-icons/web/fill";
import "@phosphor-icons/web/bold";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { ConfirmProvider } from "@/components/ConfirmProvider";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "JF Verwaltung",
  description: "Jugendfeuerwehr-Verwaltung & Wettbewerbs-Gruppenplanung",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", shortcut: "/icon.svg", apple: "/icon.svg" },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "JF Verwaltung" },
};

export const viewport: Viewport = {
  themeColor: "#161826",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className={inter.variable}>
        <ConfirmProvider>
          <AppShell>{children}</AppShell>
        </ConfirmProvider>
      </body>
    </html>
  );
}
