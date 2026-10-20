import { z } from "zod";
export const eventTypes = [
  "station_heartbeat",
  "presence_detected",
  "presence_ended",
  "headphones_connected",
  "headphones_disconnected",
  "playback_started",
  "playback_paused",
  "playback_resumed",
  "playback_stopped",
  "session_started",
  "session_ended",
] as const;
export const eventSchema = z
  .object({
    eventId: z.string().min(1).max(120),
    stationId: z.string().min(1).max(120),
    type: z.enum(eventTypes),
    timestamp: z.iso.datetime({ offset: true }),
    sourceType: z.enum(["measured", "simulated", "inferred"]),
    sourceId: z.string().min(1).max(120),
    schemaVersion: z.literal(1),
    sessionKey: z.string().min(1).max(120).optional(),
    metadata: z
      .record(
        z.string(),
        z.union([z.string(), z.number(), z.boolean(), z.null()]),
      )
      .default({}),
  })
  .superRefine((e, ctx) => {
    if (
      (e.type.startsWith("playback_") || e.type.startsWith("session_")) &&
      !e.sessionKey
    )
      ctx.addIssue({
        code: "custom",
        message: "Playback and session events require sessionKey",
        path: ["sessionKey"],
      });
  });
export type StationEvent = z.infer<typeof eventSchema>;
export type EvidenceEvent = StationEvent & {
  id: string;
  ingestedAt: Date | string;
};
export type Reconstructed = {
  startedAt: Date | null;
  endedAt: Date | null;
  durationSeconds: number | null;
  confidence: string;
  status: string;
  flags: string[];
  eventIds: string[];
  trackId: string | null;
};
export function reconstruct(
  input: EvidenceEvent[],
  maxSeconds = 14400,
): Reconstructed {
  const events = [...input].sort(
    (a, b) =>
      Date.parse(a.timestamp) - Date.parse(b.timestamp) ||
      a.eventId.localeCompare(b.eventId),
  );
  let start: Date | null = null,
    end: Date | null = null,
    playing: number | null = null,
    seconds = 0,
    hasPlayback = false,
    hasStart = false,
    stopped = false;
  const flags = new Set<string>();
  for (const e of events) {
    const t = Date.parse(e.timestamp);
    if (!Number.isFinite(t)) {
      flags.add("invalid_timestamp");
      continue;
    }
    if (
      stopped &&
      (e.type.startsWith("playback_") || e.type === "session_started")
    )
      flags.add("event_after_end");
    if (e.type === "session_started") {
      if (hasStart) flags.add("conflicting_start");
      hasStart = true;
      start ??= new Date(t);
    }
    if (e.type === "playback_started") {
      if (playing !== null || hasPlayback) flags.add("conflicting_start");
      hasPlayback = true;
      start ??= new Date(t);
      playing = t;
    }
    if (e.type === "playback_resumed") {
      if (playing !== null) flags.add("conflicting_resume");
      else if (!hasPlayback) flags.add("missing_start");
      else playing = t;
    }
    if (
      ["playback_paused", "playback_stopped", "session_ended"].includes(e.type)
    ) {
      if (playing !== null) {
        seconds += (t - playing) / 1000;
        playing = null;
      } else if (e.type === "playback_paused") flags.add("conflicting_pause");
      if (e.type === "playback_stopped" || e.type === "session_ended") {
        end = new Date(t);
        stopped = true;
      }
    }
  }
  if (!hasPlayback && !hasStart) flags.add("missing_start");
  if (!stopped) flags.add("missing_end");
  if (start && end && (end.getTime() - start.getTime()) / 1000 > maxSeconds)
    flags.add("unrealistic_duration");
  if (!hasPlayback) flags.add("no_playback_evidence");
  const reliable =
    hasPlayback &&
    stopped &&
    !Array.from(flags).some((f) =>
      [
        "missing_start",
        "conflicting_start",
        "conflicting_pause",
        "conflicting_resume",
        "unrealistic_duration",
        "event_after_end",
      ].includes(f),
    );
  return {
    startedAt: start,
    endedAt: end,
    durationSeconds: reliable ? seconds : null,
    confidence: events.some((e) => e.sourceType === "simulated")
      ? "simulated"
      : reliable
        ? "confirmed"
        : "incomplete",
    status: stopped ? "ended" : playing !== null ? "active" : "open",
    flags: [...flags],
    eventIds: events.map((e) => e.id),
    trackId:
      typeof events[0]?.metadata.trackId === "string"
        ? events[0].metadata.trackId
        : null,
  };
}
export type MetricSession = {
  durationSeconds: number | null;
  startedAt: Date | null;
  sourceType: string;
  stationId: string;
  confidence: string;
  status: string;
};
export function metrics(sessions: MetricSession[], threshold = 60) {
  const durations = sessions
      .flatMap((s) => (s.durationSeconds === null ? [] : [s.durationSeconds]))
      .sort((a, b) => a - b),
    n = durations.length,
    sum = durations.reduce((a, b) => a + b, 0);
  return {
    sessions: sessions.length,
    validSessions: n,
    average: n ? Number((sum / n).toFixed(3)) : null,
    median: n
      ? Number(
          (n % 2
            ? durations[(n - 1) / 2]
            : (durations[n / 2 - 1] + durations[n / 2]) / 2
          ).toFixed(3),
        )
      : null,
    hours: Number((sum / 3600).toFixed(6)),
    engagedRate: n
      ? Number((durations.filter((d) => d >= threshold).length / n).toFixed(6))
      : null,
    incomplete: sessions.filter((s) => s.durationSeconds === null).length,
    engagedSeconds: threshold,
  };
}
export function stationStatus(
  station: { enabled: boolean; maintenance: boolean },
  heartbeats: { lastHeartbeat: Date | null }[],
  active: boolean,
  timeout = 180,
  now = Date.now(),
) {
  if (station.maintenance) return "maintenance";
  if (!station.enabled) return "disabled";
  const latest = Math.max(
    0,
    ...heartbeats.map((d) => d.lastHeartbeat?.getTime() ?? 0),
  );
  if (now - latest > timeout * 1000) return "offline";
  return active ? "active" : "idle";
}
