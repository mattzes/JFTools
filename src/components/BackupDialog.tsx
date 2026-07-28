"use client";

import { useRef, useState } from "react";
import { Dialog } from "./ui";
import { useConfirm } from "./ConfirmProvider";

// Backup-Dialog: Datenbestand herunterladen oder ein Backup importieren (ersetzt alles).
export function BackupDialog({ onClose }: { onClose: () => void }) {
  const confirm = useConfirm();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function importBackup(file: File) {
    setMsg(null);
    setBusy(true);
    try {
      const text = await file.text();
      const res = await fetch("/api/v1/backup", { method: "POST", headers: { "Content-Type": "application/json" }, body: text });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(b?.error ?? `Fehler ${res.status}`);
      }
      setMsg("Backup erfolgreich eingespielt. Seite neu laden empfohlen.");
    } catch (e) {
      setMsg("Import fehlgeschlagen: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog title="Backup" onClose={onClose}>
      <div style={{ fontSize: 13, color: "var(--color-neutral-400)", lineHeight: 1.5 }}>
        Sichere den kompletten Datenbestand als Datei oder spiele ein früheres Backup wieder ein.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <a className="btn btn-primary" href="/api/v1/backup" download style={{ justifyContent: "center" }}>
          <i className="ph ph-download-simple" />
          Backup herunterladen
        </a>
        <button className="btn btn-secondary" onClick={() => fileRef.current?.click()} disabled={busy} style={{ justifyContent: "center" }}>
          <i className="ph ph-upload-simple" />
          Backup importieren
        </button>
      </div>
      {msg && (
        <div style={{ fontSize: 12.5, color: msg.startsWith("Import fehl") ? "var(--danger)" : "var(--color-accent-300)" }}>{msg}</div>
      )}
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
      <div className="dialog-actions">
        <button className="btn btn-secondary" onClick={onClose}>Schließen</button>
      </div>
    </Dialog>
  );
}
