import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { kleidungsstueckSchema } from "@/lib/domain/schemas";
import { requireAuth, parseBody } from "@/lib/api-helpers";

export async function GET() {
  await requireAuth();
  return NextResponse.json(db.select().from(schema.kleidungsstuecke).all());
}

// Legt ein Kleidungsstück an und – falls übergeben – gleich die Bestand-Zeilen.
// Bei mitGroessen=false wird eine einzelne Zeile mit groesse=NULL erwartet.
export async function POST(req: Request) {
  await requireAuth();
  const body = await parseBody(req, kleidungsstueckSchema);
  if (body instanceof NextResponse) return body;

  const stueck = db
    .insert(schema.kleidungsstuecke)
    .values({ name: body.name, mitGroessen: body.mitGroessen })
    .returning()
    .get();

  const zeilen = body.bestand ?? [];
  for (const z of zeilen) {
    db.insert(schema.kleidungBestand)
      .values({
        kleidungsstueckId: stueck.id,
        groesse: body.mitGroessen ? (z.groesse?.trim() || null) : null,
        menge: z.menge,
      })
      .run();
  }

  return NextResponse.json(stueck, { status: 201 });
}
