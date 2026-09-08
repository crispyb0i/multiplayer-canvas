# M7 lesson: authentication and authorization

## Goal

Authenticate users with Clerk and make workspace membership the security
boundary for collaborative rooms without forcing authentication before the
public app is opened.

## Concepts

- Authentication and authorization are separate checks: a valid Clerk session
  does not automatically grant access to every workspace.
- Clerk Organizations provide workspace membership, invitations, and roles.
- The WebSocket server must verify the session token itself; trusting a
  browser-supplied organization ID would not be an authorization check.
- Anonymous users can use the public editor locally, while collaboration
  requires a signed-in user with an active organization.

## Implementation

- Added Clerk provider setup, protected middleware, sign-in/sign-up routes, and
  organization onboarding controls.
- Added explicit `read`, `edit`, and `manage_members` workspace permissions.
- Added Clerk token verification to the WebSocket server and required the
  verified organization to match the requested room workspace.
- Added secure-mode tests for unauthenticated and cross-workspace joins.
- Configured the Clerk development instance with an eight-character minimum
  password length.

## Verification

Run:

```bash
npm test
npm run typecheck
npm run lint
npm run format:check
npm run build
```

All repository gates pass. Manual verification should also cover sign-up,
workspace creation or invitation acceptance, same-workspace collaboration,
and rejection from a different workspace.

## Interview takeaway

The browser supplies credentials, but the collaboration service is the final
authority. Clerk manages identity and membership; the application translates
those claims into a small permission policy before allowing room access.
