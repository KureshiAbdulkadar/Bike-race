import type { PlayerInput, RaceRiderState } from '@rival/shared';

/** Server-only race opponents. They send input intents through the same simulation rules. */
export function botInput(rider: RaceRiderState, riders: RaceRiderState[], tick: number, index: number): PlayerInput {
  const ahead = riders.filter((other) => other.id !== rider.id && !other.finished && other.z > rider.z && other.z - rider.z < 28).sort((a,b) => a.z - b.z)[0];
  const phase = Math.sin(tick / 190 + index * 2.1);
  const wantedLane = ahead && rider.boost < 45 ? ahead.x : Math.max(-5.5, Math.min(5.5, (index - 1.5) * 2.7 + phase * 1.4));
  const difference = wantedLane - rider.x;
  const inDuel = riders.some((other) => other.id !== rider.id && !other.finished && Math.abs(other.z-rider.z)<3.7 && Math.abs(other.x-rider.x)<2.7 && Math.abs(other.speed-rider.speed)<5);
  // Pulsed attacks preserve the same rising-edge/cooldown rules as human input.
  const punch = rider.counterWindow > 0 ? rider.counterWindow < 0.17 && (tick + index * 7) % 17 === 0 : inDuel && tick % (37 + index * 4) === 0;
  return { sequence: tick, throttle: tick % 360 > index * 2 ? 1 : 0, steer: difference > 0.3 ? 1 : difference < -0.3 ? -1 : 0, brake: false, punch, boost: rider.boost > 40 && (!ahead || ahead.z-rider.z<10), recover: rider.wobble > 0 ? 1 : 0 };
}
