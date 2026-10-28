export { createTrack, sampleTrack, type TrackLayout, type TrackPose } from './track.ts';
export const MAX_PLAYERS = 6;
export const MIN_PLAYERS = 2;
export const ROOM_CODE_LENGTH = 6;
export const MAX_NICKNAME_LENGTH = 20;
export const TICK_RATE = 60;
export const TRACK_HALF_WIDTH = 7.1;
export const TRACK_LENGTH_METERS = 2500;
export const BASE_TOP_SPEED = 32;
export const BOOST_TOP_SPEED = 42;
export const RACE_LAPS = 2;
export const SNAPSHOT_EVERY_TICKS = 3;

export interface PlayerInput {
  sequence: number;
  throttle: 0 | 1;
  steer: -1 | 0 | 1;
  brake: boolean;
  punch: boolean;
  boost: boolean;
  recover: -1 | 0 | 1;
}

export type ClientMessage =
  | { type: 'create_room'; nickname: string; bikeColor: string }
  | { type: 'quick_race'; nickname: string; bikeColor: string }
  | { type: 'join_room'; roomCode: string; nickname: string; bikeColor: string }
  | { type: 'ready'; ready: boolean }
  | { type: 'start_race' }
  | { type: 'input'; input: PlayerInput }
  | { type: 'rematch' }
  | { type: 'leave_room' };

export interface PublicPlayer {
  id: string;
  nickname: string;
  bikeColor: string;
  ready: boolean;
  connected: boolean;
  isBot: boolean;
}

export type RoomPhase = 'lobby' | 'countdown' | 'racing' | 'results';

export type ServerMessage =
  | { type: 'welcome'; playerId: string }
  | { type: 'room_state'; roomCode: string; hostId: string; phase: RoomPhase; players: PublicPlayer[]; trackSeed: number; mode: 'private' | 'quick' }
  | { type: 'countdown'; seconds: number }
  | { type: 'race_snapshot'; tick: number; riders: RiderSnapshot[] }
  | { type: 'combat_event'; style: 'punch' | 'kick'; kind: 'windup' | 'hit' | 'counter'; attackerId: string; targetId: string; direction: -1 | 1 }
  | { type: 'race_results'; standings: RaceStanding[] }
  | { type: 'error'; code: string; message: string };

export interface RiderSnapshot {
  id: string;
  x: number;
  z: number;
  heading: number;
  speed: number;
  lap: number;
  boost: number;
  stability: number;
  wobble: number;
  punchCooldown: number;
  counterWindow: number;
}

export interface RaceStanding {
  id: string;
  nickname: string;
  place: number;
  finishTimeMs: number;
}

export interface RaceRiderState extends RiderSnapshot {
  input: PlayerInput;
  punchHeld: boolean;
  punchWindup: number;
  punchTargetId: string | null;
  strikeStyle: 'punch' | 'kick';
  finished: boolean;
  finishTimeMs: number | null;
}

export function createRaceRiderState(id: string, x: number): RaceRiderState {
  return {
    id,
    x,
    z: 0,
    heading: 0,
    speed: 0,
    lap: 1,
    boost: 0,
    stability: 1,
    wobble: 0,
    punchCooldown: 0,
    input: { sequence: 0, throttle: 0, steer: 0, brake: false, punch: false, boost: false, recover: 0 },
    punchHeld: false,
    punchWindup: 0,
    punchTargetId: null,
    strikeStyle: 'punch',
    counterWindow: 0,
    finished: false,
    finishTimeMs: null,
  };
}

export interface CombatEvent {
  style: 'punch' | 'kick';
  kind: 'windup' | 'hit' | 'counter';
  attackerId: string;
  targetId: string;
  direction: -1 | 1;
}

/** Deterministic arcade simulation. Mutates only the supplied server-owned riders. */
export function stepRace(riders: RaceRiderState[], deltaSeconds: number, elapsedMs: number): CombatEvent[] {
  const dt = Math.min(0.05, Math.max(0, deltaSeconds));
  const totalDistance = TRACK_LENGTH_METERS * RACE_LAPS;
  const previousPositions = riders.map(({ id, x, z, finished }) => ({ id, x, z, finished }));
  const punchEdges = new Set(riders.filter((rider) => rider.input.punch && !rider.punchHeld).map((rider) => rider.id));

  for (const rider of riders) {
    rider.punchHeld = rider.input.punch;
    if (rider.finished) continue;
    const previousSpeed = rider.speed;
    rider.punchCooldown = Math.max(0, rider.punchCooldown - dt);
    rider.punchWindup = Math.max(0, rider.punchWindup - dt);
    rider.counterWindow = Math.max(0, rider.counterWindow - dt);
    rider.wobble = Math.max(0, rider.wobble - dt);

    if (rider.input.throttle) rider.speed += 13 * dt;
    if (rider.input.brake) rider.speed = Math.max(0, rider.speed - 24 * dt);
    if (!rider.input.throttle && !rider.input.brake) rider.speed = Math.max(0, rider.speed - 3.5 * dt);
    if (rider.wobble > 0) rider.speed = Math.max(0, rider.speed - 3 * dt);

    const steering = rider.input.steer;
    rider.heading += (steering * 0.16 - rider.heading) * Math.min(1, dt * 5);
    rider.x = Math.max(-TRACK_HALF_WIDTH, Math.min(TRACK_HALF_WIDTH, rider.x + steering * Math.max(2, rider.speed) * 0.12 * dt));

    const drafting = previousPositions.some((other) => other.id !== rider.id
      && !other.finished
      && other.z > rider.z + 2
      && other.z - rider.z < 20
      && Math.abs(other.x - rider.x) < 1.6);
    rider.boost = Math.max(0, Math.min(100, rider.boost + (!rider.input.boost ? (drafting ? 13 : 6) * dt : 0)));

    if (rider.input.boost && !rider.input.brake && rider.boost > 0) {
      rider.speed = Math.min(BOOST_TOP_SPEED, rider.speed + 9 * dt);
      rider.boost = Math.max(0, rider.boost - 32 * dt);
    } else {
      rider.speed = Math.min(rider.speed, Math.max(BASE_TOP_SPEED, previousSpeed - 5 * dt));
    }

    if (rider.wobble > 0 && (rider.input.recover !== 0 || rider.input.punch)) {
      rider.stability = Math.min(1, rider.stability + 0.34 * dt);
    } else if (rider.wobble === 0) {
      rider.stability = Math.min(1, rider.stability + 0.08 * dt);
    }

    rider.z = Math.min(totalDistance, rider.z + rider.speed * dt);
    rider.lap = Math.max(1, Math.min(RACE_LAPS, Math.floor(rider.z / TRACK_LENGTH_METERS) + 1));
    if (rider.z >= totalDistance) {
      rider.finished = true;
      rider.finishTimeMs = elapsedMs;
      rider.speed = 0;
    }
  }

  const events: CombatEvent[] = [];
  const countered = new Set<string>();
  for (const defender of riders) {
    if (!punchEdges.has(defender.id) || defender.counterWindow <= 0) continue;
    const attacker = riders.find((rider) => rider.punchTargetId === defender.id && rider.punchWindup > 0);
    if (!attacker) continue;
    attacker.punchTargetId = null;
    attacker.punchWindup = 0;
    attacker.wobble = Math.max(attacker.wobble, 0.75);
    attacker.stability = Math.max(0, attacker.stability - 0.3);
    attacker.speed = Math.max(0, attacker.speed - 2.5);
    defender.counterWindow = 0;
    defender.punchCooldown = Math.max(defender.punchCooldown, 1.4);
    countered.add(defender.id);
    events.push({ kind: 'counter', style: attacker.strikeStyle, attackerId: defender.id, targetId: attacker.id, direction: attacker.x >= defender.x ? 1 : -1 });
  }

  for (const attacker of riders) {
    if (attacker.finished || attacker.punchWindup > 0 || !attacker.punchTargetId) continue;
    const target = riders.find((candidate) => candidate.id === attacker.punchTargetId);
    attacker.punchTargetId = null;
    if (!target || target.finished || attacker.wobble > 0 || target.wobble > 0
      || Math.abs(target.z - attacker.z) > 4
      || Math.abs(target.x - attacker.x) > 2.7
      || Math.abs(target.speed - attacker.speed) > 5) continue;

    const direction: -1 | 1 = target.x >= attacker.x ? 1 : -1;
    target.x = Math.max(-TRACK_HALF_WIDTH, Math.min(TRACK_HALF_WIDTH, target.x + direction * 1.1));
    target.stability = Math.max(0, target.stability - 0.45);
    target.wobble = 1.35;
    target.speed = Math.max(0, target.speed - 3.5);
    if (target.stability === 0) {
      target.stability = 0.2;
      target.wobble = 2;
      target.speed *= 0.45;
    }
    events.push({ kind: 'hit', style: attacker.strikeStyle, attackerId: attacker.id, targetId: target.id, direction });
  }

  for (const attacker of riders) {
    if (!punchEdges.has(attacker.id) || countered.has(attacker.id) || attacker.finished
      || attacker.punchCooldown > 0 || attacker.wobble > 0) continue;
    const target = riders.find((candidate) => candidate.id !== attacker.id
      && !candidate.finished
      && candidate.wobble <= 0
      && Math.abs(candidate.z - attacker.z) <= 4
      && Math.abs(candidate.x - attacker.x) <= 2.7
      && Math.abs(candidate.speed - attacker.speed) <= 5);
    if (!target) continue;

    const direction: -1 | 1 = target.x >= attacker.x ? 1 : -1;
    attacker.strikeStyle = Math.abs(target.x - attacker.x) > 1.5 ? 'kick' : 'punch';
    attacker.punchWindup = 0.28;
    attacker.punchTargetId = target.id;
    attacker.punchCooldown = 2.2;
    target.counterWindow = 0.28;
    events.push({ kind: 'windup', style: attacker.strikeStyle, attackerId: attacker.id, targetId: target.id, direction });
  }

  return events;
}

export const BIKE_COLORS = ['#f2315a', '#21c9e6', '#ffb52e', '#9b6bff', '#52d273', '#f477d0'] as const;

const ROOM_CODE_PATTERN = /^[A-Z2-9]{6}$/;
const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(record: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(record).every((key) => keys.includes(key));
}

function isValidNickname(value: unknown): value is string {
  return typeof value === 'string'
    && value.trim().length > 0
    && value.trim().length <= MAX_NICKNAME_LENGTH
    && !/[\u0000-\u001f\u007f]/u.test(value);
}

function isValidBikeColor(value: unknown): value is string {
  return typeof value === 'string' && COLOR_PATTERN.test(value);
}

function isPlayerInput(value: unknown): value is PlayerInput {
  if (!isRecord(value) || !hasOnlyKeys(value, ['sequence', 'throttle', 'steer', 'brake', 'punch', 'boost', 'recover'])) return false;
  return typeof value.sequence === 'number'
    && Number.isSafeInteger(value.sequence)
    && value.sequence >= 0
    && (value.throttle === 0 || value.throttle === 1)
    && (value.steer === -1 || value.steer === 0 || value.steer === 1)
    && typeof value.brake === 'boolean'
    && typeof value.punch === 'boolean'
    && typeof value.boost === 'boolean'
    && (value.recover === -1 || value.recover === 0 || value.recover === 1);
}

/** Runtime validation for untrusted JSON received from a client socket. */
export function parseClientMessage(value: unknown): ClientMessage | null {
  if (!isRecord(value) || typeof value.type !== 'string') return null;
  switch (value.type) {
    case 'create_room':
    case 'quick_race':
      return hasOnlyKeys(value, ['type', 'nickname', 'bikeColor'])
        && isValidNickname(value.nickname)
        && isValidBikeColor(value.bikeColor)
        ? { type: value.type, nickname: value.nickname.trim(), bikeColor: value.bikeColor }
        : null;
    case 'join_room':
      return hasOnlyKeys(value, ['type', 'roomCode', 'nickname', 'bikeColor'])
        && typeof value.roomCode === 'string'
        && ROOM_CODE_PATTERN.test(value.roomCode)
        && isValidNickname(value.nickname)
        && isValidBikeColor(value.bikeColor)
        ? { type: 'join_room', roomCode: value.roomCode, nickname: value.nickname.trim(), bikeColor: value.bikeColor }
        : null;
    case 'ready':
      return hasOnlyKeys(value, ['type', 'ready']) && typeof value.ready === 'boolean'
        ? { type: 'ready', ready: value.ready }
        : null;
    case 'start_race':
      return hasOnlyKeys(value, ['type']) ? { type: 'start_race' } : null;
    case 'input':
      return hasOnlyKeys(value, ['type', 'input']) && isPlayerInput(value.input)
        ? { type: 'input', input: value.input }
        : null;
    case 'rematch':
      return hasOnlyKeys(value, ['type']) ? { type: 'rematch' } : null;
    case 'leave_room':
      return hasOnlyKeys(value, ['type']) ? { type: 'leave_room' } : null;
    default:
      return null;
  }
}

function isPublicPlayer(value: unknown): value is PublicPlayer {
  return isRecord(value)
    && hasOnlyKeys(value, ['id', 'nickname', 'bikeColor', 'ready', 'connected', 'isBot'])
    && typeof value.id === 'string'
    && value.id.length <= 64
    && isValidNickname(value.nickname)
    && isValidBikeColor(value.bikeColor)
    && typeof value.ready === 'boolean'
    && typeof value.connected === 'boolean'
    && typeof value.isBot === 'boolean';
}

function isRiderSnapshot(value: unknown): value is RiderSnapshot {
  if (!isRecord(value) || !hasOnlyKeys(value, ['id', 'x', 'z', 'heading', 'speed', 'lap', 'boost', 'stability', 'wobble', 'punchCooldown', 'counterWindow'])) return false;
  return typeof value.id === 'string'
    && value.id.length <= 64
    && typeof value.x === 'number' && Number.isFinite(value.x)
    && typeof value.z === 'number' && Number.isFinite(value.z)
    && typeof value.heading === 'number' && Number.isFinite(value.heading)
    && typeof value.speed === 'number' && Number.isFinite(value.speed)
    && typeof value.lap === 'number' && Number.isSafeInteger(value.lap) && value.lap >= 1 && value.lap <= RACE_LAPS
    && typeof value.boost === 'number' && Number.isFinite(value.boost) && value.boost >= 0 && value.boost <= 100
    && typeof value.stability === 'number' && Number.isFinite(value.stability) && value.stability >= 0 && value.stability <= 1
    && typeof value.wobble === 'number' && Number.isFinite(value.wobble) && value.wobble >= 0
    && typeof value.punchCooldown === 'number' && Number.isFinite(value.punchCooldown) && value.punchCooldown >= 0
    && typeof value.counterWindow === 'number' && Number.isFinite(value.counterWindow) && value.counterWindow >= 0;
}

function isRaceStanding(value: unknown): value is RaceStanding {
  return isRecord(value)
    && hasOnlyKeys(value, ['id', 'nickname', 'place', 'finishTimeMs'])
    && typeof value.id === 'string'
    && isValidNickname(value.nickname)
    && typeof value.place === 'number'
    && Number.isSafeInteger(value.place)
    && value.place >= 1
    && value.place <= MAX_PLAYERS
    && typeof value.finishTimeMs === 'number'
    && Number.isFinite(value.finishTimeMs)
    && value.finishTimeMs >= 0;
}

/** Runtime validation for data received by the browser from the room server. */
export function parseServerMessage(value: unknown): ServerMessage | null {
  if (!isRecord(value) || typeof value.type !== 'string') return null;
  switch (value.type) {
    case 'welcome':
      return hasOnlyKeys(value, ['type', 'playerId']) && typeof value.playerId === 'string' && value.playerId.length <= 64
        ? { type: 'welcome', playerId: value.playerId }
        : null;
    case 'room_state':
      return hasOnlyKeys(value, ['type', 'roomCode', 'hostId', 'phase', 'players', 'trackSeed', 'mode'])
        && typeof value.roomCode === 'string' && ROOM_CODE_PATTERN.test(value.roomCode)
        && typeof value.hostId === 'string' && value.hostId.length <= 64
        && (value.phase === 'lobby' || value.phase === 'countdown' || value.phase === 'racing' || value.phase === 'results')
        && typeof value.trackSeed === 'number' && Number.isSafeInteger(value.trackSeed) && value.trackSeed >= 0 && value.trackSeed <= 0xffffffff
        && (value.mode === 'private' || value.mode === 'quick')
        && Array.isArray(value.players) && value.players.length <= MAX_PLAYERS && value.players.every(isPublicPlayer)
        ? { type: 'room_state', roomCode: value.roomCode, hostId: value.hostId, phase: value.phase, players: value.players, trackSeed: value.trackSeed, mode: value.mode }
        : null;
    case 'countdown':
      return hasOnlyKeys(value, ['type', 'seconds'])
        && typeof value.seconds === 'number' && Number.isSafeInteger(value.seconds) && value.seconds >= 1 && value.seconds <= 3
        ? { type: 'countdown', seconds: value.seconds }
        : null;
    case 'race_snapshot':
      return hasOnlyKeys(value, ['type', 'tick', 'riders'])
        && typeof value.tick === 'number' && Number.isSafeInteger(value.tick) && value.tick >= 0
        && Array.isArray(value.riders) && value.riders.length <= MAX_PLAYERS && value.riders.every(isRiderSnapshot)
        ? { type: 'race_snapshot', tick: value.tick, riders: value.riders }
        : null;
    case 'combat_event':
      return hasOnlyKeys(value, ['type', 'kind', 'attackerId', 'targetId', 'direction', 'style'])
        && (value.style === 'punch' || value.style === 'kick')
        && (value.kind === 'windup' || value.kind === 'hit' || value.kind === 'counter')
        && typeof value.attackerId === 'string' && typeof value.targetId === 'string'
        && (value.direction === -1 || value.direction === 1)
        ? { type: 'combat_event', kind: value.kind, style: value.style, attackerId: value.attackerId, targetId: value.targetId, direction: value.direction }
        : null;
    case 'race_results':
      return hasOnlyKeys(value, ['type', 'standings'])
        && Array.isArray(value.standings) && value.standings.length <= MAX_PLAYERS
        && value.standings.every(isRaceStanding)
        ? { type: 'race_results', standings: value.standings }
        : null;
    case 'error':
      return hasOnlyKeys(value, ['type', 'code', 'message'])
        && typeof value.code === 'string' && value.code.length <= 40
        && typeof value.message === 'string' && value.message.length <= 200
        ? { type: 'error', code: value.code, message: value.message }
        : null;
    default:
      return null;
  }
}
