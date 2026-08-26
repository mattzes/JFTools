import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "@phosphor-icons/web/regular";
import "@phosphor-icons/web/fill";
import "@phosphor-icons/web/bold";
import "./globals.css";
import { cookies } from "next/headers";
import { AppShell } from "@/components/AppShell";
import { ConfirmProvider } from "@/components/ConfirmProvider";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { isRoleKey } from "@/lib/roles";

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
  // Kein Pinch-/Auto-Zoom → App-artiges Verhalten; verhindert u. a. das
  // iOS-Einzoomen beim Fokussieren von Eingabefeldern (<16px Schriftgröße)
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);
  const role = session && isRoleKey(session.role) ? session.role : null;

  return (
    <html lang="de">
      <body className={inter.variable}>
        <ConfirmProvider>
          <AppShell role={role}>{children}</AppShell>
        </ConfirmProvider>
      </body>
    </html>
  );
}
