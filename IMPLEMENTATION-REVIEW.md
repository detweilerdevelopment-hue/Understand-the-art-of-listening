# Implementation review — 20 October 2026

Scope: compare the original GalleryPulse brief with the current repository, while preserving the later request for a public presentation that requires no login or database. The presentation and the optional installation have different capabilities. Neither is a commissioned gallery measurement system.

## Requirements and evidence

| Requirement | Current evidence | Remaining work |
| --- | --- | --- |
| Foundation and normalized PostgreSQL schema | App Router, strict TypeScript, Prisma schema/migration, actual local PostgreSQL integration tests | Validate migrations and connectivity against hosted Neon |
| Authentication, roles, organization isolation | Browser login flow; role guard tests; integration tests for tenant isolation and device scope | Broader route-by-route multi-tenant adversarial testing, independent security review; MFA/account lifecycle UI absent |
| Stations | Browser registration flow; scoped create/edit endpoint, locations, enable/maintenance controls and heartbeat health | Broader edit/disable/credential browser coverage and physical timeout validation |
| Ingestion and reconstruction | Real persistence, late arrivals, duplicates, conflicting retries, timestamp validation and revoked credential tests | Durable rejected-event quarantine absent; physical gateway power-loss/clock tests pending |
| Analytics | Shared calculations and dashboard/report equality tested against PostgreSQL | Availability schedules and overlap-aware utilization absent; large-volume benchmark pending |
| Live monitoring | Private polling over persisted events; public page explicitly historical samples | No physical event stream verified; operational alert provider absent |
| Sessions and quality | Filters, pagination, session evidence browser flow; measurement edge-case unit tests | Event list and findings remain bounded display samples; comprehensive historical anomaly browsing absent |
| Reporting | Real PDF and CSV downloads, database snapshot equality and retry-safe period key tested | Hosted cron unverified; email absent; report snapshots can be regenerated rather than immutable versioned |
| Simulator | Private browser start/pause/resume/stop produces persisted sessions through ingestion | Public database-free demo remains read-only and has no interactive simulator; browser buffer is lost on tab closure |
| Public demonstration | Deterministic packaged synthetic data, no database import test, anonymous browser workflow | Fixed historical date anchor; no public mutations or real hardware claims |
| Hardware architecture | Authenticated API and example durable gateway, evaluation/installation guidance | Specific player/sensors unspecified; no drivers or measurement accuracy validated |
| Deployment and operations | Vercel configuration, optional database configuration, CI workflow, local production verification command | No deployed URL, hosted CI result, backup restore drill, retention purge, load test or cloud monitoring evidence |
| Accessibility/design | Automated theme, mobile navigation and overflow checks | Full keyboard/screen-reader and manual visual review pending |

## Priority fixes in this review

- Enforce actual streamed request bytes instead of trusting Content-Length. Apply the shared bound to application JSON mutation endpoints.
- Reject duplicate event identities that change source classification, source identity or schema version.
- Make DEMO_ONLY disable both device ingestion and scheduled writes even when database settings/secrets exist.
- Count heartbeat minutes and event findings across the entire period. Display limits must not become metric/report totals. PostgreSQL regression fixture exceeds both former caps (3,101 events; 205 findings).
- Return a validation error for an invalid end date with no start date, rather than an internal error while computing its default.
- Refuse oversized CSV exports with a shorter-period instruction instead of silently truncating at 50,000 rows.

The dependency audit became available during this review and initially reported 12 advisories (two critical, nine high, one moderate). Dependency remediation and final verification results are recorded in VERIFICATION.md; an installed package or a passing unit test alone is not evidence of a clean security audit.

## Next phase: deployment and commissioning

The public presentation can be checked locally without any provider credentials using `npm run test:demo`. Publish it to Vercel only after reviewing the verification and advisory results. A successful local production build does not establish a successful cloud deployment.

For the optional real installation, provision a separate PostgreSQL database and secure environment, then validate HTTPS login, scoped ingestion, exports, cron retries, backups/restore and monitoring on the hosted system. Obtain the client's player/sensor details and run timed playback, disconnect, power-loss and clock-skew trials before accepting measurement claims. These are outstanding acceptance gates, not completed phases.
