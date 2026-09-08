"use client";

import { OrganizationSwitcher, useAuth, useOrganization } from "@clerk/nextjs";
import Editor from "./editor";

export default function AuthenticatedEditor() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { organization } = useOrganization();

  if (!isLoaded) return null;
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
      collaborationAuth={{
        organizationId: organization.id,
        tokenProvider: () => getToken(),
      }}
    />
  );
}
