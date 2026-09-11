# Portfolio readiness audit

Date: 2026-09-11. Scope: source review, local automated checks, dependency
advisories, document-operation profiling, and browser checks against a local
unauthenticated demo. No production writes, migrations, or deployments.

## Assessment

This is a useful senior-frontend case study because it exposes real distributed
state tradeoffs. The local demo is the lowest-friction entry point. Authenticated
collaboration should be presented as a prototype with the durability and trust
limitations below, rather than described as production-ready.

The initial plan said M11, README said M13, and the landing page said M7. This
audit aligns the plan with the explicitly requested portfolio-hardening scope;
it does not retroactively certify all milestone goals.

## Fixed in this audit

| Finding                                                                                      | Change and evidence                                                                                                                                                                              |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A workspace/account switch reused the previous Yjs replica                                   | Key the editor by user and organization; regression test verifies state is discarded across both boundaries. Memoize the connection credentials.                                                 |
| Every editor render allocated another document and subscribed another undo manager           | Lazy replica initialization and effect-owned undo subscription with cleanup. Strict Mode regression covers restored shapes and local undo. Local mode no longer maintains redundant Yjs history. |
| Collaborative commands also mutated stale snapshot history                                   | Use only Yjs history in shared mode. Regression edits a remotely restored text shape and undoes the local edit while preserving the shape.                                                       |
| Every edit broadcast a full accumulated Yjs snapshot                                         | Relay incremental bytes to peers; retain full state for joining and persistence. Regression checks the actual relayed delta.                                                                     |
| Unchanged shape visuals rerendered after Yjs conversion                                      | Compare the scalar visual props, since conversion creates new object identities. This saves SVG reconciliation; it does not remove the full document conversion cost.                            |
| Updates arriving during acknowledgement could get stranded                                   | Reload the queue after each acknowledgement, retain concurrent wakeups, and bound acknowledgement waiting. Regression covers concurrent enqueue and timeout without deleting pending work.       |
| Token rejection escaped as an unhandled promise                                              | Surface an error and permit retry; regression covers failure followed by success.                                                                                                                |
| Disconnect during asynchronous room loading could resurrect a client                         | Revoke identity before checking room membership; invalidate obsolete join requests. Regression resolves a database load after disconnect.                                                        |
| Room changes discarded verified identity; non-persisted rooms lacked organization namespaces | Separate leaving from disconnecting and namespace all organization rooms. Regression covers editing after a room switch and cross-organization isolation.                                        |
| Inherited object names could throw during role lookup                                        | Reject roles absent from the permission map's own properties. Tests cover `__proto__`, `constructor`, and `toString`.                                                                            |
| Pre-authentication buffering and socket payloads were unbounded                              | Bound messages/bytes awaiting verification and set a 2 MiB payload ceiling. Register close/error handlers before awaiting authentication.                                                        |
| Shape dragging lacked capture; panning used CSS pixels as viewBox units                      | Capture gestures, handle cancellation, allow pan from shapes, convert pan deltas, and clear Space on blur. Regression covers scaled panning.                                                     |
| Wheel cancellation used a passive React event                                                | Install a scoped non-passive listener and zoom around the pointer. Provide a keyboard-accessible Reset view button.                                                                              |
| Error recovery offered destructive local-cache reset                                         | Offer connection retry, preserving queued work.                                                                                                                                                  |
| Public presentation had stale milestone copy and misleading editing hints                    | Describe the product and local demo's reload limitation; use a truthful text-editing prompt and expanded keyboard instructions.                                                                  |
| Dependency audit found production PostCSS/Sharp and critical Vitest findings                 | Override Next's transitive PostCSS/Sharp versions and patch Vitest to 3.2.7. No new application dependency. Production audit is clean; remaining dev advisory is below.                          |
| Formatting included untracked machine-local configuration                                    | Exclude `.claude/settings.local.json` from Prettier's repository gate.                                                                                                                           |

## Remaining release risks

These are source-review findings, not claims that an exploit or production
failure was reproduced.

1. **High — server acknowledgement is not durable storage confirmation.**
   `lib/collaboration.ts` acknowledges before its debounced Neon write. A crash
   in that window can lose acknowledged work. Failed snapshot writes are logged
   but are not automatically retried. The browser retains a local snapshot, but
   reconnect only sends its pending queue; an already-acknowledged edit is not
   guaranteed to reconstruct a stale server. Implement durable update storage
   before ack, or state-vector reconciliation plus retryable persistence, and
   exercise server-crash recovery before promising durable saves.
2. **High — binary validity is not document-schema validity.** The server catches
   malformed Yjs bytes but does not validate the resulting application schema.
   An authorized member can send structurally valid CRDT data containing invalid
   shapes. Client conversion then throws. Validate candidate state before
   committing it to the room/persistence; benchmark that cost and add malicious
   member tests. Payload limits alone do not solve this.
3. **High — authorization has a connection lifetime.** Clerk verification occurs
   when the socket opens. Token expiry or membership revocation does not close an
   already-authorized connection. Add a bounded session lifetime/revalidation,
   authorized-party checks appropriate to deployment, and revocation tests.
4. **Medium — IndexedDB recovery and multi-tab coordination need browser tests.**
   The adapter treats some corrupt records as absent, stores the whole snapshot
   and queue in one record, and reuses queue IDs after draining. Two tabs for the
   same workspace share that queue without cross-tab ownership. Cover quota,
   corrupt records, concurrent ack/write, and two-tab reconnect using real
   IndexedDB before claiming robust offline recovery. Memory-adapter tests do
   not establish browser storage correctness.
5. **Medium — long-lived room memory and load are unbounded.** Empty rooms and
   snapshot-write bookkeeping remain in memory. No per-user rate limiting,
   room-count limit, or state-size ceiling exists. Add eviction coordinated with
   durable writes, and test abusive authenticated workloads.
6. **Medium — one collaboration process is the supported topology.** Snapshot
   writes serialize within a process, not across replicas. Multiple server
   instances can diverge/overwrite one another. Document singleton deployment
   until shared room coordination exists.
7. **Medium — development dependency advisory remains.** `npm audit` reports
   GHSA-82fw-gwwq-j7x9 in Vitest 3.2.7 and its mocker (two moderate entries).
   Fixing it requires a separate Vitest major upgrade (patched 4.1.11+).
   This project invokes `vitest run`, not an exposed Vitest UI server. The
   critical advisory was removed; `npm audit --omit=dev` reports zero findings.
8. **Medium — accessibility and performance coverage is incomplete.** No
   screen-reader audit, touch-device matrix, or reproducible two-client browser
   performance trace is checked in. SVG shapes each add a tab stop; there is no
   keyboard zoom control beyond resetting the viewport. Long text and 1,000-shape
   keyboard navigation need dedicated UX work. Drag remains a full-document
   conversion/validation path; network presence is not throttled.

## Measurements and verification

`npm run profile:performance` on the audit machine (single sample, before edits):

| Shapes | Create  | Encode  | Convert | Full snapshot bytes |
| ------ | ------- | ------- | ------- | ------------------- |
| 1,000  | 9.1 ms  | 5.7 ms  | 14.3 ms | 174,060             |
| 5,000  | 32.2 ms | 17.0 ms | 10.6 ms | 900,165             |
| 10,000 | 57.7 ms | 32.6 ms | 21.1 ms | 1,820,565           |

These timings are document operations, not frame rates or interaction latency.
The delta relay regression demonstrates reduced network payload; no percentage
speedup is claimed. The benchmark does not exercise canvas rendering or Neon.

Final local verification:

- `npm test`: 41 tests passed across 10 files (Vitest 3.2.7).
- `npm run typecheck` and `npx tsc --noEmit`: passed with the dev server stopped.
- `npm run lint`: passed.
- `npm run format:check`: passed.
- `npm run build`: passed; home route reports 181 kB first-load JavaScript.
- `npm audit --omit=dev`: zero vulnerabilities. Full `npm audit`: two moderate
  Vitest/mocker entries, described above.
- `git diff --check`: passed; `graft build` refreshed the local context graph.
- Local browser: verified text creation/editing, undo, redo, keyboard selection,
  and deletion; inspected the desktop layout screenshot. Scaled panning is
  covered by a DOM regression test, not a native touch/drag browser test.

Authenticated Clerk/Neon integration was exercised through injected test doubles,
not live production services. One intermediate typecheck ran while the dev
server was regenerating `.next/types`; the final sequential typecheck passed.
No frame-rate, mobile-device, screen-reader, or live two-client performance
claim is made by these checks.
