"use client";

import { useMemo, useState } from "react";
import { Dialog, DatePicker } from "./ui";
import { useStoredState } from "@/lib/useStoredState";
import { PERSONEN_EXPORT_COLUMNS, PERSONEN_EXPORT_COL_KEYS } from "@/lib/domain/export-personen";

const DEFAULT_COLS = PERSONEN_EXPORT_COLUMNS.filter((c) => c.default)
  .map((c) => c.key)
  .join(",");

// Excel-Export der Mitgliederliste mit frei wählbaren Spalten + optionaler Anwesenheits-Matrix.
export function ExportDialog({ onClose }: { onClose: () => void }) {
  const [colsStr, setColsStr] = useStoredState("export.personen.cols", DEFAULT_COLS);
  const [rolle, setRolle] = useStoredState("export.personen.rolle", "alle");
  const [aktivStr, setAktivStr] = useStoredState("export.personen.aktiv", "1");
  const [anwStr, setAnwStr] = useStoredState("export.personen.anwesenheit", "0");

  const jahr = new Date().getFullYear();
  const [von, setVon] = useState(`${jahr}-01-01`);
  const [bis, setBis] = useState(new Date().toISOString().slice(0, 10));

  const nurAktive = aktivStr !== "0";
  const anwesenheit = anwStr === "1";
  const selected = useMemo(() => new Set(colsStr.split(",").filter(Boolean)), [colsStr]);

  function toggleCol(key: string) {
    const s = new Set(selected);
    if (s.has(key)) s.delete(key);
    else s.add(key);
    // In Metadaten-Reihenfolge speichern
    setColsStr(PERSONEN_EXPORT_COL_KEYS.filter((k) => s.has(k)).join(","));
  }

  const zeitraumFehlt = anwesenheit && (!von || !bis || von > bis);
  const keineSpalten = selected.size === 0;

  function exportieren() {
    const p = new URLSearchParams();
    p.set("rolle", rolle);
    p.set("aktiv", nurAktive ? "1" : "0");
    p.set("cols", PERSONEN_EXPORT_COL_KEYS.filter((k) => selected.has(k)).join(","));
    if (anwesenheit && von && bis) {
      p.set("anwesenheit", "1");
      p.set("von", von);
      p.set("bis", bis);
    }
    // Attachment-Download – die SPA bleibt geladen, Browser startet nur den Download.
    window.location.href = `/api/v1/export/personen?${p.toString()}`;
    onClose();
  }

  return (
    <Dialog title="Excel-Export" onClose={onClose}>
      <div style={{ fontSize: 13, color: "var(--color-neutral-400)", lineHeight: 1.5, marginBottom: 4 }}>
        Mitgliederliste als Excel-Datei (.xlsx). Wähle Rolle, Spalten und optional die Anwesenheit bei Terminen.
      </div>

      {/* Rolle */}
      <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12.5, color: "var(--color-neutral-400)" }}>
        Rolle
        <select className="input" value={rolle} onChange={(e) => setRolle(e.target.value)}>
          <option value="alle">Alle</option>
          <option value="jugendlich">Nur Jugendliche</option>
          <option value="betreuer">Nur Betreuer</option>
        </select>
      </label>

      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginTop: 12, cursor: "pointer" }}>
        <input type="checkbox" checked={nurAktive} onChange={(e) => setAktivStr(e.target.checked ? "1" : "0")} />
        Nur aktive Personen
      </label>

      {/* Spalten */}
      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--color-neutral-600)", marginBottom: 8 }}>
          Spalten
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "7px 12px" }}>
          {PERSONEN_EXPORT_COLUMNS.map((c) => (
            <label key={c.key} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, cursor: "pointer" }}>
              <input type="checkbox" checked={selected.has(c.key)} onChange={() => toggleCol(c.key)} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Anwesenheit */}
      <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--color-divider)" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
          <input type="checkbox" checked={anwesenheit} onChange={(e) => setAnwStr(e.target.checked ? "1" : "0")} />
          Anwesenheit bei Terminen einbeziehen
        </label>
        {anwesenheit && (
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <label style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5, fontSize: 12.5, color: "var(--color-neutral-400)" }}>
              Von
              <DatePicker value={von} onChange={setVon} clearable={false} />
            </label>
            <label style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5, fontSize: 12.5, color: "var(--color-neutral-400)" }}>
              Bis
              <DatePicker value={bis} onChange={setBis} clearable={false} />
            </label>
          </div>
        )}
        {zeitraumFehlt && (
          <div style={{ fontSize: 12, color: "var(--danger)", marginTop: 8 }}>
            Bitte einen gültigen Zeitraum wählen (Von darf nicht nach Bis liegen).
          </div>
        )}
      </div>

      <div className="dialog-actions" style={{ marginTop: 18 }}>
        <button className="btn btn-secondary" onClick={onClose}>Abbrechen</button>
        <button className="btn btn-primary" onClick={exportieren} disabled={keineSpalten || zeitraumFehlt}>
          <i className="ph ph-download-simple" />
          Exportieren
        </button>
      </div>
    </Dialog>
  );
}
