# M9 lesson: offline and reconnect sync

Status: complete

## Goal

Keep local edits available across network interruptions and browser restarts,
then merge and deliver them safely when collaboration resumes.

## Design boundary

The browser owns durability, queue state, and user-facing sync status. Yjs owns
document merge semantics. The WebSocket service remains a relay and durable
snapshot boundary; it should not need to know whether an update was created
online or offline.

## Implementation sequence

1. Define a versioned IndexedDB record for one organization/document pair and an
   ordered queue of encoded Yjs updates.
2. Persist a local document update before attempting to send it. This ordering
   makes a tab close during a network failure recoverable.
3. On startup, restore the local Yjs document and queued updates before opening
   the editor connection.
4. On reconnect, receive and apply the server state first, then drain the queue.
   Yjs update application is idempotent, so a lost acknowledgement can safely
   cause a retry.
5. Add bounded backoff and recovery UI for storage failure, corrupt local data,
   expired authentication, and a queue that cannot drain.

## Verification

Focused tests should prove:

- refresh restores the document and pending queue;
- edits while offline survive a tab restart;
- reconnect merges server changes and drains pending updates;
- duplicate updates do not duplicate shapes or fields;
- failed sends remain queued and retry with backoff;
- malformed records and IndexedDB failures produce recoverable errors.

Then run:

```bash
npm test
npm run typecheck
npm run lint
npm run format:check
npm run build
```

## Interview takeaway

Offline support is a durability and state-machine problem around the CRDT, not
a second conflict-resolution engine. Persisting before sending and making
delivery retry-safe lets the server remain simple while protecting user work.
