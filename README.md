# GalleryPulse

A Next.js application for auditable gallery listening analytics. PostgreSQL is authoritative for events, reconstructed sessions, credentials, configuration and report snapshots. Synthetic measurements remain explicitly classified and filtered independently from measured observations.

The home page now opens a **public, read-only demo** at `/demo/overview`. Clients can explore synthetic analytics, session evidence, and saved PDF/CSV samples without credentials. Administrator tools remain at `/login`. Public access is fixed to the seeded `gallery-demo` organization with `demo=true`; it cannot read measured data or another organization. Set `PUBLIC_DEMO_ENABLED=false` to disable the public demo. Demo date filters initially follow the latest sample observation so the presentation remains useful as the seed ages.

## Local setup

Requires Node.js 24 LTS and PostgreSQL (local, Neon, or the optional embedded development server). No Docker required.

```powershell
npm ci
Copy-Item .env.example .env
# Edit .env: set a random NEXTAUTH_SECRET, ADMIN_EMAIL and a strong ADMIN_PASSWORD.
npm run db:local
```

Keep that terminal open. In another terminal:

```powershell
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Visit http://localhost:3000 and sign in using the administrator credentials you configured. The seed creates an isolated **demo organization**, four stations, 56 calendar days of reproducible sample activity, known missing-end cases, duplicate/delivery findings, and four historical weekly reports. The seed is idempotent. A fixed `SEED_END=2026-10-20` reproduces the same anchor date. Samples after the execution time are omitted.

## Implemented flows

- Protected workspace, Auth.js credentials login, database-backed roles and organization scoping.
- Executive metrics, playback trends, duration distribution and local-hour heatmap.
- Station registration/editing, device provisioning/revocation and heartbeat health.
- Polling live activity and server-paginated session explorer with source-event inspection.
- Interactive simulator using the real ingestion service, pauses, sensor toggles, tab-local offline queue and synthetic reset.
- CSV exports, server-generated PDF, immutable-until-regenerated report snapshots and retry-safe weekly cron.
- Measurement configuration, data quality and methodology views; light/dark themes and mobile layout.

## Layout

```text
src/app/                 App Router screens and API handlers
src/components/          Application shell, views, charts and shadcn-style button
src/lib/                 Authentication, ingestion, projection, analytics, reporting
prisma/                  PostgreSQL schema, migrations and reproducible seed
scripts/                 Optional local PostgreSQL and reference gateway
tests/                   Unit, component and PostgreSQL integration tests
e2e/                     Playwright end-to-end workflow
.github/workflows/        PostgreSQL-backed CI checks
```

Environment variables are listed in `.env.example`; deployment details are in [DEPLOYMENT.md](DEPLOYMENT.md). See [TESTING.md](TESTING.md) for verification and [KNOWN-LIMITATIONS.md](KNOWN-LIMITATIONS.md) before commissioning. This is a software foundation, not a certified physical measurement installation.
