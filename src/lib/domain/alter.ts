import { SOLL_ZEIT_TABELLE } from "./constants";

// 1) Taggenaues Alter heute
export function alter(geburtsdatum: string | Date, ref: Date = new Date()): number {
  const geb = typeof geburtsdatum === "string" ? new Date(geburtsdatum) : geburtsdatum;
  const a = ref.getFullYear() - geb.getFullYear();
  const hadBirthday = new Date(ref.getFullYear(), geb.getMonth(), geb.getDate()) <= ref;
  return hadBirthday ? a : a - 1;
}

// 2) Jahrgangsalter (für Wettbewerbs-Alterssumme & Zeltlager-Altersklassen, Stichtagsregelung)
export function alterInDiesemJahr(geburtsdatum: string | Date, jahr = new Date().getFullYear()): number {
  const geb = typeof geburtsdatum === "string" ? new Date(geburtsdatum) : geburtsdatum;
  return jahr - geb.getFullYear();
}

// Ein Vorschlagsjahr in der Vergangenheit ergibt keinen Sinn → auf das aktuelle Jahr anheben.
function abJetzt(jahr: number): number {
  return Math.max(jahr, new Date().getFullYear());
}

// Leistungsspangen-Vorschlag: möglich ab dem Kalenderjahr, in dem die Person 16 wird
export function leistungsspangeVorschlag(geburtsdatum: string | Date): number {
  const geb = typeof geburtsdatum === "string" ? new Date(geburtsdatum) : geburtsdatum;
  return abJetzt(geb.getFullYear() + 16);
}

// Jugendflamme-1-Vorschlag: ein Jahr nach dem Eintritt
export function jugendflamme1Vorschlag(eintrittsdatum: string | Date): number {
  const ein = typeof eintrittsdatum === "string" ? new Date(eintrittsdatum) : eintrittsdatum;
  return abJetzt(ein.getFullYear() + 1);
}

// Jugendflamme-2-Vorschlag: mindestens 1 Jahr nach der JFL1 UND frühestens im Jahrgang,
// in dem die Person 13 wird. Ohne eingetragene JFL1 gibt es keinen Vorschlag.
export function jugendflamme2Vorschlag(
  geburtsdatum: string | Date | null | undefined,
  jugendflamme1: string | Date | null | undefined,
): number | null {
  if (!jugendflamme1) return null;
  const jfl1Jahr = new Date(jugendflamme1).getFullYear();
  const geb13 = geburtsdatum ? new Date(geburtsdatum).getFullYear() + 13 : null;
  const basis = geb13 != null ? Math.max(jfl1Jahr + 1, geb13) : jfl1Jahr + 1;
  return abJetzt(basis);
}

export function sollZeit(alterssumme: number) {
  return SOLL_ZEIT_TABELLE.find((r) => alterssumme >= r.minSumme && alterssumme <= r.maxSumme) ?? null;
}

export function formatSollZeit(sek: number): string {
  const m = Math.floor(sek / 60);
  const s = sek % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function startberechtigt(alterssumme: number): boolean {
  return alterssumme >= 90 && alterssumme <= 162;
}

// Geburtsdatum-Plausibilität (Excel hatte negative Alter durch Datenfehler)
export function geburtsdatumPlausibel(geburtsdatum: string): boolean {
  const a = alter(geburtsdatum);
  return a >= 5 && a <= 80;
}
