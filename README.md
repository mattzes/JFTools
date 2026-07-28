# JF Verwaltung — Jugendfeuerwehr-Verwaltung

Ablösung der Excel-Arbeitsmappe der Jugendfeuerwehr durch eine lokale Web-App:
Personen- und Betreuerverwaltung, Terminverwaltung mit Verfügbarkeits-Matrix,
Rückmeldungs-Tracking, Abzeichen-Fälligkeiten, Wettbewerbs-Gruppenplaner
(A-Teil + B-Teil per Drag & Drop), Zeltlager-Einteilung, Trainingszeiten und JSON-Backup.

Design: **Nocturne** (dunkles, kompaktes Interface), deutschsprachig, als installierbare PWA.

## Tech-Stack

- **Next.js (App Router) + TypeScript** — Frontend + API in einem Projekt
- **SQLite + Drizzle ORM** — Datei unter `data/app.db` (Docker-Volume `/data`)
- **Zod** — Validierung, geteilt zwischen API und Frontend (`src/lib/domain/`)
- **Tailwind CSS v4** + Nocturne-Tokens (`src/app/globals.css`)
- **dnd-kit** — Drag & Drop im Gruppenplaner

Alle Datenzugriffe laufen über die versionierte REST-API unter `/api/v1/…` — auch das
eigene Web-Frontend. Keine Server Actions, keine direkten DB-Zugriffe aus Komponenten,
damit eine spätere native App (Expo) dieselbe API nutzen kann. Die Auth-Einhängestelle
liegt zentral in `src/lib/api-helpers.ts` (`requireAuth`, in v1 bewusst leer).

## Lokal starten

```bash
npm install
npm run dev          # http://localhost:3000
```

Beim ersten Start werden die Termine 2026, Standard-Dokumenttypen und Disziplinen
als Seed angelegt. Über den Button **„Demo-Daten laden"** auf der leeren Übersicht
lassen sich zusätzlich die anonymisierten Beispielpersonen aus der Spec einspielen.

## Docker (Self-Hosting im Heimnetz)

```bash
docker compose up -d --build      # http://<host>:3000
```

Der Datenbestand liegt im Volume `jf-data` (`/data/app.db`). Watchtower-Label ist
gesetzt. Backup = **JSON-Export** (Seitenleiste bzw. „Mehr" → Datensicherung);
Wiederherstellung über Import derselben Datei.

## Struktur

```
src/
  app/
    api/v1/…            REST-API (personen, termine, verfuegbarkeiten, gruppen,
                        gruppenmitglieder, knoten, rueckmeldungen, disziplinen,
                        messungen, hindernis, backup, seed-demo)
    <bereich>/page.tsx  UI-Seiten (Übersicht, Personen, Termine, Rückmeldungen,
                        Abzeichen, Wettbewerbe/Planer, Zeltlager, Training, Mehr)
  components/           AppShell (NavRail + Bottom-Tabs), GruppenPlaner, UI-Helfer
  db/                   Drizzle-Schema + SQLite-Init/Seed
  lib/domain/           Konstanten, Alters-/Soll-Zeit-Logik, Zod-Schemas, Planungs-Regeln
```

## Fachliche Kernregeln

- **Zwei Alterswerte:** taggenaues Alter (Anzeige) und Jahrgangsalter (Wettbewerb/Zeltlager).
- **Soll-Zeit B-Teil** aus der Alterssumme (90–162 → 2:40…2:00 min), live im Planer.
- **Knoten je Wettbewerb** konfigurierbar (nur AF/AM/WF/WM, 4 feste Knoten).
- **Doppelstarter:** Ziehen aus der Starterliste kopiert (Person darf in 2 Gruppen stehen),
  Ziehen zwischen Gruppen verschiebt.
- **Leistungsspange-Vorschlag** = Geburtsjahr + 15, manuell überschreibbar.
