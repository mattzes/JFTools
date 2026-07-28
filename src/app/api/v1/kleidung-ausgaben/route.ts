import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { kleidungAusgabeSchema } from "@/lib/domain/schemas";
import { requireAuth, parseBody } from "@/lib/api-helpers";

export async function GET() {
  await requireAuth();
  return NextResponse.json(db.select().from(schema.kleidungAusgaben).all());
}

export async function POST(req: Request) {
  await requireAuth();
  const body = await parseBody(req, kleidungAusgabeSchema);
  if (body instanceof NextResponse) return body;
  const row = db
    .insert(schema.kleidungAusgaben)
    .values({
      personId: body.personId,
      kleidungsstueckId: body.kleidungsstueckId,
      groesse: body.groesse?.trim() || null,
      menge: body.menge,
      ausgegebenAm: body.ausgegebenAm ?? null,
      notiz: body.notiz ?? null,
    })
    .returning()
    .get();
  return NextResponse.json(row, { status: 201 });
}
