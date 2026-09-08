# ADR 0001: snapshot-based local history

## Context

M3 needs undo and redo for the immutable document commands introduced in M1.
The command set includes add, update, and remove operations. Remove needs to
remember the complete deleted shape, and future command types may have more
complex effects than a simple field patch.

## Options considered

1. Store only commands and generate inverse commands during undo.
2. Store complete before and after document snapshots for every command.
3. Store serialized document strings and deserialize them during navigation.

## Decision

Use typed history entries containing the command plus cloned `before` and
`after` `DocumentModel` snapshots. Maintain separate `past` and `future` stacks.
Executing a new command clears `future`.

## Consequences

- Undo and redo are lossless for add, update, and remove.
- The history module stays small, deterministic, and easy to test without
  React.
- Cloning shape objects prevents later edits from mutating historical state.
- Snapshot memory grows with document size and command count; this is accepted
  for the small learning-stage editor.
- Later collaborative history may need operation-level or transaction-aware
  semantics, so this local implementation is not treated as the final Yjs
  undo design.
