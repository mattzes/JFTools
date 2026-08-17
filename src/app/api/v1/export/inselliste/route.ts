import { NextResponse } from "next/server";
import path from "node:path";
import ExcelJS from "exceljs";
import { db, schema } from "@/db";
import { requireAuth } from "@/lib/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ISO "JJJJ-MM-TT" → "TT.MM.JJJJ" (leer bleibt leer)
function fmtDE(iso: string | null): string {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
  return m ? `${m[3]}.${m[2]}.${m[1]}` : "";
}

// "Berechtigung endet am": 31.12. des Jahres, in dem die Person 18 wird (Geburtsjahr + 18)
function berechtigungEndet(geburtsdatum: string | null): string {
  const m = geburtsdatum ? /^(\d{4})/.exec(geburtsdatum) : null;
  return m ? `31.12.${Number(m[1]) + 18}` : "";
}

// Für Content-Disposition unzulässige/heikle Zeichen entfernen
function sanitizeFilename(name: string): string {
  return name.replace(/["/\\?%*:|<>]/g, "").trim();
}

export async function GET(req: Request) {
  await requireAuth();
  const url = new URL(req.url);
  const jf = (url.searchParams.get("jf") ?? "").trim();
  if (!jf) {
    return NextResponse.json({ error: "Parameter 'jf' fehlt" }, { status: 400 });
  }

  // ── Nur aktive Jugendliche, sortiert nach Nachname ──
  const personen = db
    .select()
    .from(schema.personen)
    .all()
    .filter((p) => p.rolle === "jugendlich" && p.aktiv)
    .sort((a, b) => a.nachname.localeCompare(b.nachname));

  // ── Vorlage laden (wird nur gelesen, nie überschrieben) ──
  const templatePath = path.join(process.cwd(), "assets", "Inselliste-Vorlage.xlsx");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(templatePath);
  const ws = wb.getWorksheet("Tabelle1");
  if (!ws) {
    return NextResponse.json({ error: "Vorlage-Blatt 'Tabelle1' nicht gefunden" }, { status: 500 });
  }

  // Stil einer vorformatierten Referenz-Datenzeile (Zeile 2) für evtl. Zusatzzeilen
  const refRow = ws.getRow(2);
  const refStyles = Array.from({ length: 10 }, (_, i) => refRow.getCell(i + 1).style);

  // ── Datenzeilen ab Zeile 2 füllen ──
  personen.forEach((p, i) => {
    const rowNr = 2 + i;
    const row = ws.getRow(rowNr);
    // Formatierung für Zeilen jenseits der Vorlage (>49) von Zeile 2 übernehmen
    if (rowNr > 49) {
      for (let c = 1; c <= 10; c++) row.getCell(c).style = { ...refStyles[c - 1] };
    }
    row.getCell(1).value = p.nachname; // A Name
    row.getCell(2).value = p.vorname; // B Vorname
    row.getCell(3).value = p.strasse ?? ""; // C Straße
    row.getCell(4).value = p.plz ?? ""; // D PLZ
    row.getCell(5).value = p.ort ?? ""; // E Winsen (Wohnort)
    row.getCell(6).value = p.ausweisnr ?? ""; // F Ausweisnr.
    row.getCell(7).value = fmtDE(p.geburtsdatum); // G Geb.- Datum
    row.getCell(8).value = berechtigungEndet(p.geburtsdatum); // H Berechtigung endet am
    row.getCell(9).value = jf; // I JF:
    // J Bemerkungen bleibt leer
    row.commit();
  });

  const buf = await wb.xlsx.writeBuffer();
  const filename = sanitizeFilename(`Inselliste ${jf}`) + ".xlsx";
  return new NextResponse(Buffer.from(buf as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
