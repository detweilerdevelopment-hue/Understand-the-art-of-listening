import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashToken, ingest } from "@/lib/ingestion";
import { rateLimit } from "@/lib/auth";
import { failure, boundedJson } from "@/lib/http";
import { backendEnabled } from "@/lib/backend";
export async function POST(req: Request) {
  try {
    const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
    if (!token) throw new Error("UNAUTHORIZED");
    if (!backendEnabled())
      return NextResponse.json({ error: "Database backend is disabled" }, { status: 503 });
    const credential = await db.deviceCredential.findUnique({
      where: { tokenHash: hashToken(token) },
      include: {
        device: { include: { station: { include: { gallery: true } } } },
      },
    });
    if (!credential || credential.revokedAt) throw new Error("UNAUTHORIZED");
    await rateLimit(`device:${credential.deviceId}`, 180);
    return NextResponse.json(
      await ingest(
        await boundedJson(req),
        credential.deviceId,
        credential.device.station.gallery.organizationId,
      ),
    );
  } catch (e) {
    return failure(e);
  }
}
