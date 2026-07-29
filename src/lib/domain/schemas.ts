import { z } from "zod";
import {
  PLANUNGSMODI,
  ZIELGRUPPEN,
  ROLLEN,
  GESCHLECHTER,
  VERFUEGBARKEIT_STATUS,
  A_TEIL_POSITIONEN,
  KNOTEN_POSITIONEN,
  KNOTEN,
  HINDERNIS_MATERIAL,
  HINDERNIS_STATUS,
} from "./constants";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum im Format JJJJ-MM-TT");

const personBaseSchema = z.object({
  rolle: z.enum(ROLLEN),
  nachname: z.string().min(1, "Nachname fehlt"),
  vorname: z.string().min(1, "Vorname fehlt"),
  strasse: z.string().nullish(),
  plz: z.string().nullish(),
  ort: z.string().nullish(),
  ausweisnr: z.string().nullish(),
  geburtsdatum: isoDate.nullish(),
  eintrittsdatum: isoDate.nullish(),
  geschlecht: z.enum(GESCHLECHTER).nullish(),
  sitzplaetze: z.number().int().min(0).max(9).nullish(),
  jugendflamme1: isoDate.nullish(),
  jugendflamme2: isoDate.nullish(),
  leistungsspangeDatum: isoDate.nullish(),
  jugendflamme1PlanJahr: z.number().int().min(2000).max(2100).nullish(),
  jugendflamme2PlanJahr: z.number().int().min(2000).max(2100).nullish(),
  leistungsspangePlanJahr: z.number().int().min(2000).max(2100).nullish(),
  aktiv: z.boolean().default(true),
});

type PersonRefineInput = {
  rolle?: (typeof ROLLEN)[number];
  sitzplaetze?: number | null;
  geburtsdatum?: string | null;
  eintrittsdatum?: string | null;
  geschlecht?: string | null;
  ausweisnr?: string | null;
};

// Rollenabhängige Pflichtfelder. Bei Teil-Updates (PATCH ohne `rolle`, z. B.
// Aktiv-Toggle) werden die Cross-Field-Regeln übersprungen.
function refinePerson(data: PersonRefineInput, ctx: z.RefinementCtx) {
  if (data.rolle === undefined) return;
  if (data.rolle === "betreuer") {
    if (data.sitzplaetze == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sitzplaetze"],
        message: "Sitzplätze sind für Betreuer eine Pflichtangabe.",
      });
    }
  } else {
    const pflicht: [keyof PersonRefineInput, string][] = [
      ["geburtsdatum", "Geburtsdatum fehlt"],
      ["eintrittsdatum", "Eintrittsdatum fehlt"],
      ["geschlecht", "Geschlecht fehlt"],
      ["ausweisnr", "Mitgliedsnummer fehlt"],
    ];
    for (const [feld, message] of pflicht) {
      const wert = data[feld];
      if (wert == null || (typeof wert === "string" && wert.trim() === "")) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [feld], message });
      }
    }
  }
}

export const personSchema = personBaseSchema.superRefine(refinePerson);
export const personUpdateSchema = personBaseSchema.partial().superRefine(refinePerson);

export const terminSchema = z.object({
  titel: z.string().min(1, "Titel fehlt"),
  datumVon: isoDate,
  datumBis: isoDate.nullish(),
  planungsmodus: z.enum(PLANUNGSMODI),
  zielgruppe: z.enum(ZIELGRUPPEN).default("alle"),
  ort: z.string().nullish(),
  doppelstartErlaubt: z.boolean().default(true),
});

export const verfuegbarkeitSchema = z.object({
  personId: z.number().int(),
  terminId: z.number().int(),
  status: z.enum(VERFUEGBARKEIT_STATUS),
});

export const dokumententypSchema = z.object({
  name: z.string().min(1, "Name fehlt"),
  zielgruppe: z.enum(ZIELGRUPPEN).default("alle"),
});

export const rueckmeldungSchema = z.object({
  personId: z.number().int(),
  dokumententypId: z.number().int(),
  erhalten: z.boolean(),
  erhaltenAm: isoDate.nullish(),
  notiz: z.string().nullish(),
  terminId: z.number().int().nullish(),
});

export const gruppeSchema = z.object({
  terminId: z.number().int(),
  name: z.string().min(1),
  altersklasse: z.string().nullish(),
  betreuerPersonId: z.number().int().nullish(),
});

export const gruppenmitgliedSchema = z.object({
  gruppeId: z.number().int(),
  personId: z.number().int(),
  aTeilPosition: z.enum(A_TEIL_POSITIONEN).nullish(),
  bTeilLaeufer: z.number().int().min(1).max(9).nullish(),
});

export const knotenZuordnungSchema = z.object({
  position: z.enum(KNOTEN_POSITIONEN),
  knoten: z.enum(KNOTEN),
});

export const disziplinSchema = z.object({
  name: z.string().min(1, "Name fehlt"),
  einheit: z.string().default("s"),
});

export const messungSchema = z.object({
  personId: z.number().int(),
  disziplinId: z.number().int(),
  datum: isoDate,
  wertSekunden: z.number().positive().nullish(),
  wertText: z.string().nullish(),
  notiz: z.string().nullish(),
});

export const hindernisFaehigkeitSchema = z.object({
  personId: z.number().int(),
  hindernis: z.string().default("Wassergraben"),
  material: z.enum(HINDERNIS_MATERIAL),
  status: z.enum(HINDERNIS_STATUS),
  notiz: z.string().nullish(),
});

export const trainingEintragSchema = z.object({
  personId: z.number().int(),
  kategorie: z.string().min(1, "Kategorie fehlt"),
  notiz: z.string().nullish(),
  wert: z.string().nullish(),
});

// ── Kleiderkammer ──
export const kleidungsstueckSchema = z.object({
  name: z.string().min(1, "Name fehlt"),
  mitGroessen: z.boolean().default(false),
  // Optionaler Startbestand beim Anlegen: bei mitGroessen Zeilen je Größe,
  // sonst eine Gesamtmenge (groesse bleibt dann leer/null).
  bestand: z
    .array(z.object({ groesse: z.string().nullish(), menge: z.number().int().min(0) }))
    .optional(),
});

export const kleidungsstueckUpdateSchema = z.object({
  name: z.string().min(1, "Name fehlt"),
});

export const kleidungBestandSchema = z.object({
  kleidungsstueckId: z.number().int(),
  groesse: z.string().nullish(),
  menge: z.number().int().min(0),
});

export const kleidungAusgabeSchema = z.object({
  personId: z.number().int(),
  kleidungsstueckId: z.number().int(),
  groesse: z.string().nullish(),
  menge: z.number().int().min(1),
  ausgegebenAm: isoDate.nullish(),
});

export const kleidungAusgabeUpdateSchema = z.object({
  menge: z.number().int().min(1).optional(),
  groesse: z.string().nullish(), // Größentausch: bestehende Ausgabe auf andere Größe setzen
});

export type PersonInput = z.infer<typeof personSchema>;
export type TerminInput = z.infer<typeof terminSchema>;
