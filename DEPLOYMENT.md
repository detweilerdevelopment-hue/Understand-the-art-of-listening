# Deploy the public demo to Vercel

The public presentation now works **without PostgreSQL, Neon, login credentials, or environment variables**.

1. Open https://vercel.com/new and import `detweilerdevelopment-hue/Understand-the-art-of-listening` from GitHub.
2. Choose Next.js, the repository root, and Node.js 24.
3. Keep the build command as `npm run build`. The default `vercel.json` already selects it. Remove any older build override that runs `prisma migrate deploy`.
4. Leave environment variables empty. No database URL, auth secret, administrator password, or cron secret is required for this demo.
5. Click Deploy and share the production domain root or `/demo/overview`.
6. Open that URL in a private browser window to confirm anonymous access. If Vercel itself asks for authentication, review its Deployment Protection settings and use the intended public production URL.

Sample charts, date filters, session pagination, event evidence and PDF/CSV downloads work from deterministic packaged data. Writes, administrator login, live hardware, and real visitor measurements are unavailable in this mode. The sample dataset is anchored to 20 October 2026 and its time labels describe historical synthetic activity.

`PUBLIC_DEMO_ENABLED=false` disables public pages/APIs. This optional flag is not needed for the normal presentation. `DEMO_ONLY=true` can explicitly disable backend access if an existing project already has database variables.

## Optional database-backed installation

For a real gallery installation:

1. Provision PostgreSQL (for example, Neon), with a pooled DATABASE_URL and direct DIRECT_URL, both using SSL.
2. Configure NEXTAUTH_URL with the HTTPS domain, random NEXTAUTH_SECRET and CRON_SECRET, and administrator provisioning variables in a trusted environment. Keep secrets out of Git and browser bundles.
3. Run `npm run db:generate` and `npm run db:migrate` against that database. Default demo deployment no longer runs migrations automatically.
4. For evaluation, `npm run db:seed` creates the isolated database demonstration tenant; public pages still use packaged samples. For production, set GALLERY_NAME, ADMIN_EMAIL and ADMIN_PASSWORD (12+ characters) and run `npm run db:provision`. It will not overwrite existing accounts.
5. Enable scheduled reporting by copying the cron/build configuration from `vercel.database.json` to the active `vercel.json`, or configuring its `/api/cron` Monday 07:00 UTC schedule in your deployment setup. CRON_SECRET must be configured for these authenticated jobs. This optional configuration runs migrations during the build.
6. Validate HTTPS login, organization isolation, credentials, ingestion, simulator persistence, exports, cron, backups and monitoring. Complete security/load/hardware acceptance before commissioning.

## Troubleshooting

- Database error during a demo build: remove a legacy `prisma migrate deploy` build override; use the repository's current default configuration.
- Unexpected administrator tools in a demo deployment: remove inherited database settings or set DEMO_ONLY=true. The public dataset is still independent of that backend.
- Empty demo: remove PUBLIC_DEMO_ENABLED=false. No database seed is required.
- Optional backend unavailable: check SSL, pooled/direct URLs, migration status and database availability.
- Local startup: `npm run dev` is sufficient for the public demo. PostgreSQL needs its own running service only for backend operations.

Cloud deployment itself is not claimed until a provider returns a successful deployment URL. Physical hardware and operational validation remain separate commissioning work.
