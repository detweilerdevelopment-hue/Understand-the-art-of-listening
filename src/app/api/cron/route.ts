import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createReport } from "@/lib/reports";
export async function GET(req: Request) {
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`,
    actual = req.headers.get("authorization") ?? "";
  const actualBytes = Buffer.from(actual),
    expectedBytes = Buffer.from(expected);
  if (
    !process.env.CRON_SECRET ||
    actualBytes.length !== expectedBytes.length ||
    !timingSafeEqual(actualBytes, expectedBytes)
  )
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const now = new Date(),
    end = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
  end.setUTCDate(end.getUTCDate() - ((end.getUTCDay() + 6) % 7));
  const start = new Date(+end - 7 * 86400000);
  let generated = 0,
    failed = 0;
  for (const org of await db.organization.findMany()) {
    try {
      await createReport(
        {
          id: "cron",
          organizationId: org.id,
          role: "ADMIN",
          name: "Scheduler",
          demo: org.demo,
        },
        start,
        end,
        org.demo ? "simulated" : "measured",
      );
      generated++;
    } catch (error) {
      failed++;
      console.error(
        JSON.stringify({
          action: "report.cron.failed",
          organizationId: org.id,
          error: String(error),
        }),
      );
      await db.auditLog.create({
        data: {
          organizationId: org.id,
          actor: "cron",
          action: "report.failed",
          detail: { start: start.toISOString(), end: end.toISOString() },
        },
      });
    }
  }
  await db.rateBucket.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  return NextResponse.json(
    { generated, failed },
    { status: failed ? 500 : 200 },
  );
}
