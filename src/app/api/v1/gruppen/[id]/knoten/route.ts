import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { knotenZuordnungSchema } from "@/lib/domain/schemas";
import { requireAuth, parseBody, jsonError } from "@/lib/api-helpers";

type Ctx = { params: Promise<{ id: string }> };

// Knoten-Konfiguration EINER Gruppe komplett setzen (Vollersatz: nicht
// übergebene Positionen gelten als offen und werden entfernt).
export async function PUT(req: Request, ctx: Ctx) {
  await requireAuth();
  const gruppeId = Number((await ctx.params).id);
  const gruppe = db.select().from(schema.gruppen).where(eq(schema.gruppen.id, gruppeId)).get();
  if (!gruppe) return jsonError("Gruppe nicht gefunden", 404);

  const body = await parseBody(req, z.array(knotenZuordnungSchema));
  if (body instanceof NextResponse) return body;

  db.delete(schema.knotenZuordnungen).where(eq(schema.knotenZuordnungen.gruppeId, gruppeId)).run();
  for (const k of body) {
    db.insert(schema.knotenZuordnungen).values({ terminId: gruppe.terminId, gruppeId, ...k }).run();
  }
  return NextResponse.json({ ok: true });
}
