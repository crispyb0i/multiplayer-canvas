import {
  OrganizationSwitcher,
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";
import Editor from "./editor";
import AuthenticatedEditor from "./authenticated-editor";

export default function Home() {
  // The public landing page stays usable without an account; authenticated
  // workspace access is enforced separately by the collaboration service.
  const clerkConfigured = Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  );

  return (
    <main className="mx-auto max-w-[1100px] px-4 py-8 sm:px-8 sm:py-12">
      {clerkConfigured && (
        <header className="mb-8 flex items-center justify-between">
          <SignedIn>
            <div className="flex items-center gap-4">
              <OrganizationSwitcher hidePersonal />
              <UserButton />
            </div>
          </SignedIn>
          <SignedOut>
            <div className="ml-auto flex items-center gap-3">
              {/* Modal auth needs an explicit local destination; otherwise Clerk
                  falls back to its hosted accounts.dev redirect page. */}
              <SignInButton mode="modal" fallbackRedirectUrl="/">
                <button className="rounded-md px-4 py-2 text-sm text-muted hover:text-ink">
                  Sign in
                </button>
              </SignInButton>
              <SignUpButton mode="modal" fallbackRedirectUrl="/">
                <button className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-bg hover:opacity-90">
                  Sign up
                </button>
              </SignUpButton>
            </div>
          </SignedOut>
        </header>
      )}
      <p className="text-[0.8rem] font-bold uppercase tracking-[0.12em] text-accent">
        Real-time diagramming
      </p>
      <h1 className="my-4 text-[clamp(3rem,8vw,6rem)] tracking-[-0.06em]">
        Multiplayer Canvas
      </h1>
      <p className="max-w-[38rem] text-xl leading-relaxed text-muted">
        Sketch an idea. Move it forward together. Try the canvas below, or sign
        in to collaborate in a shared workspace.
      </p>
      {clerkConfigured ? <AuthenticatedEditor /> : <Editor />}
      <footer className="mt-8 border-t border-white/10 pt-5 text-sm leading-relaxed text-muted">
        Built with Next.js, TypeScript, and Yjs. Shared workspaces add live
        presence and offline sync.
      </footer>
    </main>
  );
}
