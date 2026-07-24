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

export const personSchema = z.object({
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
  leistungsspangeJahr: z.number().int().min(1990).max(2100).nullish(),
  aktiv: z.boolean().default(true),
});

export const terminSchema = z.object({
  titel: z.string().min(1, "Titel fehlt"),
  datumVon: isoDate,
  datumBis: isoDate.nullish(),
  planungsmodus: z.enum(PLANUNGSMODI),
  zielgruppe: z.enum(ZIELGRUPPEN).default("alle"),
  ort: z.string().nullish(),
});

export const verfuegbarkeitSchema = z.object({
  personId: z.number().int(),
  terminId: z.number().int(),
  status: z.enum(VERFUEGBARKEIT_STATUS),
});

export const dokumententypSchema = z.object({
  name: z.string().min(1, "Name fehlt"),
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

export type PersonInput = z.infer<typeof personSchema>;
export type TerminInput = z.infer<typeof terminSchema>;
