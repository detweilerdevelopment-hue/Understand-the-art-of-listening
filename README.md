# GalleryPulse

Gallery listening analytics with a public, read-only presentation demo and an optional PostgreSQL-backed installation.

## Run the presentation demo

Requires Node.js 24. **No database, login, secrets, migration, or seed is required.**

```powershell
npm ci
npm run dev
```

Open http://localhost:3000. The home page opens `/demo/overview` without credentials. Clients can explore charts, date filters, station comparisons, paginated sample sessions, underlying evidence, data-quality findings, and downloadable PDF/CSV reports.

The packaged sample is deterministic: four stations, 56 days of synthetic observations, and four weekly reports, anchored to 20 October 2026. Its data never represents real visitors or live hardware. Metrics and report snapshots use the same pure calculation functions as the database-backed installation. Public endpoints never import a database client. They cannot read real measurements, credentials, or other organizations.

For a production build:

```powershell
npm run build
npm start
```

Deploy the GitHub repository to Vercel with the default `vercel.json`. No environment variables or Neon account are needed for this preview. See [DEPLOYMENT.md](DEPLOYMENT.md).

## Optional real installation

PostgreSQL is required only for persisted device events, administrator login, station management, the interactive station simulator, report history, and automated reporting. Public preview data remains packaged even when the backend is connected.

1. Configure the commented backend variables in `.env.example`, using `.env` locally.
2. Start PostgreSQL; the optional local service is `npm run db:local` in a separate terminal.
3. Run `npm run db:generate`, `npm run db:migrate`, and `npm run db:seed` for an isolated demonstration tenant, or `npm run db:provision` for a production tenant.
4. Open `/login` with the configured administrator credentials.

`DEMO_ONLY=true` explicitly disables administrator/backend access even when a database URL exists. `PUBLIC_DEMO_ENABLED=false` disables public sample pages and APIs. Neither flag is required for the default presentation.

## Verification

- `npm test`: unit, component, and packaged-demo checks.
- `RUN_DB_TESTS=true npm test`: also runs real PostgreSQL integration checks (PowerShell: `$env:RUN_DB_TESTS='true'; npm test`).
- `npm run test:e2e`: public and administrator workflows; full suite requires a seeded backend.
- `npm run test:demo`: temporarily hides local dotenv files, removes database/auth credentials, builds and runs the production preview, and verifies its anonymous browser workflow. Local environment files are restored afterward. Requires an installed Playwright Chromium browser (or E2E_BROWSER_PATH).

## Project layout

```text
src/app/                 Application screens, public demo and private APIs
src/components/          Responsive dashboard, charts, login and simulator
src/lib/demo-data.ts      Packaged deterministic synthetic observations
src/lib/analytics-core.ts Shared metric and aggregation calculations
src/lib/report-format.ts Shared report snapshot, PDF and CSV formatting
src/lib/                 Optional authentication, database and ingestion services
prisma/                  Optional database schema, migrations and seed
scripts/                 Verification, local PostgreSQL and reference gateway
tests/, e2e/             Unit, integration and browser tests
.github/workflows/        CI, including a separate database-free build/job
```

[TESTING.md](TESTING.md) and [VERIFICATION.md](VERIFICATION.md) record verification. [IMPLEMENTATION-REVIEW.md](IMPLEMENTATION-REVIEW.md) compares the original requirements with current evidence and remaining gaps. [KNOWN-LIMITATIONS.md](KNOWN-LIMITATIONS.md) and the hardware/methodology guides describe commissioning requirements. The software is not a production-certified physical measurement installation.
