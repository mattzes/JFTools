import { NextResponse } from "next/server";
import { ZodSchema } from "zod";

// Zentrale Middleware-Stelle: hier wird später Authentifizierung eingehängt
// (z. B. Better-Auth). In v1 bewusst leer — die App lauscht nur im LAN.
export async function requireAuth(): Promise<void> {
  return;
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function parseBody<T>(req: Request, schema: ZodSchema<T>): Promise<T | NextResponse> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError("Ungültiges JSON");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    return jsonError(msg || "Validierung fehlgeschlagen");
  }
  return parsed.data;
}

export function touch<T extends object>(data: T): T & { updatedAt: string } {
  return { ...data, updatedAt: new Date().toISOString().replace("T", " ").slice(0, 19) };
}
