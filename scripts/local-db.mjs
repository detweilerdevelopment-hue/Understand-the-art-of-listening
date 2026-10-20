import "dotenv/config";
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
const postgres = new EmbeddedPostgres({
  databaseDir: ".local-db",
  user: "gallerypulse",
  password: "gallerypulse",
  port: 54329,
  persistent: true,
  initdbFlags: ["--encoding=UTF8"],
});
if (!existsSync(".local-db/PG_VERSION")) await postgres.initialise();
await postgres.start();
const client = postgres.getPgClient();
await client.connect();
try {
  const existing = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", ["gallerypulse"]);
  if (!existing.rowCount) await client.query('CREATE DATABASE "gallerypulse"');
} finally { await client.end(); }
console.log(
  "Local PostgreSQL ready on localhost:54329. Keep this terminal open.",
);
const stop = async () => {
  await postgres.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 60000);
