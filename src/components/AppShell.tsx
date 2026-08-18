"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BackupDialog } from "./BackupDialog";
import { ExportDialog } from "./ExportDialog";
import { InsellisteDialog } from "./InsellisteDialog";

const NAV_ITEMS = [
  { href: "/", icon: "ph-house", label: "Übersicht", key: "dashboard" },
  { href: "/personen", icon: "ph-users-three", label: "Personen", key: "personen" },
  { href: "/termine", icon: "ph-calendar-dots", label: "Termine", key: "termine" },
  { href: "/checkliste", icon: "ph-clipboard-text", label: "Checkliste", key: "rueck" },
  { href: "/abzeichen", icon: "ph-medal", label: "Abzeichen", key: "abzeichen" },
  { href: "/wettbewerbe", icon: "ph-trophy", label: "Wettbewerbe", key: "wettbewerb" },
  { href: "/training", icon: "ph-timer", label: "Training", key: "training" },
  { href: "/kleiderkammer", icon: "ph-t-shirt", label: "Kleiderkammer", key: "kleiderkammer" },
];

// Mobil passen nicht alle 8 Bereiche in die Tab-Bar → Start · Personen · Termine · Planer · Mehr
const TAB_ITEMS = [
  { href: "/", icon: "ph-house", label: "Start", match: ["/"] },
  { href: "/personen", icon: "ph-users-three", label: "Personen", match: ["/personen"] },
  { href: "/termine", icon: "ph-calendar-dots", label: "Termine", match: ["/termine"] },
  { href: "/wettbewerbe", icon: "ph-trophy", label: "Planer", match: ["/wettbewerbe"] },
  { href: "/mehr", icon: "ph-dots-three-outline", label: "Mehr", match: ["/mehr", "/checkliste", "/abzeichen", "/training", "/kleiderkammer"] },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [insellisteOpen, setInsellisteOpen] = useState(false);

  // Login-Seite ohne App-Navigation rendern.
  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <div className="flex h-dvh overflow-hidden">
      {/* NavRail — Desktop */}
      <nav
        className="hidden lg:flex"
        style={{
          width: collapsed ? 64 : 216,
          flex: "none",
          height: "100%",
          flexDirection: "column",
          background: "#1b1d29",
          borderRight: "1px solid var(--color-divider)",
          padding: "16px 12px",
          gap: 2,
          transition: "width 0.18s ease",
        }}
      >
        <div
          style={{
            display: "flex", alignItems: "center",
            justifyContent: collapsed ? "center" : "space-between",
            gap: 9, padding: "6px 8px 16px",
          }}
        >
          {!collapsed && (
            <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/icon.svg"
                alt="JF Verwaltung"
                width={30}
                height={30}
                style={{ flex: "none", borderRadius: 8 }}
              />
              <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
                <b style={{ fontSize: 14, fontWeight: 600 }}>JF Verwaltung</b>
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Menü ausklappen" : "Menü einklappen"}
            title={collapsed ? "Menü ausklappen" : "Menü einklappen"}
            style={{
              flex: "none", width: 30, height: 30, borderRadius: 7, border: "none",
              display: "grid", placeItems: "center", cursor: "pointer",
              background: "transparent", color: "var(--color-neutral-500)", fontSize: 16,
            }}
          >
            <i className={`ph ${collapsed ? "ph-caret-right" : "ph-caret-left"}`} />
          </button>
        </div>
        {NAV_ITEMS.map((it) => {
          const on = isActive(pathname, it.href);
          return (
            <Link
              key={it.key}
              href={it.href}
              aria-current={on ? "page" : undefined}
              title={collapsed ? it.label : undefined}
              style={{
                display: "flex", alignItems: "center", gap: 11, padding: "9px 11px",
                justifyContent: collapsed ? "center" : "flex-start",
                borderRadius: 8, fontSize: 13, textDecoration: "none",
                ...(on
                  ? { background: "color-mix(in srgb,var(--color-accent) 16%,transparent)", color: "var(--color-accent-200)", fontWeight: 600 }
                  : { color: "var(--color-neutral-400)", fontWeight: 400 }),
              }}
            >
              <i className={`ph ${it.icon}`} style={{ fontSize: 18 }} />
              {!collapsed && <span>{it.label}</span>}
            </Link>
          );
        })}
        <div style={{ marginTop: "auto", paddingTop: 12, borderTop: "1px solid var(--color-divider)" }}>
          <button
            type="button"
            onClick={() => setExportOpen(true)}
            title={collapsed ? "Excel-Export" : undefined}
            style={{
              display: "flex", alignItems: "center", gap: 11, padding: "9px 11px", width: "100%",
              justifyContent: collapsed ? "center" : "flex-start", border: 0, background: "transparent",
              borderRadius: 8, fontSize: 13, color: "var(--color-neutral-300)", cursor: "pointer", textAlign: "left",
            }}
          >
            <i className="ph ph-file-xls" style={{ fontSize: 18 }} />
            {!collapsed && <span>Excel-Export</span>}
          </button>
          <button
            type="button"
            onClick={() => setInsellisteOpen(true)}
            title={collapsed ? "Inselliste" : undefined}
            style={{
              display: "flex", alignItems: "center", gap: 11, padding: "9px 11px", width: "100%",
              justifyContent: collapsed ? "center" : "flex-start", border: 0, background: "transparent",
              borderRadius: 8, fontSize: 13, color: "var(--color-neutral-300)", cursor: "pointer", textAlign: "left",
            }}
          >
            <i className="ph ph-island" style={{ fontSize: 18 }} />
            {!collapsed && <span>Inselliste</span>}
          </button>
          <button
            type="button"
            onClick={() => setBackupOpen(true)}
            title={collapsed ? "Backup" : undefined}
            style={{
              display: "flex", alignItems: "center", gap: 11, padding: "9px 11px", width: "100%",
              justifyContent: collapsed ? "center" : "flex-start", border: 0, background: "transparent",
              borderRadius: 8, fontSize: 13, color: "var(--color-neutral-300)", cursor: "pointer", textAlign: "left",
            }}
          >
            <i className="ph ph-database" style={{ fontSize: 18 }} />
            {!collapsed && <span>Backup</span>}
          </button>
        </div>
      </nav>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden pb-16 lg:pb-0">{children}</main>
      </div>

      {/* MobileTabs — Bottom-Tab-Bar */}
      <div
        className="flex lg:hidden"
        style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
          alignItems: "stretch", justifyContent: "space-around",
          background: "#1b1d29", borderTop: "1px solid var(--color-divider)",
          padding: "7px 6px calc(9px + env(safe-area-inset-bottom))",
        }}
      >
        {TAB_ITEMS.map((it) => {
          const on = it.match.some((m) => (m === "/" ? pathname === "/" : pathname.startsWith(m)));
          return (
            <Link
              key={it.href}
              href={it.href}
              style={{
                flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
                gap: 3, textDecoration: "none", padding: "2px 0",
                color: on ? "var(--color-accent-300)" : "var(--color-neutral-500)",
              }}
            >
              <i className={`ph${on ? "-fill" : ""} ${it.icon}`} style={{ fontSize: 21 }} />
              <span style={{ fontSize: 10, letterSpacing: ".01em" }}>{it.label}</span>
            </Link>
          );
        })}
      </div>

      {exportOpen && <ExportDialog onClose={() => setExportOpen(false)} />}
      {insellisteOpen && <InsellisteDialog onClose={() => setInsellisteOpen(false)} />}
      {backupOpen && <BackupDialog onClose={() => setBackupOpen(false)} />}
    </div>
  );
}
