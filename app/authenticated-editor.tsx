"use client";

import { OrganizationSwitcher, useAuth, useOrganization } from "@clerk/nextjs";
import { useMemo } from "react";
import Editor from "./editor";

export default function AuthenticatedEditor() {
  const { getToken, isLoaded, isSignedIn, userId } = useAuth();
  const { organization } = useOrganization();

  // Stable credentials avoid reconnecting for unrelated Clerk renders. The key
  // below discards the replica on account/workspace changes to prevent leakage.
  const collaborationAuth = useMemo(
    () =>
      organization
        ? {
            organizationId: organization.id,
            tokenProvider: () => getToken(),
          }
        : undefined,
    [organization, getToken],
  );

  if (!isLoaded) return <p role="status">Loading workspace…</p>;
  if (!isSignedIn) return <Editor />;
  if (!organization) {
    return (
      <section className="mt-10 rounded-xl border border-white/10 bg-white/5 p-8">
        <p className="text-[0.8rem] font-bold uppercase tracking-[0.12em] text-accent">
          Workspace setup
        </p>
        <h2 className="my-3 text-3xl tracking-[-0.04em]">
          Create or join a workspace
        </h2>
        <p className="mb-6 max-w-[38rem] leading-relaxed text-muted">
          Collaboration is organized by workspace membership. Create one for
          your diagrams or accept an invitation from a teammate.
        </p>
        <OrganizationSwitcher hidePersonal />
      </section>
    );
  }
  return (
    <Editor
      key={`${userId}:${organization.id}`}
      collaborationAuth={collaborationAuth}
    />
  );
}
