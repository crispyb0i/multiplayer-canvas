CREATE TABLE IF NOT EXISTS workspaces (
  organization_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_snapshots (
  organization_id TEXT NOT NULL REFERENCES workspaces(organization_id) ON DELETE CASCADE,
  document_id TEXT NOT NULL,
  snapshot BYTEA NOT NULL,
  version BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, document_id)
);
