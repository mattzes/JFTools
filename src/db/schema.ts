import { sqliteTable, text, integer, real, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// Jede Tabelle: id, created_at, updated_at (Architektur-Regel 4 — zukunftsfest)
const timestamps = {
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
};

// Gemeinsames Personenmodell: Jugendliche + Betreuer (rolle-Feld)
export const personen = sqliteTable("personen", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  rolle: text("rolle", { enum: ["jugendlich", "betreuer"] }).notNull(),
  nachname: text("nachname").notNull(),
  vorname: text("vorname").notNull(),
  strasse: text("strasse"),
  plz: text("plz"),
  ort: text("ort"),
  ausweisnr: text("ausweisnr"),
  geburtsdatum: text("geburtsdatum"), // ISO JJJJ-MM-TT
  eintrittsdatum: text("eintrittsdatum"),
  geschlecht: text("geschlecht", { enum: ["M", "W"] }),
  sitzplaetze: integer("sitzplaetze"), // nur Betreuer: PKW-Plätze
  jugendflamme1: text("jugendflamme1"), // Datum der Abnahme
  jugendflamme2: text("jugendflamme2"),
  leistungsspangeDatum: text("leistungsspange_datum"), // Datum der Abnahme; leer = noch offen (Vorschlag aus Geburtsjahr+16)
  // Geplantes Zieljahr je Abzeichen (nur relevant solange offen; separat vom Abnahme-Datum)
  jugendflamme1PlanJahr: integer("jugendflamme1_plan_jahr"),
  jugendflamme2PlanJahr: integer("jugendflamme2_plan_jahr"),
  leistungsspangePlanJahr: integer("leistungsspange_plan_jahr"),
  aktiv: integer("aktiv", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
});

export const termine = sqliteTable("termine", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  titel: text("titel").notNull(),
  datumVon: text("datum_von").notNull(),
  datumBis: text("datum_bis"),
  planungsmodus: text("planungsmodus", {
    enum: ["keine", "nur_gruppen", "a_teil", "a_und_b_teil"],
  }).notNull(),
  zielgruppe: text("zielgruppe", { enum: ["alle", "nur_betreuer", "nur_jugendliche"] })
    .notNull()
    .default("alle"),
  ort: text("ort"),
  doppelstartErlaubt: integer("doppelstart_erlaubt", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
});

export const verfuegbarkeiten = sqliteTable(
  "verfuegbarkeiten",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    personId: integer("person_id")
      .notNull()
      .references(() => personen.id, { onDelete: "cascade" }),
    terminId: integer("termin_id")
      .notNull()
      .references(() => termine.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["ja", "nein", "offen"] }).notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex("verf_person_termin").on(t.personId, t.terminId)],
);

export const dokumententypen = sqliteTable("dokumententypen", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  zielgruppe: text("zielgruppe").notNull().default("alle"),
  ...timestamps,
});

export const rueckmeldungen = sqliteTable(
  "rueckmeldungen",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    personId: integer("person_id")
      .notNull()
      .references(() => personen.id, { onDelete: "cascade" }),
    dokumententypId: integer("dokumententyp_id")
      .notNull()
      .references(() => dokumententypen.id, { onDelete: "cascade" }),
    erhalten: integer("erhalten", { mode: "boolean" }).notNull().default(false),
    erhaltenAm: text("erhalten_am"),
    notiz: text("notiz"),
    terminId: integer("termin_id").references(() => termine.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [uniqueIndex("rueck_person_dok").on(t.personId, t.dokumententypId)],
);

// Gruppen für Wettbewerbs-Planung UND Zeltlager (altersklasse/betreuer nur dort belegt)
export const gruppen = sqliteTable("gruppen", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  terminId: integer("termin_id")
    .notNull()
    .references(() => termine.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  altersklasse: text("altersklasse"),
  betreuerPersonId: integer("betreuer_person_id").references(() => personen.id, {
    onDelete: "set null",
  }),
  ...timestamps,
});

export const gruppenmitglieder = sqliteTable("gruppenmitglieder", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gruppeId: integer("gruppe_id")
    .notNull()
    .references(() => gruppen.id, { onDelete: "cascade" }),
  personId: integer("person_id")
    .notNull()
    .references(() => personen.id, { onDelete: "cascade" }),
  aTeilPosition: text("a_teil_position", {
    enum: ["GF", "ME", "MA", "AF", "AM", "WF", "WM", "SF", "SM"],
  }),
  bTeilLaeufer: integer("b_teil_laeufer"),
  ...timestamps,
});

// Knoten-Zuordnung JE Wettbewerb (Termin) — keine globale Konstante!
export const knotenZuordnungen = sqliteTable(
  "knoten_zuordnungen",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    terminId: integer("termin_id")
      .notNull()
      .references(() => termine.id, { onDelete: "cascade" }),
    gruppeId: integer("gruppe_id")
      .notNull()
      .references(() => gruppen.id, { onDelete: "cascade" }),
    position: text("position", { enum: ["AF", "AM", "WF", "WM"] }).notNull(),
    knoten: text("knoten", {
      enum: ["Mastwurf", "Schotenstich", "Zimmermannsstich", "Kreuzknoten"],
    }).notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex("knoten_gruppe_pos").on(t.gruppeId, t.position)],
);

export const disziplinen = sqliteTable("disziplinen", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  einheit: text("einheit").notNull().default("s"),
  ...timestamps,
});

export const messungen = sqliteTable("messungen", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  personId: integer("person_id")
    .notNull()
    .references(() => personen.id, { onDelete: "cascade" }),
  disziplinId: integer("disziplin_id")
    .notNull()
    .references(() => disziplinen.id, { onDelete: "cascade" }),
  datum: text("datum").notNull(),
  wertSekunden: real("wert_sekunden"),
  wertText: text("wert_text"), // z. B. „ca. 20s"
  notiz: text("notiz"),
  ...timestamps,
});

// Training: Teilnahme pro Kategorie + Notiz pro Person + statische Auswahl (Wassergraben/Leinbeutel)
export const trainingEintraege = sqliteTable(
  "training_eintraege",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    personId: integer("person_id")
      .notNull()
      .references(() => personen.id, { onDelete: "cascade" }),
    kategorie: text("kategorie").notNull(),
    notiz: text("notiz"),
    wert: text("wert"),
    ...timestamps,
  },
  (t) => [uniqueIndex("training_person_kat").on(t.personId, t.kategorie)],
);

export const hindernisFaehigkeiten = sqliteTable(
  "hindernis_faehigkeiten",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    personId: integer("person_id")
      .notNull()
      .references(() => personen.id, { onDelete: "cascade" }),
    hindernis: text("hindernis").notNull().default("Wassergraben"),
    material: text("material", { enum: ["ohne", "verteiler", "schlauchpaket"] }).notNull(),
    status: text("status", { enum: ["ja", "nein", "unsicher"] }).notNull(),
    notiz: text("notiz"),
    ...timestamps,
  },
  (t) => [uniqueIndex("hind_person").on(t.personId, t.hindernis)],
);
