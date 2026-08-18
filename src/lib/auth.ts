// Einfache Passwort-Authentifizierung (ein gemeinsames Passwort für alle).
// Bewusst ohne DB/Provider gehalten: eine signierte Session-Cookie reicht.
// Die Helfer nutzen ausschließlich Web-Crypto, laufen also sowohl in der
// Edge-Middleware als auch in Node-Route-Handlern.

const encoder = new TextEncoder();

export const SESSION_COOKIE = "jf_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 Tage in Sekunden

function getSecret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    throw new Error(
      "AUTH_SECRET ist nicht gesetzt oder zu kurz (min. 16 Zeichen). " +
        "Bitte in der Umgebung (docker-compose / .env.local) setzen.",
    );
  }
  return s;
}

function base64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return base64url(new Uint8Array(sig));
}

// Konstante Laufzeit für gleich lange Strings (verhindert Timing-Leaks).
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export type SessionData = { role: string };

// Token = "<ablaufZeitpunkt>.<rolle>.<signatur>"; signiert wird "<exp>.<rolle>".
export async function createSessionToken(role: string): Promise<string> {
  const exp = String(Date.now() + SESSION_MAX_AGE * 1000);
  const payload = `${exp}.${role}`;
  const sig = await hmac(getSecret(), payload);
  return `${payload}.${sig}`;
}

export async function verifySessionToken(
  token: string | undefined,
): Promise<SessionData | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [exp, role, sig] = parts;
  const expected = await hmac(getSecret(), `${exp}.${role}`);
  if (!timingSafeEqual(sig, expected)) return null;
  const expMs = Number(exp);
  if (!Number.isFinite(expMs) || expMs <= Date.now()) return null;
  return { role };
}
