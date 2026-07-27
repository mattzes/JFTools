import { Person, Gruppenmitglied, Verfuegbarkeit } from "@/lib/api";
import { alterInDiesemJahr, sollZeit, formatSollZeit, startberechtigt } from "./alter";

export function gruppenAlter(mitglieder: Gruppenmitglied[], personById: Map<number, Person>): { summe: number; schnitt: number; anzahl: number } {
  let summe = 0;
  let anzahl = 0;
  for (const m of mitglieder) {
    const p = personById.get(m.personId);
    if (p?.geburtsdatum) {
      summe += alterInDiesemJahr(p.geburtsdatum);
      anzahl++;
    }
  }
  return { summe, schnitt: anzahl ? Math.round((summe / anzahl) * 10) / 10 : 0, anzahl };
}

export function sollZeitLabel(summe: number): { text: string; ok: boolean } {
  const row = sollZeit(summe);
  if (!row) return { text: "—", ok: false };
  return { text: formatSollZeit(row.sollZeitSek), ok: startberechtigt(summe) };
}

// Warnungen je Gruppe (als Hinweise, nicht blockierend)
export function gruppenWarnungen(
  mitglieder: Gruppenmitglied[],
  personById: Map<number, Person>,
  verfByPerson: Map<number, Verfuegbarkeit["status"]>,
  modus: string,
  rueckOffenByPerson: Set<number>,
): string[] {
  const w: string[] = [];
  const istABTeil = modus === "a_teil" || modus === "a_und_b_teil";

  if (istABTeil) {
    // Positionen doppelt / fehlend
    const posCount = new Map<string, number>();
    mitglieder.forEach((m) => m.aTeilPosition && posCount.set(m.aTeilPosition, (posCount.get(m.aTeilPosition) ?? 0) + 1));
    for (const [pos, n] of posCount) if (n > 1) w.push(`Position ${pos} ist ${n}× besetzt`);

    if (modus === "a_und_b_teil") {
      const laufCount = new Map<number, number>();
      mitglieder.forEach((m) => m.bTeilLaeufer && laufCount.set(m.bTeilLaeufer, (laufCount.get(m.bTeilLaeufer) ?? 0) + 1));
      for (const [l, n] of laufCount) if (n > 1) w.push(`Läufer ${l} ist ${n}× vergeben`);
    }
  }

  // Verfügbarkeit / Rückmeldung
  for (const m of mitglieder) {
    const p = personById.get(m.personId);
    if (!p) continue;
    const s = verfByPerson.get(m.personId);
    if (s === "nein") w.push(`${p.vorname} ${p.nachname} hat für den Termin abgesagt`);
    else if (s !== "ja") w.push(`${p.vorname} ${p.nachname} hat noch nicht zugesagt`);
    if (rueckOffenByPerson.has(m.personId)) w.push(`${p.vorname} ${p.nachname}: Einverständniserklärung fehlt`);
  }

  return w;
}
