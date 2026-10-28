import assert from 'node:assert/strict';
import test from 'node:test';
import { BASE_TOP_SPEED, BOOST_TOP_SPEED, RACE_LAPS, TICK_RATE, TRACK_LENGTH_METERS, createRaceRiderState, stepRace } from '../src/index.ts';

test('accelerates with the arcade throttle and builds draft boost behind a rival', () => {
  const player = createRaceRiderState('player', 0);
  const rival = createRaceRiderState('rival', 0);
  player.input.throttle = 1;
  rival.z = 10;
  rival.speed = 12;

  stepRace([player, rival], 1 / 60, 16);

  assert.ok(player.speed > 0);
  assert.ok(player.boost > 0);
});

test('telegraphs a close matching-speed punch, then starts a recoverable wobble', () => {
  const attacker = createRaceRiderState('attacker', 0);
  const target = createRaceRiderState('target', 1);
  attacker.speed = 18;
  target.speed = 18;
  attacker.z = 20;
  target.z = 21;
  attacker.input.punch = true;

  const events = stepRace([attacker, target], 1 / 60, 16);
  attacker.input.punch = false;
  const laterEvents = Array.from({ length: 18 }, (_, index) => stepRace([attacker, target], 1 / 60, 16 + (index + 1) * 16.67)).flat();

  assert.equal(events[0]?.kind, 'windup');
  assert.ok(laterEvents.some((event) => event.kind === 'hit' && event.targetId === 'target'));
  assert.ok(target.wobble > 1);
  assert.ok(target.stability < 1);
});

test('lets the target counter during the windup window', () => {
  const attacker = createRaceRiderState('attacker', 0);
  const target = createRaceRiderState('target', 1);
  attacker.speed = 18;
  target.speed = 18;
  attacker.z = 20;
  target.z = 21;
  attacker.input.punch = true;

  const windup = stepRace([attacker, target], 1 / 60, 16);
  attacker.input.punch = false;
  target.input.punch = true;
  const counter = stepRace([attacker, target], 1 / 60, 32);

  assert.equal(windup[0]?.kind, 'windup');
  assert.equal(counter[0]?.kind, 'counter');
  assert.ok(attacker.wobble > 0);
  assert.equal(target.wobble, 0);
});

test('finishes the second lap at the finish distance', () => {
  const rider = createRaceRiderState('player', 0);
  rider.z = TRACK_LENGTH_METERS * RACE_LAPS - 0.1;
  rider.speed = 20;

  stepRace([rider], 1 / 60, 10_000);

  assert.equal(rider.finished, true);
  assert.equal(rider.lap, 2);
  assert.equal(rider.finishTimeMs, 10_000);
});

test('boost consumes charge and releases gradually back to cruising speed', () => {
  const rider = createRaceRiderState('boosting-rider', 0);
  rider.speed = BASE_TOP_SPEED;
  rider.boost = 100;
  rider.input.throttle = 1;
  rider.input.boost = true;
  for (let tick = 0; tick < TICK_RATE; tick += 1) stepRace([rider], 1 / TICK_RATE, tick * 1000 / TICK_RATE);
  assert.equal(rider.speed, BOOST_TOP_SPEED);
  assert.ok(rider.boost < 100 && rider.boost > 0);
  rider.input.boost = false;
  stepRace([rider], 1 / TICK_RATE, 1000);
  assert.ok(rider.speed > BASE_TOP_SPEED && rider.speed < BOOST_TOP_SPEED);
  for (let tick = 0; tick < TICK_RATE * 2; tick += 1) stepRace([rider], 1 / TICK_RATE, 1000 + tick * 1000 / TICK_RATE);
  assert.equal(rider.speed, BASE_TOP_SPEED);
});

test('a full two-lap race at top speed fits the planned two-to-three-minute window', () => {
  const rider = createRaceRiderState('player', 0);
  let elapsedMs = 0;
  while (!rider.finished && elapsedMs < 180_000) {
    rider.input = { sequence: rider.input.sequence + 1, throttle: 1, steer: 0, brake: false, punch: false, boost: false, recover: 0 };
    elapsedMs += 1000 / TICK_RATE;
    stepRace([rider], 1 / TICK_RATE, elapsedMs);
  }

  assert.equal(rider.finished, true);
  assert.ok((rider.finishTimeMs ?? 0) >= 120_000);
  assert.ok((rider.finishTimeMs ?? Infinity) <= 180_000);
});

test('a wider adjacent strike is a kick and the shared action also recovers wobble', () => {
  const attacker = createRaceRiderState('attacker', 0);
  const target = createRaceRiderState('target', 2.2);
  attacker.speed = 20; target.speed = 20;
  attacker.input.punch = true;
  const events = stepRace([attacker,target], 1 / TICK_RATE, 0);
  assert.equal(events[0]?.style, 'kick');
  target.wobble = 1; target.stability = 0.4; target.input.punch = true;
  stepRace([target], 1 / TICK_RATE, 16);
  assert.ok(target.stability > 0.4);
});


test('normal riding recharges boost and drafting recharges faster', () => {
  const solo = createRaceRiderState('solo', 0);
  const drafting = createRaceRiderState('drafting', 0);
  const leader = createRaceRiderState('leader', 0);
  leader.z = 10;
  for (let tick = 0; tick < TICK_RATE; tick += 1) {
    stepRace([solo], 1 / TICK_RATE, tick * 1000 / TICK_RATE);
    stepRace([drafting, leader], 1 / TICK_RATE, tick * 1000 / TICK_RATE);
  }
  assert.ok(solo.boost > 5.9);
  assert.ok(drafting.boost > solo.boost * 2);
});

test('braking overrides boost and preserves charge', () => {
  const rider = createRaceRiderState('braking', 0);
  rider.speed = BASE_TOP_SPEED; rider.boost = 50;
  rider.input.boost = true; rider.input.brake = true;
  stepRace([rider], 1 / TICK_RATE, 0);
  assert.ok(rider.speed < BASE_TOP_SPEED);
  assert.equal(rider.boost, 50);
});
