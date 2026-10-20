import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashToken, ingest } from "@/lib/ingestion";
import { rateLimit } from "@/lib/auth";
import { failure } from "@/lib/http";
export async function POST(req: Request) {
  try {
    const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
    if (!token) throw new Error("UNAUTHORIZED");
    const credential = await db.deviceCredential.findUnique({
      where: { tokenHash: hashToken(token) },
      include: {
        device: { include: { station: { include: { gallery: true } } } },
      },
    });
    if (!credential || credential.revokedAt) throw new Error("UNAUTHORIZED");
    await rateLimit(`device:${credential.deviceId}`, 180);
    if (Number(req.headers.get("content-length") ?? 0) > 16384)
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    return NextResponse.json(
      await ingest(
        await req.json(),
        credential.deviceId,
        credential.device.station.gallery.organizationId,
      ),
    );
  } catch (e) {
    return failure(e);
  }
}
