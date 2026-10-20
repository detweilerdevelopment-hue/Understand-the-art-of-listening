import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { rename } from "node:fs/promises";
import { resolve } from "node:path";
const saved = [];
let server;
const env = { ...process.env, NEXT_TELEMETRY_DISABLED: "1" };
for (const key of [
  "DATABASE_URL",
  "DIRECT_URL",
  "NEXTAUTH_URL",
  "NEXTAUTH_SECRET",
  "CRON_SECRET",
  "ADMIN_EMAIL",
  "ADMIN_PASSWORD",
  "PUBLIC_DEMO_ENABLED",
  "DEMO_ONLY",
])
  delete env[key];
function run(path, args = []) {
  return new Promise((res, rej) => {
    const child = spawn(process.execPath, [resolve(path), ...args], {
      env,
      stdio: "inherit",
    });
    child.on("error", rej);
    child.on("exit", (code) =>
      code === 0 ? res() : rej(new Error(`${path} exited with ${code}`)),
    );
  });
}
try {
  // Hide local dotenv files temporarily; always restore them, including failed checks.
  for (const file of [
    ".env",
    ".env.local",
    ".env.production",
    ".env.production.local",
  ]) {
    if (!existsSync(file)) continue;
    const backup = `.env.no-db-verification-${saved.length}`;
    if (existsSync(backup)) throw new Error(`Refusing to overwrite ${backup}`);
    await rename(file, backup);
    saved.push({ file, backup });
  }
  console.log(
    "Verifying a production build with no database, auth secrets, or dotenv files.",
  );
  await run("node_modules/prisma/build/index.js", ["generate"]);
  await run("node_modules/next/dist/bin/next", ["build"]);
  const port = process.env.DEMO_TEST_PORT ?? "3100";
  env.E2E_URL = `http://127.0.0.1:${port}`;
  server = spawn(
    process.execPath,
    [
      resolve("node_modules/next/dist/bin/next"),
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      port,
    ],
    { env, stdio: "inherit" },
  );
  let healthy = false;
  for (let n = 0; n < 100; n++) {
    try {
      const r = await fetch(env.E2E_URL + "/api/health");
      if (r.ok) {
        const h = await r.json();
        if (h.mode !== "packaged-demo" || h.databaseRequired !== false)
          throw new Error("Server unexpectedly requires a database");
        healthy = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  if (!healthy)
    throw new Error("Database-free production server did not become ready");
  await run("node_modules/@playwright/test/cli.js", [
    "test",
    "e2e/public-demo.spec.ts",
    "--workers=1",
  ]);
  console.log(
    "PASS: production demo, session inspection, PDF/CSV and access boundaries work without a database.",
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (server && server.exitCode === null && server.signalCode === null) {
    await new Promise((r) => {
      server.once("exit", r);
      server.kill();
    });
  }
  for (const { file, backup } of saved.reverse()) await rename(backup, file);
  console.log("Local environment files restored.");
}
