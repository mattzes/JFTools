// Referenzdaten aus der Spezifikation (Abschnitt 7) — Single Source of Truth
// für API, Web-Frontend und eine spätere native App.

export const A_TEIL_POSITIONEN = ["GF", "ME", "MA", "AF", "AM", "WF", "WM", "SF", "SM"] as const;
export type ATeilPosition = (typeof A_TEIL_POSITIONEN)[number];

export const A_TEIL_LABELS: Record<ATeilPosition, string> = {
  GF: "Gruppenführer/in",
  ME: "Melder/in",
  MA: "Maschinist/in",
  AF: "Angriffstruppführer/in",
  AM: "Angriffstruppmann/-frau",
  WF: "Wassertruppführer/in",
  WM: "Wassertruppmann/-frau",
  SF: "Schlauchtruppführer/in",
  SM: "Schlauchtruppmann/-frau",
};

// Nur diese 4 Positionen binden einen Knoten
export const KNOTEN_POSITIONEN = ["AF", "AM", "WF", "WM"] as const;
export type KnotenPosition = (typeof KNOTEN_POSITIONEN)[number];

// STATISCH, nicht erweiterbar — es gibt genau diese 4 Knoten:
export const KNOTEN = ["Mastwurf", "Schotenstich", "Zimmermannsstich", "Kreuzknoten"] as const;
export type Knoten = (typeof KNOTEN)[number];

// Zuordnung Position -> Knoten wird JE WETTBEWERB konfiguriert.
// Seed-Beispiel (KJFT-Sheet):
export const KNOTEN_SEED_KJFT: Record<KnotenPosition, Knoten> = {
  AF: "Schotenstich",
  AM: "Zimmermannsstich",
  WF: "Mastwurf",
  WM: "Kreuzknoten",
};

// Wettbewerbe sind KEINE feste Liste — sie ergeben sich aus Terminen mit planungsmodus:
export const PLANUNGSMODI = ["keine", "nur_gruppen", "a_teil", "a_und_b_teil"] as const;
export type Planungsmodus = (typeof PLANUNGSMODI)[number];

export const ZIELGRUPPEN = ["alle", "nur_betreuer", "nur_jugendliche"] as const;
export type Zielgruppe = (typeof ZIELGRUPPEN)[number];

export const ROLLEN = ["jugendlich", "betreuer"] as const;
export type Rolle = (typeof ROLLEN)[number];

export const GESCHLECHTER = ["M", "W"] as const;

export const VERFUEGBARKEIT_STATUS = ["ja", "nein", "offen"] as const;
export type VerfuegbarkeitStatus = (typeof VERFUEGBARKEIT_STATUS)[number];

// Hindernis-Fähigkeit (A-Teil-Planungshilfe):
export const HINDERNIS_MATERIAL = ["ohne", "verteiler", "schlauchpaket"] as const;
export type HindernisMaterial = (typeof HINDERNIS_MATERIAL)[number];
export const HINDERNIS_STATUS = ["ja", "nein", "unsicher"] as const;
export type HindernisStatus = (typeof HINDERNIS_STATUS)[number];

// Alterssumme der Gruppe -> Soll-Zeit im B-Teil (Sekunden)
export const SOLL_ZEIT_TABELLE = [
  { minSumme: 90, maxSumme: 94, schnitt: 10, sollZeitSek: 160 }, // 2:40
  { minSumme: 95, maxSumme: 103, schnitt: 11, sollZeitSek: 155 }, // 2:35
  { minSumme: 104, maxSumme: 112, schnitt: 12, sollZeitSek: 150 }, // 2:30
  { minSumme: 113, maxSumme: 121, schnitt: 13, sollZeitSek: 145 }, // 2:25
  { minSumme: 122, maxSumme: 130, schnitt: 14, sollZeitSek: 140 }, // 2:20
  { minSumme: 131, maxSumme: 139, schnitt: 15, sollZeitSek: 135 }, // 2:15
  { minSumme: 140, maxSumme: 148, schnitt: 16, sollZeitSek: 130 }, // 2:10
  { minSumme: 149, maxSumme: 157, schnitt: 17, sollZeitSek: 125 }, // 2:05
  { minSumme: 158, maxSumme: 162, schnitt: 18, sollZeitSek: 120 }, // 2:00
] as const; // außerhalb 90–162: Warnung „Gruppe nicht startberechtigt"

export const B_TEIL_AUFGABEN: Record<number, string> = {
  1: "Laufen",
  2: "Laufen",
  3: "C-Schlauch",
  4: "Laufbrett",
  5: "Anziehen",
  6: "Laufen",
  7: "Strahlrohr halten",
  8: "Strahlrohr einbinden",
  9: "Leinenbeutel werfen",
};

// Feste Zeit-/Knoten-Disziplinen (Training). Die 4 Knoten teilen sich die KNOTEN-Konstante.
export const DISZIPLINEN_SEED = [
  "Strahlrohreinbinden",
  "Schlauchrollen",
  "Tunnel",
  "Anziehen",
  ...KNOTEN,
];

// ── Training: feste Kategorien ──
// kind bestimmt die Darstellung/Erfassung:
//   zeit         → Zeit-Tabelle (Best/Ø/Letzte/Verlauf), Notiz pro Person
//   knoten       → 4 Unterzeilen pro Person (die 4 Knoten), Notiz pro Person
//   wassergraben → statische Einzelauswahl pro Person
//   leinbeutel   → statische Einzelauswahl pro Person
export type TrainingKind = "zeit" | "knoten" | "wassergraben" | "leinbeutel";
export type TrainingKategorie = {
  key: string;
  label: string;
  kind: TrainingKind;
  disziplin?: string; // kind === "zeit": zugehörige Disziplin
  disziplinen?: readonly string[]; // kind === "knoten": die 4 Knoten
};

export const TRAINING_KATEGORIEN: readonly TrainingKategorie[] = [
  { key: "wassergraben", label: "Wassergraben", kind: "wassergraben" },
  { key: "strahlrohr", label: "Strahlrohreinbinden", kind: "zeit", disziplin: "Strahlrohreinbinden" },
  { key: "schlauchrollen", label: "Schlauchrollen", kind: "zeit", disziplin: "Schlauchrollen" },
  { key: "tunnel", label: "Tunnel", kind: "zeit", disziplin: "Tunnel" },
  { key: "anziehen", label: "Anziehen", kind: "zeit", disziplin: "Anziehen" },
  { key: "leinbeutel", label: "Leinbeutelwerfen", kind: "leinbeutel" },
  { key: "knoten", label: "Knoten", kind: "knoten", disziplinen: KNOTEN },
];

// Statische Auswahl-Werte (in training_eintraege.wert gespeichert; null = nicht eingetragen)
export const WASSERGRABEN_WERTE = ["ohne", "verteiler", "schlauchpaket"] as const;
export type WassergrabenWert = (typeof WASSERGRABEN_WERTE)[number];
export const WASSERGRABEN_LABELS: Record<WassergrabenWert, string> = {
  ohne: "ohne Geräte",
  verteiler: "mit Verteiler",
  schlauchpaket: "mit Schlauchpaket",
};

export const LEINBEUTEL_WERTE = ["getroffen", "zu_kurz", "vorbeigeworfen"] as const;
export type LeinbeutelWert = (typeof LEINBEUTEL_WERTE)[number];
export const LEINBEUTEL_LABELS: Record<LeinbeutelWert, string> = {
  getroffen: "getroffen",
  zu_kurz: "zu kurz",
  vorbeigeworfen: "vorbeigeworfen",
};

export const DOKUMENTTYP_SEED = ["Einverständniserklärung"];

// Zeltlager-Altersklassen (konfigurierbar gedacht, v1: feste Auswahl)
export const ALTERSKLASSEN = ["10–13 Jahre", "14–18 Jahre"] as const;
