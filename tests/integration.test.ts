import "dotenv/config";
import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { db } from "../src/lib/db";
import { ingest } from "../src/lib/ingestion";
import { analytics } from "../src/lib/analytics";
import { createReport, reportPdf } from "../src/lib/reports";
import { POST as eventPost } from "../src/app/api/events/route";
import { hashToken } from "../src/lib/ingestion";
import { GET as publicDemoGet } from "../src/app/api/demo/[resource]/route";
const enabled = process.env.RUN_DB_TESTS === "true",
  prefix = `test-${crypto.randomUUID()}`,
  orgId = prefix,
  stationId = prefix,
  deviceId = prefix;
const actor = {
  id: "test",
  organizationId: orgId,
  role: "ADMIN",
  name: "Test",
  demo: true,
};
describe.runIf(enabled)("PostgreSQL pipeline", () => {
  beforeAll(async () => {
    await db.organization.create({
      data: {
        id: orgId,
        name: "Isolated integration test",
        demo: true,
        galleries: {
          create: {
            id: prefix,
            name: "Test",
            stations: {
              create: {
                id: stationId,
                name: "Test station",
                location: "Lab",
                devices: {
                  create: { id: deviceId, name: "Simulator", simulated: true },
                },
              },
            },
          },
        },
      },
    });
  });
  afterAll(async () => {
    await db.report.deleteMany({ where: { organizationId: orgId } });
    await db.listeningSession.deleteMany({ where: { stationId } });
    await db.rawEvent.deleteMany({ where: { stationId } });
    await db.deviceCredential.deleteMany({ where: { deviceId } });
    await db.rateBucket.deleteMany({
      where: { key: { startsWith: `device:${deviceId}:` } },
    });
    await db.device.deleteMany({ where: { id: deviceId } });
    await db.station.deleteMany({ where: { id: stationId } });
    await db.gallery.deleteMany({ where: { id: prefix } });
    await db.organization.deleteMany({ where: { id: orgId } });
    await db.$disconnect();
  });
  it("persists, deduplicates and reconstructs late arrivals", async () => {
    const base = {
      stationId,
      sourceId: deviceId,
      sourceType: "simulated",
      schemaVersion: 1,
      sessionKey: "first",
      metadata: { trackId: "test-track", volume: 50 },
    };
    const start = {
        ...base,
        eventId: "start",
        type: "playback_started",
        timestamp: new Date(Date.now() - 90000).toISOString(),
      },
      stop = {
        ...base,
        eventId: "stop",
        type: "playback_stopped",
        timestamp: new Date(Date.parse(start.timestamp) + 60000).toISOString(),
      };
    await ingest(stop, deviceId, orgId);
    await ingest(start, deviceId, orgId);
    expect(
      (
        await ingest(
          { ...start, metadata: { volume: 50, trackId: "test-track" } },
          deviceId,
          orgId,
        )
      )?.duplicate,
    ).toBe(true);
    expect(await db.rawEvent.count({ where: { stationId } })).toBe(2);
    const session = await db.listeningSession.findFirstOrThrow({
      where: { stationId },
    });
    expect(session.durationSeconds).toBe(60);
    expect(
      await db.dataQualityFlag.count({
        where: { event: { stationId }, code: "out_of_order" },
      }),
    ).toBe(1);
  });
  it("rejects another organization and conflicting retry", async () => {
    const event = {
      stationId,
      sourceId: deviceId,
      sourceType: "simulated",
      schemaVersion: 1,
      eventId: "start",
      type: "playback_stopped",
      sessionKey: "first",
      timestamp: new Date().toISOString(),
    };
    await expect(ingest(event, deviceId, "other-org")).rejects.toThrow(
      "FORBIDDEN",
    );
    await expect(ingest(event, deviceId, orgId)).rejects.toThrow(
      "EVENT_ID_CONFLICT",
    );
  });
  it("uses identical calculations for dashboard and PDF snapshot", async () => {
    const start = new Date(Date.now() - 3600000),
      end = new Date();
    const a = await analytics(actor, start, end);
    const r = await createReport(actor, start, end, "simulated");
    expect((r.snapshot as { metrics: unknown }).metrics).toEqual(a.metrics);
    expect(
      Buffer.from(await reportPdf(r))
        .subarray(0, 4)
        .toString(),
    ).toBe("%PDF");
    const second = await createReport(actor, start, end, "simulated");
    expect(second.id).toBe(r.id);
  });
  it("authenticates the public ingestion route and rejects revoked tokens", async () => {
    const token = crypto.randomUUID();
    await db.deviceCredential.create({
      data: { deviceId, tokenHash: hashToken(token) },
    });
    const payload = {
      eventId: "api-heartbeat",
      stationId,
      sourceId: deviceId,
      sourceType: "simulated",
      schemaVersion: 1,
      type: "station_heartbeat",
      timestamp: new Date().toISOString(),
    };
    const req = (key: string, body = payload) =>
      new Request("http://localhost:3000/api/events", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
    expect((await eventPost(req("invalid"))).status).toBe(401);
    expect((await eventPost(req(token))).status).toBe(200);
    expect(
      (
        await eventPost(
          req(token, {
            ...payload,
            eventId: "invalid-time",
            timestamp: "not-a-date",
          }),
        )
      ).status,
    ).toBe(400);
    await db.deviceCredential.updateMany({
      where: { deviceId },
      data: { revokedAt: new Date() },
    });
    expect((await eventPost(req(token))).status).toBe(401);
  });
  it("isolates analytics by organization", async () => {
    const a = await analytics(
      { ...actor, organizationId: "other-org" },
      new Date(0),
      new Date(),
    );
    expect(a.metrics.sessions).toBe(0);
    expect(a.stations).toHaveLength(0);
  });
  it("public demo rejects private evidence and measured reports even by exact ID", async () => {
    const session = await db.listeningSession.findFirstOrThrow({
      where: { stationId },
    });
    const response = await publicDemoGet(
      new Request(
        `http://localhost:3000/api/demo/sessions?id=${session.id}&organizationId=${orgId}`,
      ),
      { params: Promise.resolve({ resource: "sessions" }) },
    );
    expect(response.status).toBe(404);
    const privateReport = await db.report.findFirstOrThrow({
      where: { organizationId: orgId },
    });
    expect(
      (
        await publicDemoGet(
          new Request(
            `http://localhost:3000/api/demo/reports?id=${privateReport.id}`,
          ),
          { params: Promise.resolve({ resource: "reports" }) },
        )
      ).status,
    ).toBe(404);
    const measured = await db.report.create({
      data: {
        organizationId: "gallery-demo",
        periodStart: new Date(),
        periodEnd: new Date(Date.now() + 1000),
        sourceType: "measured",
        timezone: "UTC",
        snapshot: { test: true },
      },
    });
    try {
      expect(
        (
          await publicDemoGet(
            new Request(
              `http://localhost:3000/api/demo/reports?id=${measured.id}`,
            ),
            { params: Promise.resolve({ resource: "reports" }) },
          )
        ).status,
      ).toBe(404);
    } finally {
      await db.report.delete({ where: { id: measured.id } });
    }
  });
});
