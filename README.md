# Rival Riding

Rival Riding is a browser-first arcade bike racing game. The current V1 slice includes private friend rooms, bot-filled online quick races, randomized two-lap circuits, arcade drafting and boost, telegraphed punches, counters, recovery, results, and rematch. Race state and results are server authoritative and held in memory.

## Requirements

- Node.js 22.12+
- npm 10+

The browser uses Babylon.js Core. Vite serves the page, and TypeScript checks and bundles the workspaces. The HUD uses HTML/CSS, so Babylon GUI is not needed.

## Install and run locally

From the project root:

```sh
npm install
```

Start the local client and authoritative room service together:

```sh
npm run dev
```

Open the URL printed by Vite (usually `http://127.0.0.1:5173`). The development server hosts the same validated WebSocket gateway at `/ws`, so a second terminal is no longer needed. The standalone `npm run dev:server` command remains available for separate server development; production uses that dedicated server behind the Nginx proxy.

Run `npm run build` for strict client/server/tooling checks and production output. Run `npm test` for protocol, track-generation, arcade simulation, and room/bot lifecycle checks.

### Check the UI without multiplayer

Start only the client with `npm run dev` and open its printed URL. The full-screen menu shows the original procedural sport bike, rider, and sunset city circuit. Choose a preset paint color, then select **Play online**, **Play with friends**, or **Practice solo**. Play online starts with four labeled bot rivals. Play with friends reveals private create/join options. Multiplayer actions become available when the room service connects. Solo practice works independently; its boost recharges automatically. Use **W/A/S/D** to drive and **R** to reset. Open **Controls** or press **?** for keyboard help; **Escape** returns from solo practice to the menu.

### Check multiplayer

With `npm run dev` running, choose Play with friends and create a room. Open another browser session at the same Vite URL, choose Play with friends, join with the code, ready up, and start the race. Run `npm test` for the protocol and server simulation checks.

With the development server running, open `http://127.0.0.1:5173/tests/browser-smoke.html` and click **Run browser smoke** for the actual two-client browser flow. It takes about three minutes and reports failure if room gating, countering, drafting, boost, two-lap results agreement, or rematch breaks. Open the same fixture with `?mode=quick` for the bot-filled online race and rematch check. The test fixture is excluded from the production build entry points.

## Host on a domain

The repository includes a Docker Compose setup for the client, Nginx WebSocket proxy, and room server:

```sh
cp .env.example .env
docker compose up --build -d
```

The site is available on port `8080` by default. Set `RIVAL_RIDING_PORT` to change the host port. For a public domain, point DNS at your host and put the Compose web service behind a TLS-terminating reverse proxy that forwards WebSocket upgrades. The client connects to same-origin `/ws` by default. Set build argument `VITE_ROOM_SERVER_URL` to use a separately hosted `wss://` endpoint. No domain purchase or public deployment is performed by these commands.

## Project structure

```text
apps/
  client/      Babylon.js browser game and Vite app
  server/      Authoritative room and WebSocket service
packages/
  shared/      Protocol, constants, and client payload validation
deploy/        Nginx WebSocket and static client proxy configuration
```

Create a room, share its code or link, join from another browser session, ready up, and start when all riders are ready. The local rider is predicted with the shared movement rules and reconciled to server snapshots; remote riders are smoothed between 20 Hz snapshots. Race simulation runs at 60 Hz.

The simulation uses a fixed 60 Hz update with a short catch-up limit. A two-lap race is tuned for roughly 2–3 minutes at sustained top speed. Rendering resolution is capped for high-DPI screens to reduce unnecessary GPU load. The client selects WebGPU when it initializes successfully and otherwise uses WebGL.

## Project documents

- `ARCHITECTURE.md` describes the intended V1 client/server/shared boundaries.
- `DECISIONS.md` records material technical choices and assumptions.
- `PROGRESS.md` tracks milestones, verification evidence, known issues, and next steps.
- `TEST_PLAN.md` describes planned automated checks and manual smoke scripts.

## Controls

- **W / Up Arrow:** accelerate
- **S / Down Arrow:** brake
- **A / Left Arrow:** steer left
- **D / Right Arrow:** steer right
- **Shift:** boost
- **Space / Strike button:** contextual punch or kick, counter during a rival's windup, or recover while wobbling
- **R:** reset the solo practice bike
- **?:** show keyboard help

Keyboard and pointer/touch buttons are available. The touch driving pad appears on coarse-pointer devices; Strike and Boost buttons are always shown. Controller support and real-device mobile performance remain unverified.
