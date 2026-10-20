import "dotenv/config";
import { hash } from "bcryptjs";
import type { Prisma } from "@prisma/client";
import { db } from "../src/lib/db";
import { reconstruct, type EvidenceEvent } from "../src/lib/measurement";
import { createHash } from "node:crypto";
import { createReport } from "../src/lib/reports";
async function seedReports(organizationId: string) {
  const lastMonday = new Date(
    process.env.SEED_END ?? new Date().toISOString().slice(0, 10),
  );
  lastMonday.setUTCDate(
    lastMonday.getUTCDate() - ((lastMonday.getUTCDay() + 6) % 7),
  );
  for (let week = 0; week < 4; week++) {
    const end = new Date(+lastMonday - week * 7 * 86400000);
    await createReport(
      {
        id: "seed",
        organizationId,
        role: "ADMIN",
        name: "Demo seed",
        demo: true,
      },
      new Date(+end - 7 * 86400000),
      end,
      "simulated",
    );
  }
}
async function main() {
  if (
    !process.env.ADMIN_EMAIL ||
    !process.env.ADMIN_PASSWORD ||
    process.env.ADMIN_PASSWORD.length < 12
  )
    throw new Error(
      "Set ADMIN_EMAIL and ADMIN_PASSWORD (at least 12 characters).",
    );
  const org = await db.organization.upsert({
    where: { id: "gallery-demo" },
    create: {
      id: "gallery-demo",
      name: "The Gallery · Demonstration",
      demo: true,
    },
    update: {},
  });
  await db.measurementConfiguration.upsert({
    where: { organizationId: org.id },
    create: { organizationId: org.id },
    update: {},
  });
  const existingUser = await db.user.findUnique({
    where: { email: process.env.ADMIN_EMAIL.toLowerCase() },
  });
  if (existingUser && existingUser.organizationId !== org.id)
    throw new Error(
      "Refusing to overwrite an account outside the demo organization.",
    );
  await db.user.upsert({
    where: { email: process.env.ADMIN_EMAIL.toLowerCase() },
    create: {
      email: process.env.ADMIN_EMAIL.toLowerCase(),
      name: "Alex Morgan",
      passwordHash: await hash(process.env.ADMIN_PASSWORD, 12),
      role: "ADMIN",
      organizationId: org.id,
    },
    update: { passwordHash: await hash(process.env.ADMIN_PASSWORD, 12) },
  });
  const gallery = await db.gallery.upsert({
    where: { id: "gallery-main" },
    create: { id: "gallery-main", organizationId: org.id, name: "The Gallery" },
    update: {},
  });
  const specs = [
    ["The Listening Room", "East wing · Ground floor", "Audio player gateway"],
    ["Between the Lines", "Main gallery · Floor 1", "Raspberry Pi gateway"],
    ["A Sense of Place", "West wing · Floor 1", "Audio player gateway"],
    ["Voices in Motion", "Sculpture hall · Floor 2", "ESP32 dock sensor"],
  ];
  for (let i = 0; i < specs.length; i++) {
    const [name, location, hardware] = specs[i],
      id = `station-${i + 1}`;
    await db.station.upsert({
      where: { id },
      create: {
        id,
        name,
        location,
        hardware,
        galleryId: gallery.id,
        maintenance: i === 3,
      },
      update: {},
    });
    await db.device.upsert({
      where: { id: `sim-device-${i + 1}` },
      create: {
        id: `sim-device-${i + 1}`,
        name: "Station simulator",
        stationId: id,
        simulated: true,
      },
      update: {},
    });
  }
  if (
    await db.rawEvent.count({ where: { eventId: { startsWith: "seed-v1-" } } })
  ) {
    await seedReports(org.id);
    console.log(
      "Deterministic seed already exists. Use the simulation reset before reseeding.",
    );
    return;
  }
  let seed = 20261020;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const anchor = new Date(
    process.env.SEED_END ?? new Date().toISOString().slice(0, 10),
  );
  const rawRows: Prisma.RawEventCreateManyInput[] = [],
    sessionRows: Prisma.ListeningSessionCreateManyInput[] = [];
  const flags: { eventId: string; code: string; detail: string }[] = [];
  for (let day = 55; day >= 0; day--) {
    const date = new Date(+anchor - day * 86400000);
    for (let st = 1; st <= 4; st++) {
      const count = Math.floor(
        (st === 4 ? 7 : 18) + random() * 17 + (55 - day) * 0.13,
      );
      for (let n = 0; n < count; n++) {
        const stationId = `station-${st}`,
          deviceId = `sim-device-${st}`,
          sessionKey = `seed-v1-${day}-${st}-${n}`;
        const start = new Date(
          +date +
            (15 + Math.floor(random() * 8)) * 3600000 +
            Math.floor(random() * 3500) * 1000,
        );
        if (start > new Date()) continue;
        const length = Math.round(12 + Math.pow(random(), 1.5) * 640),
          missing = random() < 0.025,
          paused = random() < 0.22;
        const evidence: EvidenceEvent[] = [];
        const add = (type: EvidenceEvent["type"], time: number) => {
          const eventId = `${sessionKey}-${evidence.length}`,
            id = createHash("sha256")
              .update(eventId)
              .digest("hex")
              .slice(0, 25);
          const ev: EvidenceEvent = {
            id,
            eventId,
            stationId,
            type,
            timestamp: new Date(time).toISOString(),
            ingestedAt: new Date(
              time +
                (type === "playback_started" && n === 3 && day % 9 === 0
                  ? 480000
                  : 1500),
            ),
            sourceType: "simulated",
            sourceId: deviceId,
            schemaVersion: 1,
            sessionKey,
            metadata: { trackId: `track-${st}` },
          };
          evidence.push(ev);
          rawRows.push({
            ...ev,
            deviceId,
            timestamp: new Date(ev.timestamp),
            sessionKey,
            duplicateCount: n === 2 && day % 11 === 0 ? 1 : 0,
          });
          return id;
        };
        add("playback_started", +start);
        if (paused) {
          add("playback_paused", +start + length * 400);
          add("playback_resumed", +start + length * 400 + 30000);
        }
        if (!missing)
          add(
            "playback_stopped",
            +start + length * 1000 + (paused ? 30000 : 0),
          );
        const projection = reconstruct(evidence);
        sessionRows.push({
          id: createHash("sha256")
            .update(`${stationId}:${deviceId}:simulated:${sessionKey}`)
            .digest("hex")
            .slice(0, 32),
          stationId,
          deviceId,
          sessionKey,
          sourceType: "simulated",
          ...projection,
        });
        if (n === 3 && day % 9 === 0)
          flags.push({
            eventId: evidence[0].id,
            code: "delayed_ingestion",
            detail:
              "Synthetic example: gateway buffered this event for 8 minutes.",
          });
      }
      // Sparse heartbeats intentionally reveal poor coverage in the synthetic dataset.
      for (let h = 15; h < 23; h++) {
        const time = new Date(+date + h * 3600000);
        if (time > new Date()) continue;
        const eventId = `seed-v1-heartbeat-${day}-${st}-${h}`;
        rawRows.push({
          id: createHash("sha256").update(eventId).digest("hex").slice(0, 25),
          eventId,
          stationId: `station-${st}`,
          deviceId: `sim-device-${st}`,
          type: "station_heartbeat",
          timestamp: time,
          ingestedAt: time,
          sourceType: "simulated",
          sourceId: `sim-device-${st}`,
          schemaVersion: 1,
          metadata: {},
        });
      }
    }
  }
  for (let i = 0; i < rawRows.length; i += 500)
    await db.rawEvent.createMany({ data: rawRows.slice(i, i + 500) });
  for (let i = 0; i < sessionRows.length; i += 500)
    await db.listeningSession.createMany({
      data: sessionRows.slice(i, i + 500),
    });
  await db.dataQualityFlag.createMany({ data: flags });
  for (let i = 1; i <= 4; i++)
    await db.audioContent.upsert({
      where: { id: `track-${i}` },
      create: {
        id: `track-${i}`,
        title: specs[i - 1][0],
        organizationId: org.id,
        durationSeconds: 720,
      },
      update: {},
    });
  await seedReports(org.id);
  console.log(
    `Seeded ${sessionRows.length} synthetic sessions and ${rawRows.length} raw events. Anchor ${anchor.toISOString().slice(0, 10)}. No real visitors.`,
  );
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
