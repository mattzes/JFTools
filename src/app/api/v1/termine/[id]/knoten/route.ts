import { NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/db";
import { knotenZuordnungSchema } from "@/lib/domain/schemas";
import { requireAuth, parseBody } from "@/lib/api-helpers";

type Ctx = { params: Promise<{ id: string }> };

// Knoten-Konfiguration je Wettbewerb komplett setzen (4 Positionen)
export async function PUT(req: Request, ctx: Ctx) {
  await requireAuth();
  const terminId = Number((await ctx.params).id);
  const body = await parseBody(req, z.array(knotenZuordnungSchema));
  if (body instanceof NextResponse) return body;

  for (const k of body) {
    db.insert(schema.knotenZuordnungen)
      .values({ terminId, ...k })
      .onConflictDoUpdate({
        target: [schema.knotenZuordnungen.terminId, schema.knotenZuordnungen.position],
        set: { knoten: k.knoten, updatedAt: new Date().toISOString() },
      })
      .run();
  }
  return NextResponse.json({ ok: true });
}
