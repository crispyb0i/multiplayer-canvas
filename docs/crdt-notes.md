# CRDT notes

Reference notes on Conflict-free Replicated Data Types and how Yjs applies them in
this app. Written for the M4 milestone ("Yjs without networking") but meant as a
durable reference for M5+ (WebSocket sync, presence, offline queueing).

## The problem CRDTs solve

Multiplayer editing requires each peer to apply edits to its local copy immediately.
Peers are periodically disconnected (offline, lag, partitions), so there is no way to
coordinate every edit through a central authority without hurting responsiveness.

Naive reconciliation fails in predictable ways:

- **Whole-document last-write-wins**: peer A moves shape 1 while peer B moves shape 2;
  the later write erases the earlier one entirely, even though the edits did not conflict.
- **Server as referee**: every edit waits on a round-trip, and the server becomes a
  single point of failure.

A CRDT is a data type whose merge rules are precise enough that replicas can edit
independently, in any order, and converge to the _same_ state after exchanging data.
Convergence is guaranteed by algebra, not by coordination.

## The merge algebra

A CRDT merge function satisfies three properties:

1. **Commutative** — `merge(a, b) == merge(b, a)`. The order updates arrive in does not matter.
2. **Associative** — `merge(merge(a, b), c) == merge(a, merge(b, c))`. Grouping does not
   matter, so updates can gossip through chains of peers and still converge.
3. **Idempotent** — `merge(a, a) == a`. Applying the same update twice is a no-op, so
   duplicate delivery (retries, multicast) cannot corrupt state.

These properties are why `applyYjsUpdate` in `lib/yjs-document.ts` can stay trivial:
any transport that delivers encoded updates — duplicated, reordered, delayed —
converges to the same document.

## Core building blocks

### G-Counter (grow-only counter)

Each peer owns a slot in a vector; the counter's value is the sum of slots, and merge
is per-slot max. Concurrent increments both survive because they touch different slots.

### LWW Register (last-write-wins value)

A value plus a deterministic tiebreaker, typically `(clock, clientID)`. Concurrent
writes resolve by comparing tiebreakers, so every peer independently selects the same
winner. This backs per-field writes like `shape.set("x", 10)`.

### Observed-remove set

Removal targets the _specific add operation the remover observed_, not the key. This
matters for concurrent add/remove of the same element: the outcome is deterministic
and depends on what each remover had observed. Deleted elements leave **tombstones**
in the merge log — markers that later, in-flight operations can still be evaluated
against. Tombstones are why Yjs docs expose `gc` (garbage collection of tombstones).

The `shapes` Y.Map in this app is an observed-remove map: `shapes.delete(id)`
tombstones the shape's entry, and a concurrent `shapes.set(id, ...)` from a peer that
had not yet seen the delete still merges deterministically (a resurrecting add).

## How Yjs implements CRDTs

- **Identity for every edit**: each mutation is stamped `(clientID, Lamport clock)`.
  The Lamport clock is a logical counter that increments on each local edit and
  ratchets to the max seen from peers, so no wall-clock sync is needed and concurrent
  edits still get distinct, comparable IDs. `clientID` is visible when logging a doc.
- **Root types**: a `Y.Doc` holds named shared types (`ydoc.getMap("document")`).
  `Y.Map` is an observed-remove map; nested `Y.Map`s keep stable identity across
  peers, which is what lets each shape keep field-level merge semantics.
- **Sequences** (`Y.Text`, arrays) use _position identifiers_ stable under concurrent
  shifts, so two peers inserting "at the same place" interleave deterministically
  instead of one clobbering the other.
- **Update encoding**: `Y.encodeStateAsUpdate` serializes the merge log as bytes;
  `Y.applyUpdate` merges them. Merging is commutative, associative, and idempotent.
  These two functions are the transport seam in `lib/yjs-document.ts`
  (`encodeYjsState` / `applyYjsUpdate`).

## Tradeoffs

- **Metadata overhead**: every value carries identity and tombstone metadata. Cheap
  for canvas shapes; meaningful for very large sequences or high-churn documents.
- **Convergence ≠ correctness**: CRDTs guarantee replicas agree, not that the result
  matches user intent. Two peers dragging one shape offline merge to a single
  deterministic position (LWW on `x`/`y`), not an "average". Deciding what a merge
  _means_ for the product is application logic; CRDTs only guarantee agreement.
- **No cross-peer atomicity**: `ydoc.transact` batches mutations into one atomic
  update _per peer_, but a concurrent peer may observe part of a logical command
  before the rest arrives. Commands that must appear all-or-nothing to remote peers
  need application-level handling.

## Contrast with Operational Transformation (OT)

OT (the historical Google Docs approach) broadcasts raw operations and relies on a
_central server_ to transform each incoming op against concurrent ones. It achieves
the same convergence goal but requires a sequencer and correct transform functions,
which are notoriously hard to get right. CRDTs replace transformation with the merge
algebra above, so any peer can merge with any peer. This is why M5's WebSocket
transport can be a dumb pipe that relays encoded updates without understanding them.

## How this app applies CRDTs

- `lib/document.ts` keeps the typed, immutable `DocumentModel` and command
  validation; commands remain the semantic boundary.
- `lib/yjs-document.ts` owns the shared mutable state: it validates through
  `applyCommand` first, then performs the _minimal_ Yjs mutation (field-level
  `shape.set` rather than replacing a whole shape map), preserving the CRDT's
  field-level concurrent merge behavior.
- Conversion functions (`createYDocument`, `yDocumentToDocument`) validate Yjs data
  at the trust boundary, protecting the typed editor from malformed persisted or
  network-delivered updates.

## Further study

- Yjs documentation: <https://docs.yjs.dev>
- "An introduction to Conflict-Free Replicated Data Types" (architectural overview):
  <https://martinfowler.com/articles/crdt-ops.html>
- Shapiro et al., the CRDT formalization papers: <https://crdt.be>
