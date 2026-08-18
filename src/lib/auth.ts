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
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

// Token = "<ablaufZeitpunkt>.<signatur>"
export async function createSessionToken(): Promise<string> {
  const exp = String(Date.now() + SESSION_MAX_AGE * 1000);
  const sig = await hmac(getSecret(), exp);
  return `${exp}.${sig}`;
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot < 0) return false;
  const exp = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = await hmac(getSecret(), exp);
  if (!timingSafeEqual(sig, expected)) return false;
  const expMs = Number(exp);
  return Number.isFinite(expMs) && expMs > Date.now();
}

export function verifyPassword(input: string): boolean {
  const expected = process.env.APP_PASSWORD;
  if (!expected) return false;
  return timingSafeEqual(input, expected);
}
