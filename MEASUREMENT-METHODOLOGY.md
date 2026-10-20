# Measurement methodology v1

| Metric                    | Definition                                                                                                                       |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Sessions                  | Device/station/source/session-key projections whose start falls in `[start,end)`                                                 |
| Listening duration        | Sum of observed playback intervals, excluding pauses, only after consistent end evidence                                         |
| Average / median          | Arithmetic mean / middle known duration; unknown durations excluded                                                              |
| Total hours               | Sum of known playback seconds / 3,600                                                                                            |
| Engaged-session rate      | Known durations ≥ configured threshold / all known durations; default threshold 60 s                                             |
| Prior-period change       | Session-count change against equal-length preceding period, only when prior count ≥20                                            |
| Active station            | Enabled, outside maintenance, recent heartbeat and the device?s latest session projection is active and no older than four hours |
| Connectivity              | At least one selected-source device heartbeat within 180 s by default                                                            |
| Heartbeat minute coverage | Distinct observed heartbeat station-minutes / enabled non-maintenance station-minutes across full period                         |

Coverage counts distinct station-heartbeat minutes across the complete selected period, independently of the bounded event display. It is a measure of observed minute coverage, not calibrated sensor uptime. Heartbeat cadence should be one minute or faster. Current enabled/maintenance state is used for the whole selected period; historical opening schedules and historical availability are not modeled. Utilization is intentionally not reported without validated availability intervals and overlap handling.

Playback started/resumed opens a segment; pause/stopped/session-ended closes it. Playback events require a session key. An explicit session envelope without playback produces unknown duration. Presence, dock, and connection signals alone never establish listening duration. A stop is an **ended interaction**, not evidence of audio completion. Pauses may last indefinitely until a final event arrives; missing ends remain unknown. Sessions over four hours of wall-clock span or with conflicting transitions remain unknown. Device clock synchronization is required.

Source types: `measured`, `simulated`, `inferred`. Confidence: `confirmed`, `simulated`, `incomplete`. Inferred events remain classified but are not included in measured or synthetic dashboard queries. Estimated duration is not currently implemented. No inferred/estimated value is silently substituted.

Event identity is device scoped. Late events rebuild projections, while original delivery flags remain available. Invalid schema timestamps and timestamps >5 minutes into the future are rejected with 400; invalid requests are not stored as measurements. Delivery >5 minutes late is flagged. Out-of-order delivery is flagged and corrected in projection order. Duplicate counters preserve retry evidence. Missing ends and conflicting session events are visible in session flags.

Daily chart periods and weekly scheduled report boundaries use UTC. Hourly/weekday grouping uses the organization’s IANA reporting timezone (default America/Denver). Date inputs represent inclusive UTC calendar days. Reports contain exact ISO boundaries and timezone. Local display labels use America/Denver. No unique-person inference, recordings, images, or biometric identification are collected. Playback does not prove worn headphones or visitor attention. No accuracy claim is made.

For stable report snapshot storage, mean/median seconds use three decimal places; hours and engagement ratios use six. UI formatting may show fewer places.
