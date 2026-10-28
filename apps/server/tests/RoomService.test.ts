import assert from 'node:assert/strict';
import test from 'node:test';
import { RoomService } from '../src/RoomService.ts';
import type { ServerMessage } from '@rival/shared';

const rider = (nickname: string) => ({ type: 'create_room' as const, nickname, bikeColor: '#f2315a' });
const joiner = (roomCode: string, nickname: string) => ({ type: 'join_room' as const, roomCode, nickname, bikeColor: '#21c9e6' });

function lastRoomState(messages: ServerMessage[]): Extract<ServerMessage, { type: 'room_state' }> {
  const state = messages.slice().reverse().find((message) => message.type === 'room_state');
  assert.ok(state && state.type === 'room_state');
  return state;
}

test('creates a private room, joins a rider, and transfers host on departure', () => {
  const rooms = new RoomService();
  const first: ServerMessage[] = [];
  const second: ServerMessage[] = [];
  rooms.handle('p1', (message) => first.push(message), rider('Rider One'));
  const created = lastRoomState(first);

  rooms.handle('p2', (message) => second.push(message), joiner(created.roomCode, 'Rider Two'));
  assert.equal(lastRoomState(second).players.length, 2);

  rooms.disconnect('p1');
  assert.equal(lastRoomState(second).hostId, 'p2');
  rooms.dispose();
});

test('enforces the six-rider room cap', () => {
  const rooms = new RoomService();
  const hostMessages: ServerMessage[] = [];
  rooms.handle('p1', (message) => hostMessages.push(message), rider('Rider One'));
  const code = lastRoomState(hostMessages).roomCode;

  for (let index = 2; index <= 6; index += 1) {
    rooms.handle(`p${index}`, () => undefined, joiner(code, `Rider ${index}`));
  }

  const fullRoomMessages: ServerMessage[] = [];
  rooms.handle('p7', (message) => fullRoomMessages.push(message), joiner(code, 'Rider Seven'));
  assert.ok(fullRoomMessages.some((message) => message.type === 'error' && message.code === 'room_full'));
  rooms.dispose();
});

test('requires a second ready rider before the host can start', () => {
  const rooms = new RoomService();
  const hostMessages: ServerMessage[] = [];
  rooms.handle('p1', (message) => hostMessages.push(message), rider('Rider One'));
  const code = lastRoomState(hostMessages).roomCode;
  rooms.handle('p2', () => undefined, joiner(code, 'Rider Two'));

  rooms.handle('p1', (message) => hostMessages.push(message), { type: 'start_race' });
  assert.ok(hostMessages.some((message) => message.type === 'error' && message.code === 'not_ready'));

  rooms.handle('p2', () => undefined, { type: 'ready', ready: true });
  rooms.handle('p1', (message) => hostMessages.push(message), { type: 'start_race' });
  assert.equal(lastRoomState(hostMessages).phase, 'countdown');
  rooms.dispose();
});

test('completes a server-owned race and starts a rematch when riders are ready', async () => {
  const rooms = new RoomService();
  const hostMessages: ServerMessage[] = [];
  const riderMessages: ServerMessage[] = [];
  rooms.handle('p1', (message) => hostMessages.push(message), rider('Rider One'));
  const code = lastRoomState(hostMessages).roomCode;
  rooms.handle('p2', (message) => riderMessages.push(message), joiner(code, 'Rider Two'));
  rooms.handle('p2', () => undefined, { type: 'ready', ready: true });
  rooms.handle('p1', () => undefined, { type: 'start_race' });

  await new Promise((resolve) => setTimeout(resolve, 3100));
  assert.equal(lastRoomState(hostMessages).phase, 'racing');
  rooms.handle('p1', () => undefined, {
    type: 'input', input: { sequence: 1, throttle: 1, steer: 0, brake: false, punch: false, boost: false, recover: 0 },
  });
  rooms.handle('p2', () => undefined, {
    type: 'input', input: { sequence: 1, throttle: 1, steer: 0, brake: false, punch: false, boost: false, recover: 0 },
  });
  for (let tick = 0; tick < 18_000; tick += 1) {
    rooms.tick();
    if (hostMessages.some((message) => message.type === 'race_results')) break;
  }

  const resultMessage = hostMessages.find((message) => message.type === 'race_results');
  assert.ok(resultMessage && resultMessage.type === 'race_results');
  assert.deepEqual(resultMessage.standings.map((standing) => standing.place), [1, 2]);
  assert.equal(lastRoomState(hostMessages).phase, 'results');

  rooms.handle('p1', () => undefined, { type: 'rematch' });
  rooms.handle('p2', () => undefined, { type: 'rematch' });
  assert.equal(lastRoomState(hostMessages).phase, 'countdown');
  rooms.dispose();
});

test('quick race fills a clearly identified bot grid, finishes, and rematches on a new road', async () => {
  const rooms = new RoomService();
  const messages: ServerMessage[] = [];
  rooms.handle('human', (message) => messages.push(message), { type: 'quick_race', nickname: 'Human', bikeColor: '#27bfff' });
  const initial = lastRoomState(messages);
  assert.equal(initial.mode, 'quick');
  assert.equal(initial.phase, 'countdown');
  assert.equal(initial.players.filter((player) => player.isBot).length, 4);
  assert.equal(initial.players.filter((player) => !player.isBot).length, 1);
  await new Promise((resolve) => setTimeout(resolve, 3100));
  rooms.handle('human', () => undefined, { type: 'input', input: { sequence: 1, throttle: 1, steer: 0, brake: false, punch: false, boost: false, recover: 0 } });
  for (let tick = 0; tick < 22000; tick += 1) {
    rooms.tick();
    if (messages.at(-1)?.type === 'room_state' && lastRoomState(messages).phase === 'results') break;
  }
  const results = messages.find((message) => message.type === 'race_results');
  assert.ok(results && results.type === 'race_results');
  assert.equal(results.standings.length, 5);
  assert.equal(new Set(results.standings.map((standing) => standing.place)).size, 5);
  rooms.handle('human', () => undefined, { type: 'rematch' });
  const rematch = lastRoomState(messages);
  assert.equal(rematch.phase, 'countdown');
  assert.notEqual(rematch.trackSeed, initial.trackSeed);
  const departed: ServerMessage[] = [];
  rooms.disconnect('human');
  rooms.handle('other-human', (message) => departed.push(message), joiner(initial.roomCode, 'Other'));
  assert.ok(departed.some((message) => message.type === 'error' && message.code === 'room_not_found'));
  rooms.dispose();
});
