import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { terminSchema } from "@/lib/domain/schemas";
import { requireAuth, parseBody, jsonError, touch } from "@/lib/api-helpers";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  await requireAuth();
  const id = Number((await ctx.params).id);
  const row = db.select().from(schema.termine).where(eq(schema.termine.id, id)).get();
  if (!row) return jsonError("Termin nicht gefunden", 404);
  return NextResponse.json(row);
}

export async function PATCH(req: Request, ctx: Ctx) {
  await requireAuth();
  const id = Number((await ctx.params).id);
  const body = await parseBody(req, terminSchema.partial());
  if (body instanceof NextResponse) return body;
  const row = db.update(schema.termine).set(touch(body)).where(eq(schema.termine.id, id)).returning().get();
  if (!row) return jsonError("Termin nicht gefunden", 404);
  return NextResponse.json(row);
}

export async function DELETE(_req: Request, ctx: Ctx) {
  await requireAuth();
  const id = Number((await ctx.params).id);
  db.delete(schema.termine).where(eq(schema.termine.id, id)).run();
  return NextResponse.json({ ok: true });
}
