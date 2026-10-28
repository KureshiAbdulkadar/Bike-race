# Rival Riding — Product and Execution Plan

**Status:** V0 research and execution plan  
**Product:** Browser-first, real-time multiplayer arcade bike-racing game  
**Core promise:** A group can open a link, create or join a room, and have a funny, skillful combat race in under five minutes—without a download or mandatory sign-up.

## 1. Product thesis

Rival Riding is not a conventional bike racer. Its differentiator is **high-speed, side-by-side rivalry**: riders draft to catch an opponent, pull alongside, use a timed punch or kick to disrupt their line, defend with positioning and counters, then boost through the overtake.

The desired feeling is:

> “I won because I drove well, read my rival, and took a risky combat opportunity.”

The game must never feel like an unavoidable hit decided the outcome. The player needs a way to see danger, respond, recover, and immediately race again.

### V0 scope

- 2–6 human riders in a private room.
- One polished neon city track.
- Two laps, 2–3 minutes per race.
- Guest nickname, bike colour, create room, join code, share link.
- Draft boost, punch, wobble/recovery, finish ranking, rematch.
- Desktop keyboard first; controller support if time allows.

### Explicitly out of V0

- Public ranked mode and monetary prizes.
- Open-world map.
- Full vehicle customisation economy.
- Voice chat.
- Kicks, weapons, traps, AI racers, and an “imposter” mode.
- Multiple tracks, seasons, battle pass, or cosmetics store.

These are product possibilities, not launch requirements. V0 succeeds only if the smallest loop is fun, reliable, and easy to share.

## 2. Strategic principles

1. **Instant group play wins.** A player should be able to reach a lobby in one action and begin a race in three minutes or less.
2. **The road owns the screen.** The 3D world and nearby rivals are more important than decoration, menus, or permanent labels.
3. **Arcade physics, predictable rules.** The bikes should feel fast and weighty, while the combat remains readable and recoverable.
4. **Server decides outcomes.** The client can show action immediately, but the server validates movement, attacks, checkpoints, and winners.
5. **Mobile-friendly performance is product strategy.** Build for modest hardware and variable Indian networks first; high-end graphics scale up from that base.
6. **No forced account before the first race.** Sign-in is optional until a player wants saved progress, a profile, or organised groups.
7. **Measure behaviour, not opinions alone.** Retention and rematches decide whether the combat is fun.

## 3. Technical product shape

### Client

Use **TypeScript + Babylon.js**. Babylon.js is the browser 3D engine; it does not remove the need for JavaScript/TypeScript—it is used through it.

- Babylon.js scene: road, bikes, track props, particles, cameras, lighting, collision visuals.
- Babylon GUI: race HUD, countdown, contextual strike/counter prompts, results overlay.
- HTML/CSS overlay: login, room-code input, sharing, settings, accessibility, and menus. Browser-native controls are easier to make accessible and localise.
- WebGPU when supported; initialise a WebGL fallback at startup for compatibility.

Babylon’s GUI is GPU accelerated and supports adaptive resolution, caching, and invalidation optimisation. Its documentation also makes clear that the rendering backend is selected before the scene is built; WebGPU does not silently swap to WebGL later.  
Sources: [Babylon GUI](https://doc.babylonjs.com/features/featuresDeepDive/gui/gui), [Babylon WebGPU fallback guidance](https://doc.babylonjs.com/features/featuresDeepDive/webXR/webGPUXR/).

### Multiplayer server

Use a dedicated authoritative room server over WebSockets. The client sends **input intents**, never trusted positions or claimed hits.

- Server owns: race clock, physics state, rider state, attacks, cooldowns, crash/recovery, checkpoints, finish order.
- Client owns: input sampling, local movement prediction, camera, effects, UI feedback, audio.
- Server publishes snapshots; clients interpolate remote riders and reconcile their own predicted state.
- Persist only accounts, profiles, and basic match results in a database. Ephemeral race state stays in the live room server.

Prediction and reconciliation are required for the local bike to feel responsive under real-world latency. Valve’s public networking material describes prediction and lag-compensation patterns designed to reduce latency advantage and improve fairness.  
Source: [Valve Source multiplayer networking](https://developer.valvesoftware.com/wiki/Source_Multiplayer_Networking?language=uk).

### Initial backend recommendation

- TypeScript room service using a mature room/matchmaking framework or a small focused WebSocket service.
- PostgreSQL for accounts, profiles, moderation records, and aggregate analytics.
- Redis or equivalent only if scale later needs cross-instance room presence.
- Deploy the first region close to the initial test audience; collect ping before expanding regions.

Authentication requires persistent identity storage. A database is optional only for a disposable guest-only prototype; it is necessary for real authentication, saved profiles, bans, or leaderboards.

## 4. Core race and combat rules

### Units and simulation

- Internal speed unit: metres per second; convert to mph or km/h only for UI.
- Use a fixed simulation step, initially 60 Hz server-side and client-side.
- Render at display rate; interpolate visuals between simulation states.
- Clamp the number of catch-up simulation steps per render frame to avoid a poor device entering an endless backlog.

A fixed timestep gives stable and repeatable game logic; physics engines use this pattern because frame-dependent steps create instability and inconsistent outcomes.  
Source: [Unity fixed-update documentation](https://docs.unity.com/en-us/engine/6000.0/manual/scripting/object-oriented-development/managing-time-and-frame-rate/fixed-updates).

### Bike model: arcade, not real-world injury simulation

Use a custom arcade vehicle model rather than attempting full motorcycle simulation in V0.

Each rider state includes:

- Track progress and lane offset.
- Forward speed, acceleration, braking, boost, turn input.
- Heading and visual lean.
- Grip, stability, invulnerability/recovery timers.
- Draft meter, boost charge, attack cooldown.

The bike remains constrained to a racing corridor. This produces controllable, readable overtakes and reduces desync risk. Visual lean, suspension, skid, sparks, and camera response sell the speed without making players fight a brittle physics system.

### Core values to tune in playtests

| System | Starting rule | What the player should feel |
|---|---|---|
| Top speed | Track-specific arcade top speed | Fast, readable, controllable |
| Draft range | Behind rival, aligned within a narrow lane cone | “I am hunting them” |
| Draft gain | Builds over sustained clean drafting | Reward for following skillfully |
| Boost | Short acceleration burst with a clear trail | Overtake or escape opportunity |
| Strike range | Side-by-side or up to one bike length behind; similar forward speed | A deliberate duel, never a long-range hit |
| Punch | Short lateral impulse + small speed loss + brief stability loss | Funny disruption, not a guaranteed win |
| Recovery | Correct steering input and time restore stability | Skilled players can save a bad moment |
| Cooldown | Visible and long enough to prevent spam | Attacks are decisions |
| Crash | Only after accumulated instability or a clear track hazard | Consequence is earned and understandable |

### Combat state machine

```text
Racing
  → Drafting (eligible behind rival)
  → Duel-ready (adjacent, similar speed, cooldown clear)
  → Attack wind-up (brief, telegraphed)
  → Contact resolution (server validates position, direction, cooldown)
  → Wobble / counter window / recovery
  → Racing
```

### Strike validation rules

The server accepts an attack only if all are true:

1. Attacker and target are active riders in the same race phase.
2. Attacker’s cooldown is complete.
3. Track-progress distance and lateral distance are within the defined strike envelope.
4. Relative forward speed is within a defined limit. Equal speeds are valid; the hit applies lateral disruption, not magical forward acceleration.
5. Attacker is facing a compatible direction and is not in recovery.
6. Target is not inside its short post-hit protection window.

The impact applies a bounded, deterministic lateral impulse and stability penalty. It does not simulate real injury. A visible wind-up, hit direction indicator, audio cue, and counter/recovery chance keep the result fair.

### Why side-by-side equal-speed combat works

At matching forward speeds, riders remain alongside each other long enough to create a duel. The gameplay impact comes from a controlled lateral force and a temporary handling disturbance. This is more interesting than tying attacks to raw speed alone: the player must draft, position, commit, and defend.

## 5. User experience and interface plan

### First-session flow

```text
Landing → Quick Race / Create Room / Join Room
        → Lobby → choose colour + learn controls → Ready
        → 3-2-1 countdown → Race → Results → Rematch / Share / Exit
```

### Required screens

| Screen | Player need | Required elements |
|---|---|---|
| Landing | Start immediately | Quick Race, Create Room, Join Code, “no download” promise |
| Create room | Invite a group | Track, lap count, private/public toggle, Create |
| Lobby | Know who is present and get friends in | Short room code, copy link, share, player tiles, ready state, start button |
| Controls tutorial | Learn without reading a manual | Four visual instructions: steer, accelerate, boost, strike |
| Race HUD | Make moment-to-moment decisions | Position, lap/time, small minimap, boost, contextual strike/counter |
| Pause/settings | Regain control | resume, controls, graphics, sound, leave room |
| Results | Celebrate and continue group play | ranking, best moment, rematch, share room |

### HUD hierarchy

- **Always visible:** position, lap/time, modest minimap, boost meter, speed.
- **Contextual:** Strike only when a valid target is near; counter only during a counter window; stability only after impact.
- **Never permanent:** large player names, chat popups, tutorial text, achievement toasts.

### Accessibility baseline

- Rebindable keyboard/controller controls.
- Touch targets large enough for phones.
- Text/UI scaling.
- Colour is never the only indicator: use icons, outlines, labels, and patterns.
- Motion blur, camera shake, flashes, and haptics individually reducible or disableable.
- Captions for meaningful audio cues.
- High-contrast HUD option.

Sources: [Game Accessibility Guidelines](https://gameaccessibilityguidelines.com/full-list/), [Xbox colour guidance](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/103).

## 6. Performance plan

### Experience targets

| Metric | Target | Action when missed |
|---|---|---|
| Desktop frame rate | Stable 60 FPS on target mid-tier laptop | Reduce quality tier automatically; profile before adding features |
| Input response | Local movement feels immediate | Client prediction; avoid waiting for server before animation |
| Initial playable load | First usable race scene quickly, with remaining assets streamed | Load bike, track segment, shader essentials first |
| Race joins | Clear feedback and recoverable reconnect flow | Show room full/closed/error state; retain recent room code |
| Server simulation | Stable tick under six-rider race load | Load test with bots before closed testing |

### Rendering rules

- Ship a low-poly art direction that looks deliberate.
- Use mesh instances/thin instances for repeated lights, barriers, trees, crowds, cones, and track decoration.
- Use LOD models and compressed textures.
- Limit dynamic lights, transparent particles, real-time shadows, and post-processing.
- Use a graphics preset and adaptive resolution where needed.
- Profile on low/mid/high devices continuously, not at the end.
- Keep the race HUD small: cache static Babylon GUI controls and update dynamic values only when necessary.

Babylon supports hardware instances and thin instances for repeated meshes, while its GUI offers bitmap caching and invalid-rectangle updates for complex controls.  
Sources: [Babylon instances](https://doc.babylonjs.com/features/featuresDeepDive/mesh/copies/instances), [Babylon GUI optimisation](https://doc.babylonjs.com/features/featuresDeepDive/gui/gui).

## 7. Delivery phases and gates

### Phase 0 — Validate the fun (1–2 weeks)

Build a local two-bike greybox on one loop track.

- Drive, steer, draft, boost, adjacent strike, wobble, recover, finish.
- No login, database, art, online networking, or polished menu.
- Record videos of every playtest.

**Go gate:** At least five external testers can explain the combat loop after one race and voluntarily request a rematch.

### Phase 1 — Networked vertical slice (2–4 weeks)

- Two to six browser clients in a private room.
- Authoritative room server, fixed simulation, basic prediction/interpolation.
- Create room, join code, share link, reconnect message.
- One art-directed track segment and basic HUD.

**Go gate:** Six players can finish several races with no outcome disagreement, no stuck lobby, and no repeated game-breaking desync.

### Phase 2 — Usability and stability (2–3 weeks)

- Controls tutorial, settings, graphics presets, accessibility baseline.
- Mobile evaluation and touch prototype.
- Rejoin/reconnect handling, host departure rule, clear room-error states.
- Automated race simulation/load test.

**Go gate:** New testers can create/join/start a room without assistance; target-frame-rate test passes on agreed target devices.

### Phase 3 — Closed playtest (2–4 weeks)

- Recruit groups of coworkers, students, and friends, not only solo testers.
- Observe first session without helping.
- Interview groups after their first three races.
- Tune combat values one variable at a time.

**Go gate:** Define success in advance, for example: most groups complete a first race, a meaningful share chooses rematch, and no recurring fairness complaint dominates feedback.

### Phase 4 — Launch candidate (2–3 weeks)

- Polish one track, onboarding, audio, results, error states, privacy copy, support path.
- Instrument analytics, crash reporting, moderation/abuse handling, and release monitoring.
- Make a short gameplay trailer showing draft → duel → recovery → boost → finish.

**Go gate:** All critical flows pass a release checklist; no high-severity known bug; load test meets peak expectation with margin.

## 8. Analytics and research loop

Track events with no unnecessary personal data:

- Landing opened; Quick Race / Create Room / Join Room selected.
- Room created; invite copied/shared; guest joined; room started.
- Time from landing to first race start.
- Draft started, boost used, strike attempted, strike validated, counter used, recovery successful.
- Disconnect, reconnect, room error, client frame-rate tier, ping bucket.
- Race finished; rematch chosen; player returns later.

### Questions each test must answer

1. Do players understand how to start a race?
2. Do they recognise a valid strike opportunity without reading text?
3. Does a punch feel funny and fair to both attacker and target?
4. Can a skilled player recover from a hit often enough?
5. Does any UI element block the road or nearby opponent?
6. Do players request a rematch?

Never respond to one loud opinion by changing the whole game. Combine session footage, telemetry, repeated patterns, and controlled tuning experiments.

## 9. Launch and Indian-market approach

The relevant opportunity is a browser-accessible social game that works for friend groups, college groups, and workplace teams. Industry reports show continued growth in India’s game-development ecosystem, but discoverability and sustainable product execution are harder problems than building a prototype.  
Sources: [dentsu India Gaming Report 2025](https://prod-dentsu-website-afd-ep-dcdpenekezfnd0hn.a02.azurefd.net/in/en/reports/india_gaming_report_2025), [AIGDF developer survey](https://www.aigdf.in/post/survey-of-domestic-game-developers).

### Launch strategy

1. Run closed playtests with existing groups in India; do not launch public matchmaking first.
2. Publish short, real clips of combat moments, recoveries, and photo-finish rematches.
3. Build a lightweight community channel for playtest scheduling and feedback.
4. Partner with college gaming clubs, student communities, and creator groups for organised sessions.
5. Expand only after the private-room loop shows repeat play.

### Monetisation decision

Do not add monetisation to V0. First establish that groups return. After validated retention, consider cosmetic-only bike trails, outfits, and garage visuals. Never sell speed, boost, combat power, or matchmaking advantage.

## 10. Risk register

| Risk | Early signal | Prevention / response |
|---|---|---|
| Combat feels unfair | “I got hit without a chance” | Strong telegraphing, bounded impact, recovery, cooldowns, replay review |
| Network desync | Riders teleport or players disagree on hits | Server authority, deterministic simple rules, snapshot reconciliation, test bad networks |
| Low frame rate | Input lag, battery heat, poor first-session completion | Performance budget, quality presets, profiler, simple assets, device matrix |
| Empty public rooms | Players wait alone | Prioritise private invites and scheduled groups before public queue |
| Onboarding confusion | Players reach lobby but do not start | Three primary home actions, visual tutorial, short join link/code flow |
| Scope explosion | More systems start before the core loop works | Enforce V0 exclusion list and go/no-go gates |
| Safety/tone mismatch | Groups find combat too aggressive | Cartoon impact, no gore, clear age/tone guidance, friendly party framing |
| Legal/IP risk | Game looks or sounds copied | Original art, audio, characters, track layouts, names, and code; use references only for analysis |

## 11. Definition of success

V0 is successful when a new group can:

1. Open the game from a link.
2. Enter the same room without help.
3. Learn drafting, boosting, and striking in one race.
4. Complete a race that feels fair even after contact.
5. Choose a rematch because the group wants another round.

The next build action is **Phase 0: make the two-bike local greybox and test draft, strike, wobble, recovery, and boost before any account, database, or polished UI work.**
