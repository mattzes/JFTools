import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { trainingEintragSchema } from "@/lib/domain/schemas";
import { requireAuth, parseBody } from "@/lib/api-helpers";

export async function GET() {
  await requireAuth();
  return NextResponse.json(db.select().from(schema.trainingEintraege).all());
}

// Upsert pro (Person, Kategorie) — legt Teilnahme an bzw. aktualisiert Notiz/Wert.
export async function PUT(req: Request) {
  await requireAuth();
  const body = await parseBody(req, trainingEintragSchema);
  if (body instanceof NextResponse) return body;
  const row = db
    .insert(schema.trainingEintraege)
    .values(body)
    .onConflictDoUpdate({
      target: [schema.trainingEintraege.personId, schema.trainingEintraege.kategorie],
      set: {
        notiz: body.notiz ?? null,
        wert: body.wert ?? null,
        updatedAt: new Date().toISOString(),
      },
    })
    .returning()
    .get();
  return NextResponse.json(row);
}
