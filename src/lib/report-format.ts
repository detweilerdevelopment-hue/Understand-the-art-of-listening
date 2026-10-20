import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { Prisma } from "@prisma/client";
import type { Analytics } from "./analytics-core";
import { duration } from "./utils";
export function reportSnapshot(data: Analytics) {
  return JSON.parse(
    JSON.stringify({
      metrics: data.metrics,
      daily: data.daily,
      stations: data.stations.map((s) => ({
        name: s.name,
        location: s.location,
        metrics: s.metrics,
      })),
      quality: {
        flags: data.flags.length,
        incomplete: data.metrics.incomplete,
        coverage: data.coverage,
      },
      definitions: {
        sessions:
          "Sessions starting within the period, counted once by station, device and session key.",
        duration:
          "Sum of playback intervals, excluding pauses. Unknown when start or end evidence is missing or contradictory.",
        engagement: `Known-duration sessions with at least ${data.metrics.engagedSeconds} seconds divided by known-duration sessions.`,
        coverage:
          "Observed heartbeat minutes divided by all enabled station minutes; bounded event sample may undercount.",
      },
      limitations: [
        "Playback does not verify that headphones were worn.",
        "Sessions are interactions, not unique visitors.",
        "No inferred duration is substituted for missing evidence.",
        "UTC period boundaries; timezone used for hourly grouping.",
        "Heartbeat coverage is conservative and may be sample-limited.",
      ],
    }),
  ) as Prisma.InputJsonValue;
}
type Snapshot = {
  metrics: {
    sessions: number;
    average: number | null;
    median: number | null;
    hours: number;
    engagedRate: number | null;
    incomplete: number;
  };
  daily: { date: string; sessions: number; minutes: number }[];
  stations: {
    name: string;
    location: string;
    metrics: { sessions: number; average: number | null; hours: number };
  }[];
  quality: { flags: number; incomplete: number; coverage: number | null };
  definitions: Record<string, string>;
  limitations: string[];
};
export async function reportPdf(report: {
  periodStart: Date;
  periodEnd: Date;
  generatedAt: Date;
  sourceType: string;
  timezone: string;
  snapshot: unknown;
}) {
  const s = report.snapshot as Snapshot,
    doc = await PDFDocument.create(),
    font = await doc.embedFont(StandardFonts.Helvetica),
    bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page = doc.addPage([595, 842]),
    y = 786;
  const line = (value: string, size = 11, strong = false) => {
    const ascii = value.replace(/[^\x20-\x7E]/g, "-");
    const words = ascii.split(" ");
    let text = "";
    for (const word of words) {
      const test = text ? `${text} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) > 490) {
        draw(text);
        text = word;
      } else text = test;
    }
    if (text) draw(text);
    function draw(t: string) {
      if (y < 65) {
        page = doc.addPage([595, 842]);
        y = 786;
      }
      page.drawText(t, {
        x: 50,
        y,
        size,
        font: strong ? bold : font,
        color: rgb(0.1, 0.15, 0.14),
      });
      y -= size + 8;
    }
  };
  line("GalleryPulse | Listening intelligence", 23, true);
  line(
    `${report.sourceType.toUpperCase()} DATA - ${report.periodStart.toISOString().slice(0, 10)} to ${report.periodEnd.toISOString().slice(0, 10)}`,
  );
  line(
    `Generated ${report.generatedAt.toISOString()} | Timezone ${report.timezone}`,
  );
  y -= 15;
  line("1. Executive summary", 15, true);
  line(
    `${s.metrics.sessions} station interactions were recorded. ${s.metrics.incomplete} have unknown listening duration. These interactions do not represent unique visitors.`,
  );
  line("2. Key performance indicators", 15, true);
  line(
    `Sessions: ${s.metrics.sessions} | Average: ${duration(s.metrics.average)} | Median: ${duration(s.metrics.median)}`,
  );
  line(
    `Listening hours: ${s.metrics.hours.toFixed(2)} | Engaged rate: ${s.metrics.engagedRate === null ? "Unavailable" : (s.metrics.engagedRate * 100).toFixed(1) + "%"}`,
  );
  line("3. Engagement trends", 15, true);
  for (const d of s.daily)
    line(
      `${d.date}: ${d.sessions} sessions, ${d.minutes.toFixed(1)} playback minutes`,
      9,
    );
  line("4. Station performance", 15, true);
  for (const station of s.stations)
    line(
      `${station.name} | ${station.location} | ${station.metrics.sessions} sessions | ${duration(station.metrics.average)} average`,
    );
  line("5. Listening duration analysis", 15, true);
  line(
    `Average ${duration(s.metrics.average)}; median ${duration(s.metrics.median)}. Unknown durations are excluded from duration and engagement calculations.`,
  );
  line("6. Data-quality findings", 15, true);
  line(
    `${s.quality.flags} event flags; ${s.quality.incomplete} incomplete sessions. Heartbeat minute coverage: ${s.quality.coverage === null ? "Unavailable" : (s.quality.coverage * 100).toFixed(2) + "%"}.`,
  );
  line("7. Measurement methodology", 15, true);
  Object.entries(s.definitions).forEach(([k, v]) => line(`${k}: ${v}`));
  line("8. Limitations and assumptions", 15, true);
  s.limitations.forEach((v) => line(v));
  doc
    .getPages()
    .forEach((p, i) =>
      p.drawText(
        `GalleryPulse | ${report.sourceType} | ${i + 1} / ${doc.getPageCount()}`,
        { x: 50, y: 30, size: 9, font },
      ),
    );
  return doc.save();
}
export function csvCell(v: unknown) {
  let text = String(v ?? "");
  if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
