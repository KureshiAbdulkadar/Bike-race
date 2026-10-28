import assert from 'node:assert/strict';
import test from 'node:test';
import { parseClientMessage, parseServerMessage } from '../src/index.ts';

test('accepts and normalizes a valid create-room message', () => {
  assert.deepEqual(parseClientMessage({ type: 'create_room', nickname: '  Rider  ', bikeColor: '#f2315a' }), {
    type: 'create_room', nickname: 'Rider', bikeColor: '#f2315a',
  });
});

test('rejects malformed, oversized, and extra-field messages', () => {
  assert.equal(parseClientMessage(null), null);
  assert.equal(parseClientMessage({ type: 'create_room', nickname: ' ', bikeColor: '#f2315a' }), null);
  assert.equal(parseClientMessage({ type: 'create_room', nickname: 'x'.repeat(21), bikeColor: '#f2315a' }), null);
  assert.equal(parseClientMessage({ type: 'create_room', nickname: 'Rider', bikeColor: 'red' }), null);
  assert.equal(parseClientMessage({ type: 'start_race', winner: 'me' }), null);
});

test('validates room codes and structured control input', () => {
  assert.equal(parseClientMessage({ type: 'join_room', roomCode: 'ABCD11', nickname: 'Rider', bikeColor: '#21c9e6' }), null);
  assert.equal(parseClientMessage({
    type: 'input', input: { sequence: 1, throttle: 1, steer: -1, brake: false, punch: false, boost: true, recover: 0 },
  })?.type, 'input');
  assert.equal(parseClientMessage({
    type: 'input', input: { sequence: 1.5, throttle: 1, steer: -1, brake: false, punch: false, boost: true, recover: 0 },
  }), null);
});

test('rejects malformed server snapshots before the client consumes them', () => {
  assert.equal(parseServerMessage({
    type: 'race_snapshot', tick: 3,
    riders: [{ id: 'rider', x: 0, z: 1, heading: 0, speed: 5, lap: 1, boost: 101, stability: 1, wobble: 0 }],
  }), null);
  assert.equal(parseServerMessage({ type: 'countdown', seconds: 8 }), null);
});

test('quick race payloads are validated at the same boundary as private rooms', () => {
  assert.equal(parseClientMessage({ type: 'quick_race', nickname: 'Guest', bikeColor: '#27bfff' })?.type, 'quick_race');
  assert.equal(parseClientMessage({ type: 'quick_race', nickname: '', bikeColor: '#27bfff' }), null);
  assert.equal(parseClientMessage({ type: 'quick_race', nickname: 'Guest', bikeColor: '#27bfff', botCount: 100 }), null);
});
