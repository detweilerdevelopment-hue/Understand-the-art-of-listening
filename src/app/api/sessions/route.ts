import { NextResponse } from "next/server";
import { actor } from "@/lib/auth";
import { db } from "@/lib/db";
import { failure, period } from "@/lib/http";
export async function GET(req: Request) {
  try {
    const a = await actor(),
      p = new URL(req.url).searchParams;
    const id = p.get("id");
    if (id) {
      const session = await db.listeningSession.findFirst({
        where: {
          id,
          station: { gallery: { organizationId: a.organizationId } },
        },
      });
      if (!session) throw new Error("NOT_FOUND");
      const events = await db.rawEvent.findMany({
        where: {
          id: { in: session.eventIds as string[] },
          station: { gallery: { organizationId: a.organizationId } },
        },
        orderBy: { timestamp: "asc" },
        include: { flags: true },
      });
      return NextResponse.json({ session, events });
    }
    const page = Math.max(1, Math.min(100000, Number(p.get("page")) || 1)),
      { start, end } = period(p);
    const where = {
      station: { gallery: { organizationId: a.organizationId } },
      sourceType: p.get("source") === "measured" ? "measured" : "simulated",
      ...(p.get("station") ? { stationId: p.get("station")! } : {}),
      ...(p.get("status") ? { status: p.get("status")! } : {}),
      OR: [
        { startedAt: { gte: start, lt: end } },
        { startedAt: null, endedAt: { gte: start, lt: end } },
      ],
    };
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
  } catch (e) {
    return failure(e);
  }
}
