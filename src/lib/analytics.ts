import { db } from "./db";
import { summarizeAnalytics } from "./analytics-core";
import type { Actor } from "./auth";
export async function analytics(
  a: Actor,
  start: Date,
  end: Date,
  sourceType = "simulated",
) {
  const config = await db.measurementConfiguration.findUnique({
    where: { organizationId: a.organizationId },
  });
  const where = {
    station: { gallery: { organizationId: a.organizationId } },
    sourceType,
    startedAt: { gte: start, lt: end },
  };
  const [sessions, previous, stations, events, flags, reports] =
    await Promise.all([
      db.listeningSession.findMany({ where, orderBy: { startedAt: "desc" } }),
      db.listeningSession.findMany({
        where: {
          ...where,
          startedAt: {
            gte: new Date(start.getTime() - (end.getTime() - start.getTime())),
            lt: start,
          },
        },
      }),
      db.station.findMany({
        where: { gallery: { organizationId: a.organizationId } },
        include: {
          devices: true,
          gallery: true,
          sessions: {
            where: { sourceType },
            orderBy: { startedAt: { sort: "desc", nulls: "last" } },
            take: 1,
          },
          events: {
            where: { sourceType },
            orderBy: { ingestedAt: "desc" },
            take: 1,
            select: { ingestedAt: true },
          },
        },
        orderBy: { name: "asc" },
      }),
      db.rawEvent.findMany({
        where: {
          station: { gallery: { organizationId: a.organizationId } },
          sourceType,
          timestamp: { gte: start, lt: end },
        },
        orderBy: { timestamp: "desc" },
        take: 3000,
        include: { flags: true },
      }),
      db.dataQualityFlag.findMany({
        where: {
          event: {
            station: { gallery: { organizationId: a.organizationId } },
            sourceType,
            timestamp: { gte: start, lt: end },
          },
        },
        include: { event: true },
        take: 200,
      }),
      db.report.findMany({
        where: { organizationId: a.organizationId, sourceType },
        orderBy: { generatedAt: "desc" },
        take: 30,
      }),
    ]);
  return summarizeAnalytics({
    sessions,
    previous,
    stations,
    events,
    flags,
    reports,
    config,
    start,
    end,
    sourceType,
  });
}
export type { Analytics } from "./analytics-core";
