import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";
import { DISZIPLINEN_SEED, DOKUMENTTYP_SEED } from "@/lib/domain/constants";

const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), "data", "app.db");

// DDL statt drizzle-kit-Migrationen: Single-Container, eine Datei, idempotent.
const DDL = `
CREATE TABLE IF NOT EXISTS personen (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rolle TEXT NOT NULL,
  nachname TEXT NOT NULL,
  vorname TEXT NOT NULL,
  strasse TEXT, plz TEXT, ort TEXT, ausweisnr TEXT,
  geburtsdatum TEXT, eintrittsdatum TEXT, geschlecht TEXT,
  sitzplaetze INTEGER,
  jugendflamme1 TEXT, jugendflamme2 TEXT, leistungsspange_datum TEXT,
  jugendflamme1_plan_jahr INTEGER, jugendflamme2_plan_jahr INTEGER, leistungsspange_plan_jahr INTEGER,
  aktiv INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS termine (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  titel TEXT NOT NULL,
  datum_von TEXT NOT NULL,
  datum_bis TEXT,
  planungsmodus TEXT NOT NULL,
  zielgruppe TEXT NOT NULL DEFAULT 'alle',
  ort TEXT,
  doppelstart_erlaubt INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS verfuegbarkeiten (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id INTEGER NOT NULL REFERENCES personen(id) ON DELETE CASCADE,
  termin_id INTEGER NOT NULL REFERENCES termine(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS verf_person_termin ON verfuegbarkeiten(person_id, termin_id);
CREATE TABLE IF NOT EXISTS dokumententypen (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  zielgruppe TEXT NOT NULL DEFAULT 'alle',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS rueckmeldungen (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id INTEGER NOT NULL REFERENCES personen(id) ON DELETE CASCADE,
  dokumententyp_id INTEGER NOT NULL REFERENCES dokumententypen(id) ON DELETE CASCADE,
  erhalten INTEGER NOT NULL DEFAULT 0,
  erhalten_am TEXT, notiz TEXT,
  termin_id INTEGER REFERENCES termine(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS rueck_person_dok ON rueckmeldungen(person_id, dokumententyp_id);
CREATE TABLE IF NOT EXISTS gruppen (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  termin_id INTEGER NOT NULL REFERENCES termine(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  altersklasse TEXT,
  betreuer_person_id INTEGER REFERENCES personen(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS gruppenmitglieder (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gruppe_id INTEGER NOT NULL REFERENCES gruppen(id) ON DELETE CASCADE,
  person_id INTEGER NOT NULL REFERENCES personen(id) ON DELETE CASCADE,
  a_teil_position TEXT,
  b_teil_laeufer INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS knoten_zuordnungen (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  termin_id INTEGER NOT NULL REFERENCES termine(id) ON DELETE CASCADE,
  gruppe_id INTEGER NOT NULL REFERENCES gruppen(id) ON DELETE CASCADE,
  position TEXT NOT NULL,
  knoten TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS knoten_gruppe_pos ON knoten_zuordnungen(gruppe_id, position);
CREATE TABLE IF NOT EXISTS disziplinen (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  einheit TEXT NOT NULL DEFAULT 's',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS messungen (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id INTEGER NOT NULL REFERENCES personen(id) ON DELETE CASCADE,
  disziplin_id INTEGER NOT NULL REFERENCES disziplinen(id) ON DELETE CASCADE,
  datum TEXT NOT NULL,
  wert_sekunden REAL, wert_text TEXT, notiz TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS training_eintraege (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id INTEGER NOT NULL REFERENCES personen(id) ON DELETE CASCADE,
  kategorie TEXT NOT NULL,
  notiz TEXT,
  wert TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS training_person_kat ON training_eintraege(person_id, kategorie);
CREATE TABLE IF NOT EXISTS hindernis_faehigkeiten (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id INTEGER NOT NULL REFERENCES personen(id) ON DELETE CASCADE,
  hindernis TEXT NOT NULL DEFAULT 'Wassergraben',
  material TEXT NOT NULL,
  status TEXT NOT NULL,
  notiz TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS hind_person ON hindernis_faehigkeiten(person_id, hindernis);
CREATE TABLE IF NOT EXISTS kleidungsstuecke (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  mit_groessen INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS kleidung_bestand (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kleidungsstueck_id INTEGER NOT NULL REFERENCES kleidungsstuecke(id) ON DELETE CASCADE,
  groesse TEXT,
  menge INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS bestand_stueck_groesse ON kleidung_bestand(kleidungsstueck_id, groesse);
CREATE TABLE IF NOT EXISTS kleidung_ausgaben (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id INTEGER NOT NULL REFERENCES personen(id) ON DELETE CASCADE,
  kleidungsstueck_id INTEGER NOT NULL REFERENCES kleidungsstuecke(id) ON DELETE CASCADE,
  groesse TEXT,
  menge INTEGER NOT NULL DEFAULT 1,
  ausgegeben_am TEXT,
  notiz TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

// Termine 2026 aus der Spec als Seed
const TERMINE_SEED: Array<[string, string, string | null, string, string]> = [
  ["Brennballturnier (Tag 1)", "2026-03-14", null, "keine", "alle"],
  ["Brennballturnier (Tag 2)", "2026-03-15", null, "keine", "alle"],
  ["O-Marsch Handorf", "2026-05-01", null, "nur_gruppen", "alle"],
  ["Pokalwettbewerb Laßrönne", "2026-05-10", null, "a_und_b_teil", "alle"],
  ["KJF-Tag", "2026-05-31", null, "a_und_b_teil", "alle"],
  ["SJF-Tag", "2026-06-13", null, "a_und_b_teil", "alle"],
  ["Bezirksentscheid", "2026-06-13", "2026-06-14", "a_und_b_teil", "alle"],
  ["Landesentscheid", "2026-06-26", "2026-06-28", "a_und_b_teil", "alle"],
  ["Kreiszeltlager", "2026-07-17", "2026-07-26", "nur_gruppen", "alle"],
];

// Leichte, idempotente Spalten-Migrationen für bereits bestehende Datenbanken
// (CREATE TABLE IF NOT EXISTS legt neue Spalten sonst nicht nach).
function migrate(sqlite: Database.Database) {
  const dokCols = sqlite.prepare("PRAGMA table_info(dokumententypen)").all() as { name: string }[];
  if (!dokCols.some((c) => c.name === "zielgruppe")) {
    sqlite.exec("ALTER TABLE dokumententypen ADD COLUMN zielgruppe TEXT NOT NULL DEFAULT 'alle'");
  }

  const terminCols = sqlite.prepare("PRAGMA table_info(termine)").all() as { name: string }[];
  if (!terminCols.some((c) => c.name === "doppelstart_erlaubt")) {
    sqlite.exec("ALTER TABLE termine ADD COLUMN doppelstart_erlaubt INTEGER NOT NULL DEFAULT 1");
  }

  // Knoten von pro-Termin auf pro-Gruppe umstellen. Alte (per-Termin) Zuordnungen
  // sind mit dem neuen Modell inkompatibel und werden verworfen.
  const knotenCols = sqlite.prepare("PRAGMA table_info(knoten_zuordnungen)").all() as { name: string }[];
  if (!knotenCols.some((c) => c.name === "gruppe_id")) {
    sqlite.exec("DROP INDEX IF EXISTS knoten_termin_pos");
    sqlite.exec("DELETE FROM knoten_zuordnungen");
    sqlite.exec("ALTER TABLE knoten_zuordnungen ADD COLUMN gruppe_id INTEGER NOT NULL DEFAULT 0");
    sqlite.exec("CREATE UNIQUE INDEX IF NOT EXISTS knoten_gruppe_pos ON knoten_zuordnungen(gruppe_id, position)");
  }

  const cols = sqlite.prepare("PRAGMA table_info(personen)").all() as { name: string }[];
  const has = (name: string) => cols.some((c) => c.name === name);
  for (const col of ["jugendflamme1_plan_jahr", "jugendflamme2_plan_jahr", "leistungsspange_plan_jahr"]) {
    if (!has(col)) sqlite.exec(`ALTER TABLE personen ADD COLUMN ${col} INTEGER`);
  }
  if (!has("leistungsspange_datum")) {
    sqlite.exec("ALTER TABLE personen ADD COLUMN leistungsspange_datum TEXT");
    // Altbestand: nur bereits erworbene (vergangene) Jahre als 15.05. übernehmen.
    // Zukünftige „geplante" Jahre bleiben leer und erscheinen als Vorschlag.
    if (has("leistungsspange_jahr")) {
      sqlite.exec(
        "UPDATE personen SET leistungsspange_datum = leistungsspange_jahr || '-05-15' " +
          "WHERE leistungsspange_jahr IS NOT NULL AND leistungsspange_datum IS NULL " +
          "AND leistungsspange_jahr <= CAST(strftime('%Y','now') AS INTEGER)",
      );
    }
  }

  // Training-Disziplinen auf die feste Menge abgleichen: fehlende einfügen, überzählige
  // (dynamische Alt-Disziplinen) samt ihrer Messungen entfernen. Idempotent.
  const existingDis = sqlite.prepare("SELECT id, name FROM disziplinen").all() as { id: number; name: string }[];
  const existingNames = new Set(existingDis.map((d) => d.name));
  const insDis = sqlite.prepare("INSERT INTO disziplinen (name) VALUES (?)");
  for (const name of DISZIPLINEN_SEED) if (!existingNames.has(name)) insDis.run(name);
  const fixedSet = new Set<string>(DISZIPLINEN_SEED);
  const delDis = sqlite.prepare("DELETE FROM disziplinen WHERE id = ?");
  for (const d of existingDis) if (!fixedSet.has(d.name)) delDis.run(d.id); // ON DELETE CASCADE räumt messungen mit
}

function init() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(DDL);
  migrate(sqlite);

  // Seed nur bei leerem Datenbestand
  const terminCount = sqlite.prepare("SELECT COUNT(*) AS n FROM termine").get() as { n: number };
  if (terminCount.n === 0) {
    const ins = sqlite.prepare(
      "INSERT INTO termine (titel, datum_von, datum_bis, planungsmodus, zielgruppe) VALUES (?,?,?,?,?)",
    );
    for (const t of TERMINE_SEED) ins.run(...t);
  }
  const dokCount = sqlite.prepare("SELECT COUNT(*) AS n FROM dokumententypen").get() as { n: number };
  if (dokCount.n === 0) {
    const ins = sqlite.prepare("INSERT INTO dokumententypen (name) VALUES (?)");
    for (const d of DOKUMENTTYP_SEED) ins.run(d);
  }
  const disCount = sqlite.prepare("SELECT COUNT(*) AS n FROM disziplinen").get() as { n: number };
  if (disCount.n === 0) {
    const ins = sqlite.prepare("INSERT INTO disziplinen (name) VALUES (?)");
    for (const d of DISZIPLINEN_SEED) ins.run(d);
  }
  return sqlite;
}

// Ein DB-Handle pro Prozess (Next.js Hot-Reload: auf globalThis cachen)
const globalForDb = globalThis as unknown as { __sqlite?: Database.Database };
const sqlite = globalForDb.__sqlite ?? init();
globalForDb.__sqlite = sqlite;

export const db = drizzle(sqlite, { schema });
export { schema, sqlite };
