import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { gruppenmitgliedSchema } from "@/lib/domain/schemas";
import { requireAuth, parseBody } from "@/lib/api-helpers";

export async function POST(req: Request) {
  await requireAuth();
  const body = await parseBody(req, gruppenmitgliedSchema);
  if (body instanceof NextResponse) return body;
  const row = db.insert(schema.gruppenmitglieder).values(body).returning().get();
  return NextResponse.json(row, { status: 201 });
}
