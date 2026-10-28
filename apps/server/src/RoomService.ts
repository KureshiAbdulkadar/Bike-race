import { botInput } from './BotDriver.ts';
import { randomInt, randomUUID } from 'node:crypto';
import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  ROOM_CODE_LENGTH,
  SNAPSHOT_EVERY_TICKS,
  TICK_RATE,
  createRaceRiderState,
  stepRace,
  type ClientMessage,
  type PublicPlayer,
  type RaceRiderState,
  type RaceStanding,
  type RoomPhase,
  type ServerMessage,
} from '@rival/shared';

interface PlayerSession {
  id: string;
  nickname: string;
  bikeColor: string;
  ready: boolean;
  isBot: boolean;
  send: (message: ServerMessage) => void;
}

interface Room {
  code: string;
  hostId: string;
  phase: RoomPhase;
  players: Map<string, PlayerSession>;
  countdownTimer: ReturnType<typeof setTimeout> | null;
  riders: Map<string, RaceRiderState>;
  tick: number;
  elapsedMs: number;
  trackSeed: number;
  mode: 'private' | 'quick';
}

const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export class RoomService {
  private readonly rooms = new Map<string, Room>();
  private readonly playerRooms = new Map<string, string>();

  handle(playerId: string, send: PlayerSession['send'], message: ClientMessage): void {
    if (message.type === 'create_room' || message.type === 'quick_race') {
      this.leave(playerId);
      const code = this.createCode();
      const player: PlayerSession = { id: playerId, nickname: message.nickname, bikeColor: message.bikeColor, ready: true, isBot: false, send };
      const room: Room = {
        code, hostId: playerId, phase: 'lobby', players: new Map([[playerId, player]]),
        countdownTimer: null, riders: new Map(), tick: 0, elapsedMs: 0, trackSeed: randomInt(0x100000000), mode: message.type === 'quick_race' ? 'quick' : 'private',
      };
      this.rooms.set(code, room);
      this.playerRooms.set(playerId, code);
      send({ type: 'welcome', playerId });
      if (message.type === 'quick_race') {
        const names = ['Nova', 'Axle', 'Blaze', 'Vex'];
        const colors = ['#f2315a', '#ffb52e', '#9b6bff', '#52d273'];
        names.forEach((nickname, index) => {
          const id = `bot-${randomUUID()}`;
          room.players.set(id, { id, nickname, bikeColor: colors[index] ?? '#f2315a', ready: true, isBot: true, send: () => undefined });
        });
        this.beginCountdown(room);
      } else this.broadcastRoom(room);
      return;
    }

    if (message.type === 'join_room') {
      const room = this.rooms.get(message.roomCode);
      if (!room) return this.error(send, 'room_not_found', 'That room code is not active.');
      if (room.phase !== 'lobby') return this.error(send, 'race_in_progress', 'This room has already started a race.');
      if (this.getRoomFor(playerId)?.code === room.code) return this.error(send, 'already_in_room', 'You are already in this room.');
      if (room.players.size >= MAX_PLAYERS) return this.error(send, 'room_full', 'This room already has six riders.');
      this.leave(playerId);
      const player: PlayerSession = { id: playerId, nickname: message.nickname, bikeColor: message.bikeColor, ready: false, isBot: false, send };
      room.players.set(playerId, player);
      this.playerRooms.set(playerId, room.code);
      send({ type: 'welcome', playerId });
      this.broadcastRoom(room);
      return;
    }

    const room = this.getRoomFor(playerId);
    if (!room) return this.error(send, 'not_in_room', 'Create or join a room first.');
    const player = room.players.get(playerId);
    if (!player) return this.error(send, 'not_in_room', 'Create or join a room first.');

    switch (message.type) {
      case 'ready':
        if (room.phase !== 'lobby') return this.error(send, 'wrong_phase', 'Ready state can only change in the lobby.');
        player.ready = message.ready;
        this.broadcastRoom(room);
        break;
      case 'start_race':
        if (player.id !== room.hostId) return this.error(send, 'host_only', 'Only the room host can start the race.');
        if (room.phase !== 'lobby') return this.error(send, 'wrong_phase', 'The race cannot start in this phase.');
        if (room.players.size < MIN_PLAYERS) return this.error(send, 'need_more_riders', 'Invite at least one other rider first.');
        if ([...room.players.values()].some((rider) => !rider.ready)) return this.error(send, 'not_ready', 'Every rider must be ready.');
        this.beginCountdown(room);
        break;
      case 'leave_room':
        this.leave(playerId);
        break;
      case 'rematch':
        if (room.phase !== 'results') return this.error(send, 'wrong_phase', 'A rematch is available after the results.');
        player.ready = true;
        this.broadcastRoom(room);
        if (room.players.size >= MIN_PLAYERS && [...room.players.values()].every((rider) => rider.ready)) this.beginCountdown(room);
        break;
      case 'input':
        if (room.phase !== 'racing') return this.error(send, 'wrong_phase', 'Race controls are only accepted during a race.');
        {
          const rider = room.riders.get(playerId);
          if (rider && message.input.sequence > rider.input.sequence) rider.input = message.input;
        }
        break;
    }
  }

  disconnect(playerId: string): void {
    this.leave(playerId);
  }

  tick(): void {
    const deltaSeconds = 1 / TICK_RATE;
    for (const room of this.rooms.values()) {
      if (room.phase !== 'racing') continue;
      room.tick += 1;
      room.elapsedMs += 1000 / TICK_RATE;
      const riders = [...room.riders.values()];
      let botIndex = 0;
      for (const rider of riders) {
        if (room.players.get(rider.id)?.isBot) rider.input = botInput(rider, riders, room.tick, botIndex++);
      }
      const combatEvents = stepRace(riders, deltaSeconds, room.elapsedMs);
      for (const event of combatEvents) this.broadcast(room, { type: 'combat_event', ...event });

      if (room.tick % SNAPSHOT_EVERY_TICKS === 0) {
        this.broadcast(room, {
          type: 'race_snapshot',
          tick: room.tick,
          riders: riders.map(({ id, x, z, heading, speed, lap, boost, stability, wobble, punchCooldown, counterWindow }) => ({
            id, x, z, heading, speed, lap, boost, stability, wobble, punchCooldown, counterWindow,
          })),
        });
      }

      if (riders.length > 0 && riders.every((rider) => rider.finished)) this.finishRace(room, riders);
    }
  }

  dispose(): void {
    for (const room of this.rooms.values()) {
      if (room.countdownTimer) clearTimeout(room.countdownTimer);
    }
    this.rooms.clear();
    this.playerRooms.clear();
  }

  private beginCountdown(room: Room): void {
    if (room.countdownTimer) clearTimeout(room.countdownTimer);
    room.trackSeed = (room.trackSeed + randomInt(1, 0x100000000)) >>> 0;
    room.phase = 'countdown';
    let seconds = 3;
    const tick = (): void => {
      if (seconds === 0) {
        room.countdownTimer = null;
        this.startRace(room);
        return;
      }
      for (const player of room.players.values()) player.send({ type: 'countdown', seconds });
      seconds -= 1;
      room.countdownTimer = setTimeout(tick, 1000);
    };
    this.broadcastRoom(room);
    tick();
  }

  private startRace(room: Room): void {
    const grid = [-3, 3, -1.8, 1.8, -0.6, 0.6];
    room.riders.clear();
    room.tick = 0;
    room.elapsedMs = 0;
    let index = 0;
    for (const player of room.players.values()) {
      player.ready = player.isBot;
      const rider = createRaceRiderState(player.id, grid[index] ?? 0);
      rider.z = -Math.floor(index / 2) * 3;
      room.riders.set(player.id, rider);
      index += 1;
    }
    room.phase = 'racing';
    this.broadcastRoom(room);
  }

  private finishRace(room: Room, riders: RaceRiderState[]): void {
    room.phase = 'results';
    for (const player of room.players.values()) player.ready = player.isBot;
    const standings: RaceStanding[] = riders
      .slice()
      .sort((a, b) => (a.finishTimeMs ?? Number.MAX_SAFE_INTEGER) - (b.finishTimeMs ?? Number.MAX_SAFE_INTEGER))
      .map((rider, index) => ({
        id: rider.id,
        nickname: room.players.get(rider.id)?.nickname ?? 'Rider',
        place: index + 1,
        finishTimeMs: rider.finishTimeMs ?? room.elapsedMs,
      }));
    this.broadcast(room, { type: 'race_results', standings });
    this.broadcastRoom(room);
  }

  private leave(playerId: string): void {
    const code = this.playerRooms.get(playerId);
    if (!code) return;
    this.playerRooms.delete(playerId);
    const room = this.rooms.get(code);
    if (!room) return;
    room.players.delete(playerId);
    room.riders.delete(playerId);
    if (![...room.players.values()].some((player) => !player.isBot)) {
      if (room.countdownTimer) clearTimeout(room.countdownTimer);
      this.rooms.delete(code);
      return;
    }
    if (room.phase === 'countdown') {
      if (room.countdownTimer) clearTimeout(room.countdownTimer);
      room.countdownTimer = null;
      room.phase = 'lobby';
    }
    if (room.hostId === playerId) {
      const nextHost = [...room.players.values()].find((candidate) => !candidate.isBot);
      if (nextHost) { room.hostId = nextHost.id; nextHost.ready = true; }
    }
    this.broadcastRoom(room);
  }

  private createCode(): string {
    let code = '';
    do {
      code = Array.from({ length: ROOM_CODE_LENGTH }, () => ROOM_ALPHABET[randomInt(ROOM_ALPHABET.length)]).join('');
    } while (this.rooms.has(code));
    return code;
  }

  private getRoomFor(playerId: string): Room | undefined {
    const code = this.playerRooms.get(playerId);
    return code ? this.rooms.get(code) : undefined;
  }

  private broadcastRoom(room: Room): void {
    const players: PublicPlayer[] = [...room.players.values()].map(({ id, nickname, bikeColor, ready, isBot }) => ({
      id, nickname, bikeColor, ready, connected: true, isBot,
    }));
    const message: ServerMessage = { type: 'room_state', roomCode: room.code, hostId: room.hostId, phase: room.phase, players, trackSeed: room.trackSeed, mode: room.mode };
    for (const player of room.players.values()) player.send(message);
  }

  private broadcast(room: Room, message: ServerMessage): void {
    for (const player of room.players.values()) player.send(message);
  }

  private error(send: PlayerSession['send'], code: string, message: string): void {
    send({ type: 'error', code, message });
  }
}

export function createPlayerId(): string {
  return randomUUID();
}
