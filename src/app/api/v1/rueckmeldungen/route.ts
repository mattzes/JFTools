import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { rueckmeldungSchema } from "@/lib/domain/schemas";
import { requireAuth, parseBody } from "@/lib/api-helpers";

export async function GET() {
  await requireAuth();
  return NextResponse.json(db.select().from(schema.rueckmeldungen).all());
}

// Upsert pro (Person, Dokumententyp)
export async function PUT(req: Request) {
  await requireAuth();
  const body = await parseBody(req, rueckmeldungSchema);
  if (body instanceof NextResponse) return body;
  const row = db
    .insert(schema.rueckmeldungen)
    .values(body)
    .onConflictDoUpdate({
      target: [schema.rueckmeldungen.personId, schema.rueckmeldungen.dokumententypId],
      set: {
        erhalten: body.erhalten,
        erhaltenAm: body.erhaltenAm ?? null,
        notiz: body.notiz ?? null,
        updatedAt: new Date().toISOString(),
      },
    })
    .returning().get();
  return NextResponse.json(row);
}
