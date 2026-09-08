# M1 lesson: local document model

## Goal

Create a framework-independent document model that the editor can use locally and later adapt to history and collaboration.

## What to study

- Why discriminated unions make shape and command handling readable.
- Why commands are a boundary between UI intent and document state changes.
- Why updates return a new document instead of mutating the old one.
- Why serialized data must be validated at runtime even with strict TypeScript types.
- Why a document version gives future migrations an explicit compatibility boundary.

## Verification evidence

Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.
