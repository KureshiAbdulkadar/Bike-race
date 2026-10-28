import './styles.css';
import {
  RACE_LAPS,
  createTrack,
  sampleTrack,
  TICK_RATE,
  TRACK_LENGTH_METERS,
  type PublicPlayer,
  type RaceStanding,
  type RoomPhase,
  type ServerMessage,
} from '@rival/shared';
import { RoomClient } from './networking/RoomClient';
import { createRaceScene } from './rendering/createRaceScene';

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Required page element is missing: ${selector}`);
  return element;
}

const canvas = requiredElement<HTMLCanvasElement>('#game-canvas');
const app = requiredElement<HTMLElement>('#app');
const nicknameInput = requiredElement<HTMLInputElement>('#nickname');
const colorInput = requiredElement<HTMLInputElement>('#bike-color');
const codeInput = requiredElement<HTMLInputElement>('#room-code');
const homePanel = requiredElement<HTMLElement>('#home-panel');
const lobbyPanel = requiredElement<HTMLElement>('#lobby-panel');
const countdownPanel = requiredElement<HTMLElement>('#countdown-panel');
const resultsPanel = requiredElement<HTMLElement>('#results-panel');
const flowShade = requiredElement<HTMLElement>('#flow-shade');
const roomList = requiredElement<HTMLUListElement>('#player-list');
const resultsList = requiredElement<HTMLOListElement>('#results-list');
const flowMessage = requiredElement<HTMLElement>('#flow-message');
const lobbyMessage = requiredElement<HTMLElement>('#lobby-message');
const speedReadout = requiredElement<HTMLElement>('#speed-value');
const lapReadout = requiredElement<HTMLElement>('#lap-readout');
const positionReadout = requiredElement<HTMLElement>('#position-readout');
const boostFill = requiredElement<HTMLElement>('#boost-fill');
const raceMeters = requiredElement<HTMLElement>('#race-meters');
const raceClock = requiredElement<HTMLElement>('#race-clock');
const miniMap = requiredElement<HTMLElement>('#mini-map');
const mapRiders = requiredElement<SVGGElement>('#map-riders');
const combatPrompt = requiredElement<HTMLElement>('#combat-prompt');
const stabilityCard = requiredElement<HTMLElement>('#stability-card');
const stabilityFill = requiredElement<HTMLElement>('#stability-fill');
const connectionState = requiredElement<HTMLElement>('#connection-state');
const toast = requiredElement<HTMLElement>('#race-toast');
const menuButton = requiredElement<HTMLButtonElement>('#open-menu');
const actionLabel = requiredElement<HTMLElement>('#action-label');
const actionButton = requiredElement<HTMLButtonElement>('#action-button');
let mapTrack = createTrack(1, TRACK_LENGTH_METERS);
const controlsDialog = requiredElement<HTMLDialogElement>('#controls-panel');

nicknameInput.value = localStorage.getItem('rival-riding.nickname') ?? 'Rider';
colorInput.value = localStorage.getItem('rival-riding.color') ?? '#27bfff';
const raceScene = await createRaceScene(canvas, colorInput.value).catch((error: unknown) => {
  connectionState.textContent = 'Graphics unavailable';
  flowMessage.textContent = 'The 3D scene could not start. Reload the page or try a browser with graphics acceleration enabled.';
  requiredElement<HTMLButtonElement>('#free-ride').disabled = true;
  throw error;
});
function updatePaint(): void {
  if (!/^#[0-9a-fA-F]{6}$/u.test(colorInput.value)) return;
  raceScene.setLocalBikeColor(colorInput.value);
  localStorage.setItem('rival-riding.color', colorInput.value);
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-bike-color]')) {
    const selected = button.dataset.bikeColor === colorInput.value;
    button.setAttribute('aria-pressed', String(selected));
    if (selected) requiredElement<HTMLElement>('#selected-paint-label').textContent = button.getAttribute('aria-label') ?? 'Selected paint';
  }
}
colorInput.addEventListener('input', updatePaint);
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-bike-color]')) {
  button.addEventListener('click', () => { colorInput.value = button.dataset.bikeColor ?? '#27bfff'; updatePaint(); });
}
updatePaint();
const serverProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const configuredRoomServer = import.meta.env.VITE_ROOM_SERVER_URL?.trim();
const roomServerUrl = configuredRoomServer || `${serverProtocol}//${window.location.host}/ws`;
const roomClient = new RoomClient(roomServerUrl);
let online = false;
let acceptRoomUpdates = false;
let playerId = '';
let roomPhase: RoomPhase | null = null;
let roomCode = '';
let raceStandings: RaceStanding[] = [];
let roomPlayers: PublicPlayer[] = [];
let inputSequence = 0;
let simulationAccumulator = 0;
let toastTimer = 0;

const simulationStep = 1 / 60;
const maxSimulationSteps = 5;

function showPanel(panel: HTMLElement | null): void {
  for (const candidate of [homePanel, lobbyPanel, countdownPanel, resultsPanel]) candidate.hidden = candidate !== panel;
  flowShade.hidden = panel === null;
  app.dataset.view = panel ? panel.id.replace('-panel', '') : 'ride';
  raceScene.setMenuMode(panel !== null && panel !== countdownPanel);
  raceScene.setDrivingEnabled(panel === null);
  menuButton.hidden = panel !== null;
  menuButton.textContent = roomPhase === 'racing' ? 'Leave race' : 'Back to menu';
}

function setConnection(state: 'connecting' | 'online' | 'offline'): void {
  online = state === 'online';
  app.dataset.connection = state;
  connectionState.textContent = state === 'online' ? 'Multiplayer online' : state === 'connecting' ? 'Connecting' : 'Solo available';
  requiredElement<HTMLButtonElement>('#create-room').disabled = !online;
  requiredElement<HTMLButtonElement>('#quick-race').disabled = !online;
  requiredElement<HTMLButtonElement>('#join-room').disabled = !online;
  requiredElement<HTMLButtonElement>('#retry-connection').hidden = state !== 'offline';
}

function sendRoomAction(message: Parameters<RoomClient['send']>[0]): void {
  if (!roomClient.send(message)) {
    (roomPhase === 'lobby' ? lobbyMessage : flowMessage).textContent = 'Multiplayer is unavailable. You can still ride solo.';
  }
}

function updateRoomUi(message: Extract<ServerMessage, { type: 'room_state' }>): void {
  const previousPhase = roomPhase;
  raceScene.setTrackSeed(message.trackSeed);
  mapTrack = createTrack(message.trackSeed, TRACK_LENGTH_METERS);
  updateMapRoad();
  roomCode = message.roomCode;
  roomPhase = message.phase;
  if (message.phase === 'racing' && previousPhase !== 'racing') {
    lapReadout.textContent = `LAP 1 OF ${RACE_LAPS}`;
    raceClock.textContent = '00:00'; speedReadout.textContent = '0';
    positionReadout.textContent = `— / ${message.players.length}`;
    boostFill.style.width = '0%'; mapRiders.replaceChildren();
  }
  roomPlayers = message.players;
  raceScene.setPlayers(message.players, playerId);

  requiredElement<HTMLElement>('#room-code-label').textContent = message.roomCode;
  requiredElement<HTMLElement>('#rider-count').textContent = `${message.players.length} / 6`;
  roomList.replaceChildren();
  const localPlayer = message.players.find((player) => player.id === playerId);
  for (const player of message.players) {
    const item = document.createElement('li');
    item.className = 'player-tile';
    const name = document.createElement('span');
    name.className = 'player-name';
    const color = document.createElement('span');
    color.className = 'player-color';
    color.style.backgroundColor = player.bikeColor;
    const nickname = document.createElement('span');
    nickname.textContent = `${player.nickname}${player.id === playerId ? ' (you)' : ''}`;
    name.append(color, nickname);
    const badge = document.createElement('span');
    badge.className = 'player-badge';
    badge.textContent = player.isBot ? 'BOT' : player.id === message.hostId ? 'HOST' : player.ready ? 'READY' : 'NOT READY';
    item.append(name, badge);
    roomList.append(item);
  }
  for (let slot = message.players.length; slot < 6; slot += 1) {
    const item = document.createElement('li');
    item.className = 'player-tile empty';
    const label = document.createElement('span');
    label.className = 'player-name';
    const dot = document.createElement('span');
    dot.className = 'player-color';
    label.append(dot, 'Open slot');
    const badge = document.createElement('span');
    badge.className = 'player-badge'; badge.textContent = 'INVITE A FRIEND';
    item.append(label, badge); roomList.append(item);
  }

  requiredElement<HTMLButtonElement>('#ready-up').textContent = localPlayer?.ready ? 'Unready' : 'Ready up';
  const canStart = message.hostId === playerId
    && message.players.length >= 2
    && message.players.every((player) => player.ready);
  const startButton = requiredElement<HTMLButtonElement>('#start-race');
  startButton.hidden = message.hostId !== playerId;
  startButton.disabled = !canStart;
  requiredElement<HTMLButtonElement>('#ready-up').hidden = message.hostId === playerId;

  raceScene.setNetworkMode(message.phase === 'racing');
  raceScene.setDrivingEnabled(false);
  raceMeters.hidden = message.phase !== 'racing';
  requiredElement<HTMLElement>('#reset-hint').hidden = true;
  raceClock.hidden = message.phase !== 'racing';
  miniMap.hidden = message.phase !== 'racing';
  if (message.phase !== 'racing') { stabilityCard.hidden = true; combatPrompt.hidden = true; }
  requiredElement<HTMLElement>('#boost-help').textContent = 'Draft behind a rival to charge';

  switch (message.phase) {
    case 'lobby':
      showPanel(lobbyPanel);
      lobbyMessage.textContent = message.players.length < 2
        ? 'Share the code with a friend to fill the grid.'
        : 'Ready when your group is.';
      break;
    case 'countdown':
      requiredElement<HTMLElement>('#countdown-number').textContent = '3';
      showPanel(countdownPanel);
      break;
    case 'racing':
      showPanel(null);
      break;
    case 'results':
      renderResults();
      showPanel(resultsPanel);
      break;
  }
}

function renderResults(): void {
  resultsList.replaceChildren();
  for (const standing of raceStandings) {
    const item = document.createElement('li');
    item.className = 'result-tile';
    const place = document.createElement('span');
    place.textContent = `${standing.place}.  ${standing.nickname}${roomPlayers.find((player) => player.id === standing.id)?.isBot ? ' · BOT' : ''}`;
    const time = document.createElement('span');
    time.className = 'result-time';
    time.textContent = `${(standing.finishTimeMs / 1000).toFixed(2)} s`;
    item.append(place, time);
    resultsList.append(item);
  }
}

function showToast(message: string): void {
  toast.textContent = message;
  toast.classList.add('visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 1100);
}

function updateBoostHud(charge: number): void {
  boostFill.style.width = `${charge}%`;
  const button = requiredElement<HTMLButtonElement>('.boost-action');
  const ready = charge > 1;
  button.dataset.empty = String(!ready);
  button.setAttribute('aria-label', ready ? 'Hold Shift or this button to boost' : 'Boost recharging. Ride normally or draft to charge faster');
  requiredElement<HTMLElement>('.boost-action small').textContent = ready ? 'BOOST' : 'EMPTY';
  requiredElement<HTMLElement>('#boost-help').textContent = ready
    ? 'Hold Shift or the boost button'
    : roomPhase === 'racing' ? 'Recharging · draft to charge faster' : 'Recharging · release Shift';
}

function updateCombatPrompt(
  local: Extract<ServerMessage, { type: 'race_snapshot' }>['riders'][number],
  riders: Extract<ServerMessage, { type: 'race_snapshot' }>['riders'],
): void {
  actionButton.hidden = false;
  combatPrompt.classList.remove('counter', 'recover');
  actionLabel.textContent = 'STRIKE';
  actionButton.dataset.ready = 'false';
  if (local.counterWindow > 0) {
    combatPrompt.textContent = 'COUNTER NOW · SPACE';
    actionLabel.textContent = 'COUNTER'; actionButton.dataset.ready = 'true';
    combatPrompt.classList.add('counter');
    combatPrompt.hidden = false;
    return;
  }
  if (local.wobble > 0) {
    combatPrompt.textContent = 'RECOVER · HOLD SPACE';
    actionLabel.textContent = 'RECOVER'; actionButton.dataset.ready = 'true';
    combatPrompt.classList.add('recover');
    combatPrompt.hidden = false;
    return;
  }
  const validTarget = riders.some((rider) => rider.id !== local.id
    && Math.abs(rider.z - local.z) <= 4
    && Math.abs(rider.x - local.x) <= 2.7
    && Math.abs(rider.speed - local.speed) <= 5
    && rider.wobble === 0);
  if (validTarget && local.punchCooldown === 0) {
    actionButton.dataset.ready = 'true';
    combatPrompt.textContent = 'STRIKE READY · SPACE OR CLICK';
    combatPrompt.hidden = false;
    return;
  }
  combatPrompt.hidden = true;
}

function mapPosition(progress: number, lane: number): { x: number; y: number } {
  const pose = sampleTrack(mapTrack, progress, lane);
  const xs = mapTrack.points.map((point) => point.x);
  const zs = mapTrack.points.map((point) => point.z);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
  const scale = 80 / Math.max(maxX - minX, maxZ - minZ);
  return { x: 50 + (pose.x - (minX + maxX) / 2) * scale, y: 50 - (pose.z - (minZ + maxZ) / 2) * scale };
}
function updateMapRoad(): void {
  const points = Array.from({ length: 96 }, (_, index) => mapPosition(index / 96 * TRACK_LENGTH_METERS, 0));
  requiredElement<SVGPathElement>('#map-road').setAttribute('d', points.map((point,index) => `${index ? 'L' : 'M'}${point.x},${point.y}`).join(' ') + ' Z');
  const start = mapPosition(0, 0); const heading = sampleTrack(mapTrack, 0).heading;
  const nx = Math.cos(heading) * 5, ny = Math.sin(heading) * 5;
  requiredElement<SVGPathElement>('.map-finish').setAttribute('d', `M${start.x-nx},${start.y-ny}L${start.x+nx},${start.y+ny}`);
}
function updateMiniMap(riders: Extract<ServerMessage, { type: 'race_snapshot' }>['riders']): void {
  mapRiders.replaceChildren();
  for (const rider of riders) {
    const position = mapPosition(rider.z, rider.x);
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    marker.setAttribute('cx', String(position.x)); marker.setAttribute('cy', String(position.y));
    marker.setAttribute('r', rider.id === playerId ? '3.8' : '3');
    marker.setAttribute('fill', roomPlayers.find((player) => player.id === rider.id)?.bikeColor ?? '#ffffff');
    marker.setAttribute('class', 'map-rider'); mapRiders.append(marker);
  }
}

function updateRaceHud(snapshot: Extract<ServerMessage, { type: 'race_snapshot' }>): void {
  const { riders, tick } = snapshot;
  raceScene.applySnapshots(riders);
  updateMiniMap(riders);
  const elapsedSeconds = Math.floor(tick / TICK_RATE);
  const minutes = String(Math.floor(elapsedSeconds / 60)).padStart(2, '0');
  const seconds = String(elapsedSeconds % 60).padStart(2, '0');
  raceClock.textContent = `${minutes}:${seconds}`;
  const local = riders.find((rider) => rider.id === playerId);
  const sorted = riders.slice().sort((a, b) => b.z - a.z);
  const position = sorted.findIndex((rider) => rider.id === playerId) + 1;
  if (position > 0) positionReadout.textContent = `${position} / ${sorted.length}`;
  if (local) {
    lapReadout.textContent = `LAP ${local.lap} OF ${RACE_LAPS}`;
    updateBoostHud(local.boost);
    speedReadout.textContent = String(Math.round(local.speed * 3.6));
    stabilityCard.hidden = local.wobble === 0 && local.stability >= 1;
    stabilityFill.style.width = `${local.stability * 100}%`;
    updateCombatPrompt(local, riders);
  }
}

roomClient.onMessage((message) => {
  switch (message.type) {
    case 'welcome':
      playerId = message.playerId;
      acceptRoomUpdates = true;
      break;
    case 'room_state':
      if (acceptRoomUpdates) updateRoomUi(message);
      break;
    case 'countdown':
      if (!acceptRoomUpdates) break;
      requiredElement<HTMLElement>('#countdown-number').textContent = String(message.seconds);
      showPanel(countdownPanel);
      break;
    case 'race_snapshot':
      if (!acceptRoomUpdates) break;
      updateRaceHud(message);
      break;
    case 'combat_event':
      if (!acceptRoomUpdates) break;
      raceScene.playCombatEvent(message);
      if (message.attackerId !== playerId && message.targetId !== playerId) break;
      if (message.kind === 'windup') {
        if (message.targetId === playerId) {
          combatPrompt.textContent = 'COUNTER NOW · SPACE';
          combatPrompt.classList.add('counter');
          combatPrompt.hidden = false;
        } else if (message.attackerId === playerId) {
          showToast(`${message.style.toUpperCase()} WINDUP`);
        }
      } else if (message.kind === 'counter') {
        showToast(message.targetId === playerId ? 'PUNCH COUNTERED' : message.attackerId === playerId ? 'COUNTER LANDED' : 'PUNCH COUNTERED');
      } else {
        showToast(message.targetId === playerId ? 'WOBBLE! HOLD SPACE TO RECOVER' : message.attackerId === playerId ? `${message.style.toUpperCase()} LANDED` : 'CONTACT');
      }
      break;
    case 'race_results':
      if (!acceptRoomUpdates) break;
      raceStandings = message.standings;
      renderResults();
      break;
    case 'error':
      if (message.code === 'connection_closed') {
        acceptRoomUpdates = false;
        setConnection('offline');
        if (roomPhase !== null) {
          roomPhase = null;
          raceScene.setNetworkMode(false);
          raceScene.setPlayers([], 'local');
          showPanel(homePanel);
        }
      }
      (roomPhase === 'lobby' ? lobbyMessage : flowMessage).textContent = message.message;
      break;
  }
});

function getProfile(): { nickname: string; bikeColor: string } {
  const nickname = nicknameInput.value.trim().slice(0, 20) || 'Rider';
  const bikeColor = /^#[0-9a-fA-F]{6}$/u.test(colorInput.value) ? colorInput.value : '#f2315a';
  localStorage.setItem('rival-riding.nickname', nickname);
  localStorage.setItem('rival-riding.color', bikeColor);
  return { nickname, bikeColor };
}

function joinRoom(code: string): void {
  if (!online) {
    flowMessage.textContent = 'Multiplayer is unavailable. You can still ride solo.';
    return;
  }
  const profile = getProfile();
  sendRoomAction({ type: 'join_room', roomCode: code.trim().toUpperCase(), ...profile });
}

requiredElement<HTMLButtonElement>('#friends-toggle').addEventListener('click', () => {
  const options = requiredElement<HTMLElement>('#friend-options'); options.hidden = !options.hidden;
  requiredElement<HTMLButtonElement>('#friends-toggle').setAttribute('aria-expanded', String(!options.hidden));
});
requiredElement<HTMLButtonElement>('#quick-race').addEventListener('click', () => {
  if (online) sendRoomAction({ type: 'quick_race', ...getProfile() });
});
requiredElement<HTMLButtonElement>('#create-room').addEventListener('click', () => {
  if (!online) {
    flowMessage.textContent = 'Multiplayer is unavailable. You can still ride solo.';
    return;
  }
  sendRoomAction({ type: 'create_room', ...getProfile() });
});
requiredElement<HTMLButtonElement>('#join-room').addEventListener('click', () => joinRoom(codeInput.value));
codeInput.addEventListener('input', () => { codeInput.value = codeInput.value.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/gu, '').slice(0, 6); });
requiredElement<HTMLInputElement>('#room-code').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') joinRoom(codeInput.value);
});
requiredElement<HTMLButtonElement>('#ready-up').addEventListener('click', () => {
  const ready = !roomPlayers.find((player) => player.id === playerId)?.ready;
  sendRoomAction({ type: 'ready', ready });
});
requiredElement<HTMLButtonElement>('#start-race').addEventListener('click', () => sendRoomAction({ type: 'start_race' }));
requiredElement<HTMLButtonElement>('#rematch').addEventListener('click', () => sendRoomAction({ type: 'rematch' }));

function leaveRoom(): void {
  acceptRoomUpdates = false;
  window.clearTimeout(toastTimer); toast.classList.remove('visible'); toast.textContent = '';
  if (roomPhase !== null) roomClient.send({ type: 'leave_room' });
  roomPhase = null;
  roomCode = '';
  raceStandings = [];
  raceScene.setNetworkMode(false);
  raceScene.setPlayers([], 'local');
  raceScene.resetLocalRide();
  raceMeters.hidden = true;
  raceClock.hidden = true;
  miniMap.hidden = true;
  stabilityCard.hidden = true;
  combatPrompt.hidden = true;
  showPanel(homePanel);
}

function startFreeRide(): void {
  acceptRoomUpdates = false;
  getProfile();
  if (roomPhase !== null) roomClient.send({ type: 'leave_room' });
  roomPhase = null;
  roomCode = '';
  raceStandings = [];
  raceScene.setNetworkMode(false);
  raceScene.setPlayers([], 'local');
  raceScene.randomizeTrack();
  raceScene.resetLocalRide();
  raceScene.setDrivingEnabled(true);
  raceMeters.hidden = false;
  raceClock.hidden = true;
  miniMap.hidden = true;
  stabilityCard.hidden = true;
  combatPrompt.hidden = true;
  actionLabel.textContent = 'STRIKE'; actionButton.dataset.ready = 'false';
  positionReadout.textContent = 'SOLO';
  requiredElement<HTMLElement>('#reset-hint').hidden = false;
  lapReadout.textContent = 'SOLO PRACTICE';
  actionButton.hidden = true;
  requiredElement<HTMLElement>('#boost-help').textContent = 'Solo boost recharges automatically';
  showPanel(null);
}

requiredElement<HTMLButtonElement>('#leave-room').addEventListener('click', leaveRoom);
requiredElement<HTMLButtonElement>('#leave-from-results').addEventListener('click', leaveRoom);
requiredElement<HTMLButtonElement>('#free-ride').addEventListener('click', startFreeRide);
requiredElement<HTMLButtonElement>('#free-ride-from-lobby').addEventListener('click', startFreeRide);
menuButton.addEventListener('click', leaveRoom);
requiredElement<HTMLButtonElement>('#controls-toggle').addEventListener('click', () => {
  raceScene.setDrivingEnabled(false);
  controlsDialog.showModal();
});
controlsDialog.addEventListener('close', () => raceScene.setDrivingEnabled(flowShade.hidden));
window.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLElement && event.target.closest('input, textarea, dialog')) return;
  if (event.key === '?') { event.preventDefault(); requiredElement<HTMLButtonElement>('#controls-toggle').click(); }
  if (event.key === 'Escape' && flowShade.hidden && roomPhase === null) leaveRoom();
});
requiredElement<HTMLButtonElement>('#copy-link').addEventListener('click', async () => {
  const url = new URL(window.location.href);
  url.searchParams.set('room', roomCode);
  try {
    await navigator.clipboard.writeText(url.toString());
    lobbyMessage.textContent = 'Invite link copied. Send it to your group.';
  } catch {
    lobbyMessage.textContent = `Share room code ${roomCode} with your group.`;
  }
});

async function connectToServer(): Promise<void> {
  setConnection('connecting');
  try {
  await roomClient.connect();
  setConnection('online');
  flowMessage.textContent = 'Create a private room or join with a code.';
  const roomFromLink = new URLSearchParams(window.location.search).get('room');
  if (roomFromLink) {
    codeInput.value = roomFromLink.toUpperCase();
    joinRoom(roomFromLink);
  }
} catch {
  setConnection('offline');
  flowMessage.textContent = 'Multiplayer is unavailable right now. Try a solo ride.';
}
}
requiredElement<HTMLButtonElement>('#retry-connection').addEventListener('click', () => { void connectToServer(); });
showPanel(homePanel);
void connectToServer();

window.setInterval(() => {
  if (roomPhase !== 'racing') return;
  inputSequence += 1;
  roomClient.send({ type: 'input', input: raceScene.getPlayerInput(inputSequence) });
}, 50);

raceScene.engine.runRenderLoop(() => {
  const frameTime = Math.min(raceScene.engine.getDeltaTime() / 1000, simulationStep * maxSimulationSteps);
  simulationAccumulator = Math.min(simulationAccumulator + frameTime, simulationStep * maxSimulationSteps);

  let steps = 0;
  while (simulationAccumulator >= simulationStep && steps < maxSimulationSteps) {
    raceScene.update(simulationStep);
    simulationAccumulator -= simulationStep;
    steps += 1;
  }

  raceScene.scene.render();
  if (roomPhase !== 'racing') {
    speedReadout.textContent = String(Math.round(Math.abs(raceScene.speedMetersPerSecond()) * 3.6));
    updateBoostHud(raceScene.boostCharge());
  }
});

window.addEventListener('resize', () => raceScene.engine.resize());
window.addEventListener('beforeunload', () => {
  roomClient.close();
  raceScene.dispose();
});
