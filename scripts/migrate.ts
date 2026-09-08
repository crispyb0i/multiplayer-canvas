import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());
const connectionString = process.env.DATABASE_URL ?? "";
if (!connectionString)
  throw new Error("DATABASE_URL is required to run migrations");

async function main(): Promise<void> {
  const sql = neon(connectionString);
  const migrationDirectory = join(process.cwd(), "migrations");
  const files = (await readdir(migrationDirectory))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  // Migrations are ordered files so a fresh database and an existing database
  // follow the same deterministic history; each file is recorded after success.
  await sql`CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`;

  for (const file of files) {
    const version = file.replace(/\.sql$/, "");
    const existing =
      await sql`SELECT version FROM schema_migrations WHERE version = ${version}`;
    if (existing.length > 0) continue;

    const contents = await readFile(join(migrationDirectory, file), "utf8");
    await sql.unsafe(contents);
    await sql`INSERT INTO schema_migrations (version) VALUES (${version})`;
    console.log(`Applied ${version}`);
  }
}

void main();
