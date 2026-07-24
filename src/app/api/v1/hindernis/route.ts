import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { hindernisFaehigkeitSchema } from "@/lib/domain/schemas";
import { requireAuth, parseBody } from "@/lib/api-helpers";

export async function GET() {
  await requireAuth();
  return NextResponse.json(db.select().from(schema.hindernisFaehigkeiten).all());
}

// Upsert pro (Person, Hindernis)
export async function PUT(req: Request) {
  await requireAuth();
  const body = await parseBody(req, hindernisFaehigkeitSchema);
  if (body instanceof NextResponse) return body;
  const row = db
    .insert(schema.hindernisFaehigkeiten)
    .values(body)
    .onConflictDoUpdate({
      target: [schema.hindernisFaehigkeiten.personId, schema.hindernisFaehigkeiten.hindernis],
      set: {
        material: body.material,
        status: body.status,
        notiz: body.notiz ?? null,
        updatedAt: new Date().toISOString(),
      },
    })
    .returning().get();
  return NextResponse.json(row);
}
