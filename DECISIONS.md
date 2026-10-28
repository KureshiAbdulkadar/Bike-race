# Decisions

## D-001 — Browser rendering baseline: Babylon.js and TypeScript

**Status:** Existing scaffold; retain unless the remaining build brief overrides it.

**Reason:** `plan.md` selects TypeScript and Babylon.js, and the current local prototype already uses them. The HTML/CSS HUD remains separate from the 3D canvas to keep accessibility and localization practical.

## D-002 — Private-room V1 has no persistent race database

**Status:** Provisional from `plan.md`.

**Reason:** Room and race state are ephemeral, and V1 is limited to private friend groups. Persistent accounts and match records are outside the requested first playable loop.

## D-003 — Server owns outcomes; clients send input intents

**Status:** Required by `plan.md`.

**Reason:** Server authority is needed for fair hits, checkpoints, finish order, and room phase transitions. Clients may predict presentation but cannot submit trusted positions or results.

## D-004 — Do not add unused UI or rendering packages

**Status:** Current package setup.

**Reason:** Babylon.js Core, Vite, and TypeScript cover the existing scaffold. Add dependencies only to meet a concrete V1 requirement; unused dependencies add install weight and maintenance cost.

## D-005 — Use a focused WebSocket room service for private V1

**Status:** Provisional implementation choice, based on `plan.md`; revise if the missing brief continuation specifies another transport or framework.

**Reason:** V1 has small private rooms (2–6 riders) and no public matchmaking. A focused room service keeps ephemeral game state authoritative without introducing a broader matchmaking framework. The server validates every incoming message before it can affect room or race state.

## D-006 — Select WebGPU before scene creation, with WebGL fallback

**Status:** Implemented, pending browser verification.

**Reason:** `plan.md` requires WebGPU when available and WebGL compatibility otherwise. Babylon requires choosing the backend before creating the scene, so WebGPU support and initialization are checked first; the scene is constructed with WebGL when either check fails.

## D-007 — Use same-origin `/ws` for browser networking

**Status:** Implemented; local/proxy runtime verification pending.

**Reason:** A same-origin WebSocket path keeps the client build usable across local Vite, Docker Compose, and a hosted domain without embedding a particular hostname. Vite and Nginx proxy `/ws` to the room server. `VITE_ROOM_SERVER_URL` remains available for separate hosting.

## D-008 — Use direct Babylon module imports

**Status:** Implemented and production-built.

**Reason:** Root-barrel imports produced a 4.9 MB main JavaScript chunk. Direct imports reduced the main chunk to 988 KB (250 KB gzipped) while retaining the same engine and scene APIs.


## D-007 — User-directed quick races and accessible combat

The updated user request explicitly adds bot-filled online races and kicks to V1. Private friend rooms remain separate. Bots are labeled and use the same input/simulation rules as humans. Space and the on-screen Strike button select punch/kick by range, counter in a telegraph window, and recover during wobble. No weapon assets were requested.

## D-008 — Shared seeded track geometry

The server supplies a new road seed each race/rematch. Client road, world props, bike transforms, and minimap sample the same deterministic layout; movement remains expressed in metres of progress and lane offset. This avoids trusting client positions or using different random roads for different players.

## D-009 — One-command local multiplayer

Vite hosts the same validated authoritative gateway on its existing `/ws` upgrade path during development. Production retains the dedicated server. This removes the previous two-terminal local setup and lets changes to local room code reload with the development server.
