# Hardware integration and evaluation

No specific device driver is supplied or claimed as validated. `scripts/gateway.mjs` is a Node.js reference adapter for translating known player events into the public API. It persists an offline NDJSON queue, preserves IDs across retries, drains sequentially, and retains failed payloads. It assumes one writer; use a SQLite/outbox spool and a supervised service before installation. Run heartbeats every 30–60 seconds independently of interaction state.

| Method                           | Measures                                   | Tradeoff / requirement                                                                                    |
| -------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Player software callbacks        | Start, pause, resume, stop and track ID    | Strong playback evidence; requires documented player API and correctly synchronized clocks                |
| Headphone jack / USB connection  | Electrical connection                      | Does not establish that headphones are worn; adapter compatibility needs bench testing                    |
| Dock microswitch / magnetic reed | Headset removed/returned                   | Simple and private, but dock absence is only an interaction proxy; debounce and mounting required         |
| PIR motion                       | Nearby movement                            | Low-cost presence signal, not listening; false triggers and blind spots require site testing              |
| Time-of-flight proximity         | Range occupancy                            | More constrained detection; reflective surfaces and crowd flow affect performance                         |
| Raspberry Pi gateway             | Software integration and durable buffering | Needs secured OS, power/network, service supervision, updates and recovery procedures                     |
| ESP32 gateway                    | Sensor readings and heartbeats             | Compact but requires purpose-built firmware, secure credential provisioning and resilient local buffering |

Recommended evaluation sequence: identify player and headset interfaces; capture player callbacks; combine optional dock/connection evidence for context; keep motion outside listening metrics; compare raw timings against manually observed test sessions; test pauses, headphone removal, power loss, network loss, clock drift and gateway restart. Never record faces or audio to establish routine engagement metrics.

## Adapter example

1. Open a station’s Manage dialog as ADMIN and provision a gateway.
2. Securely set GALLERYPULSE_URL, DEVICE_TOKEN, STATION_ID and DEVICE_ID on the gateway. Never put its token in the browser or repository.
3. `node scripts/gateway.mjs station_heartbeat`
4. `node scripts/gateway.mjs playback_started <session-key>`
5. On pause/resume/stop invoke the corresponding event with the same session key.
6. Keep the device clock synchronized via NTP. Generate event time at observation, not delivery.

Confirm player make/model/API, headphone model and connectors, physical dock, power availability, wired/Wi-Fi policy, network egress, opening schedules, accessibility requirements and mounting permissions. Agree what the installation can defensibly call listening, the minimum engagement threshold and acceptable measurement gaps before commissioning. Obtain electrical/installation review where required.
