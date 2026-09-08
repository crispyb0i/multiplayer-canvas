# Multiplayer Canvas

Multiplayer Canvas is a learning-first portfolio project: a real-time collaborative technical diagramming workspace designed to demonstrate senior frontend engineering decisions.

## Current milestone: M6

M6 adds ephemeral presence over the WebSocket collaboration service: peers can see remote cursors and selected shapes without putting UI state into Yjs.

Project documentation:

- [Milestone lessons](docs/lessons/README.md) explain the implementation and tradeoffs in sequence.
- [Architecture decisions](docs/adr/README.md) record decisions that affect system boundaries.
- [Project plan](docs/project-plan.md) defines each milestone and its Definition of Done.

```bash
npm install
npm run dev
```

Quality gates:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

See [AGENTS.md](AGENTS.md) for the curriculum implementation contract.
