# Architecture

## Product boundary

V1 is a browser client, an authoritative live room server, and a shared TypeScript package. Accounts, persistent profiles, public matchmaking, and database-backed race state are out of scope. Guest identity lives in the room session; room and race state are ephemeral.

## Workspace

```text
apps/
  client/   Babylon.js rendering, keyboard and pointer/touch input, HUD, room flow, WebSocket client
  server/   room lifecycle, WebSocket boundary, authoritative race simulation
packages/
  shared/   protocol types, runtime payload validation, constants, deterministic rules
```

## Authority and data flow

1. The client sends validated input intents (controls, ready state, room actions), never a claimed position, hit, checkpoint, or result.
2. The server validates every message at the network boundary, checks room and race phase, then applies accepted input to server-owned player state.
3. The server advances race state at a fixed timestep and publishes snapshots/events to room members.
4. The client predicts its own movement with the shared deterministic step, interpolates remote riders between snapshots, and reconciles against server snapshots.
5. The server decides attacks, cooldowns, recovery, checkpoints, finish ordering, rematch, and disconnect outcomes.

## State ownership

- **Client only:** Babylon scene, camera, effects, local key sampling, predicted presentation, menus and HUD.
- **Server only:** room membership, lobby readiness, race clock, authoritative bike state, combat validation, race results.
- **Shared:** message schemas, stable identifiers, game constants, deterministic math that has no browser or server runtime dependencies.

No database is planned for the private-room V1. Adding authentication, saved progression, moderation persistence, or durable analytics requires a later storage decision.

## Domain hosting path

The client defaults to same-origin `/ws`. Vite proxies that path to the local room server in development; the Compose web service uses Nginx to proxy it to the server container. `VITE_ROOM_SERVER_URL` can point to a separately hosted `wss://` service. Terminate TLS at the hosting platform or an outer reverse proxy. Rooms are in memory on one server process and are lost on restart; this setup is a single-instance playtest deployment, not a horizontally scaled launch architecture.

## Current implementation status

The source has been migrated from the initial root scaffold into the workspace above. `packages/shared` defines strict protocol parsing and deterministic 60 Hz race rules. `apps/server` implements ephemeral room creation/join, readiness, host countdown, capacity, input sequence validation, race simulation, snapshots, finish order, and rematch. The client connects over WebSocket, predicts its own motion, smooths snapshots, and presents the lobby, race HUD, and results. The server enforces a six-player cap and transfers host on departure. Quick races add server-driven bot input intents. Shared seeded track samples drive scenery, bike placement, and the minimap consistently. Vite development embeds the same gateway used by the standalone production server. Persistence, controller support, and reconnect grace are not implemented. The `plan.md` product plan is authoritative where the pasted build brief is incomplete.
