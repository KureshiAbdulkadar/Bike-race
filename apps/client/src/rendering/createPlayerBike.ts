import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3, Quaternion } from '@babylonjs/core/Maths/math.vector';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Scene } from '@babylonjs/core/scene';

interface BikeVisual {
  paint: StandardMaterial;
  wheels: TransformNode[];
  trails: Mesh[];
  arms: TransformNode[];
  legs: TransformNode[];
  strikeStyle: 'punch' | 'kick';
  strikeTime: number;
  strikeDirection: -1 | 1;
  time: number;
  boostTime: number;
}
const visuals = new WeakMap<TransformNode, BikeVisual>();

/** Original sport bike and crouched rider, made from local procedural geometry. */
export function createPlayerBike(scene: Scene, color = '#27bfff'): TransformNode {
  const root = new TransformNode('rival-bike', scene);
  const surface = (name: string, hex: string, emission = 0): StandardMaterial => {
    const result = new StandardMaterial(name, scene);
    result.diffuseColor = Color3.FromHexString(hex);
    result.emissiveColor = result.diffuseColor.scale(emission);
    result.specularColor = new Color3(0.65, 0.7, 0.85);
    result.specularPower = 96;
    return result;
  };
  const paint = surface('bike-paint', color, 0.13);
  const rubber = surface('bike-rubber', '#14182a');
  rubber.specularColor = new Color3(0.08, 0.08, 0.1);
  const suit = surface('rider-suit', '#192238', 0.03);
  const metal = surface('bike-alloy', '#798baf');
  const visor = surface('helmet-visor', '#19394c', 0.15);
  const neon = surface('bike-neon', '#75edff', 1);
  const tail = surface('bike-tail-light', '#ff3766', 1);
  const shadow = surface('bike-contact-shadow', '#090e21');
  shadow.alpha = 0.34;
  shadow.disableLighting = true;

  const box = (name: string, size: Vector3, position: Vector3, mat: StandardMaterial, parent = root): Mesh => {
    const mesh = MeshBuilder.CreateBox(name, { width: size.x, height: size.y, depth: size.z }, scene);
    mesh.position.copyFrom(position); mesh.material = mat; mesh.parent = parent; mesh.isPickable = false;
    return mesh;
  };
  const sphere = (name: string, scale: Vector3, position: Vector3, mat: StandardMaterial): Mesh => {
    const mesh = MeshBuilder.CreateSphere(name, { diameter: 1, segments: 16 }, scene);
    mesh.scaling.copyFrom(scale); mesh.position.copyFrom(position); mesh.material = mat; mesh.parent = root; mesh.isPickable = false;
    return mesh;
  };
  const link = (name: string, from: Vector3, to: Vector3, diameter: number, mat: StandardMaterial, parent = root): Mesh => {
    const direction = to.subtract(from);
    const mesh = MeshBuilder.CreateCylinder(name, { height: direction.length(), diameter, tessellation: 12 }, scene);
    mesh.position.copyFrom(from.add(to).scale(0.5)); mesh.material = mat; mesh.parent = parent; mesh.isPickable = false;
    direction.normalize();
    const axis = Vector3.Cross(Vector3.Up(), direction);
    if (axis.lengthSquared() > 0.0001) mesh.rotationQuaternion = Quaternion.RotationAxis(axis.normalize(), Math.acos(Vector3.Dot(Vector3.Up(), direction)));
    return mesh;
  };
  const fairing = (name: string, sections: Array<[number, number, number, number]>, mat: StandardMaterial): void => {
    const positions: number[] = [];
    const indices: number[] = [];
    for (const [z, bottom, top, width] of sections) positions.push(-width, bottom, z, width, bottom, z, width * 0.8, top, z, -width * 0.8, top, z);
    for (let s = 0; s < sections.length - 1; s += 1) {
      for (let side = 0; side < 4; side += 1) {
        const a = s * 4 + side; const b = s * 4 + (side + 1) % 4;
        indices.push(a, b, a + 4, b, b + 4, a + 4);
      }
    }
    indices.push(0, 2, 1, 0, 3, 2);
    const end = (sections.length - 1) * 4;
    indices.push(end, end + 1, end + 2, end, end + 2, end + 3);
    const normals: number[] = [];
    VertexData.ComputeNormals(positions, indices, normals);
    const data = new VertexData(); data.positions = positions; data.indices = indices; data.normals = normals;
    const mesh = new Mesh(name, scene); data.applyToMesh(mesh); mesh.material = mat; mesh.parent = root; mesh.isPickable = false;
    mat.backFaceCulling = false;
  };

  const wheels: TransformNode[] = [];
  for (const [name, z] of [['rear', -0.88], ['front', 0.95]] as const) {
    const wheel = new TransformNode(`${name}-wheel-axle`, scene); wheel.parent = root; wheel.position.set(0, 0.43, z); wheels.push(wheel);
    const tyre = MeshBuilder.CreateTorus(`${name}-tyre`, { diameter: 0.69, thickness: name === 'rear' ? 0.26 : 0.19, tessellation: 28 }, scene);
    tyre.rotation.z = Math.PI / 2; tyre.material = rubber; tyre.parent = wheel;
    const rim = MeshBuilder.CreateCylinder(`${name}-rim`, { height: 0.19, diameter: 0.54, tessellation: 24 }, scene);
    rim.rotation.z = Math.PI / 2; rim.material = metal; rim.parent = wheel;
    const hub = MeshBuilder.CreateCylinder(`${name}-hub`, { height: 0.23, diameter: 0.4, tessellation: 24 }, scene);
    hub.rotation.z = Math.PI / 2; hub.material = rubber; hub.parent = wheel;
    for (let spoke = 0; spoke < 5; spoke += 1) {
      const part = box(`${name}-spoke-${spoke}`, new Vector3(0.245, 0.035, 0.48), Vector3.Zero(), metal, wheel);
      part.rotation.x = spoke / 5 * Math.PI;
    }
    const rimLight = MeshBuilder.CreateTorus(`${name}-rim-light`, { diameter: 0.49, thickness: 0.018, tessellation: 28 }, scene);
    rimLight.rotation.z = Math.PI / 2; rimLight.position.x = 0.13; rimLight.material = neon; rimLight.parent = wheel;
  }
  const contact = MeshBuilder.CreateDisc('bike-shadow', { radius: 1, tessellation: 24 }, scene);
  contact.rotation.x = Math.PI / 2; contact.scaling.set(0.6, 1.65, 1); contact.position.y = -0.035; contact.material = shadow; contact.parent = root;
  fairing('sport-fairing', [[-0.5, 0.48, 0.99, 0.27], [0.12, 0.28, 1.18, 0.41], [0.74, 0.62, 1.28, 0.34], [1.06, 0.87, 1.14, 0.19]], paint);
  fairing('tapered-tail', [[-1.25, 1.04, 1.19, 0.12], [-0.82, 0.98, 1.3, 0.29], [-0.35, 0.91, 1.12, 0.29]], paint);
  sphere('fuel-tank', new Vector3(0.65, 0.52, 0.86), new Vector3(0, 1.15, 0), paint);
  box('saddle', new Vector3(0.42, 0.12, 0.54), new Vector3(0, 1.17, -0.6), suit);
  sphere('windscreen', new Vector3(0.49, 0.46, 0.5), new Vector3(0, 1.38, 0.66), visor).rotation.x = -0.4;
  for (const side of [-1, 1]) {
    const headlight = box(`headlight-${side}`, new Vector3(0.23, 0.055, 0.07), new Vector3(side * 0.19, 1.12, 1.035), neon);
    headlight.rotation.z = side * 0.25;
    box(`fairing-light-${side}`, new Vector3(0.025, 0.045, 0.67), new Vector3(side * 0.383, 0.76, 0.18), neon).rotation.x = -0.22;
    link(`front-fork-${side}`, new Vector3(side * 0.18, 1.18, 0.6), new Vector3(side * 0.18, 0.43, 0.95), 0.075, metal);
    link(`swingarm-${side}`, new Vector3(side * 0.14, 0.61, -0.15), new Vector3(side * 0.14, 0.43, -0.88), 0.08, metal);
  }
  box('tail-light', new Vector3(0.29, 0.06, 0.065), new Vector3(0, 1.15, -1.25), tail);
  link('handlebar', new Vector3(-0.43, 1.35, 0.52), new Vector3(0.43, 1.35, 0.52), 0.055, suit);
  link('exhaust', new Vector3(0.34, 0.43, -0.15), new Vector3(0.38, 0.63, -0.95), 0.14, metal);

  sphere('rider-torso', new Vector3(0.57, 0.79, 0.38), new Vector3(0, 1.5, -0.22), suit).rotation.x = 0.98;
  sphere('rider-back-panel', new Vector3(0.34, 0.46, 0.08), new Vector3(0, 1.65, -0.36), paint).rotation.x = 0.98;
  sphere('helmet', new Vector3(0.49, 0.46, 0.57), new Vector3(0, 1.82, 0.43), paint);
  sphere('helmet-visor', new Vector3(0.43, 0.22, 0.3), new Vector3(0, 1.84, 0.67), visor);
  box('helmet-center-stripe', new Vector3(0.055, 0.025, 0.42), new Vector3(0, 2.045, 0.42), neon);
  const arms: TransformNode[] = [];
  const legs: TransformNode[] = [];
  for (const side of [-1, 1]) {
    const shoulder = new TransformNode(`rider-arm-${side}`, scene); shoulder.parent = root; shoulder.position.set(side * 0.24, 1.64, 0.12); arms.push(shoulder);
    link(`upper-arm-${side}`, Vector3.Zero(), new Vector3(side * 0.17, -0.2, 0.15), 0.18, paint, shoulder);
    link(`forearm-${side}`, new Vector3(side * 0.17, -0.2, 0.15), new Vector3(side * 0.15, -0.27, 0.43), 0.145, suit, shoulder);
    box(`glove-${side}`, new Vector3(0.15, 0.13, 0.17), new Vector3(side * 0.15, -0.27, 0.43), suit, shoulder);
    const hip = new TransformNode(`rider-leg-${side}`, scene); hip.parent = root; hip.position.set(side * 0.19, 1.31, -0.64); legs.push(hip);
    link(`rider-thigh-${side}`, Vector3.Zero(), new Vector3(side * 0.2, -0.37, 0.6), 0.24, suit, hip);
    const knee = sphere(`knee-armor-${side}`, new Vector3(0.2, 0.25, 0.25), new Vector3(side * 0.2, -0.37, 0.6), paint); knee.parent = hip;
    link(`rider-shin-${side}`, new Vector3(side * 0.2, -0.37, 0.6), new Vector3(side * 0.05, -0.69, 0.11), 0.18, suit, hip);
    box(`rider-boot-${side}`, new Vector3(0.2, 0.15, 0.32), new Vector3(side * 0.05, -0.72, 0.21), suit, hip);
  }
  const trailSurface = surface('boost-plasma', '#53dfff', 1);
  trailSurface.alpha = 0.65; trailSurface.disableLighting = true;
  const trails = [-1, 1].map((side) => {
    const trail = box(`boost-stream-${side}`, new Vector3(0.12, 0.08, 2.8), new Vector3(side * 0.19, 0.45, -2.4), trailSurface);
    trail.setEnabled(false); return trail;
  });
  visuals.set(root, { paint, wheels, trails, arms, legs, strikeStyle: 'punch', strikeTime: 0, strikeDirection: 1, time: 0, boostTime: 0 });
  return root;
}

export function setPlayerBikeColor(bike: TransformNode, color: string): void {
  const visual = visuals.get(bike);
  if (!visual) return;
  visual.paint.diffuseColor = Color3.FromHexString(color);
  visual.paint.emissiveColor = visual.paint.diffuseColor.scale(0.13);
}

export function playBikeStrike(bike: TransformNode, direction: -1 | 1, style: 'punch' | 'kick' = 'punch'): void {
  const visual = visuals.get(bike);
  if (visual) { visual.strikeTime = 0.5; visual.strikeDirection = direction; visual.strikeStyle = style; }
}

export function updateBikeVisual(bike: TransformNode, speed: number, boosting: boolean, wobble: number, steer: number, dt: number): void {
  const visual = visuals.get(bike);
  if (!visual) return;
  visual.time += dt;
  for (const wheel of visual.wheels) wheel.rotation.x += speed * dt / 0.44;
  const lean = -steer * 0.18 + Math.sin(visual.time * 22) * Math.min(1, wobble) * 0.12;
  bike.rotation.z += (lean - bike.rotation.z) * Math.min(1, dt * 8);
  visual.boostTime = boosting ? 0.35 : Math.max(0, visual.boostTime - dt);
  for (const trail of visual.trails) {
    trail.setEnabled(visual.boostTime > 0 && speed > 3);
    const intensity = visual.boostTime / 0.35;
    trail.visibility = intensity;
    trail.scaling.z = intensity * (1 + Math.sin(visual.time * 20) * 0.06);
  }
  visual.strikeTime = Math.max(0, visual.strikeTime - dt);
  for (let i = 0; i < visual.arms.length; i += 1) {
    const arm = visual.arms[i];
    if (!arm) continue;
    const side = i === 0 ? -1 : 1;
    const extension = visual.strikeStyle === 'punch' && side === visual.strikeDirection ? Math.sin(visual.strikeTime / 0.5 * Math.PI) : 0;
    arm.rotation.y = side * extension * 1.5;
    arm.rotation.z = -side * extension * 0.4;
  }
  for (let i = 0; i < visual.legs.length; i += 1) {
    const leg = visual.legs[i]; if (!leg) continue;
    const side = i === 0 ? -1 : 1;
    const extension = visual.strikeStyle === 'kick' && side === visual.strikeDirection ? Math.sin(visual.strikeTime / 0.5 * Math.PI) : 0;
    leg.rotation.z = side * extension * 1.3; leg.rotation.y = -side * extension * 0.7;
  }
}
