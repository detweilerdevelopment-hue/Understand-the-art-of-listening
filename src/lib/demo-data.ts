import type {
  ListeningSession,
  RawEvent,
  DataQualityFlag,
  Report,
} from "@prisma/client";
import { reconstruct, type EvidenceEvent } from "./measurement";
import { summarizeAnalytics, type AnalyticsInput } from "./analytics-core";
import { reportSnapshot } from "./report-format";

// Fixed synthetic sample, independent of clocks, credentials, networks and databases.
export const DEMO_END = "2026-10-20T00:00:00.000Z";
const organizationId = "packaged-gallery-demo";
type SampleEvent = RawEvent & { flags: DataQualityFlag[] };
type SampleData = {
  stations: AnalyticsInput["stations"];
  sessions: ListeningSession[];
  events: SampleEvent[];
  reports: Report[];
  config: NonNullable<AnalyticsInput["config"]>;
};
function buildSample(): SampleData {
  let seed = 20261020;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const gallery = {
    id: "sample-gallery",
    name: "The Gallery",
    timezone: "America/Denver",
    organizationId,
  };
  const config = {
    id: "sample-config",
    organizationId,
    engagedSeconds: 60,
    maxSessionSeconds: 14400,
    heartbeatTimeoutSeconds: 180,
    reportTimezone: gallery.timezone,
  };
  const specs = [
    ["The Listening Room", "East wing / Ground floor"],
    ["Between the Lines", "Main gallery / Floor 1"],
    ["A Sense of Place", "West wing / Floor 1"],
    ["Voices in Motion", "Sculpture hall / Floor 2"],
  ];
  const stations: SampleData["stations"] = specs.map(([name, location], i) => ({
    id: `sample-station-${i + 1}`,
    name,
    location,
    hardware: "Sample audio player gateway",
    enabled: true,
    maintenance: i === 3,
    galleryId: gallery.id,
    gallery,
    devices: [
      {
        id: `sample-device-${i + 1}`,
        stationId: `sample-station-${i + 1}`,
        name: "Packaged sample gateway",
        simulated: true,
        lastHeartbeat: new Date(+new Date(DEMO_END) - 3600000),
      },
    ],
    sessions: [],
    events: [],
  }));
  const sessions: ListeningSession[] = [],
    events: SampleEvent[] = [];
  for (let day = 56; day >= 1; day--) {
    const date = +new Date(DEMO_END) - day * 86400000;
    for (let station = 0; station < stations.length; station++) {
      const s = stations[station],
        deviceId = s.devices[0].id;
      const count = Math.floor(
        (station === 3 ? 8 : 18) + random() * 15 + (56 - day) * 0.12,
      );
      for (let n = 0; n < count; n++) {
        const key = `sample-${day}-${station}-${n}`,
          start =
            date +
            (15 + Math.floor(random() * 8)) * 3600000 +
            Math.floor(random() * 3400) * 1000;
        const seconds = Math.round(15 + Math.pow(random(), 1.5) * 650),
          paused = random() < 0.22,
          missing = random() < 0.025;
        const evidence: EvidenceEvent[] = [];
        const add = (type: EvidenceEvent["type"], time: number) => {
          const id = `${key}-${evidence.length}`;
          const e: EvidenceEvent = {
            id,
            eventId: id,
            stationId: s.id,
            type,
            timestamp: new Date(time).toISOString(),
            ingestedAt: new Date(time + 1500),
            sourceType: "simulated",
            sourceId: deviceId,
            schemaVersion: 1,
            sessionKey: key,
            metadata: { trackId: `sample-track-${station + 1}` },
          };
          evidence.push(e);
          const delayed =
            n === 3 && day % 9 === 0 && type === "playback_started";
          events.push({
            ...e,
            deviceId,
            timestamp: new Date(time),
            ingestedAt: new Date(time + (delayed ? 480000 : 1500)),
            sessionKey: key,
            duplicateCount: n === 2 && day % 11 === 0 ? 1 : 0,
            flags: delayed
              ? [
                  {
                    id: `flag-${id}`,
                    eventId: id,
                    code: "delayed_ingestion",
                    detail:
                      "Synthetic example: gateway buffered this observation for eight minutes.",
                  },
                ]
              : [],
          });
        };
        add("playback_started", start);
        if (paused) {
          add("playback_paused", start + seconds * 400);
          add("playback_resumed", start + seconds * 400 + 30000);
        }
        if (!missing)
          add(
            "playback_stopped",
            start + seconds * 1000 + (paused ? 30000 : 0),
          );
        sessions.push({
          id: key,
          stationId: s.id,
          deviceId,
          sessionKey: key,
          sourceType: "simulated",
          ...reconstruct(evidence),
        });
      }
      for (let hour = 15; hour < 23; hour++) {
        const id = `sample-heartbeat-${day}-${station}-${hour}`,
          time = new Date(date + hour * 3600000);
        events.push({
          id,
          eventId: id,
          stationId: s.id,
          deviceId,
          type: "station_heartbeat",
          timestamp: time,
          ingestedAt: time,
          sourceType: "simulated",
          sourceId: deviceId,
          schemaVersion: 1,
          sessionKey: null,
          metadata: {},
          duplicateCount: 0,
          flags: [],
        });
      }
    }
  }
  sessions.sort((a, b) => +(b.startedAt ?? 0) - +(a.startedAt ?? 0));
  events.sort((a, b) => +b.timestamp - +a.timestamp);
  stations.forEach((s) => {
    s.sessions = sessions.filter((x) => x.stationId === s.id).slice(0, 1);
    s.events = events
      .filter((e) => e.stationId === s.id)
      .slice(0, 1)
      .map((e) => ({ ingestedAt: e.ingestedAt }));
  });
  const data = { stations, sessions, events, config, reports: [] as Report[] };
  const monday = new Date(DEMO_END);
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  for (let week = 0; week < 4; week++) {
    const end = new Date(+monday - week * 7 * 86400000),
      start = new Date(+end - 7 * 86400000),
      result = sampleAnalytics(data, start, end);
    data.reports.push({
      id: `sample-report-${week + 1}`,
      organizationId,
      periodStart: start,
      periodEnd: end,
      sourceType: "simulated",
      timezone: config.reportTimezone,
      generatedAt: new Date(DEMO_END),
      snapshot: JSON.parse(JSON.stringify(reportSnapshot(result))),
    });
  }
  return data;
}
function sampleAnalytics(data: SampleData, start: Date, end: Date) {
  const inside = (date: Date | null) => !!date && date >= start && date < end;
  const periodEvents = data.events.filter((e) => inside(e.timestamp));
  const events = periodEvents.slice(0, 3000);
  const previousStart = new Date(+start - (+end - +start));
  return summarizeAnalytics({
    start,
    end,
    sourceType: "simulated",
    config: data.config,
    stations: data.stations,
    reports: data.reports,
    sessions: data.sessions.filter((s) => inside(s.startedAt)),
    previous: data.sessions.filter(
      (s) =>
        !!s.startedAt && s.startedAt >= previousStart && s.startedAt < start,
    ),
    events,
    heartbeatMinuteCount: new Set(periodEvents.filter((e) =>
      e.type === "station_heartbeat" && data.stations.some((s) =>
        s.id === e.stationId && s.enabled && !s.maintenance,
      ),
    ).map((e) => `${e.stationId}:${Math.floor(+e.timestamp / 60000)}`)).size,
    qualityFlagCount: periodEvents.reduce((count, event) => count + event.flags.length, 0),
    flags: periodEvents
      .flatMap((event) => event.flags.map((flag) => ({ ...flag, event })))
      .slice(0, 200),
  });
}
export const demoData = buildSample();
export function packagedAnalytics(start: Date, end: Date) {
  return sampleAnalytics(demoData, start, end);
}
