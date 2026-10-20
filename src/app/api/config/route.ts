import { NextResponse } from "next/server";
import { z } from "zod";
import { actor, adminOnly } from "@/lib/auth";
import { db } from "@/lib/db";
import { failure, sameOrigin } from "@/lib/http";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const a = await actor();
    adminOnly(a);
    const data = z
      .object({
        engagedSeconds: z.number().int().min(10).max(3600),
        heartbeatTimeoutSeconds: z.number().int().min(60).max(3600),
      })
      .parse(await req.json());
    const config = await db.measurementConfiguration.upsert({
      where: { organizationId: a.organizationId },
      create: { ...data, organizationId: a.organizationId },
      update: data,
    });
    await db.auditLog.create({
      data: {
        organizationId: a.organizationId,
        actor: a.id,
        action: "configuration.update",
        detail: data,
      },
    });
    return NextResponse.json(config);
  } catch (e) {
    return failure(e);
  }
}
