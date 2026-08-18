import { timingSafeEqual } from "@/lib/auth";

// ── Rollen-Definitionen ──
// Zentrale, einzige Stelle für „welche Rolle darf welchen Pfad".
// `pages`   : erlaubte Seiten-Präfixe ("*" = alle)
// `apiFull` : API-Präfixe mit Lese- UND Schreibrecht ("*" = alle)
// `apiRead` : API-Präfixe nur mit Leserecht (GET erlaubt, Rest gesperrt)
// `landing` : Startseite nach dem Login / bei nicht erlaubtem Aufruf

export type RoleKey = "admin" | "kleiderkammer";

export type RoleDef = {
  label: string;
  landing: string;
  pages: string[] | "*";
  apiFull: string[] | "*";
  apiRead: string[];
};

export const ROLES: Record<RoleKey, RoleDef> = {
  admin: {
    label: "Admin",
    landing: "/",
    pages: "*",
    apiFull: "*",
    apiRead: [],
  },
  kleiderkammer: {
    label: "Kleiderkammer",
    landing: "/kleiderkammer",
    pages: ["/kleiderkammer"],
    apiFull: [
      "/api/v1/kleidungsstuecke",
      "/api/v1/kleidung-bestand",
      "/api/v1/kleidung-ausgaben",
    ],
    // Personen werden zum Zuordnen von Kleidung benötigt – aber nur lesend.
    apiRead: ["/api/v1/personen"],
  },
};

export function isRoleKey(v: string | undefined): v is RoleKey {
  return v === "admin" || v === "kleiderkammer";
}

// Präfix-Treffer: exakt oder als Segment-Präfix ("/a/b" liegt unter "/a").
export function pathAllowed(prefixes: string[] | "*", pathname: string): boolean {
  if (prefixes === "*") return true;
  return prefixes.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

// Passwort → Rolle. Die Passwörter kommen aus der Umgebung (Portainer/Env),
// damit ohne Code-Änderung neue Zugänge vergeben werden können.
export function roleForPassword(pw: string): RoleKey | null {
  const map: [string | undefined, RoleKey][] = [
    [process.env.APP_PASSWORD, "admin"],
    [process.env.KLEIDERKAMMER_PASSWORD, "kleiderkammer"],
  ];
  for (const [secret, role] of map) {
    if (secret && timingSafeEqual(pw, secret)) return role;
  }
  return null;
}
