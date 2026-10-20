# Known limitations and commissioning dependencies

The public presentation is now database-free: its synthetic dataset is packaged, read-only, fixed to 56 days ending 20 October 2026, and independent of optional database measurements. Its event stream is historical sample activity, not live monitoring. It does not accept new sessions, simulator writes, administrator login, or scheduled jobs without a configured backend. Database, hardware, backup and cron dependencies below apply to a real installation, not to deploying the public preview.

Local verification results are in [VERIFICATION.md](VERIFICATION.md), with requirement gaps in [IMPLEMENTATION-REVIEW.md](IMPLEMENTATION-REVIEW.md). The dependency audit is now available: the Vitest upgrade removed critical/moderate findings, but nine high-severity findings remain in Prisma/ESLint dependency chains. The audit is not clean; assess and remediate before commissioning. Automated browser workflows passed with installed Chromium 139; an in-app visual screenshot review was unavailable.

- No cloud account or production PostgreSQL credentials are supplied. Vercel, Neon, production cron and domain/HTTPS behavior require deployment validation.
- No physical player, dock or sensor has been identified. All hardware methods are proposals for evaluation, not claims of compatibility or measurement accuracy.
- Playback is software evidence, not proof of worn headphones, audible audio, attention or unique people. Presence is kept separate.
- Availability schedules and overlap-aware utilization are not modeled. Utilization is not displayed as a misleading derived percentage.
- Daily/report boundaries use UTC; hourly grouping uses the configured timezone. Weekday totals are visible in the heatmap, rather than a separate chart. Track performance is grouped by gateway-supplied identifiers; content-catalog management is not implemented.
- Analytics session reads are bounded by period, not row count; benchmark large installations. Event lists show up to 3,000 rows and finding lists up to 200; heartbeat coverage and event-finding totals now count the full period independently of these display limits. CSV requests exceeding 50,000 rows are rejected with an instruction to shorten the period. Report history shows the newest 30.
- Invalid request timestamps are rejected, not stored as raw measurements. There is no durable rejected-payload quarantine. Structured application errors and audit records support investigation; external observability/alerts must be configured.
- No automatic repair invents duration. Missing-end projections stay open/incomplete until evidence arrives. No estimated duration is currently supplied.
- Simulator offline buffering lasts only within the current browser tab. The gateway reference uses a durable file queue with one-writer assumptions; production firmware/outbox needs restart/power-loss testing and supervision.
- Credentials login has database-backed account rate limits, secure Auth.js cookies and server-side roles. MFA, SSO, invitation/password reset, account lifecycle UI and organization switching are not implemented. User role changes are enforced on the next request; deleted users lose API access.
- Schema does not enforce tenant isolation through PostgreSQL RLS; application predicates provide tenant isolation. Independent security review is still needed.
- No email delivery, immutable report version chain, automated retention purge or external monitoring provider is configured. Raw events and audit logs remain until an agreed retention process is added.
- Scheduled jobs process organizations sequentially. Large fleets need batch/retry orchestration within provider execution limits.
- The application is not production-certified. Security review, backup/restore drill, load tests, cloud deployment checks and physical calibration remain commissioning work.
