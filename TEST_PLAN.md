# Test Plan

Tests must report actual outcomes. Do not mark a check as passing until it has run.

## Automated checks planned for V1

- Strict TypeScript checks for all workspaces.
- Client production build.
- Unit tests for shared protocol validation and deterministic simulation rules.
- Server unit/integration tests for room creation, join capacity (2–6), readiness, phase transitions, invalid payload rejection, race finish ordering, disconnects, and rematch.
- A local multi-client smoke script that creates a private room, joins clients, starts and finishes a race, and checks identical server results.

## Manual browser scripts

### Local driving prototype

1. Open the local client and confirm the canvas renders.
2. Hold accelerate, brake, left, and right independently; confirm speed and bike response.
3. Press reset after moving and confirm position, heading, and speed reset.
4. Resize the viewport and confirm the follow camera and HUD remain usable.

### Private multiplayer flow

1. Open two or more browser sessions; create a private room in one and join via code/link in the others.
2. Confirm room capacity, nickname and bike colour display, ready state, and start gating.
3. Complete a two-lap race; exercise drafting, boost, punch telegraph, hit, recovery/counter, checkpoints, and finish.
4. Confirm sustained full throttle produces a 2–3 minute race and that the HUD clock, minimap, position, lap, boost, stability, and contextual combat prompts update.
5. Compare result order in every client and choose rematch.
6. Disconnect/reconnect clients and verify the documented host/room behavior and clear errors.

## Verification recorded so far

- Shared protocol/simulation/track tests: 14 passed using Node 24's built-in TypeScript stripping, including seeded roads, full-race duration, boost release, contextual kick selection, and Space recovery.
- Room lifecycle tests: 5 passed using Node 24; includes full authoritative private and bot races, standings, cleanup, and a new-seed rematch.
- `npm run build` passed for all three workspaces using the real Babylon.js/Vite package declarations. The bundle still has a size warning.
- Real Chrome manual checks passed for scene startup, bike paint changes, solo acceleration, boost trails, reset, help dialog, return to menu, two-client room join, readiness/start gating, countdown, and race HUD/minimap updates. No new browser console errors appeared after the missing instancing registration was fixed.
- The repository includes `apps/client/tests/browser-smoke.html`, which drives two real iframe game clients through the complete flow with actual WebSocket traffic. Each run reports its own current result; do not infer a passing full race from the manual lobby checks.
- The full browser fixture passed on 2026-10-28: room → ready/countdown → matching-speed punch/counter → drafting → boost → both laps → identical finish results → rematch. Results agreed at 157.65 s / 157.67 s. Evidence is saved in `artifacts/browser-smoke.log` and `artifacts/browser-smoke.jpg`.
- At a 390 × 844 viewport, the menu document width was 390px and the panel width was 342px, with all primary actions visible. This is a layout check, not a touch-control claim. Temporary viewport overrides were reset.

## Latest user-requested flow verification

- `?mode=quick` browser fixture passed Play online → four labeled bots → both laps → all five results → new-road rematch. Actual finish times ranged from 157.58 to 158.57 seconds.
- Updated private browser fixture passed the Play with friends disclosure, click-triggered strike, Space counter, drafting, boost, shared randomized road, full race, matching results (157.42 / 157.60 seconds), and new-road rematch.
- The first updated private run caught a stale rematch lap label. The race transition now explicitly resets lap/time/speed/boost before snapshots arrive; the rerun passed.
- A dedicated `?mode=leave` regression passed simultaneous client departure and checked that late room updates do not reopen a departed race.
- `artifacts/online-bots-smoke.log`, `artifacts/private-road-smoke.log`, and `artifacts/leave-race-smoke.log` contain the real run output. `private-road-smoke-before-fix.log` preserves the earlier failed run.
- Pointer/touch control code is present; real mobile hardware, controller support, six-human latency/load tests, and final production art quality remain outside the verified set.
