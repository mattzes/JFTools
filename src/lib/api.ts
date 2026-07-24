"use client";

import { useCallback, useEffect, useState } from "react";

// Client-Datenzugriff — ausschließlich über die versionierte REST-API /api/v1
// (Architektur-Regel 1: keine Server Actions, keine direkten DB-Zugriffe).

export async function api<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Fehler ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function useApi<T>(path: string): { data: T | null; reload: () => void; error: string | null } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    api<T>(path)
      .then((d) => alive && setData(d))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [path, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, reload, error };
}

// ── Typen (API-Antworten) ──
export type Person = {
  id: number;
  rolle: "jugendlich" | "betreuer";
  nachname: string;
  vorname: string;
  strasse: string | null;
  plz: string | null;
  ort: string | null;
  ausweisnr: string | null;
  geburtsdatum: string | null;
  eintrittsdatum: string | null;
  geschlecht: "M" | "W" | null;
  sitzplaetze: number | null;
  jugendflamme1: string | null;
  jugendflamme2: string | null;
  leistungsspangeJahr: number | null;
  aktiv: boolean;
};

export type Termin = {
  id: number;
  titel: string;
  datumVon: string;
  datumBis: string | null;
  planungsmodus: "keine" | "nur_gruppen" | "a_teil" | "a_und_b_teil";
  zielgruppe: "alle" | "nur_betreuer" | "nur_jugendliche";
  ort: string | null;
};

export type Verfuegbarkeit = { id: number; personId: number; terminId: number; status: "ja" | "nein" | "offen" };
export type Dokumententyp = { id: number; name: string };
export type Rueckmeldung = {
  id: number;
  personId: number;
  dokumententypId: number;
  erhalten: boolean;
  erhaltenAm: string | null;
  notiz: string | null;
  terminId: number | null;
};
export type Gruppe = {
  id: number;
  terminId: number;
  name: string;
  altersklasse: string | null;
  betreuerPersonId: number | null;
};
export type Gruppenmitglied = {
  id: number;
  gruppeId: number;
  personId: number;
  aTeilPosition: "GF" | "ME" | "MA" | "AF" | "AM" | "WF" | "WM" | "SF" | "SM" | null;
  bTeilLaeufer: number | null;
};
export type KnotenZuordnung = { id: number; terminId: number; position: "AF" | "AM" | "WF" | "WM"; knoten: string };
export type Disziplin = { id: number; name: string; einheit: string };
export type Messung = {
  id: number;
  personId: number;
  disziplinId: number;
  datum: string;
  wertSekunden: number | null;
  wertText: string | null;
  notiz: string | null;
};
export type HindernisFaehigkeit = {
  id: number;
  personId: number;
  hindernis: string;
  material: "ohne" | "verteiler" | "schlauchpaket";
  status: "ja" | "nein" | "unsicher";
  notiz: string | null;
};

export type Planung = {
  termin: Termin;
  gruppen: Gruppe[];
  mitglieder: Gruppenmitglied[];
  knoten: KnotenZuordnung[];
  verfuegbarkeiten: Verfuegbarkeit[];
};

export function personName(p: Person): string {
  return `${p.vorname} ${p.nachname}`;
}
