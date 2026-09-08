# M0 lesson: repository and engineering baseline

## Goal

Create a small, reproducible application whose quality gates are reliable before feature complexity arrives. This makes later failures easier to attribute to a new milestone instead of missing repository conventions.

## Concepts

- How the Next.js App Router discovers `app/layout.tsx` and `app/page.tsx`.
- How strict TypeScript catches defects before runtime.
- The different guarantees provided by linting, type checking, tests, and a production build.
- Why `package-lock.json` makes CI installs reproducible.
- Why CI should run the same quality gates used during local development.

## Implementation

- Established a minimal Next.js and TypeScript application.
- Added Vitest and Testing Library for focused automated checks.
- Added ESLint, Prettier, and repository quality-gate scripts.
- Added CI and project conventions for future milestones.

## Verification

Run:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

The expected result is a passing smoke test, no type or lint errors, and a successful optimized production build.

## Interview takeaway

The project begins with explicit engineering hygiene. Every later feature must earn its dependencies while preserving the same quality gates.
