import { NextResponse } from "next/server";
import { z } from "zod";
import { actor, canWrite } from "@/lib/auth";
import { db } from "@/lib/db";
import { createReport, reportPdf, csvCell } from "@/lib/reports";
import { failure, period, sameOrigin, boundedJson } from "@/lib/http";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const a = await actor();
    canWrite(a);
    const body = z.object({ start: z.string(), end: z.string(), source: z.enum(["measured", "simulated"]).default("simulated") }).parse(await boundedJson(req)),
      p = new URLSearchParams(body);
    const { start, end } = period(p);
    const report = await createReport(
      a,
      start,
      end,
      body.source === "measured" ? "measured" : "simulated",
    );
    await db.auditLog.create({
      data: {
        organizationId: a.organizationId,
        actor: a.id,
        action: "report.generate",
        detail: { reportId: report.id },
      },
    });
    return NextResponse.json(report);
  } catch (e) {
    return failure(e);
  }
}
export async function GET(req: Request) {
  try {
    const a = await actor(),
      p = new URL(req.url).searchParams,
      id = p.get("id");
    if (p.get("format") === "csv") {
      const { start, end } = period(p);
      const rows = await db.listeningSession.findMany({
        where: {
          station: { gallery: { organizationId: a.organizationId } },
          sourceType: p.get("source") === "measured" ? "measured" : "simulated",
          startedAt: { gte: start, lt: end },
        },
        include: { station: true },
        take: 50001,
        orderBy: { startedAt: "asc" },
      });
      if (rows.length > 50000)
        return NextResponse.json({ error: "Export exceeds 50,000 sessions. Choose a shorter date range." }, { status: 413 });
      await db.auditLog.create({
        data: {
          organizationId: a.organizationId,
          actor: a.id,
          action: "sessions.export",
          detail: { rows: rows.length, limit: 50000 },
        },
      });
      const csv = [
        [
          "Session ID",
          "Station",
          "Start UTC",
          "End UTC",
          "Listening seconds",
          "Source",
          "Confidence",
          "Status",
        ],
        ...rows.map((s) => [
          s.id,
          s.station.name,
          s.startedAt?.toISOString(),
          s.endedAt?.toISOString(),
          s.durationSeconds,
          s.sourceType,
          s.confidence,
          s.status,
        ]),
      ]
        .map((row) => row.map(csvCell).join(","))
        .join("\r\n");
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition":
            'attachment; filename="gallerypulse-sessions.csv"',
        },
      });
    }
    if (!id) throw new Error("NOT_FOUND");
    const report = await db.report.findFirst({
      where: { id, organizationId: a.organizationId },
    });
    if (!report) throw new Error("NOT_FOUND");
    await db.auditLog.create({
      data: {
        organizationId: a.organizationId,
        actor: a.id,
        action: "report.download",
        detail: { reportId: id },
      },
    });
    return new Response(Buffer.from(await reportPdf(report)), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="gallerypulse-${report.periodStart.toISOString().slice(0, 10)}.pdf"`,
      },
    });
  } catch (e) {
    return failure(e);
  }
}
