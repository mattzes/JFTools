import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { personSchema } from "@/lib/domain/schemas";
import { requireAuth, parseBody } from "@/lib/api-helpers";

export async function GET() {
  await requireAuth();
  const rows = db.select().from(schema.personen).all();
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  await requireAuth();
  const body = await parseBody(req, personSchema);
  if (body instanceof NextResponse) return body;
  const row = db.insert(schema.personen).values(body).returning().get();
  return NextResponse.json(row, { status: 201 });
}
