# Deploy to Vercel + Neon

## Public proposal demo

After deploying and seeding the demo database, share `https://<your-domain>/demo/overview` (or the domain root). No client credentials are required. Leave `PUBLIC_DEMO_ENABLED=true` for public sample access; administrator login and all writes remain protected. Only the dedicated demo organization’s simulated records and simulated report snapshots are exposed. Set this flag to false to disable public pages and APIs. Provision real gallery users separately; never move real measurements into the demonstration organization.

The local URL cannot be shared with external clients. Publishing still requires authorized Vercel and Neon accounts and production environment variables. A working local demo does not establish that a cloud deployment has occurred.

1. Create a Neon PostgreSQL project in the appropriate region. Obtain pooled application and direct migration URLs, both with `sslmode=require`. Do not share these values.
2. Push this repository to your Git provider. Import it into Vercel as a Next.js project with Node.js 24. No Sites/Cloudflare deployment is configured because this application targets the requested Next.js runtime.
3. Set DATABASE_URL to the pooled connection, DIRECT_URL to the direct connection, NEXTAUTH_URL to the final HTTPS origin, NEXTAUTH_SECRET to a securely generated random secret, and CRON_SECRET to a different random secret. Set administrator seed variables only in a trusted provisioning environment.
4. Run `npm ci`, `npm run db:generate` and `npm run db:migrate` against the target database. Vercel’s configured build also runs migrations; use one deployment pipeline per database to avoid competing migration jobs.
5. For evaluation only, run `npm run db:seed` with ADMIN_EMAIL and ADMIN_PASSWORD (12+ characters). This creates a demo organization and only simulated events. Do not use the demonstration organization as a production tenant.
6. For a real tenant, provision Organization → Gallery → MeasurementConfiguration → User with a bcrypt cost-12 password hash through a trusted Prisma administration script or `npx prisma studio` in a secured environment. Set demo=false. No public user registration exists. Rotate any temporary password and disable direct database administration afterward.
7. Deploy. Vercel reads vercel.json: weekly `/api/cron` Monday 07:00 UTC, authorized by CRON_SECRET. Verify your Vercel plan supports the schedule and required function runtime. No provider credentials are included in the source tree.
8. Validate `/api/health`, unauthorized API 401, HTTPS sign-in/sign-out, tenant isolation, station provisioning, simulator persistence, PDF/CSV and cron authorization. Configure alerts for structured ingestion errors and `report.cron.failed` logs.
9. Enable Neon backups/restore policy, Vercel log retention/alerts, dependency scanning, edge request-size controls and a physical acceptance plan. Load-test the expected installation volume.

## Troubleshooting

- Prisma connection error: check SSL, pooled vs direct URLs, region, DB permissions and Neon availability.
- Missing tables: run `npm run db:migrate`; verify the target database before seeding.
- Login rejected: verify the seeded email/password, bcrypt hash, NEXTAUTH_URL/SECRET and consistent secrets across deployments. The seed updates a matching email’s password only; never run it with a production account email.
- Empty dashboard: select the intended source and period; simulator data appears under Synthetic data. A session duration becomes known after a consistent stop.
- Offline station: send a current heartbeat with the provisioned sourceId. Historical events do not establish connectivity.
- Missing weekly report: verify cron/plan/secret, UTC boundaries and structured errors. Retry manually with authenticated POST /api/reports. The unique period key prevents duplicate history entries.

Cloud deployment, managed Neon connectivity, cron execution on Vercel and hardware installation require external accounts and are not validated merely by a local build.
