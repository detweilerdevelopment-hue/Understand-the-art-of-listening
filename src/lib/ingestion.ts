import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { eventSchema, reconstruct, type StationEvent } from "./measurement";
const canonicalMetadata = (value: unknown) =>
  JSON.stringify(
    Object.entries((value ?? {}) as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b),
    ),
  );
export const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export async function ingest(
  raw: unknown,
  deviceId: string,
  organizationId: string,
) {
  const event = eventSchema.parse(raw);
  const device = await db.device.findFirst({
    where: {
      id: deviceId,
      stationId: event.stationId,
      station: { gallery: { organizationId } },
    },
  });
  if (
    !device ||
    device.simulated !== (event.sourceType === "simulated") ||
    event.sourceId !== device.id
  )
    throw new Error("FORBIDDEN");
  if (Date.parse(event.timestamp) > Date.now() + 300000)
    throw new Error("FUTURE_TIMESTAMP");
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await db.$transaction(
        async (tx) => {
          // Serialize station projection updates, including out-of-order arrivals and retries.
          await tx.$queryRaw`SELECT id FROM "Station" WHERE id=${event.stationId} FOR UPDATE`;
          const existing = await tx.rawEvent.findUnique({
            where: { deviceId_eventId: { deviceId, eventId: event.eventId } },
          });
          if (existing) {
            if (
              existing.type !== event.type ||
              existing.sourceType !== event.sourceType ||
              existing.sourceId !== event.sourceId ||
              existing.schemaVersion !== event.schemaVersion ||
              existing.timestamp.getTime() !== Date.parse(event.timestamp) ||
              existing.sessionKey !== (event.sessionKey ?? null) ||
              canonicalMetadata(existing.metadata) !==
                canonicalMetadata(event.metadata)
            )
              throw new Error("EVENT_ID_CONFLICT");
            await tx.rawEvent.update({
              where: { id: existing.id },
              data: { duplicateCount: { increment: 1 } },
            });
            return { duplicate: true, id: existing.id };
          }
          const latest = await tx.rawEvent.findFirst({
            where: { deviceId },
            orderBy: { timestamp: "desc" },
          });
          const codes: string[] = [];
          if (Date.now() - Date.parse(event.timestamp) > 300000)
            codes.push("delayed_ingestion");
          if (
            latest &&
            latest.timestamp.getTime() > Date.parse(event.timestamp)
          )
            codes.push("out_of_order");
          if (event.type === "station_heartbeat") {
            const prior = await tx.rawEvent.findFirst({
              where: {
                deviceId,
                type: "station_heartbeat",
                timestamp: { lt: new Date(event.timestamp) },
              },
              orderBy: { timestamp: "desc" },
            });
            const cfg = await tx.measurementConfiguration.findUnique({
              where: { organizationId },
            });
            if (
              prior &&
              Date.parse(event.timestamp) - prior.timestamp.getTime() >
                (cfg?.heartbeatTimeoutSeconds ?? 180) * 1000
            )
              codes.push("connectivity_gap");
          }
          const saved = await tx.rawEvent.create({
            data: {
              ...event,
              deviceId,
              timestamp: new Date(event.timestamp),
              metadata: event.metadata as Prisma.InputJsonValue,
              flags: {
                create: codes.map((code) => ({
                  code,
                  detail:
                    code === "out_of_order"
                      ? "Arrived after a later event; projection reconstructed in event-time order."
                      : code === "connectivity_gap"
                        ? "Observed heartbeat interval exceeded the configured timeout."
                        : "Received more than five minutes after event time.",
                })),
              },
            },
          });
          if (event.type === "station_heartbeat")
            await tx.device.updateMany({
              where: {
                id: deviceId,
                OR: [
                  { lastHeartbeat: null },
                  { lastHeartbeat: { lt: new Date(event.timestamp) } },
                ],
              },
              data: { lastHeartbeat: new Date(event.timestamp) },
            });
          if (event.sessionKey) {
            const history = await tx.rawEvent.findMany({
              where: {
                stationId: event.stationId,
                deviceId,
                sourceType: event.sourceType,
                sessionKey: event.sessionKey,
              },
            });
            const config = await tx.measurementConfiguration.findUnique({
              where: { organizationId },
            });
            const projection = reconstruct(
              history.map((e) => ({
                ...e,
                timestamp: e.timestamp.toISOString(),
                metadata: e.metadata as StationEvent["metadata"],
                type: e.type as StationEvent["type"],
                sourceType: e.sourceType as StationEvent["sourceType"],
                sessionKey: e.sessionKey ?? undefined,
                schemaVersion: 1,
              })),
              config?.maxSessionSeconds,
            );
            const id = createHash("sha256")
              .update(
                `${event.stationId}:${deviceId}:${event.sourceType}:${event.sessionKey}`,
              )
              .digest("hex")
              .slice(0, 32);
            const data = {
              ...projection,
              stationId: event.stationId,
              deviceId,
              sessionKey: event.sessionKey,
              sourceType: event.sourceType,
            };
            await tx.listeningSession.upsert({
              where: { id },
              create: { id, ...data },
              update: data,
            });
          }
          return { duplicate: false, id: saved.id };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: 15000,
        },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ["P2034", "P2002"].includes(error.code) &&
        attempt < 3
      )
        continue;
      throw error;
    }
  }
  throw new Error("INGESTION_RETRY_EXHAUSTED");
}
