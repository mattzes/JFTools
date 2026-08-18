import { NextResponse } from "next/server";
import { z } from "zod";
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth";
import { ROLES, roleForPassword } from "@/lib/roles";

const schema = z.object({ password: z.string().min(1) });

// Einfacher In-Memory-Bremsklotz gegen Brute-Force (eine Instanz, reicht im LAN).
const attempts = new Map<string, { count: number; until: number }>();
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 60_000;

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0].trim() : "local";
}

export async function POST(req: Request) {
  const ip = clientIp(req);
  const now = Date.now();
  const rec = attempts.get(ip);
  if (rec && rec.until > now && rec.count >= MAX_ATTEMPTS) {
    return NextResponse.json(
      { error: "Zu viele Versuche. Bitte kurz warten." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Passwort fehlt" }, { status: 400 });
  }

  const role = roleForPassword(parsed.data.password);
  if (!role) {
    const next = rec && rec.until > now ? rec.count + 1 : 1;
    attempts.set(ip, { count: next, until: now + WINDOW_MS });
    return NextResponse.json({ error: "Falsches Passwort" }, { status: 401 });
  }

  attempts.delete(ip);

  const token = await createSessionToken(role);
  const proto =
    req.headers.get("x-forwarded-proto") ??
    new URL(req.url).protocol.replace(":", "");
  const res = NextResponse.json({ ok: true, landing: ROLES[role].landing });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: proto === "https",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
