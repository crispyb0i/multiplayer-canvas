export type WorkspaceRole = "org:admin" | "org:member";
export type WorkspacePermission = "read" | "edit" | "manage_members";

export type WorkspaceIdentity = {
  userId: string | null;
  organizationId: string | null;
  organizationRole: string | null;
};

const rolePermissions: Record<WorkspaceRole, readonly WorkspacePermission[]> = {
  "org:admin": ["read", "edit", "manage_members"],
  "org:member": ["read", "edit"],
};

// The room id is not authorization. Compare the requested workspace with the
// server-verified active organization before checking role permissions; this
// prevents a valid user from selecting another organization's room by URL.
export function canAccessWorkspace(
  identity: WorkspaceIdentity,
  requestedOrganizationId: string,
  permission: WorkspacePermission,
): boolean {
  if (
    !identity.userId ||
    !identity.organizationId ||
    identity.organizationId !== requestedOrganizationId
  )
    return false;

  const permissions =
    rolePermissions[identity.organizationRole as WorkspaceRole];
  return permissions?.includes(permission) ?? false;
}
