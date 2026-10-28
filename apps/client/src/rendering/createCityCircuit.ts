import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import '@babylonjs/core/Meshes/instancedMesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { GlowLayer } from '@babylonjs/core/Layers/glowLayer';
import { Scene } from '@babylonjs/core/scene';
import { sampleTrack, type TrackLayout } from '@rival/shared';

/** Original, procedural city circuit. Repeated scenery shares geometry/materials. */
export function createCityCircuit(scene: Scene, track: TrackLayout): { dispose: () => void } {
  const previousMeshes = new Set(scene.meshes);
  const previousMaterials = new Set(scene.materials);
  const previousLights = new Set(scene.lights);
  const position = (progress: number, lane: number, height: number): Vector3 => { const pose = sampleTrack(track, progress, lane); return new Vector3(pose.x, height, pose.z); };
  let seed = track.seed ^ 714;
  const random = (): number => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const material = (name: string, color: string, emission?: string): StandardMaterial => {
    const result = new StandardMaterial(name, scene);
    result.diffuseColor = Color3.FromHexString(color);
    result.specularColor = new Color3(0.15, 0.17, 0.24);
    if (emission) result.emissiveColor = Color3.FromHexString(emission);
    return result;
  };
  const asphalt = material('circuit-asphalt', '#20283a');
  asphalt.specularColor = new Color3(0.18, 0.2, 0.28);
  asphalt.specularPower = 64;
  const concrete = material('city-concrete', '#171f37');
  const barrier = material('barrier-slate', '#34445f');
  const white = material('road-white', '#e8dbcd', '#3b3346');
  const cyan = material('neon-cyan', '#78efff', '#18c9ff');
  const pink = material('neon-pink', '#ff64d8', '#e42b9e');
  const amber = material('neon-amber', '#ffdc78', '#eeb048');
  for (const neon of [cyan, pink, amber]) neon.disableLighting = true;

  const ambient = new HemisphericLight('sunset-ambient', new Vector3(0, 1, 0), scene);
  ambient.diffuse = new Color3(0.72, 0.8, 1);
  ambient.groundColor = new Color3(0.3, 0.22, 0.4);
  ambient.intensity = 0.85;
  const sun = new DirectionalLight('sunset-key', new Vector3(-0.45, -0.7, -0.4), scene);
  sun.diffuse = new Color3(1, 0.72, 0.5);
  sun.intensity = 1.25;
  scene.clearColor = new Color3(0.4, 0.31, 0.58).toColor4(1);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.0018;
  scene.fogColor = new Color3(0.49, 0.37, 0.59);
  scene.imageProcessingConfiguration.exposure = 1;
  scene.imageProcessingConfiguration.contrast = 1.12;

  const skyTexture = new DynamicTexture('painted-sunset', { width: 2048, height: 1024 }, scene, false);
  const skyContext = skyTexture.getContext();
  const gradient = skyContext.createLinearGradient(0, 0, 0, 1024);
  gradient.addColorStop(0, '#192c65');
  gradient.addColorStop(0.34, '#545ab0');
  gradient.addColorStop(0.47, '#b979aa');
  gradient.addColorStop(0.53, '#ffb38b');
  gradient.addColorStop(0.62, '#ffcb91');
  gradient.addColorStop(1, '#343354');
  skyContext.fillStyle = gradient;
  skyContext.fillRect(0, 0, 2048, 1024);
  for (let index = 0; index < 95; index += 1) {
    const x = random() * 2048;
    const y = 340 + random() * 230;
    skyContext.fillStyle = index % 2 ? 'rgba(255,197,158,.18)' : 'rgba(125,92,161,.15)';
    skyContext.save();
    skyContext.translate(x, y);
    skyContext.scale(25 + random() * 120, 2 + random() * 9);
    skyContext.beginPath();
    skyContext.arc(0, 0, 1, 0, Math.PI * 2);
    skyContext.fill();
    skyContext.restore();
  }
  const sunGlow = skyContext.createRadialGradient(1350, 525, 10, 1350, 525, 150);
  sunGlow.addColorStop(0, 'rgba(255,247,183,1)');
  sunGlow.addColorStop(0.3, 'rgba(255,219,143,.8)');
  sunGlow.addColorStop(1, 'rgba(255,174,129,0)');
  skyContext.fillStyle = sunGlow;
  skyContext.fillRect(1170, 345, 360, 360);
  skyContext.fillStyle = '#fff2bf';
  skyContext.beginPath();
  skyContext.arc(1350, 525, 42, 0, Math.PI * 2);
  skyContext.fill();
  skyTexture.update(false);
  const skyMaterial = new StandardMaterial('sunset-sky-material', scene);
  skyMaterial.emissiveTexture = skyTexture;
  skyMaterial.disableLighting = true;
  skyMaterial.fogEnabled = false;
  skyMaterial.backFaceCulling = false;
  const sky = MeshBuilder.CreateSphere('sunset-sky', { diameter: 2800, segments: 24, sideOrientation: Mesh.BACKSIDE }, scene);
  sky.material = skyMaterial;
  sky.infiniteDistance = true;
  sky.isPickable = false;

  const sunSurface = material('sun-disc-material', '#fff2bc', '#fff2bc');
  sunSurface.disableLighting = true;
  sunSurface.fogEnabled = false;
  const sunDisc = MeshBuilder.CreateSphere('sun-disc', { diameter: 95, segments: 24 }, scene);
  sunDisc.position.set(900, 120, -100);
  sunDisc.material = sunSurface;
  sunDisc.infiniteDistance = true;
  sunDisc.isPickable = false;

  const ground = MeshBuilder.CreateGround('city-foundation', { width: 1600, height: 1600 }, scene);
  ground.position.y = -0.32;
  ground.material = concrete;
  const points = (lane: number, y: number): Vector3[] => Array.from({ length: 512 }, (_, i) => position(i / 512 * track.length, lane, y));
  const ribbon = (name: string, r: number, halfWidth: number, y: number, surface: StandardMaterial): void => {
    const mesh = MeshBuilder.CreateRibbon(name, {
      pathArray: [points(r - halfWidth, y), points(r + halfWidth, y)], closePath: true, sideOrientation: Mesh.DOUBLESIDE,
    }, scene);
    mesh.material = surface;
    mesh.isPickable = false;
    mesh.freezeWorldMatrix();
  };
  ribbon('city-circuit', 0, 9, -0.1, asphalt);
  ribbon('inner-neon-edge', 8.45, 0.075, 0.55, pink);
  ribbon('outer-neon-edge', -8.45, 0.075, 0.55, cyan);
  ribbon('inner-shoulder', 7.7, 0.055, -0.075, amber);
  ribbon('outer-shoulder', -7.7, 0.055, -0.075, amber);
  ribbon('elevated-city-link', -38, 4, 10.8, concrete);
  ribbon('elevated-city-light', -34, 0.07, 11.1, pink);

  const source = (name: string, width: number, height: number, depth: number, surface: StandardMaterial): Mesh => {
    const mesh = MeshBuilder.CreateBox(name, { width, height, depth }, scene);
    mesh.material = surface;
    mesh.isVisible = false;
    mesh.isPickable = false;
    return mesh;
  };
  const laneDash = source('lane-dash-source', 0.13, 0.015, 3.4, white);
  const barrierBlock = source('barrier-source', 0.45, 0.8, 9.9, barrier);
  const pole = source('viaduct-pier-source', 2, 10.8, 2, concrete);
  const lampPole = source('lamp-pole-source', 0.16, 6, 0.16, barrier);
  const lampHead = source('lamp-head-source', 1.3, 0.08, 0.25, cyan);
  for (let i = 0; i < 256; i += 1) {
    const progress = i / 256 * track.length;
    for (const offset of [-2.75, 2.75]) {
      const dash = laneDash.createInstance(`dash-${i}-${offset}`);
      dash.position.copyFrom(position(progress, offset, -0.07));
      dash.rotation.y = sampleTrack(track, progress).heading;
      dash.freezeWorldMatrix();
    }
    for (const side of [-1, 1]) {
      const block = barrierBlock.createInstance(`barrier-${i}-${side}`);
      block.position.copyFrom(position(progress, side * 8.8, 0.23));
      block.rotation.y = sampleTrack(track, progress).heading;
      block.freezeWorldMatrix();
    }
    if (i % 6 === 0) {
      const pier = pole.createInstance(`pier-${i}`);
      pier.position.copyFrom(position(progress, -38, 5.3));
      pier.freezeWorldMatrix();
      const lamp = lampPole.createInstance(`lamp-${i}`);
      lamp.position.copyFrom(position(progress, 10, 2.8));
      const head = lampHead.createInstance(`lamp-head-${i}`);
      head.position.copyFrom(lamp.position).addInPlace(new Vector3(0, 3, 0));
      head.rotation.y = sampleTrack(track, progress).heading - Math.PI / 2;
      lamp.freezeWorldMatrix(); head.freezeWorldMatrix();
    }
  }

  const buildingSources = ['#202440', '#253653', '#332c55', '#233e50', '#42304e'].map((color, index) => {
    const texture = new DynamicTexture(`building-windows-${index}`, { width: 128, height: 256 }, scene, false);
    const context = texture.getContext();
    context.fillStyle = color;
    context.fillRect(0, 0, 128, 256);
    for (let row = 0; row < 22; row += 1) {
      for (let column = 0; column < 7; column += 1) {
        context.fillStyle = random() > 0.34 ? ['#71b8df', '#ffc998', '#988bd0', '#e08cb9'][index % 4] ?? '#71b8df' : '#152037';
        context.fillRect(7 + column * 17, 5 + row * 11, 5, 4);
      }
    }
    texture.update();
    const facade = material(`city-facade-${index}`, '#ffffff');
    facade.diffuseTexture = texture;
    facade.emissiveTexture = texture;
    facade.emissiveColor = new Color3(0.45, 0.45, 0.5);
    facade.specularColor = Color3.Black();
    return source(`tower-source-${index}`, 1, 1, 1, facade);
  });
  for (let i = 0; i < 240; i += 1) {
    const progress = (i * 0.61803398875 % 1) * track.length;
    const side = i % 2 ? 1 : -1;
    const lane = side * (26 + random() * 100);
    const height = 13 + random() ** 1.5 * 80;
    const building = buildingSources[i % buildingSources.length]?.createInstance(`city-tower-${i}`);
    if (!building) continue;
    building.position.copyFrom(position(progress, lane, height / 2 - 0.3));
    building.scaling.set(9 + random() * 13, height, 9 + random() * 13);
    building.rotation.y = sampleTrack(track, progress).heading;
    building.freezeWorldMatrix();
  }

  const signMaterial = (name: string, text: string, color: string): StandardMaterial => {
    const texture = new DynamicTexture(`${name}-texture`, { width: 512, height: 128 }, scene, false);
    const context = texture.getContext();
    context.fillStyle = '#0c1530'; context.fillRect(0, 0, 512, 128);
    context.strokeStyle = color; context.lineWidth = 5; context.strokeRect(3, 3, 506, 122);
    texture.drawText(text, null, 91, 'italic bold 64px Arial', color, null, true, true);
    const surface = material(name, '#ffffff');
    surface.emissiveTexture = texture;
    surface.disableLighting = true;
    surface.backFaceCulling = false;
    return surface;
  };
  const chevron = signMaterial('turn-marker', '>>>', '#ffce59');
  for (let i = 0; i < 36; i += 1) {
    const progress = i / 36 * track.length;
    const marker = MeshBuilder.CreatePlane(`turn-board-${i}`, { width: 3.2, height: 0.8 }, scene);
    marker.position.copyFrom(position(progress, -9, 1.2));
    marker.rotation.y = sampleTrack(track, progress).heading - Math.PI / 2;
    marker.material = chevron;
    marker.isPickable = false;
  }
  const start = sampleTrack(track, 0);
  const gateSurface = signMaterial('start-gate-sign', 'START / FINISH', '#8af6ff');
  const beam = MeshBuilder.CreateBox('finish-gantry', { width: 0.65, height: 1.5, depth: 20 }, scene);
  beam.position.copyFrom(position(0, 0, 6.4)); beam.rotation.y = start.heading - Math.PI / 2; beam.material = concrete;
  for (const side of [-1, 1]) {
    const support = MeshBuilder.CreateBox(`gate-pillar-${side}`, { width: 0.65, height: 6.4, depth: 0.65 }, scene);
    support.position.copyFrom(position(0, side * 9.5, 3.1)); support.material = cyan;
  }
  const gateSign = MeshBuilder.CreatePlane('finish-banner', { width: 18, height: 1.4 }, scene);
  gateSign.position.copyFrom(position(-0.36, 0, 6.4)); gateSign.rotation.y = start.heading; gateSign.material = gateSurface;
  for (let row = 0; row < 2; row += 1) {
    for (let column = 0; column < 16; column += 1) {
      if ((row + column) % 2) continue;
      const checker = MeshBuilder.CreateBox(`finish-check-${row}-${column}`, { width: 0.65, height: 0.01, depth: 1 }, scene);
      checker.position.copyFrom(position(row * 0.65, 7.5 - column, -0.06)); checker.rotation.y = start.heading - Math.PI / 2; checker.material = white;
    }
  }
  for (let i = 0; i < 14; i += 1) {
    const progress = (i / 14 + 0.004) * track.length;
    const sign = MeshBuilder.CreatePlane(`city-sign-${i}`, { width: 7, height: 1.75 }, scene);
    sign.position.copyFrom(position(progress, -23, 7 + i % 3 * 3));
    sign.rotation.y = sampleTrack(track, progress).heading - Math.PI / 2;
    sign.material = signMaterial(`billboard-${i}`, ['RIVAL', 'AFTERGLOW', 'RIDE / 01'][i % 3] ?? 'RIVAL', i % 2 ? '#ff79db' : '#77efff');
  }

  const glow = new GlowLayer('neon-bloom', scene, { mainTextureRatio: 0.35, blurKernelSize: 32 });
  glow.intensity = 0.48;
  glow.addExcludedMesh(sky);
  const meshes = scene.meshes.filter((mesh) => !previousMeshes.has(mesh));
  const materials = scene.materials.filter((surface) => !previousMaterials.has(surface));
  const lights = scene.lights.filter((light) => !previousLights.has(light));
  return { dispose: () => { glow.dispose(); for (const mesh of meshes) if (!mesh.isDisposed()) mesh.dispose(); for (const surface of materials) surface.dispose(false, true); for (const light of lights) light.dispose(); } };
}
