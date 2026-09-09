import { neon } from "@neondatabase/serverless";
import { createDocument } from "../lib/document";
import { saveSnapshot, upsertWorkspace } from "../lib/persistence";
import { createYDocument, encodeYjsState } from "../lib/yjs-document";

loadEnvConfig(process.cwd());

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  const organizationIdFromEnv = process.env.PERF_ORGANIZATION_ID;
  const documentId = "demo";
  const shapeCount = 1_000;

  if (!connectionString) {
    throw new Error("DATABASE_URL required performance seed");
  }

  const sql = neon(connectionString);

  // Reusing an existing workspace keeps the seed aligned with the authenticated
  // editor while allowing CI or a local developer to select an explicit tenant.
  const organizationId =
    organizationIdFromEnv ??
    (
      await sql`
        SELECT organization_id
        FROM workspaces
        ORDER BY created_at ASC
        LIMIT 1
      `
    )[0]?.organization_id;

  if (!organizationId || typeof organizationId !== "string") {
    throw new Error(
      "No workspace found; set PERF_ORGANIZATION_ID before seeding",
    );
  }

  const shapes = Array.from({ length: shapeCount }, (_, index) => ({
    type: "rectangle" as const,
    id: `profile-shape-${index}`,
    x: (index % 50) * 24,
    y: Math.floor(index / 50) * 18,
    width: 120,
    height: 80,
    fill: "#fff",
  }));

  // Seed the same binary snapshot that the collaboration server persists. This
  // measures real restore behavior instead of creating a parallel test format.
  const snapshot = encodeYjsState(createYDocument(createDocument(shapes)));
  await upsertWorkspace({ organizationId, name: organizationId });
  await saveSnapshot({
    organizationId,
    documentId,
    snapshot,
    version: 1,
  });

  console.log(
    JSON.stringify({
      documentId,
      shapes: shapeCount,
      bytes: snapshot.byteLength,
    }),
  );
}

void main();
import { loadEnvConfig } from "@next/env";
