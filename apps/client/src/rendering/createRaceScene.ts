import { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import { Engine } from '@babylonjs/core/Engines/engine';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Viewport } from '@babylonjs/core/Maths/math.viewport';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Scene } from '@babylonjs/core/scene';
import {
  TRACK_LENGTH_METERS, RACE_LAPS, createTrack, sampleTrack, createRaceRiderState, stepRace,
  type CombatEvent, type PlayerInput, type PublicPlayer, type RaceRiderState, type RiderSnapshot,
} from '@rival/shared';
import { KeyboardBikeInput } from '../game/KeyboardBikeInput';
import { createPlayerBike, setPlayerBikeColor, playBikeStrike, updateBikeVisual } from './createPlayerBike';
import { createCityCircuit } from './createCityCircuit';
import { ThirdPersonCamera } from './ThirdPersonCamera';
import { CombatEffects } from './CombatEffects';

export interface RaceScene {
  engine: AbstractEngine;
  scene: Scene;
  speedMetersPerSecond: () => number;
  boostCharge: () => number;
  getPlayerInput: (sequence: number) => PlayerInput;
  setPlayers: (players: PublicPlayer[], localPlayerId: string) => void;
  setLocalBikeColor: (color: string) => void;
  applySnapshots: (riders: RiderSnapshot[]) => void;
  setNetworkMode: (enabled: boolean) => void;
  setDrivingEnabled: (enabled: boolean) => void;
  setMenuMode: (enabled: boolean) => void;
  resetLocalRide: () => void;
  setTrackSeed: (seed: number) => void;
  randomizeTrack: () => void;
  playCombatEvent: (event: CombatEvent) => void;
  update: (deltaSeconds: number) => void;
  dispose: () => void;
}

async function createEngine(canvas: HTMLCanvasElement): Promise<AbstractEngine> {
  try {
    const { WebGPUEngine } = await import('@babylonjs/core/Engines/webgpuEngine');
    if (await WebGPUEngine.IsSupportedAsync) {
      const engine = new WebGPUEngine(canvas, { antialias: true, adaptToDeviceRatio: true });
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          engine.initAsync(),
          new Promise<never>((_resolve, reject) => {
            timeout = setTimeout(() => reject(new Error('WebGPU startup timed out')), 5000);
          }),
        ]);
        return engine;
      }
      catch (error) { engine.dispose(); console.warn('WebGPU initialization failed; falling back to WebGL.', error); }
      finally { if (timeout !== undefined) clearTimeout(timeout); }
    }
  } catch (error) { console.info('WebGPU is unavailable; using WebGL.', error); }
  return new Engine(canvas, true, { antialias: true, adaptToDeviceRatio: true });
}

export async function createRaceScene(canvas: HTMLCanvasElement, bikeColor = '#27bfff'): Promise<RaceScene> {
  const engine = await createEngine(canvas);
  engine.setHardwareScalingLevel(Math.max(1, window.devicePixelRatio / 1.5));
  const scene = new Scene(engine);
  let trackSeed = 1;
  let track = createTrack(trackSeed, TRACK_LENGTH_METERS);
  let world = createCityCircuit(scene, track);
  const combatEffects = new CombatEffects(scene);
  const bike = createPlayerBike(scene, bikeColor);
  const input = new KeyboardBikeInput();
  const followCamera = new ThirdPersonCamera(scene, bike);
  const menuCamera = new FreeCamera('garage-camera', Vector3.Zero(), scene);
  menuCamera.minZ = 0.1; menuCamera.maxZ = 1800; menuCamera.fov = 0.7;
  const bikes = new Map<string, TransformNode>([['local', bike]]);
  const targets = new Map<string, RiderSnapshot>();
  let localPlayerId = 'local';
  let networkMode = false;
  let drivingEnabled = false;
  let menuMode = true;
  let predictedRider: RaceRiderState | null = null;
  let practiceRider = createRaceRiderState('local', 0);
  let elapsedMs = 0;

  function placeBike(node: TransformNode, state: RiderSnapshot, blend = 1): void {
    const pose = sampleTrack(track, state.z, state.x);
    node.position.x += (pose.x - node.position.x) * blend;
    node.position.z += (pose.z - node.position.z) * blend;
    const heading = pose.heading + state.heading;
    const difference = Math.atan2(Math.sin(heading - node.rotation.y), Math.cos(heading - node.rotation.y));
    node.rotation.y += difference * blend;
  }
  function positionMenuCamera(): void {
    const forward = new Vector3(Math.sin(bike.rotation.y), 0, Math.cos(bike.rotation.y));
    const side = new Vector3(forward.z, 0, -forward.x);
    menuCamera.position.copyFrom(bike.position).subtractInPlace(forward.scale(4.8)).addInPlace(side.scale(5.5)).addInPlace(new Vector3(0, 2.65, 0));
    menuCamera.setTarget(bike.position.add(new Vector3(0, 1.05, 0)));
    const inset = window.innerWidth >= 900 ? 0.28 : 0;
    menuCamera.viewport = new Viewport(inset, 0, 1 - inset, 1);
  }
  function resetLocalRide(): void {
    practiceRider = createRaceRiderState('local', 0);
    practiceRider.boost = 100;
    placeBike(bike, practiceRider);
    bike.rotation.z = 0;
    followCamera.snap();
    positionMenuCamera();
  }
  function setTrackSeed(seed: number): void {
    if (seed === trackSeed) return;
    trackSeed = seed;
    world.dispose(); track = createTrack(seed, TRACK_LENGTH_METERS); world = createCityCircuit(scene, track);
    resetLocalRide();
  }
  resetLocalRide();
  scene.activeCamera = menuCamera;

  return {
    engine, scene,
    speedMetersPerSecond: () => networkMode && predictedRider ? predictedRider.speed : practiceRider.speed,
    boostCharge: () => networkMode ? predictedRider?.boost ?? 0 : practiceRider.boost,
    getPlayerInput: (sequence) => input.toPlayerInput(sequence),
    setPlayers: (players, playerId) => {
      const localAvatar = bikes.get(localPlayerId) ?? bikes.get('local') ?? bike;
      bikes.delete(localPlayerId); bikes.delete('local');
      localPlayerId = playerId; bikes.set(localPlayerId, localAvatar);
      for (const player of players) {
        if (player.id === localPlayerId) { setPlayerBikeColor(bike, player.bikeColor); continue; }
        let remote = bikes.get(player.id);
        if (!remote) { remote = createPlayerBike(scene, player.bikeColor); bikes.set(player.id, remote); }
        if (!networkMode) {
          const grid = createRaceRiderState(player.id, players.indexOf(player) % 2 ? 2.8 : -2.8);
          grid.z = -3 - players.indexOf(player) * 2;
          placeBike(remote, grid);
        }
      }
      for (const [id, riderBike] of bikes) {
        if (id !== localPlayerId && !players.some((player) => player.id === id)) {
          riderBike.dispose(false); bikes.delete(id); targets.delete(id);
        }
      }
    },
    setLocalBikeColor: (color) => setPlayerBikeColor(bike, color),
    applySnapshots: (riders) => {
      for (const rider of riders) {
        targets.set(rider.id, rider);
        if (rider.id === localPlayerId && predictedRider) {
          Object.assign(predictedRider, rider);
          predictedRider.finished = rider.z >= TRACK_LENGTH_METERS * RACE_LAPS;
        }
      }
    },
    setNetworkMode: (enabled) => {
      if (enabled && !networkMode) {
        predictedRider = createRaceRiderState(localPlayerId, 0);
        targets.clear();
      }
      if (!enabled) predictedRider = null;
      networkMode = enabled;
    },
    setDrivingEnabled: (enabled) => { drivingEnabled = enabled; if (!enabled) input.clear(); },
    setMenuMode: (enabled) => {
      if (menuMode === enabled) return;
      menuMode = enabled;
      scene.activeCamera = enabled ? menuCamera : followCamera.camera;
      if (enabled) positionMenuCamera(); else followCamera.snap();
    },
    resetLocalRide, setTrackSeed,
    randomizeTrack: () => setTrackSeed(crypto.getRandomValues(new Uint32Array(1))[0] ?? 1),
    playCombatEvent: (event) => {
      const attacker = bikes.get(event.attackerId);
      if (attacker) playBikeStrike(attacker, event.direction, event.style);
      const target = bikes.get(event.targetId);
      if (target && event.kind !== 'windup') combatEffects.hit(target, event.direction);
    },
    update: (dt) => {
      elapsedMs += dt * 1000;
      combatEffects.update(dt);
      if (drivingEnabled && !networkMode) {
        if (input.reset) resetLocalRide();
        practiceRider.input = input.toPlayerInput(practiceRider.input.sequence + 1);
        if (!input.boost) practiceRider.boost = Math.min(100, practiceRider.boost + dt * 14);
        stepRace([practiceRider], dt, elapsedMs);
        if (practiceRider.z >= TRACK_LENGTH_METERS) practiceRider.z -= TRACK_LENGTH_METERS;
        placeBike(bike, practiceRider);
        updateBikeVisual(bike, practiceRider.speed, input.boost && practiceRider.boost > 0, practiceRider.wobble, practiceRider.input.steer, dt);
      }
      if (networkMode) {
        if (predictedRider) {
          predictedRider.input = input.toPlayerInput(predictedRider.input.sequence + 1);
          const remotePredictions = [...targets.values()].filter((target) => target.id !== localPlayerId).map((target) => Object.assign(createRaceRiderState(target.id, target.x), target));
          stepRace([predictedRider, ...remotePredictions], dt, elapsedMs);
        }
        const blend = 1 - Math.exp(-18 * Math.min(dt, 0.1));
        for (const [id, target] of targets) {
          const node = bikes.get(id); if (!node) continue;
          const state = id === localPlayerId && predictedRider ? predictedRider : target;
          placeBike(node, state, blend);
          updateBikeVisual(node, state.speed, state.speed > 33, state.wobble, state.heading * 5, dt);
        }
      }
      if (menuMode) positionMenuCamera();
      else followCamera.update(dt, networkMode ? predictedRider?.speed ?? 0 : practiceRider.speed);
    },
    dispose: () => { input.dispose(); scene.dispose(); engine.dispose(); },
  };
}
