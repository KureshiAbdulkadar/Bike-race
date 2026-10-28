/** Browser/server-safe, seeded road geometry. Distances are metres along the loop. */
export interface TrackPoint { x: number; z: number; distance: number }
export interface TrackLayout { seed: number; length: number; points: TrackPoint[] }
export interface TrackPose { x: number; z: number; heading: number }

export function createTrack(seed: number, length: number): TrackLayout {
  let state = seed >>> 0;
  const random = (): number => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const phaseA = random() * Math.PI * 2;
  const phaseB = random() * Math.PI * 2;
  const aspect = 1.1 + random() * 0.35;
  const raw: TrackPoint[] = [];
  let distance = 0;
  for (let i = 0; i <= 512; i += 1) {
    const angle = i / 512 * Math.PI * 2;
    const radius = 1 + 0.13 * Math.sin(angle * 2 + phaseA) + 0.07 * Math.sin(angle * 3 + phaseB);
    const point = { x: Math.sin(angle) * radius * aspect, z: Math.cos(angle) * radius / aspect, distance: 0 };
    const previous = raw[i - 1];
    if (previous) distance += Math.hypot(point.x - previous.x, point.z - previous.z);
    point.distance = distance; raw.push(point);
  }
  const scale = length / distance;
  return { seed: seed >>> 0, length, points: raw.map((point) => ({ x: point.x * scale, z: point.z * scale, distance: point.distance * scale })) };
}

export function sampleTrack(track: TrackLayout, progress: number, laneOffset = 0): TrackPose {
  const distance = ((progress % track.length) + track.length) % track.length;
  let lower = 0; let upper = track.points.length - 1;
  while (upper - lower > 1) {
    const middle = (lower + upper) >> 1;
    if ((track.points[middle]?.distance ?? Infinity) <= distance) lower = middle; else upper = middle;
  }
  const a = track.points[lower]; const b = track.points[upper];
  if (!a || !b) throw new Error('Track has no usable road segment.');
  const mix = (distance - a.distance) / Math.max(0.00001, b.distance - a.distance);
  const previous = track.points[(lower - 1 + 512) % 512] ?? a;
  const next = track.points[(upper + 1) % 512] ?? b;
  const tangentAX = b.x - previous.x; const tangentAZ = b.z - previous.z;
  const tangentBX = next.x - a.x; const tangentBZ = next.z - a.z;
  const heading = Math.atan2(tangentAX * (1 - mix) + tangentBX * mix, tangentAZ * (1 - mix) + tangentBZ * mix);
  return {
    x: a.x + (b.x - a.x) * mix + Math.cos(heading) * laneOffset,
    z: a.z + (b.z - a.z) * mix - Math.sin(heading) * laneOffset,
    heading,
  };
}
