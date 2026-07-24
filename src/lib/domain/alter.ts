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

// Leistungsspangen-Vorschlag: möglich ab dem Kalenderjahr, in dem die Person 15 wird
export function leistungsspangeVorschlag(geburtsdatum: string | Date): number {
  const geb = typeof geburtsdatum === "string" ? new Date(geburtsdatum) : geburtsdatum;
  return geb.getFullYear() + 15;
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
