import { NextResponse } from "next/server";
import { db, schema, sqlite } from "@/db";
import { requireAuth, jsonError } from "@/lib/api-helpers";

const TABLES = [
  "personen",
  "termine",
  "verfuegbarkeiten",
  "dokumententypen",
  "rueckmeldungen",
  "gruppen",
  "gruppenmitglieder",
  "knotenZuordnungen",
  "disziplinen",
  "messungen",
  "trainingEintraege",
  "kleidungsstuecke",
  "kleidungBestand",
  "kleidungAusgaben",
] as const;

const SQL_NAMES: Record<(typeof TABLES)[number], string> = {
  personen: "personen",
  termine: "termine",
  verfuegbarkeiten: "verfuegbarkeiten",
  dokumententypen: "dokumententypen",
  rueckmeldungen: "rueckmeldungen",
  gruppen: "gruppen",
  gruppenmitglieder: "gruppenmitglieder",
  knotenZuordnungen: "knoten_zuordnungen",
  disziplinen: "disziplinen",
  messungen: "messungen",
  trainingEintraege: "training_eintraege",
  kleidungsstuecke: "kleidungsstuecke",
  kleidungBestand: "kleidung_bestand",
  kleidungAusgaben: "kleidung_ausgaben",
};

// Export: kompletter Datenbestand als JSON-Datei
export async function GET() {
  await requireAuth();
  const data: Record<string, unknown[]> = {};
  for (const t of TABLES) {
    data[t] = db.select().from(schema[t]).all();
  }
  const payload = { app: "jf-rottorf", version: 1, exportedAt: new Date().toISOString(), data };
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="jf-rottorf-backup-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}

// Import: Datenbestand komplett ersetzen (Wiederherstellung)
export async function POST(req: Request) {
  await requireAuth();
  let payload: { version?: number; data?: Record<string, Record<string, unknown>[]> };
  try {
    payload = await req.json();
  } catch {
    return jsonError("Ungültiges JSON");
  }
  if (!payload?.data || payload.version !== 1) {
    return jsonError("Keine gültige Backup-Datei (version 1 erwartet)");
  }

  const restore = sqlite.transaction(() => {
    sqlite.pragma("foreign_keys = OFF");
    // In umgekehrter Reihenfolge leeren, dann in Originalreihenfolge einspielen
    for (const t of [...TABLES].reverse()) {
      sqlite.prepare(`DELETE FROM ${SQL_NAMES[t]}`).run();
    }
    for (const t of TABLES) {
      const rows = payload.data![t];
      if (!Array.isArray(rows)) continue;
      for (const row of rows) {
        const cols = Object.keys(row);
        if (!cols.length) continue;
        const snake = (s: string) => s.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase());
        const sql = `INSERT INTO ${SQL_NAMES[t]} (${cols.map(snake).join(",")}) VALUES (${cols.map(() => "?").join(",")})`;
        sqlite.prepare(sql).run(
          ...cols.map((c) => {
            const v = row[c];
            return typeof v === "boolean" ? (v ? 1 : 0) : v;
          }),
        );
      }
    }
    sqlite.pragma("foreign_keys = ON");
  });

  try {
    restore();
  } catch (e) {
    sqlite.pragma("foreign_keys = ON");
    return jsonError("Import fehlgeschlagen: " + (e instanceof Error ? e.message : String(e)), 500);
  }
  return NextResponse.json({ ok: true });
}
