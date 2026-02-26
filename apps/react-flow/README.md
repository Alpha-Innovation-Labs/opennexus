# cdd-react-flow-ui

Initial Next.js App Router MVP for visualizing CDD context dependencies with React Flow.

## Commands

- `bun install`
- `bun run dev`
- `bun run typecheck`
- `bun run lint`
- `bun run test`

## Local run from repo root

- `just flow`

## Notes

- Reads context files from `../../.nexus/context/cdd-web-ui/**`.
- Override repo root with `NEXUS_REPO_ROOT` if needed.
- Server logs write to `./logs/react-flow-server.log`.
