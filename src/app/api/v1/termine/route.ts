import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { terminSchema } from "@/lib/domain/schemas";
import { requireAuth, parseBody } from "@/lib/api-helpers";
import { asc } from "drizzle-orm";

export async function GET() {
  await requireAuth();
  const rows = db.select().from(schema.termine).orderBy(asc(schema.termine.datumVon)).all();
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  await requireAuth();
  const body = await parseBody(req, terminSchema);
  if (body instanceof NextResponse) return body;
  const row = db.insert(schema.termine).values(body).returning().get();
  return NextResponse.json(row, { status: 201 });
}
