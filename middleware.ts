import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher(["/", "/sign-in(.*)", "/sign-up(.*)"]);
const clerkConfigured = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY,
);

// Authentication belongs at the request boundary so every future server
// route starts from the same invariant: only an explicitly public route may
// be reached without a verified Clerk session. Keyless local development is
// intentionally allowed to keep the editor usable without an auth account.
export default clerkMiddleware(async (auth, request) => {
  if (clerkConfigured && !isPublicRoute(request)) await auth.protect();
});

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/(api|trpc)(.*)"],
};
