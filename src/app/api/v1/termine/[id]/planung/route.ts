import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireAuth, jsonError } from "@/lib/api-helpers";

type Ctx = { params: Promise<{ id: string }> };

// Komplette Planung eines Termins: Gruppen + Mitglieder + Knoten-Zuordnung
export async function GET(_req: Request, ctx: Ctx) {
  await requireAuth();
  const terminId = Number((await ctx.params).id);
  const termin = db.select().from(schema.termine).where(eq(schema.termine.id, terminId)).get();
  if (!termin) return jsonError("Termin nicht gefunden", 404);

  const gruppen = db.select().from(schema.gruppen).where(eq(schema.gruppen.terminId, terminId)).all();
  const mitglieder = gruppen.length
    ? db.select().from(schema.gruppenmitglieder).all().filter((m) => gruppen.some((g) => g.id === m.gruppeId))
    : [];
  const knoten = db
    .select()
    .from(schema.knotenZuordnungen)
    .where(eq(schema.knotenZuordnungen.terminId, terminId))
    .all();
  const verfuegbarkeiten = db
    .select()
    .from(schema.verfuegbarkeiten)
    .where(eq(schema.verfuegbarkeiten.terminId, terminId))
    .all();

  return NextResponse.json({ termin, gruppen, mitglieder, knoten, verfuegbarkeiten });
}
