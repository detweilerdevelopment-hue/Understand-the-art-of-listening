import { NextResponse } from "next/server";
import { demoActor, demoAnalytics, demoPeriod } from "@/lib/public-demo";
import { demoData } from "@/lib/demo-data";
import { failure } from "@/lib/http";
import { csvCell, reportPdf } from "@/lib/report-format";
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
    if (resource === "sessions" && p.get("id")) {
      const session = demoData.sessions.find((s) => s.id === p.get("id"));
      if (!session) throw new Error("NOT_FOUND");
      const eventIds = new Set(session.eventIds as string[]);
      const events = demoData.events
        .filter((e) => eventIds.has(e.id))
        .sort((a, b) => +a.timestamp - +b.timestamp);
      return NextResponse.json({ session, events });
    }
    if (resource === "reports" && p.get("id")) {
      const report = demoData.reports.find((r) => r.id === p.get("id"));
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
    const rows = demoData.sessions
      .filter((s) => {
        const date = s.startedAt ?? s.endedAt;
        return (
          !!date &&
          date >= start &&
          date < end &&
          (!p.get("station") || s.stationId === p.get("station")) &&
          (!p.get("status") || s.status === p.get("status"))
        );
      })
      .map((s) => ({
        ...s,
        station: {
          name: demoData.stations.find((st) => st.id === s.stationId)!.name,
        },
      }));
    if (resource === "sessions") {
      const page = Math.max(1, Math.min(10000, Number(p.get("page")) || 1));
      const sorted = [...rows].sort(
        (a, b) =>
          (+(a.startedAt ?? 0) - +(b.startedAt ?? 0)) *
          (p.get("sort") === "asc" ? 1 : -1),
      );
      return NextResponse.json({
        rows: sorted.slice((page - 1) * 20, page * 20),
        total: sorted.length,
        page,
      });
    }
    if (resource === "reports" && p.get("format") === "csv") {
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
