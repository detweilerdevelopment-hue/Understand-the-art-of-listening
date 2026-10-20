# API contracts

## Public read-only demonstration

`GET /api/demo/analytics`, `/api/demo/sessions` and `/api/demo/reports` are database-free, anonymous read endpoints over packaged synthetic data only. They never import a database client or query the optional installation. Sample session/report IDs are checked against that dataset. Requests for measured data are forbidden; writes have no public handlers (405). There is no public settings, credentials, reset, provisioning or report-generation endpoint. PDF/CSV downloads are generated from packaged observations and shared calculations. Disable access with PUBLIC_DEMO_ENABLED=false.

## Device ingestion

`POST /api/events`, `Authorization: Bearer gp_<token>`, JSON:

```json
{
  "eventId": "gateway-unique-uuid",
  "stationId": "station-id",
  "type": "playback_started",
  "timestamp": "2026-10-20T16:30:00.000Z",
  "sourceType": "measured",
  "sourceId": "provisioned-device-id",
  "schemaVersion": 1,
  "sessionKey": "persistent-interaction-uuid",
  "metadata": { "trackId": "content-id" }
}
```

Fields are validated with Zod. Metadata accepts flat string/number/boolean/null values. The server assigns ingestion time. Playback/session events require a sessionKey. Supported types: station_heartbeat, presence_detected, presence_ended, headphones_connected, headphones_disconnected, playback_started, playback_paused, playback_resumed, playback_stopped, session_started, session_ended.

Success: `{ "duplicate": false, "id": "raw-event-id" }`, 200. Identical retry: duplicate true, 200. Retry with the original event ID; never assign new IDs to retransmissions. 400 invalid schema/future timestamp/conflicting event identity (including changed source classification); 401 invalid or revoked token; 403 source/station mismatch; 413 body larger than 16 KiB; 429 >180 accepted attempts/device/minute; 503 backend disabled; 500 storage/processing error. Retry 429/5xx with exponential backoff and jitter after checking backend configuration. Fix 400/401/403/413 before retrying. Actual streamed bytes are bounded, including missing or false Content-Length headers. Application JSON mutation endpoints use the same 16 KiB bound.

## Authenticated workspace APIs

Auth.js session required for every route below. Browser writes require a same-origin request. ADMIN or ANALYST writes except where indicated.

| Route                         | Contract                                                        |
| ----------------------------- | --------------------------------------------------------------- |
| GET /api/analytics            | `start`, `end` ISO timestamps, `source=measured` or `simulated`; max 93 days |
| GET /api/sessions             | Above plus `page`, `sort=asc` or `desc`, optional `station`, `status` |
| GET /api/sessions?id=…        | Scoped session + ordered raw evidence                           |
| POST /api/stations            | `id?`, name, location, hardware, enabled, maintenance           |
| POST /api/devices             | ADMIN: stationId, name; returns deviceId and one-time token     |
| DELETE /api/devices           | ADMIN: deviceId; revokes all device tokens                      |
| POST /api/simulator           | Same event contract; sourceId/sourceType overridden server-side |
| DELETE /api/simulator         | Deletes only scoped simulated measurements/reports; audited     |
| POST /api/config              | ADMIN: engagedSeconds 10–3600, heartbeatTimeoutSeconds 60–3600  |
| POST /api/reports             | start, end, source; stores/regenerates period snapshot          |
| GET /api/reports?id=…         | PDF download of saved snapshot                                  |
| GET /api/reports?format=csv&… | Scoped rows; 413 above 50,000 (shorten period); formulas escaped |

`GET /api/health` returns status only, 200 or 503. `GET /api/cron` requires `Authorization: Bearer <CRON_SECRET>`, generates the prior complete UTC week and returns generated/failed counts. Login: Auth.js `/api/auth/*` CSRF-protected credential flow. Rate limits are shared PostgreSQL minute buckets, not in-memory counters.
