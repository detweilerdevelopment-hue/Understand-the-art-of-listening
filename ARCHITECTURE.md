# Architecture

## Data flow

Player/sensor gateway → HTTPS `/api/events` → credential lookup + organization/station scope → Zod schema → PostgreSQL transaction → raw event + delivery flags → event-time session projection → shared analytics → dashboard / saved report → PDF or CSV.

Simulator → authenticated `/api/simulator` → same `ingest()` service → same persistence and projection. Simulator source fields are forced by the server. A real credential cannot submit simulated data and vice versa.

The application is a single Next.js App Router deployment. PostgreSQL handles shared rate buckets, concurrency, persistence and report deduplication. No analytics state depends on a warm server process. Live activity polls every five seconds. Gateway tokens are random 256-bit values, stored only as SHA-256 hashes; administrator passwords use bcrypt with cost 12. Auth.js JWT cookies expire after eight hours; role and organization are read from the database on every protected request.

## Concurrency and audit

Ingestion locks the station row within a serializable transaction. `(deviceId, eventId)` is unique. Matching retries increment a counter; changed type, time, session key or metadata is rejected. Serialization/uniqueness conflicts retry up to four attempts. A late observation causes reconstruction of the full affected device/session group in event-time order. Raw observations remain immutable apart from duplicate counters.

Each session stores source event IDs, flags and classification. Reports store a versioned-in-time JSON snapshot of the shared analytics output; regenerating the same organization/period/source replaces that snapshot and generation timestamp. Export and administrative changes create audit records. Device heartbeat updates are monotonic.

## Isolation and roles

Users belong to an organization; galleries/stations/devices inherit that scope. API queries constrain organization through station → gallery relations. `ADMIN` manages credentials, rules and stations; `ANALYST` manages stations, simulator and reports; `VIEWER` reads dashboards, evidence and authorized exports. The database itself is trusted server-side infrastructure; row-level database policies are not configured. Do not expose PostgreSQL directly to clients.

## Limits and retention

Session pages use 20-row server pagination. Live/chart event reads are bounded at 3,000; event flags at 200; report history at 30; CSV at 50,000. Coverage can therefore undercount and is labeled conservative. Session metrics currently read all sessions in a maximum 93-day query: add SQL aggregates/materialization after volume testing. Raw events, reports and audits have no automatic destructive retention; agree retention with the client before commissioning. Rate buckets expire and cron cleans old buckets.

No email service, streaming process, job queue or unidentified hardware driver is implied. Cron processes organizations sequentially; larger installations need bounded batches and deployment-specific runtime testing.
