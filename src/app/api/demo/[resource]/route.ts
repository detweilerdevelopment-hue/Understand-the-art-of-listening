import { NextResponse } from "next/server";
import { demoActor, demoAnalytics, demoPeriod } from "@/lib/public-demo";
import { db } from "@/lib/db";
import { failure } from "@/lib/http";
import { csvCell, reportPdf } from "@/lib/reports";
export async function GET(
  req: Request,
  { params }: { params: Promise<{ resource: string }> },
) {
  try {
    const { resource } = await params;
    if (!["analytics", "sessions", "reports"].includes(resource))
      throw new Error("NOT_FOUND");
    const a = await demoActor(),
      p = new URL(req.url).searchParams;
    if (p.has("source") && p.get("source") !== "simulated")
      throw new Error("FORBIDDEN");
    const scope = {
      sourceType: "simulated",
      station: { gallery: { organizationId: a.organizationId } },
    };
    if (resource === "sessions" && p.get("id")) {
      const session = await db.listeningSession.findFirst({
        where: { ...scope, id: p.get("id")! },
      });
      if (!session) throw new Error("NOT_FOUND");
      const events = await db.rawEvent.findMany({
        where: { ...scope, id: { in: session.eventIds as string[] } },
        orderBy: { timestamp: "asc" },
        include: { flags: true },
      });
      return NextResponse.json({ session, events });
    }
    if (resource === "reports" && p.get("id")) {
      const report = await db.report.findFirst({
        where: {
          id: p.get("id")!,
          organizationId: a.organizationId,
          sourceType: "simulated",
        },
      });
      if (!report) throw new Error("NOT_FOUND");
      return new Response(Buffer.from(await reportPdf(report)), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition":
            'attachment; filename="gallerypulse-sample-report.pdf"',
          "Cache-Control": "private, no-store",
        },
      });
    }
    const { start, end } = await demoPeriod(p, a);
    if (resource === "analytics")
      return NextResponse.json(await demoAnalytics(a, start, end));
    const where = {
      ...scope,
      ...(p.get("station") ? { stationId: p.get("station")! } : {}),
      ...(p.get("status") ? { status: p.get("status")! } : {}),
      OR: [
        { startedAt: { gte: start, lt: end } },
        { startedAt: null, endedAt: { gte: start, lt: end } },
      ],
    };
    if (resource === "sessions") {
      const page = Math.max(1, Math.min(10000, Number(p.get("page")) || 1));
      const [rows, total] = await Promise.all([
        db.listeningSession.findMany({
          where,
          include: { station: { select: { name: true } } },
          orderBy: { startedAt: p.get("sort") === "asc" ? "asc" : "desc" },
          take: 20,
          skip: (page - 1) * 20,
        }),
        db.listeningSession.count({ where }),
      ]);
      return NextResponse.json({ rows, total, page });
    }
    if (resource === "reports" && p.get("format") === "csv") {
      const rows = await db.listeningSession.findMany({
        where,
        include: { station: { select: { name: true } } },
        take: 50000,
        orderBy: { startedAt: "asc" },
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
            'attachment; filename="gallerypulse-demo-sessions.csv"',
          "Cache-Control": "private, no-store",
        },
      });
    }
    throw new Error("NOT_FOUND");
  } catch (error) {
    return failure(error);
  }
}
