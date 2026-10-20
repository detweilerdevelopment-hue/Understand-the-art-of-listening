# Local verification — 20 October 2026

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
