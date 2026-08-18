# Konzept: Authentifizierung & rollenbasierte Autorisierung für JF-Verwaltung

> Konzept-/Brainstorm-Dokument. Fasst Aufwand und Bausteine zusammen — noch keine Implementierung.

## Warum

Die App (`jf-rottorf`, Jugendfeuerwehr-Verwaltung) soll mit mehreren Personen geteilt werden.
Heute gibt es **keinerlei Authentifizierung** — der Sicherheitsstand ist „läuft nur im LAN".
Sobald die App geteilt/erreichbar wird, sind alle Daten offen, inkl. **Personendaten von
Minderjährigen** (`/personen`) → DSGVO-relevant. Ziel: Login mit externem Anbieter (kein
Eigenbau) + jeder sieht nur die Bereiche, für die er berechtigt ist.

## Ist-Zustand (Code-Analyse)

- **Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind v4. Ein einziges
  Next-Projekt (Frontend + API). `output: "standalone"`.
- **Daten:** SQLite via `better-sqlite3` + Drizzle ORM (`data/app.db`, Docker-Volume). Schema:
  `src/db/schema.ts`. **Keine** `users`/`sessions`/`accounts`/`roles`-Tabellen.
- **API:** Versionierte REST-Handler unter `/api/v1/*`. Auch das eigene Frontend spricht nur
  über die API (bewusst, für spätere native App).
- **Wichtigster Fund:** In `src/lib/api-helpers.ts` existiert bereits
  `export async function requireAuth(): Promise<void> { return; }` — ein **leerer, aber überall
  aufgerufener** Auth-Hook (steht oben in *jeder* Route). Der Kommentar nennt **Better-Auth**
  als geplante Lösung. → Der Enforcement-Punkt ist schon verdrahtet.
- **Deployment:** Docker (Home-Server), `docker-compose.yml`, GitHub Actions baut Image nach GHCR.
  Kein Vercel. Kein `.env` vorhanden.
- **Bereiche/Nav** (`src/components/AppShell.tsx`): Übersicht `/`, Personen, Termine, Checkliste,
  Abzeichen, Wettbewerbe, Training, Kleiderkammer, Mehr (inkl. Backup/Export).

## Entscheidungen

- **Login-Provider:** nur **Google**.
- **Berechtigung:** **Rollen pro Bereich** (keine feingranulare Lesen/Schreiben-Trennung nötig).

## Empfohlener Ansatz

**Bibliothek: Better-Auth** (statt Auth.js) — passt, weil der Code sie bereits vorsieht, sie
first-class Drizzle+SQLite-Support hat, Google-OAuth mitbringt und ein **Admin-Plugin** für
Nutzerverwaltung/Freischaltung/Rollen liefert. (Auth.js/NextAuth v5 wäre die Alternative,
bringt aber weniger fertige Admin-/Rollen-Bausteine.)

### Rollenmodell (Rollen → Bereiche)

Vorschlag als Startpunkt (in Code als Mapping `Rolle → erlaubte Bereiche`, vom Admin pro
Nutzer zuweisbar):

| Rolle | Bereiche |
|---|---|
| **admin / Leitung** | alles, inkl. Personen, Backup/Export, Nutzerverwaltung |
| **betreuer / Trainer** | Übersicht, Termine, Checkliste, Abzeichen, Wettbewerbe, Training |
| **kleiderwart** | Übersicht, Kleiderkammer |

Rollen als benanntes Feld am User; das Mapping Rolle→Bereiche liegt zentral im Code
(leicht anpassbar), nicht fest in jeder Route verstreut.

## Bausteine & Aufwand

| # | Baustein | Aufwand |
|---|---|---|
| 1 | **Auth-Grundgerüst:** Better-Auth einbinden, Google-Provider, Drizzle-Schema (users/sessions/accounts/role), Login-Seite, Logout | 0,5–1 Tag |
| 2 | **Absicherung:** `requireAuth()` real implementieren (Session lesen → User+Rolle), Bereichs-Guard-Helper; Rollenprüfung in API-Routen (nach Bereich gruppiert) + `middleware.ts` für Seiten; Nav in `AppShell.tsx` nach Rolle ausblenden | 1–1,5 Tage |
| 3 | **Zugangskontrolle:** Wer darf rein? Freischaltungs-Flow (neuer User = „pending", Admin gibt frei + weist Rolle zu) via Better-Auth Admin-Plugin + kleine Admin-UI | 1–1,5 Tage |
| 4 | **Deployment/DSGVO-Härtung:** `AUTH_SECRET` + Google Client-ID/Secret in docker-compose/Env, **HTTPS-Reverse-Proxy** (Caddy/Traefik) — Pflicht für Login-Cookies, Cookie-Flags (secure/httpOnly) | ~0,5 Tag |
| | **Summe** | **~3–4 Arbeitstage** |

## Zu ändernde / neue Kern-Dateien (Ausblick)

- `src/lib/api-helpers.ts` — `requireAuth()` ausimplementieren + `requireBereich(rolle, bereich)`-Helper.
- `src/db/schema.ts` — Better-Auth-Tabellen (users/sessions/accounts) + `role`-Feld.
- neu: `src/lib/auth.ts` (Better-Auth-Config), `src/app/api/auth/[...all]/route.ts` (Auth-Endpunkt),
  `src/app/login/page.tsx`, `src/middleware.ts`.
- `src/components/AppShell.tsx` — Nav-Items nach Rolle filtern.
- neu: `src/app/admin/…` — Nutzerverwaltung/Freischaltung (Admin-only).
- `docker-compose.yml` / Deployment — Secrets + Reverse-Proxy/HTTPS.

## Voraussetzungen, die du selbst erledigen musst

- **Google Cloud Console:** OAuth-Client anlegen (Client-ID + Secret, Redirect-URIs eintragen).
- **Öffentliche Domain + HTTPS** für den Server (Reverse-Proxy + Zertifikat, z. B. via Caddy/Let's Encrypt).
- Entscheidung, welche E-Mail-Adressen initial Admin sind.

## Verifikation (bei späterer Umsetzung)

1. Google-Login durchspielen (eingeloggt → Session-Cookie gesetzt).
2. Als nicht freigeschalteter User → „pending"/kein Zugriff.
3. Rolle `kleiderwart`: nur Kleiderkammer + Übersicht sichtbar; direkter Aufruf von
   `/personen` und der `personen`-API → 403.
4. Rolle `betreuer`: kein Personen-/Backup-Zugriff.
5. Ausgeloggt / ohne Cookie: jeder `/api/v1/*`-Aufruf → 401 (dank `requireAuth()` in jeder Route).
6. Admin-UI: neuen User freischalten + Rolle zuweisen.
