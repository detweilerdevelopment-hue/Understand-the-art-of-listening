// Node 20+ reference gateway: maps player events into the public device contract.
// Example: node scripts/gateway.mjs playback_started installation-session-001
import { randomUUID } from "node:crypto";
import { appendFile, readFile, writeFile } from "node:fs/promises";
const { GALLERYPULSE_URL, DEVICE_TOKEN, STATION_ID, DEVICE_ID } = process.env;
if (!GALLERYPULSE_URL || !DEVICE_TOKEN || !STATION_ID || !DEVICE_ID)
  throw new Error("Set gateway URL, token, station ID and device ID.");
const queueFile = process.env.GATEWAY_QUEUE_FILE ?? "gateway-queue.ndjson";
const event = {
  eventId: randomUUID(),
  stationId: STATION_ID,
  type: process.argv[2] ?? "station_heartbeat",
  timestamp: new Date().toISOString(),
  sourceType: "measured",
  sourceId: DEVICE_ID,
  schemaVersion: 1,
  ...(process.argv[3] ? { sessionKey: process.argv[3] } : {}),
};
await appendFile(queueFile, JSON.stringify(event) + "\n", { mode: 0o600 });
let pending = (await readFile(queueFile, "utf8"))
  .trim()
  .split("\n")
  .filter(Boolean);
while (pending.length) {
  try {
    const r = await fetch(new URL("/api/events", GALLERYPULSE_URL), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DEVICE_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: pending[0],
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) {
      console.error(
        `Delivery stopped: HTTP ${r.status}. Payload retained; check credentials/schema before retry.`,
      );
      break;
    }
    pending = pending.slice(1);
    await writeFile(
      queueFile,
      pending.join("\n") + (pending.length ? "\n" : ""),
      { mode: 0o600 },
    );
  } catch {
    console.error("Network unavailable; buffered events retained.");
    break;
  }
}
console.log(
  `${pending.length} events pending. Single gateway writer required.`,
);
