import { describe, it, expect } from "vitest";
import {
  eventSchema,
  reconstruct,
  metrics,
  stationStatus,
  type EvidenceEvent,
} from "../src/lib/measurement";
function events(types: [EvidenceEvent["type"], number][]): EvidenceEvent[] {
  return types.map(([type, t], i) => ({
    id: String(i),
    eventId: String(i),
    type,
    timestamp: new Date(Date.UTC(2026, 9, 20, 10, 0, t)).toISOString(),
    ingestedAt: new Date(),
    stationId: "one",
    sourceType: "measured",
    sourceId: "device",
    schemaVersion: 1,
    sessionKey: "session",
    metadata: {},
  }));
}
describe("measurement evidence", () => {
  it("excludes paused intervals", () => {
    const s = reconstruct(
      events([
        ["playback_started", 0],
        ["playback_paused", 20],
        ["playback_resumed", 40],
        ["playback_stopped", 80],
      ]),
    );
    expect(s.durationSeconds).toBe(60);
    expect(s.confidence).toBe("confirmed");
    expect(s.status).toBe("ended");
  });
  it("rebuilds out-of-order deliveries", () => {
    const e = events([
      ["playback_started", 0],
      ["playback_stopped", 90],
    ]);
    expect(reconstruct(e.reverse()).durationSeconds).toBe(90);
  });
  it("does not invent an end", () => {
    const s = reconstruct(events([["playback_started", 0]]));
    expect(s.durationSeconds).toBeNull();
    expect(s.flags).toContain("missing_end");
    expect(s.status).toBe("active");
  });
  it("does not infer listening from presence or session envelope", () => {
    const s = reconstruct(
      events([
        ["session_started", 0],
        ["presence_detected", 5],
        ["session_ended", 80],
      ]),
    );
    expect(s.durationSeconds).toBeNull();
    expect(s.flags).toContain("no_playback_evidence");
  });
  it("flags missing start", () => {
    expect(reconstruct(events([["playback_stopped", 20]])).flags).toContain(
      "missing_start",
    );
  });
  it("marks conflicting transitions unknown", () => {
    const s = reconstruct(
      events([
        ["playback_started", 0],
        ["playback_started", 10],
        ["playback_stopped", 30],
      ]),
    );
    expect(s.durationSeconds).toBeNull();
    expect(s.flags).toContain("conflicting_start");
  });
  it("flags unrealistic wall-clock duration", () => {
    const s = reconstruct(
      events([
        ["playback_started", 0],
        ["playback_stopped", 15000],
      ]),
    );
    expect(s.flags).toContain("unrealistic_duration");
    expect(s.durationSeconds).toBeNull();
  });
  it("separates simulation from confirmation", () => {
    const e = events([
      ["playback_started", 0],
      ["playback_stopped", 60],
    ]).map((e) => ({ ...e, sourceType: "simulated" as const }));
    expect(reconstruct(e).confidence).toBe("simulated");
  });
  it("requires session keys and strict timestamps", () => {
    expect(
      eventSchema.safeParse({
        ...events([["playback_started", 0]])[0],
        sessionKey: undefined,
      }).success,
    ).toBe(false);
    expect(
      eventSchema.safeParse({
        ...events([["station_heartbeat", 0]])[0],
        timestamp: "yesterday",
      }).success,
    ).toBe(false);
  });
  it("computes median, average and explicit engagement denominator", () => {
    const durations = [30, 60, 90, null];
    const m = metrics(
      durations.map((durationSeconds) => ({
        durationSeconds,
        startedAt: new Date(),
        sourceType: "measured",
        stationId: "one",
        confidence: "confirmed",
        status: "ended",
      })),
    );
    expect(m.average).toBe(60);
    expect(m.median).toBe(60);
    expect(m.engagedRate).toBeCloseTo(2 / 3);
    expect(m.incomplete).toBe(1);
    expect(m.hours).toBe(0.05);
  });
  it("returns null instead of misleading empty rates", () => {
    expect(metrics([]).engagedRate).toBeNull();
    expect(metrics([]).average).toBeNull();
  });
  it("requires a recent heartbeat for active status", () => {
    expect(stationStatus({ enabled: true, maintenance: false }, [], true)).toBe(
      "offline",
    );
    expect(
      stationStatus(
        { enabled: true, maintenance: false },
        [{ lastHeartbeat: new Date() }],
        true,
      ),
    ).toBe("active");
  });
});
