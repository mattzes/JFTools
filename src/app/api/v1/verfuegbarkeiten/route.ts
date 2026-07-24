import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { verfuegbarkeitSchema } from "@/lib/domain/schemas";
import { requireAuth, parseBody } from "@/lib/api-helpers";

export async function GET() {
  await requireAuth();
  const rows = db.select().from(schema.verfuegbarkeiten).all();
  return NextResponse.json(rows);
}

// Upsert: eine Zelle der Verfügbarkeits-Matrix setzen
export async function PUT(req: Request) {
  await requireAuth();
  const body = await parseBody(req, verfuegbarkeitSchema);
  if (body instanceof NextResponse) return body;
  const row = db
    .insert(schema.verfuegbarkeiten)
    .values(body)
    .onConflictDoUpdate({
      target: [schema.verfuegbarkeiten.personId, schema.verfuegbarkeiten.terminId],
      set: { status: body.status, updatedAt: new Date().toISOString() },
    })
    .returning().get();
  return NextResponse.json(row);
}
