import { NextResponse } from "next/server";
import { sqlite } from "@/db";
import { requireAuth } from "@/lib/api-helpers";

// Beispieldaten aus der Spec (anonymisiert) — nur für einen leeren Datenbestand,
// damit man die App sofort ausprobieren kann.
// Index 7 = Leistungsspange-Datum (absolviert) oder null (offen → Vorschlag)
type P = [string, string, string, "M" | "W", number, string | null, string | null, string | null, boolean, "jugendlich" | "betreuer", number?];

const PEOPLE: P[] = [
  ["715003786", "Lena", "Brandt", "W", 2010, "2019-03-07", "2023-11-04", "2025-05-15", true, "jugendlich"],
  ["715003790", "Finn", "Hoffmann", "M", 2011, "2020-03-13", null, null, true, "jugendlich"],
  ["715003802", "Mia", "Schröder", "W", 2012, "2021-09-22", null, null, false, "jugendlich"],
  ["715003815", "Jonas", "Keller", "M", 2009, "2018-05-11", "2022-06-19", "2024-05-11", true, "jugendlich"],
  ["715003821", "Emma", "Voigt", "W", 2011, "2020-04-03", null, null, false, "jugendlich"],
  ["715003838", "Luca", "Petersen", "M", 2013, null, null, null, true, "jugendlich"],
  ["715003844", "Marie", "Wagner", "W", 2012, "2021-09-22", null, null, true, "jugendlich"],
  ["715003850", "Tom", "Krüger", "M", 2010, "2019-03-07", "2023-11-04", "2025-05-15", false, "jugendlich"],
  ["715003867", "Sophie", "Radtke", "W", 2014, null, null, null, true, "jugendlich"],
  ["715003873", "Ben", "Ahrens", "M", 2011, "2020-03-13", null, null, true, "jugendlich"],
  ["715003889", "Lea", "Timm", "W", 2013, "2021-09-22", null, null, false, "jugendlich"],
  ["715003895", "Paul", "Dettmer", "M", 2009, "2018-05-11", "2022-06-19", "2024-05-11", true, "jugendlich"],
  ["", "Katrin", "Meyer", "W", 1989, null, null, null, true, "betreuer", 4],
  ["", "Stefan", "Ruge", "M", 1985, null, null, null, true, "betreuer", 3],
  ["", "Andrea", "Pohl", "W", 1992, null, null, null, true, "betreuer", 4],
];

export async function POST() {
  await requireAuth();
  const count = sqlite.prepare("SELECT COUNT(*) AS n FROM personen").get() as { n: number };
  if (count.n > 0) {
    return NextResponse.json({ ok: false, message: "Es sind bereits Personen vorhanden — Demo-Daten übersprungen." }, { status: 409 });
  }

  const ins = sqlite.transaction(() => {
    const insP = sqlite.prepare(
      `INSERT INTO personen (rolle, vorname, nachname, geschlecht, geburtsdatum, ausweisnr, jugendflamme1, jugendflamme2, leistungsspange_datum, sitzplaetze, aktiv, ort)
       VALUES (?,?,?,?,?,?,?,?,?,?,1,?)`,
    );
    for (const p of PEOPLE) {
      insP.run(p[9], p[1], p[2], p[3], `${p[4]}-01-15`, p[0] || null, p[5], p[6], p[7], p[10] ?? null, p[8] === false && p[9] === "jugendlich" ? "Winsen" : "Winsen");
    }

    // Ein paar Verfügbarkeiten für die drei Wettkampf-Termine setzen
    const termine = sqlite.prepare("SELECT id, planungsmodus FROM termine ORDER BY datum_von").all() as { id: number; planungsmodus: string }[];
    const personIds = (sqlite.prepare("SELECT id FROM personen WHERE rolle='jugendlich'").all() as { id: number }[]).map((r) => r.id);
    const insV = sqlite.prepare("INSERT INTO verfuegbarkeiten (person_id, termin_id, status) VALUES (?,?,?)");
    const pat = ["ja", "ja", "nein", "offen", "ja", "ja", "ja", "nein", "ja"];
    for (const t of termine.filter((t) => t.planungsmodus !== "keine")) {
      personIds.forEach((pid, i) => insV.run(pid, t.id, pat[i % pat.length]));
    }

    // Knoten-Seed (KJFT) für den ersten a_und_b_teil-Termin
    const wettkampf = termine.find((t) => t.planungsmodus === "a_und_b_teil");
    if (wettkampf) {
      const insK = sqlite.prepare("INSERT INTO knoten_zuordnungen (termin_id, position, knoten) VALUES (?,?,?)");
      insK.run(wettkampf.id, "AF", "Schotenstich");
      insK.run(wettkampf.id, "AM", "Zimmermannsstich");
      insK.run(wettkampf.id, "WF", "Mastwurf");
      insK.run(wettkampf.id, "WM", "Kreuzknoten");
    }
  });
  ins();

  return NextResponse.json({ ok: true, message: `${PEOPLE.length} Personen angelegt.` });
}
