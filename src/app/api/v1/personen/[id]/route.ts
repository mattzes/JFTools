import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { personSchema } from "@/lib/domain/schemas";
import { requireAuth, parseBody, jsonError, touch } from "@/lib/api-helpers";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  await requireAuth();
  const id = Number((await ctx.params).id);
  const row = db.select().from(schema.personen).where(eq(schema.personen.id, id)).get();
  if (!row) return jsonError("Person nicht gefunden", 404);
  return NextResponse.json(row);
}

export async function PATCH(req: Request, ctx: Ctx) {
  await requireAuth();
  const id = Number((await ctx.params).id);
  const body = await parseBody(req, personSchema.partial());
  if (body instanceof NextResponse) return body;
  const row = db
    .update(schema.personen)
    .set(touch(body))
    .where(eq(schema.personen.id, id))
    .returning().get();
  if (!row) return jsonError("Person nicht gefunden", 404);
  return NextResponse.json(row);
}

export async function DELETE(_req: Request, ctx: Ctx) {
  await requireAuth();
  const id = Number((await ctx.params).id);
  db.delete(schema.personen).where(eq(schema.personen.id, id)).run();
  return NextResponse.json({ ok: true });
}
