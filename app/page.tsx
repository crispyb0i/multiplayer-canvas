import {
  OrganizationSwitcher,
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";
import Editor from "./editor";

export default function Home() {
  // Keeping this component synchronous preserves the simple jsdom test seam;
  // middleware enforces authentication before production requests reach it.
  const clerkConfigured = Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  );

  return (
    <main className="mx-auto max-w-[980px] px-8 py-[8vh]">
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
              <SignInButton mode="modal">
                <button className="rounded-md px-4 py-2 text-sm text-muted hover:text-ink">
                  Sign in
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-bg hover:opacity-90">
                  Sign up
                </button>
              </SignUpButton>
            </div>
          </SignedOut>
        </header>
      )}
      <p className="text-[0.8rem] font-bold uppercase tracking-[0.12em] text-accent">
        M7 · Authenticated workspace
      </p>
      <h1 className="my-4 text-[clamp(3rem,8vw,6rem)] tracking-[-0.06em]">
        Multiplayer Canvas
      </h1>
      <p className="max-w-[38rem] text-xl leading-relaxed text-muted">
        A learning-first foundation for a real-time collaborative technical
        diagramming app.
      </p>
      <Editor />
    </main>
  );
}
