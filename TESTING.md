# Verification

## Database-free production check

Run `npx playwright install chromium`, then `npm run test:demo`. It temporarily moves recognized local dotenv files aside, removes backend/auth environment variables, generates Prisma types without a database connection, builds Next.js, starts a production server on port 3100, and runs the anonymous public workflow. It restores local dotenv files afterward. Stop local Next.js processes first on Windows to avoid a native engine DLL lock during client generation. E2E_BROWSER_PATH may point to an existing Chromium executable. The CI `demo-without-database` job has no PostgreSQL service or database/auth credentials.

`tests/demo-data.test.ts` rejects any import of a database client and checks sample metrics, date/station filters, pagination, raw evidence, report consistency, real PDF/CSV bytes and access restrictions. Backend integration checks are optional and skipped unless RUN_DB_TESTS=true.

`e2e/public-demo.spec.ts` verifies anonymous navigation, sample PDF/CSV downloads, hidden administration controls, and denial of measured sources and private write endpoints. PostgreSQL integration tests also check that exact private session/report IDs and measured reports in the demo organization cannot be accessed through public demo APIs. Database integration tests require the demonstration seed for these assertions.

Actual local results are recorded in [VERIFICATION.md](VERIFICATION.md). To use an existing Chromium installation for the automated suite, set E2E_BROWSER_PATH to its executable; otherwise install the browser version supplied by Playwright.

```powershell
npm run db:generate
npm run typecheck
npm run lint
npm test
$env:RUN_DB_TESTS='true'
$env:DEMO_ONLY='false'
npm run test:integration
npm run build
npx playwright install chromium
npm run test:e2e
```

Unit tests exercise paused duration, event-time ordering, missing evidence, transition conflicts, maximum session length, source classification, schema validation, engagement denominators and heartbeat health. The component test verifies disabled action behavior using React Testing Library.

PostgreSQL integration tests require `.env` and an initialized database. They create an isolated randomly named organization and clean its data afterward. They verify real persistence, duplicate idempotency, late-arrival reconstruction, organization/source rejection, shared report metrics, PDF bytes and period-key deduplication. Without RUN_DB_TESTS=true they are explicitly skipped, not claimed as passing.

Playwright requires seeded ADMIN_EMAIL/ADMIN_PASSWORD. It verifies unauthenticated denial, credentials login, station creation, playback start/pause/resume/stop, persisted session appearance and a PDF download. The test leaves its QA station and simulated measurements in the demo organization. Use an expendable test database. Browser availability depends on the execution environment.

CI supplies a real PostgreSQL 17 service and runs migration, seed, typecheck, lint, tests, build and Playwright. In CI, Playwright starts the production server from that build and refuses to reuse an unrelated server. Locally it starts development unless E2E_URL targets a separately started server. Review the CI result on your actual provider; adding a workflow does not mean it has run remotely.

Physical acceptance is separate: compare gateway observations against known timed playback, network disconnects, buffering, restarts, power failure and clock skew. Document observed error rates rather than inventing accuracy percentages. See KNOWN-LIMITATIONS.md for unresolved operational validation.
