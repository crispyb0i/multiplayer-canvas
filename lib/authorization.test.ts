import { describe, expect, it } from "vitest";
import { canAccessWorkspace, type WorkspaceIdentity } from "./authorization";

const member: WorkspaceIdentity = {
  userId: "user_1",
  organizationId: "org_1",
  organizationRole: "org:member",
};

describe("workspace authorization", () => {
  it("allows members to read and edit their active workspace", () => {
    expect(canAccessWorkspace(member, "org_1", "read")).toBe(true);
    expect(canAccessWorkspace(member, "org_1", "edit")).toBe(true);
  });

  it("keeps member management restricted to administrators", () => {
    expect(canAccessWorkspace(member, "org_1", "manage_members")).toBe(false);
    expect(
      canAccessWorkspace(
        { ...member, organizationRole: "org:admin" },
        "org_1",
        "manage_members",
      ),
    ).toBe(true);
  });

  it("rejects missing identity and cross-workspace access", () => {
    expect(
      canAccessWorkspace({ ...member, userId: null }, "org_1", "read"),
    ).toBe(false);
    expect(canAccessWorkspace(member, "org_2", "read")).toBe(false);
    expect(
      canAccessWorkspace(
        { ...member, organizationRole: "org:unknown" },
        "org_1",
        "read",
      ),
    ).toBe(false);
  });
});
