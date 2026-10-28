import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Scene } from '@babylonjs/core/scene';

/** Low chase camera: rider stays substantial while the road ahead remains visible. */
export class ThirdPersonCamera {
  readonly camera: FreeCamera;
  private readonly desiredPosition = new Vector3();
  private readonly lookTarget = new Vector3();
  private readonly previousTarget = new Vector3();
  private hasPreviousTarget = false;

  constructor(scene: Scene, private readonly target: TransformNode) {
    this.camera = new FreeCamera('follow-camera', new Vector3(0, 3, -7), scene);
    this.camera.minZ = 0.1; this.camera.maxZ = 1800; this.camera.fov = 0.9;
  }

  snap(): void { this.update(1, 0, true); }

  update(dt: number, _speed = 0, snap = false): void {
    const forward = new Vector3(Math.sin(this.target.rotation.y), 0, Math.cos(this.target.rotation.y));
    this.desiredPosition.copyFrom(this.target.position).subtractInPlace(forward.scale(5.2)).addInPlace(new Vector3(0, 2.4, 0));
    const blend = snap ? 1 : 1 - Math.exp(-8 * Math.min(dt, 0.1));
    // Follow actual displacement, including corrections, rather than guessing from speed.
    if (!snap && this.hasPreviousTarget) {
      this.camera.position.addInPlace(this.target.position.subtract(this.previousTarget));
    }
    this.previousTarget.copyFrom(this.target.position);
    this.hasPreviousTarget = true;
    Vector3.LerpToRef(this.camera.position, this.desiredPosition, blend, this.camera.position);
    this.lookTarget.copyFrom(this.target.position).addInPlace(forward.scale(8)).addInPlace(new Vector3(0, 1.15, 0));
    this.camera.setTarget(this.lookTarget);
    // Keep framing stable through acceleration, braking, and boost.
    this.camera.fov = 0.9;
  }
}
