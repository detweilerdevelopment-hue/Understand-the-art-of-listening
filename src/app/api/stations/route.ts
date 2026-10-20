import { NextResponse } from "next/server";
import { z } from "zod";
import { actor, canWrite } from "@/lib/auth";
import { db } from "@/lib/db";
import { failure, sameOrigin, boundedJson } from "@/lib/http";
const schema = z.object({
  id: z.string().optional(),
  name: z.string().min(2).max(80),
  location: z.string().min(2).max(120),
  hardware: z.string().min(2).max(120),
  enabled: z.boolean().default(true),
  maintenance: z.boolean().default(false),
});
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const a = await actor();
    canWrite(a);
    const { id, ...data } = schema.parse(await boundedJson(req));
    const gallery = await db.gallery.findFirst({
      where: { organizationId: a.organizationId },
    });
    if (!gallery) throw new Error("NOT_FOUND");
    const result = await db.$transaction(async (tx) => {
      if (
        id &&
        !(await tx.station.findFirst({
          where: { id, gallery: { organizationId: a.organizationId } },
        }))
      )
        throw new Error("NOT_FOUND");
      const station = id
        ? await tx.station.update({ where: { id }, data })
        : await tx.station.create({
            data: {
              ...data,
              galleryId: gallery.id,
              devices: { create: { name: "Simulator", simulated: true } },
            },
          });
      await tx.auditLog.create({
        data: {
          organizationId: a.organizationId,
          actor: a.id,
          action: id ? "station.update" : "station.create",
          detail: { stationId: station.id },
        },
      });
      return station;
    });
    return NextResponse.json(result);
  } catch (e) {
    return failure(e);
  }
}
