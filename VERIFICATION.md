# Local verification — 20 October 2026

## Requirements review and hardening (latest)

See [IMPLEMENTATION-REVIEW.md](IMPLEMENTATION-REVIEW.md) for the requirement matrix, fixes, missing functionality and commissioning gates. These results supersede the historical counts below.

- **36 tests passed, zero skipped**, using Vitest 4.1.11 and `RUN_DB_TESTS=true`, `DEMO_ONLY=false`, against actual local PostgreSQL 18. This includes eight PostgreSQL integration cases, streamed-body limits, disabled-backend write guards, report/export boundaries, and full-period coverage/findings beyond display caps.
- Strict TypeScript and ESLint passed. The Vitest configuration uses an explicit ESM `.mts` file to avoid the Vite configuration compatibility warning.
- `npm run test:demo` passed: Prisma generation, optimized Next.js build, production health and anonymous Playwright workflow, with dotenv files hidden and database/auth environment variables removed. Environment files were restored.
- The optional backend production build (`DEMO_ONLY=false npm run build`) also passed. **All four Playwright workflows passed against `next start`**, covering login hydration, authenticated station registration, persisted simulator events, report downloads, analytics navigation, source separation, theme, mobile layout and the anonymous demo.
- The updated Playwright CI startup path was exercised locally with `CI=true`: it started its own production server, refused server reuse, and all four workflows passed. This is local CI-configuration evidence, not a claim that GitHub Actions ran.
- `npm audit` now succeeds in retrieving advisory data but **exits nonzero**: nine high-severity findings remain after upgrading Vitest from 3.2.7 to 4.1.11. Critical findings decreased from two to zero; moderate from one to zero. This is not a clean dependency audit.

Remaining audit chains: Prisma 6.19 → @prisma/config → deepmerge-ts/effect; eslint-config-next → @next/eslint-plugin-next → fast-glob/micromatch/braces. `npm audit --omit=dev` still reports four high entries in the Prisma chain (the CLI can be included through the client peer relationship). The supplied fixes propose a Prisma major upgrade and an incompatible Next ESLint downgrade; neither was forced into this application without migration and compatibility work. Review advisory reachability and remediate before production commissioning. Relevant advisories: [DeepmergeTS](https://github.com/advisories/GHSA-ggr8-5vv4-36mx), [Effect](https://github.com/advisories/GHSA-38f7-945m-qr2g), [braces](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).

No hosted deployment, remote CI run, hardware calibration, backup/restore drill or independent security review is claimed.

## Database-free presentation update

Latest checks: **30 unit/component/integration tests passed**, **4 browser workflows passed**, strict TypeScript and ESLint passed, and the credential-free production build/browser check passed with no required application environment variables.

A production Next.js build and anonymous Playwright workflow passed after local dotenv files were temporarily removed and database/auth credentials were unset. The production health endpoint confirmed packaged-demo mode. Public analytics, session pagination, evidence, real PDF/CSV downloads, anonymous navigation and access restrictions no longer query PostgreSQL. `test:demo` restores local environment files after the check. Packaged fixture tests additionally fail if the public demo imports a database client. The default Vercel build no longer runs migrations or configures cron. The historical database-backed results below remain relevant to the optional installation.

## Public demo update

The root now opens `/demo/overview` without login. Latest checks passed: **25 unit/component/PostgreSQL integration tests**, **4 Playwright workflows**, strict TypeScript, ESLint, and a production Next.js build. Public API tests verify rejection of measured sources, private organization session/report IDs, measured reports even inside the demo organization, and anonymous write requests. Public navigation and saved PDF/CSV downloads work without cookies or credentials. The administrator workflow still verifies station management and real persisted simulator events. Login and simulator controls wait for hydration before accepting submissions. Vercel and Neon connections were discovered but are not installed/authorized; no cloud deployment is claimed.

Verified on Windows with Node.js 24.15, Next.js 16.4.2, Prisma 6.19 and actual local PostgreSQL 18.

| Check                                     | Result                                                                                                      |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Dependency installation                   | Passed after retrying a registry connection reset; lockfile included                                        |
| Prisma schema / generated client          | Passed                                                                                                      |
| Migration deployment                      | Passed, 14 application tables                                                                               |
| Database vs Prisma schema diff            | No difference                                                                                               |
| Deterministic seed                        | 6,099 synthetic sessions, 16,606 raw observations, four gallery stations and four historical weekly reports |
| TypeScript strict check                   | Passed                                                                                                      |
| ESLint                                    | Passed without warnings                                                                                     |
| Unit / component / PostgreSQL integration | 24 passed, none skipped with RUN_DB_TESTS=true                                                              |
| Production build                          | Passed                                                                                                      |
| Playwright workflows                      | 2 passed                                                                                                    |
| Production HTTP smoke                     | Login 200, health 200, unauthenticated analytics 401                                                        |
| Dependency vulnerability audit            | Not completed: npm advisory endpoint returned ECONNRESET                                                    |

Playwright used the installed Chromium 139 executable through E2E_BROWSER_PATH. The latest Playwright browser download was stopped after the installed browser successfully verified the workflows. CI uses the normal `playwright install` flow. The in-app browser connector reported no available browser; no visual screenshot review through that connector was performed.

End-to-end checks covered credentials login, station registration, playback start/pause/resume/stop, persisted session visibility, PDF download, CSV response, every analysis view, measured/synthetic source selection, dark theme, mobile navigation and no horizontal page overflow at 390px. No uncaught browser errors were observed in the navigation workflow.

Integration checks exercised real PostgreSQL writes, out-of-order reconstruction, device-event deduplication including reordered metadata keys, organization isolation, invalid/revoked credentials, invalid timestamps, matching dashboard/report metrics, PDF bytes and duplicate-report prevention. An initial floating-point snapshot mismatch was corrected by defining metric precision. A Windows DLL-lock conflict occurred when client generation and tests ran concurrently; sequential build passed afterward.

Owned QA stations and generated test reports were removed from the demonstration organization after verification. Seed measurements and audit history were retained. Future E2E runs intentionally leave their QA station; use an expendable test database as documented.

Not validated: Vercel deployment, Neon connectivity, hosted cron, external observability, backups/restore, physical hardware, measurement accuracy, large-fleet performance and independent security review. See KNOWN-LIMITATIONS.md.
