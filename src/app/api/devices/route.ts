import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { actor, adminOnly } from "@/lib/auth";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/ingestion";
import { failure, sameOrigin, boundedJson } from "@/lib/http";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const a = await actor();
    adminOnly(a);
    const { stationId, name } = z
      .object({ stationId: z.string(), name: z.string().min(2).max(80) })
      .parse(await boundedJson(req));
    if (
      !(await db.station.findFirst({
        where: { id: stationId, gallery: { organizationId: a.organizationId } },
      }))
    )
      throw new Error("NOT_FOUND");
    const token = `gp_${randomBytes(32).toString("hex")}`;
    const device = await db.device.create({
      data: {
        stationId,
        name,
        credentials: { create: { tokenHash: hashToken(token) } },
      },
    });
    await db.auditLog.create({
      data: {
        organizationId: a.organizationId,
        actor: a.id,
        action: "device.provision",
        detail: { deviceId: device.id },
      },
    });
    return NextResponse.json({ deviceId: device.id, token });
  } catch (e) {
    return failure(e);
  }
}
export async function DELETE(req: Request) {
  try {
    sameOrigin(req);
    const a = await actor();
    adminOnly(a);
    const { deviceId } = z
      .object({ deviceId: z.string() })
      .parse(await boundedJson(req));
    const device = await db.device.findFirst({
      where: {
        id: deviceId,
        station: { gallery: { organizationId: a.organizationId } },
      },
    });
    if (!device) throw new Error("NOT_FOUND");
    await db.deviceCredential.updateMany({
      where: { deviceId },
      data: { revokedAt: new Date() },
    });
    await db.auditLog.create({
      data: {
        organizationId: a.organizationId,
        actor: a.id,
        action: "device.revoke",
        detail: { deviceId },
      },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
