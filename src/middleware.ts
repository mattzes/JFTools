import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { ROLES, isRoleKey, pathAllowed } from "@/lib/roles";

// Öffentlich erreichbar ohne Anmeldung: die Login-Seite und der Login-Endpunkt.
const PUBLIC_PATHS = ["/login", "/api/auth/login"];

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);
  if (!session || !isRoleKey(session.role)) {
    return denied(req, pathname, search);
  }

  // Abmelden ist für jede angemeldete Rolle erlaubt.
  if (pathname === "/api/auth/logout") return NextResponse.next();

  const role = ROLES[session.role];

  if (pathname.startsWith("/api/")) {
    if (pathAllowed(role.apiFull, pathname)) return NextResponse.next();
    if (req.method === "GET" && pathAllowed(role.apiRead, pathname)) {
      return NextResponse.next();
    }
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  // Seiten: erlaubt → durch; sonst zur Startseite der Rolle.
  if (pathAllowed(role.pages, pathname)) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = role.landing;
  url.search = "";
  return NextResponse.redirect(url);
}

// Nicht angemeldet: API → 401, Seite → Login mit Rücksprung-Ziel.
function denied(req: NextRequest, pathname: string, search: string) {
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("next", pathname + search);
  return NextResponse.redirect(url);
}

// Alles schützen außer statischen Next-Assets und öffentlichen Dateien.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|robots.txt|sitemap.xml).*)",
  ],
};
