import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { db, schema } from "@/db";
import { requireAuth } from "@/lib/api-helpers";
import { alter, alterInDiesemJahr } from "@/lib/domain/alter";
import {
  PERSONEN_EXPORT_COLUMNS,
  isPersonenExportColKey,
  type PersonenExportColKey,
} from "@/lib/domain/export-personen";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PersonRow = typeof schema.personen.$inferSelect;

// ISO "JJJJ-MM-TT" → "TT.MM.JJJJ" (leer bleibt leer)
function fmtDE(iso: string | null): string {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
  return m ? `${m[3]}.${m[2]}.${m[1]}` : "";
}
// "JJJJ-MM-TT" → "TT.MM." (für Termin-Spaltenköpfe)
function fmtDEShort(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}.` : iso;
}

// Wert einer Stammdaten-Spalte für eine Person (Reihenfolge/Label kommen aus der Metadaten-Liste)
function cellValue(p: PersonRow, key: PersonenExportColKey): string | number {
  switch (key) {
    case "nachname": return p.nachname;
    case "vorname": return p.vorname;
    case "rolle": return p.rolle === "betreuer" ? "Betreuer" : "Jugendlich";
    case "geschlecht": return p.geschlecht ?? "";
    case "strasse": return p.strasse ?? "";
    case "plz": return p.plz ?? "";
    case "ort": return p.ort ?? "";
    case "ausweisnr": return p.ausweisnr ?? "";
    case "geburtsdatum": return fmtDE(p.geburtsdatum);
    case "alter": return p.geburtsdatum ? alter(p.geburtsdatum) : "";
    case "jahrgangsalter": return p.geburtsdatum ? alterInDiesemJahr(p.geburtsdatum) : "";
    case "eintrittsdatum": return fmtDE(p.eintrittsdatum);
    case "sitzplaetze": return p.sitzplaetze ?? "";
    case "jugendflamme1": return fmtDE(p.jugendflamme1);
    case "jugendflamme2": return fmtDE(p.jugendflamme2);
    case "leistungsspange": return fmtDE(p.leistungsspangeDatum);
    case "aktiv": return p.aktiv ? "ja" : "nein";
  }
}

export async function GET(req: Request) {
  await requireAuth();
  const url = new URL(req.url);
  const q = url.searchParams;

  // ── Filter/Optionen ──
  const rolle = q.get("rolle") ?? "alle"; // alle | jugendlich | betreuer
  const nurAktive = q.get("aktiv") !== "0"; // Default: nur aktive
  const mitAnwesenheit = q.get("anwesenheit") === "1";
  const von = q.get("von");
  const bis = q.get("bis");

  // Gewählte Spalten (Reihenfolge folgt der Metadaten-Liste, nicht der Query)
  const gewaehlt = new Set((q.get("cols") ?? "").split(",").filter(isPersonenExportColKey));
  const cols = PERSONEN_EXPORT_COLUMNS.filter((c) => gewaehlt.has(c.key));
  const spalten = cols.length > 0 ? cols : PERSONEN_EXPORT_COLUMNS.filter((c) => c.default);

  // ── Personen laden, filtern, sortieren (wie Personen-Seite: Jugendliche vor Betreuer, dann Nachname) ──
  let personen = db.select().from(schema.personen).all();
  if (nurAktive) personen = personen.filter((p) => p.aktiv);
  if (rolle === "jugendlich" || rolle === "betreuer") personen = personen.filter((p) => p.rolle === rolle);
  personen.sort((a, b) =>
    a.rolle === b.rolle ? a.nachname.localeCompare(b.nachname) : a.rolle === "jugendlich" ? -1 : 1,
  );

  // ── Anwesenheit: Termine im Zeitraum + Rückmeldungen ──
  let termine: (typeof schema.termine.$inferSelect)[] = [];
  const statusMap = new Map<string, "ja" | "nein" | "offen">();
  if (mitAnwesenheit && von && bis) {
    termine = db
      .select()
      .from(schema.termine)
      .all()
      .filter((t) => t.datumVon >= von && t.datumVon <= bis)
      .sort((a, b) => a.datumVon.localeCompare(b.datumVon));
    const terminIds = new Set(termine.map((t) => t.id));
    for (const v of db.select().from(schema.verfuegbarkeiten).all()) {
      if (terminIds.has(v.terminId)) statusMap.set(`${v.personId}:${v.terminId}`, v.status);
    }
  }

  // ── Workbook aufbauen ──
  const wb = new ExcelJS.Workbook();
  wb.creator = "JF Rottorf";
  wb.created = new Date();
  const ws = wb.addWorksheet("Mitgliederliste");

  const header: string[] = [...spalten.map((c) => c.label)];
  if (termine.length > 0) {
    header.push(...termine.map((t) => `${fmtDEShort(t.datumVon)} ${t.titel}`), "Anwesend");
  }
  const headerRow = ws.addRow(header);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: "middle" };

  for (const p of personen) {
    const row: (string | number)[] = spalten.map((c) => cellValue(p, c.key));
    if (termine.length > 0) {
      let jaCount = 0;
      for (const t of termine) {
        const s = statusMap.get(`${p.id}:${t.id}`);
        if (s === "ja") { jaCount++; row.push("✓"); }
        else if (s === "nein") row.push("–");
        else if (s === "offen") row.push("offen");
        else row.push(""); // keine Rückmeldung
      }
      row.push(`${jaCount} / ${termine.length}`);
    }
    ws.addRow(row);
  }

  // Spaltenbreiten grob an Inhaltslänge anpassen
  ws.columns.forEach((col) => {
    let max = 8;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = String(cell.value ?? "").length;
      if (len > max) max = len;
    });
    col.width = Math.min(max + 2, 40);
  });
  // Termin-Spalten (Datum + Titel) zentriert; Auto-Breite oben greift bereits
  const terminStart = spalten.length + 1;
  if (termine.length > 0) {
    for (let i = 0; i <= termine.length; i++) {
      ws.getColumn(terminStart + i).alignment = { horizontal: "center" };
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  const datum = new Date().toISOString().slice(0, 10);
  return new NextResponse(Buffer.from(buf as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="mitgliederliste-${datum}.xlsx"`,
    },
  });
}
