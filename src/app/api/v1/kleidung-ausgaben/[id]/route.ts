import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { kleidungAusgabeUpdateSchema } from "@/lib/domain/schemas";
import { requireAuth, parseBody, touch } from "@/lib/api-helpers";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  await requireAuth();
  const id = Number((await ctx.params).id);
  const body = await parseBody(req, kleidungAusgabeUpdateSchema);
  if (body instanceof NextResponse) return body;
  const row = db
    .update(schema.kleidungAusgaben)
    .set(touch({ menge: body.menge }))
    .where(eq(schema.kleidungAusgaben.id, id))
    .returning()
    .get();
  return NextResponse.json(row);
}

export async function DELETE(_req: Request, ctx: Ctx) {
  await requireAuth();
  const id = Number((await ctx.params).id);
  db.delete(schema.kleidungAusgaben).where(eq(schema.kleidungAusgaben.id, id)).run();
  return NextResponse.json({ ok: true });
}
