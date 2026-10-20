# Client handoff

For a proposal presentation, share the hosted domain root or `/demo/overview`. It opens a read-only synthetic workspace without credentials. Visitors can browse analytics and evidence and download saved sample PDF/CSV reports. Administrator tools and live measurements remain behind `/login`. Until hosting is connected, use http://localhost:3000/demo/overview only on this computer; external clients cannot reach a localhost address.

Sign in with the workspace credentials provided by your administrator. Start on Executive overview. Select reporting dates and Synthetic or Measured data; every view and export follows that selection. Synthetic observations never represent actual visitors.

Register a station with a name, physical location and integration description. Under Manage, administrators can provision a gateway token, which is displayed once. Transfer it securely to the gateway operator. Revoke it if exposed. A station stays offline until current heartbeat evidence arrives. Maintenance status is explicit.

Use the simulator before connecting equipment: choose a station, start, pause/resume and stop. Check Session explorer to inspect the actual persisted observations. Toggle connectivity to buffer and replay events; keep that tab open. The displayed clock previews playback time; the backend calculates the final duration from event timestamps.

Review Data quality for ingestion findings and Session explorer for missing starts/ends or conflicting evidence. An unknown duration is intentional. A playback stop means ended, not completed content. Session counts do not imply unique visitors or attention.

Generate report exports for the selected period. PDFs include definitions, source classification, generation time, quality and limitations. Historical PDFs use saved snapshots; explicit regeneration replaces a matching period/source snapshot. CSV provides up to 50,000 sessions. Weekly reports require a live Vercel cron deployment; email delivery is not implemented.

ADMIN controls thresholds and heartbeat timeout in Workspace settings. A simulation reset removes only synthetic events, sessions and reports within your organization; real data is preserved. To restore samples, an operator runs the seed script. Agree backup, retention, credential rotation and incident ownership before the gallery opens.
