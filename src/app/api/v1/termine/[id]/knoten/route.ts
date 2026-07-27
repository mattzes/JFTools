import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { knotenZuordnungSchema } from "@/lib/domain/schemas";
import { requireAuth, parseBody } from "@/lib/api-helpers";

type Ctx = { params: Promise<{ id: string }> };

// Knoten-Konfiguration je Wettbewerb komplett setzen (Vollersatz: nicht
// übergebene Positionen gelten als offen und werden entfernt).
export async function PUT(req: Request, ctx: Ctx) {
  await requireAuth();
  const terminId = Number((await ctx.params).id);
  const body = await parseBody(req, z.array(knotenZuordnungSchema));
  if (body instanceof NextResponse) return body;

  db.delete(schema.knotenZuordnungen).where(eq(schema.knotenZuordnungen.terminId, terminId)).run();
  for (const k of body) {
    db.insert(schema.knotenZuordnungen).values({ terminId, ...k }).run();
  }
  return NextResponse.json({ ok: true });
}
