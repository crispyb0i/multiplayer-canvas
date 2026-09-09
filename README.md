# Multiplayer Canvas

Multiplayer Canvas is a learning-first portfolio project: a real-time collaborative technical diagramming workspace designed to demonstrate senior frontend engineering decisions.

## Current milestone: M13

The project now includes authenticated collaboration, offline recovery,
persisted Yjs snapshots, accessibility polish, and portfolio documentation.
Clerk organization membership remains the authorization boundary for rooms.

Project documentation:

- [Milestone lessons](docs/lessons/README.md) explain the implementation and tradeoffs in sequence.
- [Architecture decisions](docs/adr/README.md) record decisions that affect system boundaries.
- [Architecture overview](docs/architecture.md) maps the runtime boundaries.
- [Portfolio case study](docs/case-study.md) summarizes the problem, solution, and tradeoffs.
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
