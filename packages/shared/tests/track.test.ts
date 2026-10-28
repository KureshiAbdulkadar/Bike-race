import assert from 'node:assert/strict';
import test from 'node:test';
import { createTrack, sampleTrack, TRACK_LENGTH_METERS } from '../src/index.ts';

test('a shared seed produces identical closed roads and different seeds change the layout', () => {
  const first = createTrack(1042, TRACK_LENGTH_METERS);
  assert.deepEqual(first, createTrack(1042, TRACK_LENGTH_METERS));
  assert.notDeepEqual(first.points, createTrack(999, TRACK_LENGTH_METERS).points);
  assert.deepEqual(sampleTrack(first, 0), sampleTrack(first, TRACK_LENGTH_METERS));
  assert.deepEqual(sampleTrack(first, -10), sampleTrack(first, TRACK_LENGTH_METERS - 10));
});

test('road progress and lane sampling stay finite, ordered, and correctly spaced', () => {
  for (const seed of [0, 1, 42, 0xffffffff]) {
    const track = createTrack(seed, TRACK_LENGTH_METERS);
    assert.equal(track.points.at(-1)?.distance, TRACK_LENGTH_METERS);
    for (let i = 1; i < track.points.length; i += 1) assert.ok((track.points[i]?.distance ?? 0) > (track.points[i - 1]?.distance ?? 0));
    for (let distance = 0; distance < TRACK_LENGTH_METERS; distance += 17) {
      const center = sampleTrack(track, distance);
      const lane = sampleTrack(track, distance, 5);
      assert.ok(Number.isFinite(center.x) && Number.isFinite(center.z) && Number.isFinite(center.heading));
      assert.ok(Math.abs(Math.hypot(lane.x-center.x,lane.z-center.z)-5)<0.000001);
    }
  }
});
