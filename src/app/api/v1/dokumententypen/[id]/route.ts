import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireAuth } from "@/lib/api-helpers";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, ctx: Ctx) {
  await requireAuth();
  const id = Number((await ctx.params).id);
  db.delete(schema.dokumententypen).where(eq(schema.dokumententypen.id, id)).run();
  return NextResponse.json({ ok: true });
}
