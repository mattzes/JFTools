// Gemeinsame Definition der exportierbaren Personen-Spalten.
// Bewusst isomorph (keine Server-Importe): der Export-Dialog (Client) rendert daraus
// die Auswahl-Checkboxen, die Export-Route (Server) übernimmt Reihenfolge & Beschriftung.

export type PersonenExportColKey =
  | "nachname"
  | "vorname"
  | "rolle"
  | "geschlecht"
  | "strasse"
  | "plz"
  | "ort"
  | "ausweisnr"
  | "geburtsdatum"
  | "alter"
  | "jahrgangsalter"
  | "eintrittsdatum"
  | "sitzplaetze"
  | "jugendflamme1"
  | "jugendflamme2"
  | "leistungsspange"
  | "aktiv";

export type PersonenExportColumn = {
  key: PersonenExportColKey;
  label: string;
  default: boolean;
};

// Reihenfolge = Spaltenreihenfolge im Export.
export const PERSONEN_EXPORT_COLUMNS: readonly PersonenExportColumn[] = [
  { key: "nachname", label: "Nachname", default: true },
  { key: "vorname", label: "Vorname", default: true },
  { key: "rolle", label: "Rolle", default: true },
  { key: "geschlecht", label: "Geschlecht", default: false },
  { key: "strasse", label: "Straße", default: false },
  { key: "plz", label: "PLZ", default: false },
  { key: "ort", label: "Ort", default: false },
  { key: "ausweisnr", label: "Ausweis-Nr.", default: true },
  { key: "geburtsdatum", label: "Geburtsdatum", default: true },
  { key: "alter", label: "Alter (aktuell)", default: true },
  { key: "jahrgangsalter", label: "Jahrgangs-Alter", default: false },
  { key: "eintrittsdatum", label: "Eintrittsdatum", default: true },
  { key: "sitzplaetze", label: "Sitzplätze", default: false },
  { key: "jugendflamme1", label: "Jugendflamme 1", default: false },
  { key: "jugendflamme2", label: "Jugendflamme 2", default: false },
  { key: "leistungsspange", label: "Leistungsspange", default: false },
  { key: "aktiv", label: "Aktiv", default: false },
] as const;

export const PERSONEN_EXPORT_COL_KEYS = PERSONEN_EXPORT_COLUMNS.map((c) => c.key);

export function isPersonenExportColKey(v: string): v is PersonenExportColKey {
  return (PERSONEN_EXPORT_COL_KEYS as string[]).includes(v);
}
