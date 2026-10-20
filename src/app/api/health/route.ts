import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { backendEnabled } from "@/lib/backend";
export async function GET() {
  if (!backendEnabled())
    return NextResponse.json({
      status: "ok",
      mode: "packaged-demo",
      databaseRequired: false,
    });
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", time: new Date().toISOString() });
  } catch {
    return NextResponse.json({ status: "unavailable" }, { status: 503 });
  }
}
