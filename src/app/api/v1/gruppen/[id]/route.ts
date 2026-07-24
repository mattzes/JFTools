import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { gruppeSchema } from "@/lib/domain/schemas";
import { requireAuth, parseBody, jsonError, touch } from "@/lib/api-helpers";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  await requireAuth();
  const id = Number((await ctx.params).id);
  const body = await parseBody(req, gruppeSchema.partial());
  if (body instanceof NextResponse) return body;
  const row = db.update(schema.gruppen).set(touch(body)).where(eq(schema.gruppen.id, id)).returning().get();
  if (!row) return jsonError("Gruppe nicht gefunden", 404);
  return NextResponse.json(row);
}

export async function DELETE(_req: Request, ctx: Ctx) {
  await requireAuth();
  const id = Number((await ctx.params).id);
  db.delete(schema.gruppen).where(eq(schema.gruppen.id, id)).run();
  return NextResponse.json({ ok: true });
}
