"use client";

import { useState } from "react";
import { Dialog } from "./ui";

// Füllt die Inselliste-Vorlage mit allen aktiven Jugendlichen und startet den Download.
// Der eingegebene JF-Name landet in Spalte „JF:" und im Dateinamen (Inselliste <Name>.xlsx).
export function InsellisteDialog({ onClose }: { onClose: () => void }) {
  const [jf, setJf] = useState("");
  const name = jf.trim();

  function herunterladen() {
    if (!name) return;
    // Attachment-Download – die SPA bleibt geladen, Browser startet nur den Download.
    window.location.href = `/api/v1/export/inselliste?jf=${encodeURIComponent(name)}`;
    onClose();
  }

  return (
    <Dialog title="Inselliste" onClose={onClose}>
      <div style={{ fontSize: 13, color: "var(--color-neutral-400)", lineHeight: 1.5, marginBottom: 12 }}>
        Inselliste als Excel-Datei (.xlsx) mit allen aktiven Jugendlichen. Der Name der Jugendfeuerwehr
        erscheint in der Liste und im Dateinamen.
      </div>

      <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12.5, color: "var(--color-neutral-400)" }}>
        Name der Jugendfeuerwehr
        <input
          className="input"
          value={jf}
          onChange={(e) => setJf(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && herunterladen()}
          placeholder="z. B. Rottorf"
          autoFocus
        />
      </label>

      <div className="dialog-actions" style={{ marginTop: 18 }}>
        <button className="btn btn-secondary" onClick={onClose}>Abbrechen</button>
        <button className="btn btn-primary" onClick={herunterladen} disabled={!name}>
          <i className="ph ph-download-simple" />
          Herunterladen
        </button>
      </div>
    </Dialog>
  );
}
