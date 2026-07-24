import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { dokumententypSchema } from "@/lib/domain/schemas";
import { requireAuth, parseBody } from "@/lib/api-helpers";

export async function GET() {
  await requireAuth();
  return NextResponse.json(db.select().from(schema.dokumententypen).all());
}

export async function POST(req: Request) {
  await requireAuth();
  const body = await parseBody(req, dokumententypSchema);
  if (body instanceof NextResponse) return body;
  const row = db.insert(schema.dokumententypen).values(body).returning().get();
  return NextResponse.json(row, { status: 201 });
}
