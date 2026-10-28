# Progress

## Current status

The current local game has preset-only paint, Play online with four labeled bot rivals, private friend rooms, seeded randomized circuits, Space/click contextual punch/kick/counter/recovery, and pointer/touch controls. The procedural sunset city, bike/rider, chase camera, boost trails, and cartoon effects run in the browser. The complete strict build and 19 automated tests pass. Full real-client browser runs passed online bot racing and private two-player races, both laps/results, new-road rematches, and a separate simultaneous-leave regression. Production art polish, real-device/latency profiling, and a reproducible clean registry install remain outstanding. No domain purchase or public deployment has been performed.

## Milestone 0 — Repository audit and working documents

### Plan

- Inspect the existing scaffold and product plan.
- Add the requested project documents and record architecture assumptions.
- Check local tooling and dependency availability before committing to the V1 workspace migration.

### Work completed

- Read `plan.md` and inspected the existing browser scaffold, package manifest, and Vite configuration.
- Confirmed there is no Git repository, no existing V1 server/client workspace, and no automated test script.
- Confirmed Node.js and npm are present. Dependencies are not installed.
- Created README, architecture, test plan, decision, and progress documents.

### Commands and evidence

- `node --version`: Node v24.13.0.
- `npm --version`: npm 11.8.0.
- `npm install --no-audit --no-fund --fetch-retries=0 --fetch-timeout=15000`: blocked with `ENOTFOUND registry.npmjs.org`.
- `npm run dev`: blocked because Vite is not installed (`vite: command not found`).
- `npm run build`: blocked because TypeScript is not installed (`tsc: command not found`).

### Known issues / assumptions

- Build brief is incomplete in the message received; it ends at `### Client`.
- No package registry access means dependencies cannot currently be installed and runtime/build checks cannot be completed here.
- The current folder already has the prior single-app scaffold, despite the brief describing an empty repository. Preserve and migrate useful work rather than deleting it.

### Milestone 1 — V1 workspace foundation

#### Plan

- Migrate the existing Babylon client into `apps/client` without losing its local driving prototype.
- Add `apps/server` and `packages/shared` workspace packages with strict TypeScript boundaries.
- Use a small authoritative WebSocket service for private rooms, following `plan.md`; validate all client messages at the server boundary.
- Add real build/test scripts and a minimal local server/client smoke path.
- Install dependencies, typecheck, build, run tests, and launch both local processes. Record any environment-level blocks honestly.

#### Pending input

The pasted build brief ends at `### Client`. The workspace implementation will follow `plan.md` unless the user supplies additional constraints.

#### Work completed

- Migrated the Babylon/Vite prototype into `apps/client`.
- Added the `apps/server` and `packages/shared` npm workspaces and strict TypeScript configurations.
- Added shared client/server protocol types, constants, and a strict runtime parser that rejects unknown fields and malformed data.
- Added a WebSocket server boundary with a 16 KB payload limit, per-connection message rate limit, JSON parsing, and protocol validation.
- Added in-memory room create/join, readiness, host start/countdown, six-player cap, host transfer, and rematch readiness.
- Added authoritative 60 Hz racing with two laps, drafting boost, telegraphed punches, counter windows, wobble/recovery, snapshots, and finish standings.
- Connected the browser client with nickname/color selection, copyable room links, lobby, local input prediction/reconciliation, chase camera, race HUD, results, and rematch.
- Added shared protocol/simulation tests, room lifecycle tests, and root `dev`, `dev:server`, `build`, and `test` scripts.
- Added the requested README, architecture, test plan, decisions, and progress documents.

#### Verification

- `node --experimental-strip-types --test packages/shared/tests/*.test.ts`: 8 passed.
- `node --experimental-strip-types --conditions=development --test apps/server/tests/*.test.ts`: 4 passed using a temporary workspace symlink, removed after the run. Includes room capacity, host transfer, readiness/start gating, full race finish, standings, and rematch countdown.
- Node TypeScript syntax checks passed; these do not typecheck TypeScript.
- `npm install --no-audit --no-fund --fetch-retries=0 --fetch-timeout=15000`: blocked with `ENOTFOUND registry.npmjs.org`.
- Selective offline install of server/shared workspaces: blocked because npm cache metadata for `@types/node` is unavailable.
- `npm run build`, `npm run dev`, and `npm run dev:server`: blocked before compilation/startup because TypeScript is not installed (`tsc: command not found`).
- Browser smoke has not run because Vite and Babylon.js are unavailable.

### Next milestone

### Milestone 2 — Race readability and smoke validation

#### Plan

- Fill the race HUD gaps from `plan.md`: elapsed time, minimap, strike-ready prompt, counter/recovery prompt, and contextual stability.
- Keep prompts hidden unless the player can act, and expose only server-authoritative combat eligibility.
- Add/update protocol tests for the additional snapshot fields.
- Use the recovered local TypeScript toolchain to build shared/server and run the standard test script; attempt a real local WebSocket smoke, recording sandbox limitations.

#### Verification gate

- The full game remains unverified until the client dependencies (`@babylonjs/core` and Vite) can be installed and a browser smoke run succeeds.

### Milestone 3 — Rendering backend readiness

#### Plan

- Review `plan.md` rendering requirements and current engine setup.
- Select WebGPU before scene construction when supported and successfully initialized; fall back to WebGL otherwise.
- Keep the engine abstraction compatible with both backends and record the runtime verification limit.
- Re-run available shared/server checks and attempt the full client build after inspecting local package caches.

#### Milestone 2 work and verification update

- Added elapsed race clock, an SVG track minimap with rider colors/lane offsets, contextual strike/counter/recovery prompts, and a stability meter.
- Extended server snapshots with punch cooldown and counter-window values so combat prompts reflect authoritative state.
- Corrected the lobby ready handler to use the existing `roomPhase` state and removed duplicate rider-state initialization.
- Added a clear server bind-error message and clean timer shutdown when the environment cannot open the socket.

Commands and evidence:

- `npm test`: passed; 8 shared tests and 4 room/server lifecycle tests.
- `npm run build --workspace @rival/server`: passed with TypeScript strict settings.
- `npm run build`: shared and server passed; client typecheck stopped because `vite/client` types are unavailable (Vite dependencies were not installed).
- `npm run dev:server`: server compiled, but runtime bind was denied by the environment (`listen EPERM 127.0.0.1:3001`). A browser/server smoke test therefore could not run.
- After adding startup error handling, `npm run dev:server` reports the bind denial clearly and exits with status 1 instead of an unhandled error.
- `node --experimental-strip-types --check` syntax checks passed for client entry, shared simulation, and room service. This is syntax validation only, not client typechecking.
- npm registry remains unreachable (`ENOTFOUND registry.npmjs.org`), and cached Vite/Babylon packages are unavailable. No install or browser build was possible.

Current gate: implementation is in place, but the browser application is not verified runnable. The next required action is to run `npm install`, `npm run build`, and the two-client browser smoke flow in an environment with registry access and loopback socket permission. The pasted build brief still ends at `### Client`; implementation followed `plan.md` where the brief supplied no detail.

Milestone 3 work and verification:

- Added WebGPU support detection and initialization before scene construction, with automatic WebGL fallback on unsupported or failed initialization.
- Resized the procedural ground based on track radius and increased track length to 2,500 metres per lap. At the shared 32 m/s top speed, a solo two-lap race now fits the plan's 2–3 minute target.
- Added a simulation test for the planned race duration and updated the server integration test to run until the full-length race finishes.
- Added the client assets folder documentation and corrected architecture/test-plan notes.
- `npm test`: passed; 9 shared tests and 4 server tests.
- `npm run build --workspace @rival/server`: passed.
- Client TypeScript syntax checks passed, but static client typecheck and bundle still stop at missing `vite/client` definitions. The npm cache has Vite tarballs but no `@babylonjs/core` package.
- WebGPU/WebGL behavior remains unverified in a browser. The full local multiplayer smoke remains blocked by unavailable client dependencies and denied socket binding.

Latest retry evidence:

- `npm test`: passed again; 9 shared and 4 server tests.
- `npm run build`: shared/server TypeScript builds passed; client typecheck failed on missing `vite/client` declarations.
- `npm ping --fetch-retries=0 --fetch-timeout=10000`: failed with `ENOTFOUND registry.npmjs.org`.
- `npm run dev:server`: compiled, then failed to bind `127.0.0.1:3001` with `EPERM`.
- A strict client-source typecheck passed against temporary Babylon API declarations. It checks internal application typing but does not verify the real Babylon package types.
- Computer-use access to Chrome is denied, so it cannot provide a package-download fallback. No Babylon.js package exists in the local npm cache.

The remaining full-client build and local runtime smoke cannot be completed until package-registry network access and loopback socket permission are available.

User launch preference (2026-10-28): finish local UI, functionality, usability, and testing before any domain purchase. Do not buy or publish until the user has reviewed the local game.

### Milestone 4 — Online deployment readiness

#### Plan

- Make the client use same-origin `/ws` by default and allow an environment override for hosted WebSocket endpoints.
- Proxy `/ws` in Vite during local development.
- Add container packaging for the static client, Nginx WebSocket proxy, and authoritative server.
- Document deployment prerequisites and commands without purchasing a domain or publishing the app.
- Run available builds/tests and validate the container configuration if Docker tooling is present.

User-requested retry on 2026-10-28:

- `npm install --cache /private/tmp/rival-riding-npm-cache`: failed after retries with `ENOTFOUND registry.npmjs.org` while resolving Vite and Babylon.js. It produced no `package-lock.json` and installed neither package.
- `npm run build`: shared and server workspaces compiled; client typecheck failed because `vite/client` declarations are absent.
- `npm run dev`: shared build passed; client launch failed with `vite: command not found`.

Milestone 4 work:

- The browser uses same-origin `/ws` by default, or `VITE_ROOM_SERVER_URL` when configured.
- Vite proxies `/ws` to the local WebSocket server for development.
- Added multi-stage Docker build targets for the production room server and static client, a Compose stack, and Nginx WebSocket proxy configuration.
- Added `.env.example` and documented host-port, TLS-terminating proxy, and separate WebSocket URL configuration.
- `compose.yaml` parses as YAML and contains `server` and `web` services.
- `npm test` passed after the networking configuration change: 9 shared tests and 4 server tests. Shared/server strict TypeScript builds passed; client source passed only the temporary shim-based check.
- Docker/Compose and Nginx executables are unavailable in this environment, so container builds and proxy validation have not run. Public domain setup, TLS termination, and deployment remain unperformed.
- `package-lock.json` is still absent because the requested install failed before dependency resolution completed. Generate and review it as soon as registry access is available before relying on production container builds.

### Milestone 5 — Babylon bundle size

#### Plan

- Inspect the real production bundle produced with cached dependencies.
- Replace root-barrel imports with direct Babylon module imports where valid.
- Re-run the client typecheck/build and compare output size; retain changes only if the bundle gets smaller without errors.

Milestone 5 work and verification:

- Changed Babylon imports to direct modules. Production output dropped from 4,927 KB (1,107 KB gzipped) to 988 KB (250 KB gzipped); Vite also emits the WebGPU engine as a separate 258 KB (64 KB gzipped) chunk.
- Retrieved Babylon.js 9.32.1 from the official npm registry through the available Chrome session and verified its SHA-512 against registry metadata before unpacking it into ignored `node_modules`.
- Retrieved Vite 8.3.5 from the official registry and verified its SHA-512; assembled its dependencies from the local npm cache without changing package manifests.
- `npm run build`: passed for shared, server, and client with real Babylon declarations.
- `npm test`: passed; 9 shared tests and 4 server tests.
- `npm run dev`: Vite compiled, then could not bind `127.0.0.1:5173` (`EPERM`). Chrome also blocked opening `file://` under its URL safety policy. The actual visual and interaction smoke still needs a browser-accessible local server.
- Follow-up local check: `curl -I http://127.0.0.1:5173/` could not connect, and the existing Chrome tab at `http://localhost:5173/` showed `ERR_CONNECTION_REFUSED`. The UI is not currently being served; this is a server-start blocker, not evidence of a canvas/rendering failure.
- Rechecked at the user's request: reloading that Chrome tab still shows `ERR_CONNECTION_REFUSED`; retrying `npm run dev` again fails on `listen EPERM 127.0.0.1:5173` before serving a page.
- Docker Compose validation remains YAML-only; Docker is unavailable. No domain or hosting account was purchased or used.

### Milestone 6 — Game UI rework after user feedback

#### Plan

- Replace the boxed dashboard layout with a full-viewport race scene and a simple left-aligned game menu.
- Make the nickname/color setup, create/join actions, solo practice, lobby readiness, and results easier to scan.
- Keep race HUD compact and move detailed keyboard help into a controls panel.
- Tie connection messages and disabled states to real server availability; remove technical setup instructions from player-facing flows.
- Review local ride/menu transitions and repair any problems exposed by the new UI.
- Run the real strict build, relevant tests, and a local/browser smoke if the environment permits it. Record limitations explicitly.

Current-state audit: Vite and Babylon.js are now installed in ignored `node_modules`, and the complete production build passes using the real package types. The existing same-origin `/ws` configuration and solo ride entry were preserved from the current workspace.

Milestone 6 scope update from the user's visual references: the requested improvement includes the rendered game world, not only menus. Use the reference's colorful sunset city, road lighting, substantial sport bikes with visible riders, close chase camera, and readable speed/boost effects as visual direction. Build original procedural geometry and effects; verify the real scene rather than substituting concept art for gameplay. The previous greybox is not an acceptable visual result for this request.

#### Milestone 6 implemented

- Replaced the boxed dashboard with a full-viewport scene, compact race HUD, left-side game menu, paint swatches, clear create/join/solo paths, readable room code, empty lobby slots, and a keyboard help dialog.
- Added an original procedural sunset sky, sun, skyline with window textures, road markings, neon barriers, turn boards, finish gantry, street lights, and elevated road. Repeated city objects use mesh instances.
- Replaced the tiny placeholder with a procedural sport bike and crouched rider: fairings, tank, wheels/spokes, fork, visor, suit/armor, lights, contact shadow, wheel rotation, leaning, strike animation, and boost trails.
- Added cartoon impact bursts and a closer chase camera with forward motion compensation, plus a garage camera for menus.
- Fixed solo practice movement to use the shared circular-circuit simulation instead of clamping global X coordinates. Solo reset and automatically recharging practice boost work independently of the server.
- Added real connection/disabled states, retry action, bounded connection startup, and readable graphics-startup failure text. Removed setup commands and fake render-loop success labels from the player interface.
- Improved keyboard key-release handling and blocked driving keys while the help dialog is open. Solo Escape/menu navigation and online leave-race navigation are available.
- Smoothed boost release in shared simulation and added a meaningful charge/speed/decay test.

#### Milestone 6 verification

- `npm run build`: passed for shared/server/client with real dependency types. Main bundle is approximately 929 KB / 227 KB gzip, plus dynamically loaded backend/shader chunks; the large-chunk warning remains.
- `npm test`: 10 shared protocol/simulation tests and 4 authoritative room tests passed.
- Real Chrome visual and input smoke: menu, color selection, solo acceleration, boost trails, reset, help dialog, return to menu, two-browser create/join, readiness, countdown, race position/lap/time/minimap all exercised.
- Found and fixed the missing Babylon instanced-mesh side-effect import through browser console inspection. No new errors appeared during the tested race flow.
- Full actual-client browser fixture passed in room MDT9S9: punch/counter, drafting charge, boost speed, both laps, identical standings/times (157.65 s / 157.67 s), and fresh rematch. The fixture cleaned up its rooms and restored saved profile preferences.
- 390 × 844 layout check: no horizontal document overflow (document width 390px); menu panel 342px. Desktop Chrome gameplay was the actual play target; touch/controller are not implemented.
- Actual screenshots and smoke log are in `artifacts/`.
- Existing client/server processes started outside this restricted shell were used for the browser smoke. The source build contains the new boost-release easing; restarting the existing server is required to load that shared-code change into its already-running process.
- An offline lockfile-only attempt exited successfully but produced incomplete metadata for optional native packages from the manually assembled dependency tree. The generated file was removed rather than treating it as a verified portable lockfile. Workspace symlinks were restored in ignored `node_modules`. A normal registry-connected install is still needed to produce a complete portable lockfile.

Remaining review gates: visual polish against the supplied concept reference, six-player/device/latency profiling, reconnect grace, and external group playtesting. The requested game is not represented as a finished commercial-quality release. No purchases or public deployment were made.

### Milestone 7 — Updated controls, online flow, bots, and randomized circuits

User-directed scope update (2026-10-28): use preset bike colors instead of a color picker; use Space/click as the contextual punch/kick/counter/recovery action; provide Play online with bot-filled matches and a separate private-room path; randomize roads per race; improve original bike/rider proportions using the new examples as visual direction. This explicitly supersedes the earlier no-bots/no-kicks constraints. Weapons and copied third-party assets were not requested.

#### Plan

1. Replace the color picker with preset swatches and simpler Play online / Play with friends choices.
2. Add Space and an on-screen strike button, contextual counter/recovery behavior, and distinct original punch/kick animations.
3. Add shared deterministic track generation from a room seed, use it for road/scenery/bikes/minimap, and rotate seeds on rematch.
4. Add authoritative bot-filled quick races. Clearly label bot riders; private friend rooms retain their readiness and invite flow.
5. Extract the validated WebSocket gateway for reuse by both the production server and Vite development server. This lets the existing local Vite process serve current multiplayer code through `/ws` and makes local startup one command; preserve a separate production server.
6. Run strict builds, targeted simulation/bot/protocol/track tests, then real browser quick-race and private-room smoke tests. Update the test fixture for Space controls and new user flow. Save actual visual evidence and open the current source/game in Codex for morning review.

#### Milestone 7 implementation and evidence

- Preset paint swatches replace the color picker. The menu now offers Play online, a separate Play with friends disclosure for create/join, and Practice solo.
- Play online creates a server-owned five-rider race with four explicitly labeled bots. Bots use the same input intents, cooldowns, drafting/boost, and finish rules as humans. No orphan bot room remains when its human leaves.
- Space/click is the contextual action: close-range punch, wider adjacent kick, telegraph counter, and wobble recovery. A short input latch makes fast button clicks survive the input-send interval. Pointer controls support driving, boost, and strike; keyboard help reflects the new bindings.
- Added original kick animation using leg pivots and kept cartoon spark/wobble presentation. Combat toasts ignore fights that do not involve the local player.
- Shared deterministic road generation uses a room seed. Road meshes, barriers, scenery, bike transforms, finish gantry, and minimap use the same sampler; rematch changes the seed. Practice also randomizes its circuit.
- Extracted the bounded/validated WebSocket gateway and embedded it in Vite for local development at `/ws`. The existing running Vite process reloaded the new service successfully. Local play is now `npm run dev` only; production keeps the dedicated server.
- Fixed a rematch lap-label reset caught by a real browser test, a late-room-message race after leaving, true 3/2/1 countdown timing, and host readiness on transfer.
- `npm run build` passed across shared, server, Vite tooling, and client. Main output is about 934 KB / 228 KB gzip; the bundle-size warning is still present.
- `npm test`: 14 shared/protocol/track tests and 5 room/bot tests passed.
- Actual online browser smoke passed all five riders finishing, labeled bot standings, rematch, and a different road.
- Actual private browser smoke passed click-to-strike, Space counter, drafting/boost, both laps, matching results (157.42/157.60 s), and rematch on a different shared road.
- Dedicated simultaneous-leave browser regression passed after guarding against obsolete room updates.
- Logs are saved in `artifacts/`. The external editor UI automation timed out; code and game-preview panels were requested in Codex. Do not represent external-editor opening as verified.

## Milestone 8 — Reference playtest and camera/boost UX

Plan: drive Traffic Rider in Chrome, compare acceleration/braking and framing with Rival Riding, then address reproduced camera and boost confusion.

Observed: reference cockpit framing stayed substantial at 100 and 20 km/h; steering shifted lane and braking reduced speed directly. Rival Riding varied camera FOV with speed and presented an active-looking empty boost button. Its procedural bike/environment still have substantially less detail than the reference; this milestone does not close that art gap.

Implemented: constant chase FOV; camera follows actual target displacement instead of extrapolated speed; repeated menu-state updates no longer snap an already active chase camera. Empty boost has a faded dashed button labelled EMPTY, an accessible explanation, and contextual charging guidance.

Browser testing exposed WebGPU startup hanging indefinitely. Added a five-second initialization deadline and WebGL fallback. Chrome recovered to the menu and playable solo/online modes. Babylon logged a late WebGPU initialization error from the disposed attempt; the WebGL game remained playable.

Validation: npm run build passed; npm test passed all 19 checks. Drove solo acceleration and boost (144 km/h), braked to 0, visually confirmed stable rider framing. Started a quick race and confirmed EMPTY plus drafting instructions. Evidence: artifacts/camera-boost-review.jpg. No full race rerun was needed for presentation-only simulation-independent changes. Reference was paused after testing. Remaining: detailed original bike/road assets, device performance coverage, countdown pre-held throttle behavior, and broader commercial UX polish.

## Milestone 9 — Racing first, smoother boost

Plan: prioritize consistent driving; inspect low boost opacity and charge/speed transitions. Interpreted the request for faster boost while riding normally as faster replenishment rather than increasing ordinary speed above boosted speed.

Implemented: normal non-boost riding restores 6 charge/second; drafting restores 13; practice restores 20 total. Charge no longer drains unused. Boost consumes 32/second only while accelerating with boost, and braking takes priority without wasting charge. Release deceleration reduced from 7 to 5 m/s². Exhaust trails fade and shrink over 0.35 seconds with less flicker. Empty button opacity increased from .5 to .85; meter and button transitions smoothed. Solo strike animation/button removed; online combat retained as a secondary race mechanic. No death/wound or combat-points system added; finish placement remains the scoring rule.

Validation: npm test: 21 passing (16 shared, 5 server), including new recharge/drafting and brake-priority checks. npm run build passed. Chrome solo: ordinary throttle, boost reached 147 km/h, release returned toward normal cruise; replenished meter and solo strike absence observed. Screenshot: artifacts/smooth-boost.jpg. Full online browser race not rerun for this tuning; server bot race completion tests passed.
