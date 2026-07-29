"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { PageHeader } from "@/components/ui";
import { useConfirm } from "@/components/ConfirmProvider";
import { ExportDialog } from "@/components/ExportDialog";

const LINKS = [
  { href: "/checkliste", icon: "ph-clipboard-text", label: "Checkliste", sub: "Zettel & Einverständnis" },
  { href: "/abzeichen", icon: "ph-medal", label: "Abzeichen", sub: "Fälligkeit nach Jahr" },
  { href: "/training", icon: "ph-timer", label: "Training", sub: "Zeiten & Auswertung" },
  { href: "/kleiderkammer", icon: "ph-t-shirt", label: "Kleiderkammer", sub: "Bestand & Ausgabe" },
];

export default function MehrPage() {
  const confirm = useConfirm();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  async function importBackup(file: File) {
    setMsg(null);
    try {
      const text = await file.text();
      const res = await fetch("/api/v1/backup", { method: "POST", headers: { "Content-Type": "application/json" }, body: text });
      if (!res.ok) {
        const b = await res.json().catch(() => null);
        throw new Error(b?.error ?? `Fehler ${res.status}`);
      }
      setMsg("Backup erfolgreich eingespielt. Seite neu laden empfohlen.");
    } catch (e) {
      setMsg("Import fehlgeschlagen: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  return (
    <>
      <PageHeader title="Mehr" />
      <div style={{ flex: 1, overflowY: "auto", padding: "6px 16px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 15px", background: "var(--color-surface)", borderRadius: 11, textDecoration: "none", color: "inherit" }}>
            <span style={{ width: 38, height: 38, flex: "none", borderRadius: 10, display: "grid", placeItems: "center", fontSize: 19, background: "var(--color-accent-900)", color: "var(--color-accent-200)" }}>
              <i className={`ph ${l.icon}`} />
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{l.label}</div>
              <div style={{ fontSize: 11.5, color: "var(--color-neutral-500)" }}>{l.sub}</div>
            </div>
            <i className="ph ph-caret-right" style={{ color: "var(--color-neutral-600)" }} />
          </Link>
        ))}

        <div style={{ marginTop: 12, fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--color-neutral-600)", padding: "0 4px" }}>
          Export
        </div>
        <button
          onClick={() => setExportOpen(true)}
          style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 15px", background: "var(--color-surface)", borderRadius: 11, border: 0, color: "inherit", cursor: "pointer", textAlign: "left" }}
        >
          <span style={{ width: 38, height: 38, flex: "none", borderRadius: 10, display: "grid", placeItems: "center", fontSize: 19, background: "var(--color-accent-900)", color: "var(--color-accent-200)" }}>
            <i className="ph ph-file-xls" />
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 500 }}>Excel-Export</div>
            <div style={{ fontSize: 11.5, color: "var(--color-neutral-500)" }}>Mitgliederliste & Anwesenheit als .xlsx</div>
          </div>
        </button>

        <div style={{ marginTop: 12, fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--color-neutral-600)", padding: "0 4px" }}>
          Datensicherung
        </div>
        <a href="/api/v1/backup" download style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 15px", background: "var(--color-surface)", borderRadius: 11, textDecoration: "none", color: "inherit" }}>
          <span style={{ width: 38, height: 38, flex: "none", borderRadius: 10, display: "grid", placeItems: "center", fontSize: 19, background: "var(--color-accent-900)", color: "var(--color-accent-200)" }}>
            <i className="ph ph-download-simple" />
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 500 }}>Backup exportieren</div>
            <div style={{ fontSize: 11.5, color: "var(--color-neutral-500)" }}>Kompletter Datenbestand als Datei</div>
          </div>
        </a>
        <button
          onClick={() => fileRef.current?.click()}
          style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 15px", background: "var(--color-surface)", borderRadius: 11, border: 0, color: "inherit", cursor: "pointer", textAlign: "left" }}
        >
          <span style={{ width: 38, height: 38, flex: "none", borderRadius: 10, display: "grid", placeItems: "center", fontSize: 19, background: "var(--color-neutral-800)", color: "var(--color-neutral-300)" }}>
            <i className="ph ph-upload-simple" />
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 500 }}>Backup importieren</div>
            <div style={{ fontSize: 11.5, color: "var(--color-neutral-500)" }}>Ersetzt den gesamten Datenbestand</div>
          </div>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          style={{ display: "none" }}
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f && (await confirm({ title: "Backup einspielen", message: "Der aktuelle Datenbestand wird komplett ersetzt. Fortfahren?", confirmLabel: "Ersetzen", danger: false }))) importBackup(f);
          }}
        />
        {msg && <div style={{ fontSize: 12.5, color: msg.startsWith("Import fehl") ? "var(--danger)" : "var(--color-accent-300)", padding: "0 4px" }}>{msg}</div>}
      </div>
      {exportOpen && <ExportDialog onClose={() => setExportOpen(false)} />}
    </>
  );
}
