# M1 lesson: local document model

## Goal

Create a framework-independent document model that the editor can use locally and that later milestones can adapt to history and collaboration.

## Concepts

- How discriminated unions make rectangle and text shape handling explicit.
- Why commands form the boundary between user intent and document state changes.
- Why mutations return new documents instead of modifying existing snapshots.
- Why serialized data still needs runtime validation despite strict TypeScript types.
- How a document version creates an explicit compatibility and migration boundary.

## Implementation

- Defined typed rectangle and text shapes.
- Added immutable add, update, and remove commands.
- Added versioned JSON serialization and deserialization.
- Added validation for malformed documents, invalid shapes, duplicate IDs, and invalid command targets.
- Added focused model tests without introducing a runtime dependency.

## Verification

Run:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

## Interview takeaway

The UI does not own document rules. A small, typed, framework-independent model gives the editor, history layer, and future sync layer one predictable mutation boundary.
