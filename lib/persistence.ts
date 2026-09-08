import { neon } from "@neondatabase/serverless";

export type WorkspaceRecord = {
  organizationId: string;
  name: string;
};

export type SnapshotRecord = {
  organizationId: string;
  documentId: string;
  snapshot: Uint8Array;
  version: number;
};

function database() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString)
    throw new Error("DATABASE_URL is required for persistence");
  return neon(connectionString);
}

export async function upsertWorkspace(
  workspace: WorkspaceRecord,
): Promise<void> {
  const sql = database();
  await sql`
    INSERT INTO workspaces (organization_id, name)
    VALUES (${workspace.organizationId}, ${workspace.name})
    ON CONFLICT (organization_id) DO UPDATE SET name = EXCLUDED.name
  `;
}

export async function loadSnapshot(
  organizationId: string,
  documentId: string,
): Promise<SnapshotRecord | null> {
  const sql = database();
  const rows = await sql`
    SELECT snapshot, version
    FROM document_snapshots
    WHERE organization_id = ${organizationId} AND document_id = ${documentId}
  `;
  const row = rows[0] as { snapshot: Uint8Array; version: number } | undefined;
  return row
    ? {
        organizationId,
        documentId,
        snapshot: row.snapshot,
        version: Number(row.version),
      }
    : null;
}

export async function saveSnapshot(record: SnapshotRecord): Promise<void> {
  const sql = database();
  await sql`
    INSERT INTO document_snapshots
      (organization_id, document_id, snapshot, version, updated_at)
    VALUES
      (${record.organizationId}, ${record.documentId}, ${record.snapshot}, ${record.version}, NOW())
    ON CONFLICT (organization_id, document_id) DO UPDATE SET
      snapshot = EXCLUDED.snapshot,
      version = EXCLUDED.version,
      updated_at = EXCLUDED.updated_at
  `;
}
