import { NextResponse } from "next/server";
import { actor, canWrite, rateLimit } from "@/lib/auth";
import { db } from "@/lib/db";
import { ingest } from "@/lib/ingestion";
import { failure, sameOrigin } from "@/lib/http";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const a = await actor();
    canWrite(a);
    await rateLimit(`sim:${a.id}`, 120);
    const raw = await req.json();
    const device = await db.device.findFirst({
      where: {
        stationId: raw.stationId,
        simulated: true,
        station: { gallery: { organizationId: a.organizationId } },
      },
    });
    if (!device) throw new Error("NOT_FOUND");
    return NextResponse.json(
      await ingest(
        { ...raw, sourceId: device.id, sourceType: "simulated" },
        device.id,
        a.organizationId,
      ),
    );
  } catch (e) {
    return failure(e);
  }
}
export async function DELETE(req: Request) {
  try {
    sameOrigin(req);
    const a = await actor();
    canWrite(a);
    await db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT s.id FROM "Station" s JOIN "Gallery" g ON s."galleryId"=g.id WHERE g."organizationId"=${a.organizationId} ORDER BY s.id FOR UPDATE OF s`;
        const where = {
          station: { gallery: { organizationId: a.organizationId } },
          sourceType: "simulated",
        };
        await tx.listeningSession.deleteMany({ where });
        await tx.rawEvent.deleteMany({ where });
        await tx.device.updateMany({
          where: {
            simulated: true,
            station: { gallery: { organizationId: a.organizationId } },
          },
          data: { lastHeartbeat: null },
        });
        await tx.report.deleteMany({
          where: { organizationId: a.organizationId, sourceType: "simulated" },
        });
        await tx.auditLog.create({
          data: {
            organizationId: a.organizationId,
            actor: a.id,
            action: "simulation.reset",
          },
        });
      },
      { timeout: 30000 },
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
