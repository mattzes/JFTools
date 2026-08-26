import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { kleidungBestandSchema } from "@/lib/domain/schemas";
import { requireAuth, parseBody, touch } from "@/lib/api-helpers";

export async function GET() {
  await requireAuth();
  return NextResponse.json(db.select().from(schema.kleidungBestand).all());
}

// Upsert des Gesamtbestands je (Kleidungsstück, Größe). Größe kann NULL sein
// (keine Größenunterteilung) – dafür manuell suchen, da der Unique-Index
// NULL-Werte als verschieden behandelt und onConflict dort nicht greift.
export async function PUT(req: Request) {
  await requireAuth();
  const body = await parseBody(req, kleidungBestandSchema);
  if (body instanceof NextResponse) return body;

  const groesse = body.groesse?.trim() || null;
  const b = schema.kleidungBestand;

  const existing = db
    .select()
    .from(b)
    .where(
      and(
        eq(b.kleidungsstueckId, body.kleidungsstueckId),
        groesse === null ? isNull(b.groesse) : eq(b.groesse, groesse),
      ),
    )
    .get();

  if (existing) {
    const row = db
      .update(b)
      .set(touch(body.sortierung != null ? { menge: body.menge, sortierung: body.sortierung } : { menge: body.menge }))
      .where(eq(b.id, existing.id))
      .returning()
      .get();
    return NextResponse.json(row);
  }

  const row = db
    .insert(b)
    .values({ kleidungsstueckId: body.kleidungsstueckId, groesse, menge: body.menge, sortierung: body.sortierung ?? 0 })
    .returning()
    .get();
  return NextResponse.json(row, { status: 201 });
}
