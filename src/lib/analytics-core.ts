import type {
  Device,
  Station,
  Gallery,
  ListeningSession,
  RawEvent,
  DataQualityFlag,
  Report,
  MeasurementConfiguration,
} from "@prisma/client";
import { metrics, stationStatus } from "./measurement";
export type AnalyticsInput = {
  sessions: ListeningSession[];
  previous: ListeningSession[];
  stations: (Station & {
    devices: Device[];
    gallery: Gallery;
    sessions: ListeningSession[];
    events: { ingestedAt: Date }[];
  })[];
  events: (RawEvent & { flags: DataQualityFlag[] })[];
  flags: (DataQualityFlag & { event: RawEvent })[];
  reports: Report[];
  config: MeasurementConfiguration | null;
  start: Date;
  end: Date;
  sourceType: string;
  heartbeatMinuteCount?: number;
  qualityFlagCount?: number;
};
export function summarizeAnalytics({
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
  heartbeatMinuteCount,
  qualityFlagCount,
}: AnalyticsInput) {
  const current = metrics(sessions, config?.engagedSeconds),
    prior = metrics(previous, config?.engagedSeconds);
  const timezone = config?.reportTimezone ?? "America/Denver";
  const dailyMap = new Map<
    string,
    { date: string; sessions: number; minutes: number }
  >();
  for (let t = start.getTime(); t < end.getTime(); t += 86400000) {
    const date = new Date(t).toISOString().slice(0, 10);
    dailyMap.set(date, { date, sessions: 0, minutes: 0 });
  }
  const heatmap = Array.from(
    { length: 7 },
    () => Array(24).fill(0) as number[],
  );
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "numeric",
    hourCycle: "h23",
  });
  for (const s of sessions) {
    if (!s.startedAt) continue;
    const day = s.startedAt.toISOString().slice(0, 10),
      d = dailyMap.get(day);
    if (d) {
      d.sessions++;
      d.minutes += (s.durationSeconds ?? 0) / 60;
    }
    const parts = fmt.formatToParts(s.startedAt);
    const w = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(
      parts.find((p) => p.type === "weekday")?.value ?? "",
    );
    const hour = Number(parts.find((p) => p.type === "hour")?.value);
    if (w >= 0) heatmap[w][hour]++;
  }
  const distribution = [
    { name: "Under 1 min", min: 0, max: 60 },
    { name: "1–3 min", min: 60, max: 180 },
    { name: "3–5 min", min: 180, max: 300 },
    { name: "5–10 min", min: 300, max: 600 },
    { name: "10+ min", min: 600, max: Infinity },
  ].map((b) => ({
    name: b.name,
    sessions: sessions.filter(
      (s) =>
        s.durationSeconds !== null &&
        s.durationSeconds >= b.min &&
        s.durationSeconds < b.max,
    ).length,
  }));
  const tracks = Object.entries(
    sessions.reduce<Record<string, typeof sessions>>((groups, s) => {
      const key = s.trackId ?? "Unattributed";
      (groups[key] ??= []).push(s);
      return groups;
    }, {}),
  ).map(([trackId, rows]) => ({
    trackId,
    metrics: metrics(rows, config?.engagedSeconds),
  }));
  const mapped = stations.map((s) => ({
    ...s,
    status: stationStatus(
      s,
      s.devices.filter((d) => d.simulated === (sourceType === "simulated")),
      s.sessions.some(
        (latest) =>
          latest.status === "active" &&
          !!latest.startedAt &&
          Date.now() - latest.startedAt.getTime() <=
            (config?.maxSessionSeconds ?? 14400) * 1000,
      ),
      config?.heartbeatTimeoutSeconds,
    ),
    metrics: metrics(
      sessions.filter((x) => x.stationId === s.id),
      config?.engagedSeconds,
    ),
  }));
  // Coverage is observed heartbeat minutes / all enabled station minutes, never historical session presence.
  const enabled = stations.filter((s) => s.enabled && !s.maintenance);
  const denominator =
    (enabled.length * (end.getTime() - start.getTime())) / 60000;
  const heartbeatMinutes = heartbeatMinuteCount ?? new Set(
    events
      .filter(
        (e) =>
          e.type === "station_heartbeat" &&
          enabled.some((s) => s.id === e.stationId),
      )
      .map(
        (e) => `${e.stationId}:${Math.floor(e.timestamp.getTime() / 60000)}`,
      ),
  ).size;
  return {
    metrics: current,
    previous: prior,
    change:
      prior.sessions >= 20
        ? (current.sessions - prior.sessions) / prior.sessions
        : null,
    stations: mapped,
    tracks,
    daily: [...dailyMap.values()],
    heatmap,
    distribution,
    coverage: denominator ? Math.min(heartbeatMinutes / denominator, 1) : null,
    coverageLimited: heartbeatMinuteCount === undefined && events.length === 3000,
    qualityFlagCount: qualityFlagCount ?? flags.length,
    events,
    flags,
    reports,
    timezone,
    sourceType,
    period: { start: start.toISOString(), end: end.toISOString() },
    config,
  };
}
export type Analytics = ReturnType<typeof summarizeAnalytics>;
