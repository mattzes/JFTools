# Spezifikation: Jugendfeuerwehr-Verwaltung & Wettbewerbs-Gruppenplanung

> Ablösung einer Excel-Arbeitsmappe („Mitglieder und Gruppen – Gruppenbildung") durch eine moderne Anwendung.
> Zielgruppe: Jugendfeuerwehrwarte/Betreuer der JF Rottorf (Landkreis Harburg, Niedersachsen).
> Dieses Dokument ist die Grundlage für Claude Code. Es beschreibt Ist-Zustand (Excel), Domänenmodell, Geschäftsregeln, Features und offene Entscheidungen.

---

## 1. Kontext & Ziel

Aktuell wird alles in einer Excel-Datei mit 9 Sheets verwaltet:

| Sheet | Zweck |
|---|---|
| `Mitgliederliste` | Stammdaten Jugendliche + Abzeichen + Terminverfügbarkeit + Einverständniserklärung |
| `Betreuer` | Stammdaten Betreuer + Sitzplätze (PKW) + Terminverfügbarkeit |
| `Wettbewerbs-Zeiten` | Trainings-/Übungszeiten pro Disziplin und Person (Freiform, mehrere Messreihen) |
| `Laßrönne`, `KJFT`, `SFT`, `Bezirk`, `Land` | Gruppenplanung je Wettbewerb (A-Teil-Positionen, B-Teil-Läufer, Knoten, Alterssumme) |
| `Zeltlager` | Gruppeneinteilung nach Altersklassen + Betreuer-Rollenzuweisung |

Kernfunktionen der App:

1. **Mitglieder- und Betreuerverwaltung** (Stammdaten, gemeinsames Personenmodell)
2. **Terminverwaltung + Verfügbarkeitsabfrage** (wer kann an welchem Termin?)
3. **Rückmeldungs-Tracking** (Einverständniserklärung u. weitere Zettel)
4. **Abzeichenverwaltung** (Jugendflamme 1, Jugendflamme 2, Leistungsspange – erledigt + fällig)
5. **Wettbewerbs-Gruppenplanung** (je nach Termin: reine Gruppeneinteilung, A-Teil oder A+B-Teil; 9 Positionen, Läufer 1–9, Knoten je Wettbewerb, Alterssumme → Soll-Zeit, gefiltert nach Verfügbarkeit)
6. **Zeltlager-Gruppeneinteilung** (nach Altersklassen; ohne Betreuer-Rollen in v1)
7. **Trainingszeiten-Erfassung** (Zeiten pro Disziplin/Person über mehrere Übungsabende, Notizen)
8. **JSON-Backup** (Export/Import des kompletten Datenbestands)

---

## 2. Domänenmodell (Entitäten)

### 2.1 Mitglied (Jugendliche/r)

Spalten aus `Mitgliederliste` (Excel-Tabelle `Tabelle1`):

| Feld | Typ | Beispiel | Anmerkung |
|---|---|---|---|
| `nachname` | string | Kaiser | |
| `vorname` | string | Jessica | In Excel ist der Vorname der Lookup-Key – in der App wird die **Mitgliedsnummer (`ausweisnr`) als eindeutige fachliche ID** verwendet (vom Nutzer festgelegt). Technisch zusätzlich interner Primärschlüssel empfohlen, da Betreuer/unverknüpfte Trainings-Personen evtl. keine Mitgliedsnummer haben. |
| `strasse` | string | Bundesstr. 32 | |
| `plz` | string | 21423 | |
| `ort` | string | Winsen | Header-Zelle in Excel heißt fälschlich „Winsen" – gemeint ist der Ort |
| `ausweisnr` | string | 715003786 | Mitgliedsausweisnummer |
| `geburtsdatum` | date | 12.01.2008 | |
| `eintrittsdatum` | date | 12.01.2018 | |
| `geschlecht` | enum `M`/`W` | | Nur M/W – mehr gibt es derzeit in der JF nicht (vom Nutzer bestätigt) |
| `jugendflamme1` | date \| null | 07.03.2019 | s. Abzeichen-Modell unten |
| `jugendflamme2` | date \| null | 04.11.2023 | „-" = nicht vorhanden |
| `leistungsspange_jahr` | int \| null | 2024 / 2026 / 2028 / 2030 | In Excel: Jahr, in dem die Leistungsspange **ansteht bzw. gemacht wurde** – Vergangenheit = erledigt, Zukunft = geplant/fällig |
| `einverstaendniserklaerung` | bool | Ja | s. Rückmeldungen |
| `aktiv` | bool | – | Neu: statt Zeile löschen, Mitglied deaktivieren (Historie erhalten) |

**Berechnete Felder** (Excel-Formeln, in der App serverseitig/on-the-fly berechnen, nicht speichern):

- `alter` (taggenau): `Jahr(heute) − Jahr(geb)`, minus 1 wenn Geburtstag dieses Jahr noch nicht war.
  Excel: `=(YEAR(TODAY())-YEAR(Geb)) + IF(DATE(YEAR(TODAY()),MONTH(Geb),DAY(Geb)) > TODAY(), -1, 0)`
- `alter_in_diesem_jahr` (Jahrgangs-Alter): `Jahr(heute) − Jahr(geb)`. **Dieses Alter wird für die Wettbewerbs-Gruppenplanung verwendet** (Alterssumme/Schnitt), weil bei den Wettbewerben das im Kalenderjahr erreichte Alter zählt (Stichtagsregelung).
- Excel-Datenfehler als Warnung: Bei 4 Datensätzen ist `alter` negativ (−111 bis −115) → in Excel Formel-/Datenfehler. Die App muss Geburtsdaten validieren und Plausibilitätswarnungen anzeigen.

### 2.2 Betreuer

Spalten aus `Betreuer` (Excel-Tabelle `Tabelle116`):

| Feld | Typ | Anmerkung |
|---|---|---|
| `nachname`, `vorname` | string | |
| `sitzplaetze` | int \| null | Anzahl PKW-Sitzplätze für Fahrgemeinschaften (Werte: 3, 4, „-") – relevant für Transportplanung zu Terminen |
| Verfügbarkeit je Termin | s. 2.4 | gleiche Terminliste wie Mitglieder, plus eigene Termine (z. B. Weihnachtsfeier) |

**Entschieden:** Mitglied und Betreuer werden als **eine gemeinsame Entität `Person`** mit `rolle: jugendlich | betreuer` modelliert (vom Nutzer bestätigt). Jugendliche können mit 18 zu Betreuern wechseln (muss nicht, kann aber) → Rollenwechsel ohne Datenverlust möglich. Betreuer haben weniger Pflichtfelder, dafür `sitzplaetze`; Jugendliche haben Abzeichen.

### 2.3 Abzeichen

Drei Abzeichen-Typen mit fester Reihenfolge und (real existierenden) Mindestalter-Regeln der Nds. Jugendfeuerwehr:

| Abzeichen | Excel-Speicherung | Regel (Vorschlag für App-Logik) |
|---|---|---|
| Jugendflamme 1 | Datum der Abnahme (teils Text „13.3.2025" oder nur Jahr „2026") | frühestens ab 10 Jahren (üblich) |
| Jugendflamme 2 | Datum der Abnahme, „-" oder leer | setzt JF1 voraus, üblich ab 13 |
| Leistungsspange | **Jahr** (Vergangenheit = erworben, Zukunft = geplant) | **Nach Jahrgang gerechnet: möglich ab dem Kalenderjahr, in dem die Person 15 wird** (vom Nutzer bestätigt). App-Vorschlag: `geburtsjahr + 15`, manuell überschreibbar (in der Praxis werden Jahrgänge in Kohorten geplant: 2024, 2026, 2028, 2030) |

App-Modell (Vorschlag):

```
Abzeichen {
  person_id
  typ: JF1 | JF2 | LSP
  status: erworben | geplant
  datum: date | null        // bei erworben
  geplantes_jahr: int|null  // bei geplant
}
```

Feature: Übersicht/Dashboard „Wer ist wann fällig?" – gruppiert nach Jahr, mit Filter auf Abzeichentyp. Die App soll das Fälligkeitsjahr **vorschlagen** (`geburtsjahr + 15` für die Leistungsspange), aber manuell überschreibbar lassen.

### 2.4 Termin (Event) & Verfügbarkeit

In Excel sind Termine **Spalten** in Mitglieder- und Betreuerliste. In der App: eigene Entität.

Termine gelten für Betreuer und Jugendliche als **eine gemeinsame Entität** (vom Nutzer bestätigt). Es gibt jedoch Termine, an denen Jugendliche nicht teilnehmen müssen (z. B. Weihnachtsfeier der Betreuer) → Zielgruppen-Flag.

**Wichtig: Wettbewerbe sind KEINE feste Liste, sondern hängen an den Terminen des jeweiligen Jahres.** Beim Anlegen eines Termins wird angegeben, welche Art von Planung dort nötig ist (vom Nutzer festgelegt):

- `keine` – normaler Termin, nur Verfügbarkeitsabfrage (z. B. Brennballturnier, Weihnachtsfeier)
- `nur_gruppen` – reine Gruppeneinteilung ohne Vorgaben/Positionen (z. B. O-Marsch)
- `a_teil` – Gruppenplanung mit den 9 A-Teil-Positionen + Knoten
- `a_und_b_teil` – A-Teil plus B-Teil-Läufer 1–9 und Soll-Zeit

```
Termin {
  id, titel, datum_von, datum_bis (optional, für mehrtägige)
  planungsmodus: keine | nur_gruppen | a_teil | a_und_b_teil
  zielgruppe: alle | nur_betreuer | nur_jugendliche   // steuert, für wen Verfügbarkeit abgefragt wird
  ort (optional)
}

Verfuegbarkeit {
  person_id, termin_id
  status: ja | nein | offen   // Excel: "Ja" / "Nein" / leer
}
```

Termine 2026 aus der Excel (als Seed-/Beispieldaten):

| Datum | Titel | Planungsmodus | Zielgruppe |
|---|---|---|---|
| 14.03.26 | Brennballturnier (Tag 1) | keine | alle |
| 15.03.26 | Brennballturnier (Tag 2) | keine | alle |
| 01.05.26 | O-Marsch Handorf | nur_gruppen | alle |
| 10.05.26 | Pokalwettbewerb Laßrönne | a_und_b_teil | alle |
| 31.05.26 | KJF-Tag | a_und_b_teil | alle |
| 13.06.26 | SJF-Tag in Rottorf | a_und_b_teil | alle |
| 13.–14.06.26 | Bezirksentscheid | a_und_b_teil | alle |
| 26.–28.06.26 | Landesentscheid | a_und_b_teil | alle |
| (Zeitraum) | Kreiszeltlager | nur_gruppen | alle |
| (offen) | Weihnachtsfeier | keine | nur_betreuer |

*(Ob ein konkreter Wettbewerb nur A-Teil oder A+B-Teil hat, legt der Nutzer beim Anlegen des Termins fest – die Zuordnung oben ist eine Annahme als Seed.)*

Funktionen:
- Pro Termin: Zähler „Zusagen" (Excel: `COUNTIF(...,"Ja")` je Spalte, getrennt für Jugendliche und Betreuer).
- Pro Termin: Summe verfügbarer Betreuer-Sitzplätze (Transportkapazität) – heute nicht in Excel, aber naheliegend, da `Sitzplätze` gepflegt wird.
- Verfügbarkeits-Matrix-Ansicht (Personen × Termine) als Ersatz für den Excel-Blick.
- Die Gruppenplanung eines Wettbewerbs zeigt nur Personen mit `status = ja` für den zugehörigen Termin als „Starter" an (heute: manuell gepflegte Starter-Spalte + XLOOKUP der Ja/Nein-Werte).

### 2.5 Rückmeldungen / Zettel

Heute nur eine Spalte `Einverständniserklärung` (Ja/leer). Anforderung laut Nutzer: „Einverständniserklärung **bzw. weitere Zettel/Rückmeldungen**".

Modell generisch halten:

```
Dokumententyp { id, name }          // z. B. "Einverständniserklärung", "Gesundheitsbogen Zeltlager", "Fotoerlaubnis"
Rueckmeldung {
  person_id, dokumententyp_id
  erhalten: bool, erhalten_am: date|null, notiz
  termin_id: optional               // falls ein Zettel zu einem konkreten Termin gehört (z. B. Zeltlager-Anmeldung)
}
```

Dashboard: „Wem fehlt noch was?" pro Dokumententyp/Termin.

### 2.6 Wettbewerbs-Gruppenplanung

Das Herzstück. Für jeden Termin mit `planungsmodus ≠ keine` wird eine Gruppenplanung angelegt. Gruppen können per Button **beliebig hinzugefügt und gelöscht** werden (vom Nutzer festgelegt; Excel hatte fix 3 Slots). Bei `nur_gruppen` (z. B. O-Marsch) ist es eine freie Einteilung ohne Positionen; bei `a_teil` / `a_und_b_teil` gelten die folgenden Strukturen.

**A-Teil – 9 feste Positionen** (Löschangriff, Bundeswettbewerb-Schema):

| Kürzel | Position |
|---|---|
| GF | Gruppenführer/in |
| ME | Melder/in |
| MA | Maschinist/in |
| AF | Angriffstruppführer/in |
| AM | Angriffstruppmann/-frau |
| WF | Wassertruppführer/in |
| WM | Wassertruppmann/-frau |
| SF | Schlauchtruppführer/in |
| SM | Schlauchtruppmann/-frau |

**Knoten im A-Teil:** Genau 4 Positionen binden je einen Knoten: **AF, AM, WF, WM** (Angriffs- und Wassertrupp; vom Nutzer als „AT, AM, WT, WM" bezeichnet). Die restlichen 5 Positionen binden keinen Knoten.

⚠️ **Die Knoten-Zuordnung ist je Wettbewerb unterschiedlich** (vom Nutzer bestätigt). Sie darf also NICHT als globale Konstante modelliert werden, sondern als Konfiguration **pro Wettbewerb**:

```
WettbewerbKnotenZuordnung {
  wettbewerb_id
  position: AF | AM | WF | WM
  knoten: string   // Auswahl aus Knoten-Stammliste
}
```

Die Knoten-Liste ist **statisch und nicht erweiterbar** (vom Nutzer festgelegt) – es gibt genau diese 4: **Mastwurf, Schotenstich, Zimmermannsstich, Kreuzknoten**. Variabel ist nur, welche Position bei welchem Wettbewerb welchen dieser 4 Knoten bindet.

Beispiel-Zuordnung aus dem KJFT-Sheet (als Seed für KJFT):

| Position | Knoten |
|---|---|
| AF | Schotenstich |
| AM | Zimmermannsstich |
| WF | Mastwurf |
| WM | Kreuzknoten |

UI: Im Gruppenplaner wird neben AF/AM/WF/WM der für diesen Wettbewerb konfigurierte Knoten angezeigt, damit man beim Besetzen sieht, wer welchen Knoten können muss.

**B-Teil – Staffellauf mit 9 Läufern**, jeder Läufer-Position ist eine feste Aufgabe zugeordnet (Excel-Referenztabelle `Tabelle2`):

| Läufer | Aufgabe |
|---|---|
| 1 | Laufen |
| 2 | Laufen |
| 3 | C-Schlauch |
| 4 | Laufbrett |
| 5 | Anziehen |
| 6 | Laufen |
| 7 | Strahlrohr halten |
| 8 | Strahlrohr einbinden |
| 9 | Leinenbeutel werfen |

In Excel bekommt jede Person in der Gruppe eine Läufer-Nummer (Spalte „Gruppe"), die Aufgabe wird per `VLOOKUP` aufgelöst. **A-Teil-Position und B-Teil-Läufer sind unabhängig voneinander zugewiesen** (dieselbe Person hat beides).

**Alterslogik & Soll-Zeit (B-Teil):**
- Pro Gruppe wird **Alterssumme** (Excel: `SUM` der Spalte „Alter in diesem Jahr", z. B. 143, 117, 134) und **Altersdurchschnitt** (`AVERAGE`) berechnet.
- Es zählt „Alter in diesem Jahr" (Jahrgangs-Alter / Stichtagsregelung).
- Zeltlager-Sheet-Notiz: „Kreis ist die Altersgrenze Stichtag".
- Aus dem **Gesamtalter (Alterssumme)** der Gruppe ergibt sich die **Soll-Zeit im B-Teil** (Quelle: Wettbewerbsordnung, vom Nutzer bestätigt):

| Gesamtalter | Durchschnittsalter | Soll-Zeit B-Teil |
|---|---|---|
| 90–94 | 10 | 2:40 min |
| 95–103 | 11 | 2:35 min |
| 104–112 | 12 | 2:30 min |
| 113–121 | 13 | 2:25 min |
| 122–130 | 14 | 2:20 min |
| 131–139 | 15 | 2:15 min |
| 140–148 | 16 | 2:10 min |
| 149–157 | 17 | 2:05 min |
| 158–162 | 18 | 2:00 min |

- Die App zeigt beim Planen live: Alterssumme, Durchschnitt und die daraus resultierende **Soll-Zeit** an. Gültiger Bereich der Alterssumme: **90–162**; außerhalb → Warnung („Gruppe nicht startberechtigt / außerhalb der Tabelle").
- Diese Tabelle als konfigurierbare Stammdaten hinterlegen (falls sich die Wettbewerbsordnung ändert).
- Praktischer Nutzen für den Planer: Beim Tauschen einzelner Personen sieht man sofort, ob die Gruppe in eine günstigere/ungünstigere Soll-Zeit-Stufe rutscht.

**Verfügbarkeits-Integration:** Jede Gruppenplanungs-Zeile zeigt in Excel per XLOOKUP die Ja/Nein-Werte der Person für die Termine Laßrönne, KJFT und SFT nebeneinander (weil dieselben Gruppen oft bei mehreren Wettbewerben starten). Die App soll beim Zuweisen einer Person zu einer Gruppe deren Verfügbarkeit für den jeweiligen Wettbewerbstermin anzeigen und bei „Nein"/„offen" warnen.

**Starterliste:** Pro Wettbewerb existiert eine Liste „Starter" (verfügbare Kandidaten). In der App: automatisch = alle Personen mit Zusage für den Termin; daraus wird per Drag & Drop in die Gruppen/Positionen verteilt. Zugewiesene Personen bleiben in der Starterliste sichtbar (mit Kennzeichnung), da Doppelstarts möglich sind; nicht zugeteilte Starter sind die „Reserve".

**Hindernis-Fähigkeiten als Planungshilfe (A-Teil):** Im A-Teil müssen die Jugendlichen Hindernisse (u. a. den **Wassergraben**) überwinden, wobei je nach Position unterschiedliches Material mitgetragen wird (**Schlauchpaket**, **Verteiler**). Pro Person wird daher als Einschätzung gepflegt, welche Hindernis-Material-Kombination sie fehlerfrei schafft:

```
HindernisFaehigkeit {
  person_id
  hindernis: "Wassergraben"           // aktuell einziges relevantes Hindernis, erweiterbar
  material: ohne | verteiler | schlauchpaket
  status: ja | nein | unsicher        // "vllt" aus der Excel
  notiz
}
```

Im Gruppenplaner wird diese Einschätzung neben den Personen angezeigt, damit man die A-Teil-Positionen passend besetzt (wer kein Schlauchpaket über den Wassergraben schafft, sollte keine Position bekommen, die eins trägt).

App-Modell (Vorschlag):

```
Wettbewerbsplanung { id, termin_id }        // wird für Termine mit planungsmodus ≠ keine angelegt
Gruppe { id, planung_id, name ("Gruppe 1"...) }   // per Button hinzufügen/löschen
Gruppenmitglied {
  gruppe_id, person_id
  a_teil_position: GF|ME|MA|AF|AM|WF|WM|SF|SM | null   // nur bei a_teil / a_und_b_teil
  b_teil_laeufer: 1..9 | null                          // nur bei a_und_b_teil
}
KnotenZuordnung { planung_id, position: AF|AM|WF|WM, knoten }  // je Wettbewerb konfiguriert
```

**Doppelstarter:** Eine Person KANN bei einem Wettbewerb in **zwei Gruppen gleichzeitig** starten (vom Nutzer bestätigt). Konsequenzen für UI und Logik:
- Die Starterliste ist keine „Verschieben"-Quelle, sondern eine **Kopier-Quelle**: Eine Person bleibt nach Zuweisung in der Starterliste sichtbar (bzw. wird dort als „eingeteilt in Gruppe 1" o. ä. markiert) und kann per Drag & Drop zusätzlich in eine weitere Gruppe gezogen werden.
- dnd-kit entsprechend konfigurieren: Drag aus der Starterliste erzeugt eine Zuweisung (Kopie), kein Move; Drag zwischen Gruppen verschiebt.
- Doppelstarter werden visuell gekennzeichnet (z. B. Badge „2×"), damit man den Überblick behält – die Alterssumme zählt die Person natürlich in **jeder** Gruppe, in der sie steht.

Validierungen (als Warnungen):
- Jede A-Teil-Position genau 1× pro Gruppe besetzt; jede Läufer-Nr. genau 1×.
- Person nicht doppelt in **derselben** Gruppe. (Mehrere Gruppen desselben Wettbewerbs sind als Doppelstart ausdrücklich ERLAUBT – nur Hinweis-Badge, keine Warnung.)
- Person hat für den Termin nicht zugesagt.
- Alterssumme außerhalb 90–162.
- Einverständniserklärung fehlt.

### 2.7 Zeltlager-Planung

Aus Sheet `Zeltlager`:

- Jugendliche werden in **Altersklassen** eingeteilt: `14–18` und `10–13` (Klassen sollten konfigurierbar sein). Maßgeblich: „Alter in diesem Jahr" mit Kreis-Stichtag.
- Innerhalb der Altersklasse mehrere Gruppen; jeder Gruppe ist ein Betreuer zugeordnet.
- ❌ Die **Betreuer-Rollen-Planung** (Fahrer, Schiri, Spielleitung, …) wird in der **ersten Version komplett weggelassen** (vom Nutzer festgelegt).

```
ZeltlagerGruppe { id, termin_id, altersklasse, betreuer_person_id, name }
ZeltlagerGruppenmitglied { gruppe_id, person_id }
```

Alternativ kann das Zeltlager über den generischen `planungsmodus: nur_gruppen` des Termins abgebildet werden – dann braucht es keine eigene Entität, nur das Altersklassen-Feld an der Gruppe.

### 2.8 Trainings-/Wettbewerbszeiten

Sheet `Wettbewerbs-Zeiten` ist Freiform-Erfassung von Übungsabenden. Struktur, die sich daraus ableitet:

- **Disziplinen** (in Excel als Spaltenblöcke): `Handschuhe Anziehen`, `Tunnel`, `Schlauchrollen`, `Strahlrohr Einbinden` – Disziplinen müssen frei anlegbar sein.
- Pro Disziplin: Personen × Versuche/Übungsabende, Messwert = Zeit in Sekunden (auch Text wie „ca. 20s" kommt vor → App: Sekunden als Zahl + optionales Freitextfeld).
- **Notizen** pro Person/Versuch (Excel: „verhaspelt sich mit dem Knoten", „sichere Technik", „Problem beim Halben Schlag", „Marie noch langsam aber sehr gute Technik").
- Zusätzlich enthält das Sheet die Spalte „Ermittlung Wassergraben" (Schlauchpaket / Wassergraben / Verteiler / „vllt …") → das ist die **Hindernis-Fähigkeit für den A-Teil** (s. Abschnitt 2.6, `HindernisFaehigkeit`): welche Material-Kombination die Person fehlerfrei über den Wassergraben bringt.

```
Disziplin { id, name, einheit: "s" }
Messung { person_id, disziplin_id, datum, wert_sekunden|null, wert_text|null, notiz }
```

Auswertung: Bestzeit, letzte Zeit, Verlauf (Sparkline) pro Person/Disziplin; Ranking pro Disziplin → unterstützt die Läufer-/Positionsvergabe im B-Teil.

ℹ️ **Hinweis zur Beispieldatei:** Die Mitglieder- und Betreuerliste in der vorliegenden Excel ist **anonymisiert** (vom Nutzer bestätigt); nur `Wettbewerbs-Zeiten` enthält echte Vornamen – daher passen die Namen nicht zusammen. Da kein Excel-Import stattfindet, ist das nur für das Verständnis der Beispieldaten relevant.

---

## 3. Hinweise aus der Excel-Analyse (informativ)

Ein Excel-Import ist **nicht** Teil des Umfangs (vom Nutzer gestrichen) – die Daten werden in der App neu erfasst. Die folgenden Beobachtungen sind trotzdem nützlich, um Validierungen richtig zu bauen:

1. **Vorname als Join-Key** in Excel bricht bei doppelten Vornamen → in der App feste IDs (Mitgliedsnummer + interner Schlüssel).
2. **Gemischte Datentypen** in Abzeichen-Spalten (Datum, Text-Datum, Jahreszahl, „-", leer) → Eingabefelder klar typisieren (Datum vs. Jahr).
3. **Negative Alter** durch fehlerhafte Geburtsdaten → Geburtsdatum bei Eingabe validieren (Plausibilitätsbereich, z. B. Alter 5–80).
4. Excel-Summenzeilen (`COUNTIF`-Zähler, Altersdurchschnitt) sind berechnete Werte → in der App live berechnen, nie speichern.

---

## 4. Feature-Liste (nach Priorität)

**MVP:**
1. Personenverwaltung (Jugendliche + Betreuer als `Person`), CRUD, Validierung, berechnete Alter
2. Terminverwaltung (mit Planungsmodus + Zielgruppe) + Verfügbarkeits-Matrix (Ja/Nein/offen), Zähler, schnelles Massen-Eintragen (Termin-Spalte durchklicken wie in Excel)
3. Rückmeldungs-Tracking (Einverständniserklärung + generische Dokumenttypen)
4. Abzeichenverwaltung mit Fälligkeits-Übersicht pro Jahr (Leistungsspangen-Vorschlag: `geburtsjahr + 15`)
5. Wettbewerbs-Gruppenplaner: Starterliste (aus Zusagen) → Gruppen per Button hinzufügen/löschen, 9 A-Teil-Positionen + B-Teil-Läufer per Drag & Drop, Knoten-Konfiguration je Wettbewerb, Live-Anzeige Alterssumme/-schnitt/Soll-Zeit, Hindernis-Fähigkeiten als Planungshilfe, Warnhinweise
6. **JSON-Backup:** kompletter Datenbestand als JSON-Datei exportierbar (und wieder importierbar zur Wiederherstellung)

**Phase 2:**
7. Zeltlager-Gruppeneinteilung nach Altersklassen (ohne Betreuer-Rollen)
8. Trainingszeiten-Erfassung + Auswertung (mobil-tauglich für den Übungsabend!)
9. Transport-/Sitzplatzübersicht pro Termin

---

## 5. Nichtfunktionale Anforderungen & Tech-Stack (verbindlich)

### Rahmenbedingungen

- **Ganz einfach halten (vom Nutzer festgelegt):** Die App läuft **nur lokal** (Self-Hosting im Heimnetz, kein öffentlicher Zugriff). Kein Login-/Rechtesystem, **keine Mehrbenutzer-Funktionalität** in der ersten Version – ein Nutzer, ein Datenbestand.
- **Zukunftssicherheit:** Multi-User-Fähigkeit und eine native iOS/Android-App sollen **später möglich** sein, ohne Rewrite. Das bestimmt die Architektur (s. u.), aber es wird nichts davon jetzt gebaut.
- **Backup:** Der komplette Datenbestand muss sich per Button als **JSON-Datei exportieren** lassen (und zur Wiederherstellung wieder importieren). Das ist gleichzeitig die Backup-Strategie.
- **Mobile:** Responsive Web-App als **PWA** (installierbar, Nutzung am Übungsabend auf dem Smartphone, v. a. Zeiten-Erfassung und Verfügbarkeits-Abhaken).
- Sprache der UI: **Deutsch**.

### Tech-Stack (verbindlich)

| Baustein | Wahl | Begründung |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript** | Frontend + Backend in einem Projekt und einem Container; größtes Ökosystem, damit zuverlässigste Codegenerierung; TypeScript-Typen können später von einer React-Native-App (Expo) wiederverwendet werden |
| Datenbank | **SQLite** (Datei im Docker-Volume, z. B. `/data/app.db`) | Für Single-User lokal völlig ausreichend, kein zweiter Container, triviales Backup |
| ORM | **Drizzle ORM** | Typsicher, Migrations eingebaut; abstrahiert die DB so, dass ein späterer Wechsel auf Postgres (für Multi-User) eine Migration ist, kein Rewrite |
| Validierung | **Zod** | Schemas als Single Source of Truth, geteilt zwischen API und Frontend; später auch von einer nativen App nutzbar |
| Styling | **Tailwind CSS** | Responsive out of the box, schnelle Iteration |
| Drag & Drop | **dnd-kit** | Ausgereifte React-Bibliothek für den Gruppenplaner (das anspruchsvollste UI-Stück) |
| Deployment | **Docker, Single-Container** (Next.js Standalone-Build), `docker-compose.yml` mit einem Service + Volume, Watchtower-kompatibel | Passt zum vorhandenen Setup, minimaler Wartungsaufwand |

### Architektur-Regeln (verbindlich, wegen späterer Multi-User-/Native-App-Fähigkeit)

1. **Strikte API-Trennung:** ALLE Datenzugriffe laufen über eine versionierte REST-API unter `/api/v1/...`. Auch das eigene Web-Frontend nutzt ausschließlich diese API. **Keine Server Actions, keine direkten DB-Zugriffe aus Seiten/Komponenten.** → Eine spätere native App (Expo/React Native) spricht dieselbe API ohne Umbau.
2. **Shared Types:** Zod-Schemas und Domänenlogik (Altersberechnung, Soll-Zeit-Lookup, Validierungen) liegen in einem eigenen Modul (z. B. `src/lib/domain/`), getrennt von UI und API-Routen → wiederverwendbar in Web und später nativ.
3. **Auth-ready, aber kein Auth jetzt:** Die API hat eine zentrale Middleware-Stelle, an der später Authentifizierung eingehängt wird (z. B. Better-Auth). In v1 bleibt sie leer (App lauscht nur im LAN).
4. **Datenmodell zukunftsfest:** Jede Tabelle bekommt von Anfang an `id`, `created_at`, `updated_at` → später lassen sich `user_id`/Audit-Felder nachrüsten, ohne Bestandsdaten anzufassen.
5. **Bewusst NICHT jetzt:** kein Postgres, kein Auth, kein Monorepo mit separatem Backend-Service – das wäre Vorab-Komplexität. Die API-Trennung und die ORM-Abstraktion sind die zwei günstigen Entscheidungen, die alle Türen offenhalten.

---

## 6. Entscheidungen (alle Fragen geklärt)

Alle offenen Fragen wurden vom Nutzer beantwortet und sind in die obigen Abschnitte eingearbeitet:

- ✅ **Soll-Zeit B-Teil:** Alterssumme 90–162 bestimmt die Soll-Zeit (2:40 → 2:00 min), Tabelle in Abschnitt 2.6.
- ✅ **Anonymisierung:** Die vorliegende Excel ist anonymisiert; kein Excel-Import geplant, Daten werden neu erfasst.
- ✅ **Knoten:** Statisch genau 4 (Mastwurf, Schotenstich, Zimmermannsstich, Kreuzknoten), nicht erweiterbar. Nur AF, AM, WF, WM binden je einen; Zuordnung je Wettbewerb konfigurierbar.
- ✅ **Eindeutige ID:** Mitgliedsnummer (`ausweisnr`).
- ✅ **Termine:** Eine gemeinsame Entität mit `zielgruppe`-Flag; Wettbewerbe sind keine feste Liste, sondern entstehen aus Terminen mit `planungsmodus` (keine / nur_gruppen / a_teil / a_und_b_teil).
- ✅ **Leistungsspange:** Nach Jahrgang, möglich ab dem Jahr des 15. Geburtstags → App-Vorschlag `geburtsjahr + 15`, überschreibbar.
- ✅ **Personenmodell:** Gemeinsame `Person`-Entität; Rollenwechsel Jugendliche/r → Betreuer möglich, aber nicht automatisch.
- ✅ **Selbstauskunft:** NICHT in der ersten Version (evtl. ferne Zukunft).
- ✅ **Gruppen:** Beliebig viele pro Wettbewerb, per Button hinzufügen/löschen.
- ✅ **Doppelstarter:** Eine Person kann bei einem Wettbewerb in zwei Gruppen starten → Drag & Drop aus der Starterliste kopiert statt verschiebt, Doppelstarter werden per Badge gekennzeichnet.
- ✅ **Schlauchpaket/Wassergraben/Verteiler:** Hindernis-Fähigkeit im A-Teil (welches Material schafft die Person fehlerfrei über den Wassergraben), als Planungshilfe pro Person.
- ✅ **Meldebogen-Export:** Nicht benötigt.
- ✅ **Geschlecht:** Nur M und W.
- ✅ **Zeltlager:** Betreuer-Rollen-Planung entfällt in Version 1.
- ✅ **Mehrbenutzer:** Nein, Single-User, nur lokal, JSON-Backup als Export. Multi-User und native App sollen aber **später möglich** sein → Architektur-Regeln in Abschnitt 5.
- ✅ **Tech-Stack:** Next.js + TypeScript, SQLite + Drizzle, Zod, Tailwind, dnd-kit, Docker Single-Container. Strikte `/api/v1`-Trennung (keine Server Actions), damit eine spätere native App dieselbe API nutzen kann.
- ✅ **Altersberechnung:** Genau zwei Werte – taggenaues Alter heute und Jahrgangsalter (Jahr − Geburtsjahr). Keine weiteren Varianten.

---

## 7. Anhang: Referenzdaten (Konstanten)

```ts
export const A_TEIL_POSITIONEN = ["GF","ME","MA","AF","AM","WF","WM","SF","SM"] as const;

export const KNOTEN_POSITIONEN = ["AF","AM","WF","WM"] as const; // nur diese 4 binden Knoten

// STATISCH, nicht erweiterbar – es gibt genau diese 4 Knoten:
export const KNOTEN = ["Mastwurf","Schotenstich","Zimmermannsstich","Kreuzknoten"] as const;

// Zuordnung Position -> Knoten wird JE WETTBEWERB konfiguriert (Auswahl aus KNOTEN).
// Seed-Beispiel (KJFT-Sheet):
export const KNOTEN_SEED_KJFT = {
  AF: "Schotenstich",
  AM: "Zimmermannsstich",
  WF: "Mastwurf",
  WM: "Kreuzknoten",
} as const;

// Wettbewerbe sind KEINE feste Liste – sie ergeben sich aus Terminen mit planungsmodus:
export const PLANUNGSMODI = ["keine","nur_gruppen","a_teil","a_und_b_teil"] as const;

// Hindernis-Fähigkeit (A-Teil-Planungshilfe):
export const HINDERNIS_MATERIAL = ["ohne","verteiler","schlauchpaket"] as const;
export const HINDERNIS_STATUS = ["ja","nein","unsicher"] as const;

// Alterssumme der Gruppe -> Soll-Zeit im B-Teil (Sekunden)
export const SOLL_ZEIT_TABELLE = [
  { minSumme: 90,  maxSumme: 94,  schnitt: 10, sollZeitSek: 160 }, // 2:40
  { minSumme: 95,  maxSumme: 103, schnitt: 11, sollZeitSek: 155 }, // 2:35
  { minSumme: 104, maxSumme: 112, schnitt: 12, sollZeitSek: 150 }, // 2:30
  { minSumme: 113, maxSumme: 121, schnitt: 13, sollZeitSek: 145 }, // 2:25
  { minSumme: 122, maxSumme: 130, schnitt: 14, sollZeitSek: 140 }, // 2:20
  { minSumme: 131, maxSumme: 139, schnitt: 15, sollZeitSek: 135 }, // 2:15
  { minSumme: 140, maxSumme: 148, schnitt: 16, sollZeitSek: 130 }, // 2:10
  { minSumme: 149, maxSumme: 157, schnitt: 17, sollZeitSek: 125 }, // 2:05
  { minSumme: 158, maxSumme: 162, schnitt: 18, sollZeitSek: 120 }, // 2:00
]; // außerhalb 90–162: Warnung anzeigen

export const B_TEIL_AUFGABEN = {
  1: "Laufen",
  2: "Laufen",
  3: "C-Schlauch",
  4: "Laufbrett",
  5: "Anziehen",
  6: "Laufen",
  7: "Strahlrohr halten",
  8: "Strahlrohr einbinden",
  9: "Leinenbeutel werfen",
} as const;

export const DISZIPLINEN_SEED = ["Handschuhe Anziehen","Tunnel","Schlauchrollen","Strahlrohr Einbinden"];
```

**Altersberechnung (es gibt genau zwei Werte, vom Nutzer bestätigt):**

```ts
// 1) Taggenaues Alter heute
function alter(geb: Date, ref: Date = today()): number {
  let a = ref.getFullYear() - geb.getFullYear();
  const hadBirthday = new Date(ref.getFullYear(), geb.getMonth(), geb.getDate()) <= ref;
  return hadBirthday ? a : a - 1;
}

// 2) Jahrgangsalter (für Wettbewerbs-Alterssumme & Zeltlager-Altersklassen)
function alterInDiesemJahr(geb: Date, jahr = today().getFullYear()): number {
  return jahr - geb.getFullYear();
}
```
