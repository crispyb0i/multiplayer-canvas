# M0 lesson: repository and engineering baseline

## Goal

Create a small, reproducible application whose quality gates are clear before feature complexity
arrives. A baseline is valuable because future failures can be attributed to the new lesson rather
than to missing repository conventions.

## What to study

- How Next.js App Router discovers `app/layout.tsx` and `app/page.tsx`.
- Why TypeScript's strict mode catches defects before runtime.
- The difference between linting, type checking, unit/component tests, and a production build.
- Why `package-lock.json` makes CI installs reproducible.
- Why CI should run the same quality gates as local development.

## Verification evidence

Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`. The expected result is one
passing smoke test, no type errors, no lint errors, and a successful optimized production build.

## Interview takeaway

The project begins with explicit engineering hygiene and a milestone boundary. Every later feature
must earn its dependencies and preserve these quality gates.
