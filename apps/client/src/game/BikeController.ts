import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';

export interface BikeInput {
  accelerate: boolean;
  brake: boolean;
  steerLeft: boolean;
  steerRight: boolean;
  reset: boolean;
}

export interface BikeControllerOptions {
  acceleration?: number;
  braking?: number;
  drag?: number;
  maxSpeed?: number;
  maxReverseSpeed?: number;
  steeringRate?: number;
  trackHalfWidth?: number;
}

const DEFAULT_OPTIONS: Required<BikeControllerOptions> = {
  acceleration: 15,
  braking: 25,
  drag: 4,
  maxSpeed: 32,
  maxReverseSpeed: 5,
  steeringRate: 1.45,
  trackHalfWidth: 7.1,
};

/** Simple, frame-rate independent arcade movement for a single bike. */
export class BikeController {
  private readonly options: Required<BikeControllerOptions>;
  private readonly startPosition: Vector3;
  private readonly startYaw: number;
  private speed = 0;

  constructor(
    private readonly bike: TransformNode,
    private readonly input: BikeInput,
    options: BikeControllerOptions = {},
  ) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.startPosition = bike.position.clone();
    this.startYaw = bike.rotation.y;
  }

  get speedMetersPerSecond(): number {
    return this.speed;
  }

  reset(): void {
    this.speed = 0;
    this.bike.position.copyFrom(this.startPosition);
    this.bike.rotation.y = this.startYaw;
    this.bike.rotation.z = 0;
  }

  update(deltaSeconds: number): void {
    const dt = Math.min(deltaSeconds, 0.05);
    if (this.input.reset) this.reset();

    const { acceleration, braking, drag, maxSpeed, maxReverseSpeed, steeringRate, trackHalfWidth } = this.options;
    if (this.input.accelerate) this.speed += acceleration * dt;
    if (this.input.brake) this.speed -= braking * dt;

    if (!this.input.accelerate && !this.input.brake) {
      if (this.speed > 0) this.speed = Math.max(0, this.speed - drag * dt);
      else if (this.speed < 0) this.speed = Math.min(0, this.speed + drag * dt);
    }
    this.speed = Math.min(maxSpeed, Math.max(-maxReverseSpeed, this.speed));

    const steering = Number(this.input.steerRight) - Number(this.input.steerLeft);
    const movementFactor = Math.min(1, Math.abs(this.speed) / 7);
    if (steering !== 0) {
      const reverseSign = this.speed < -0.1 ? -1 : 1;
      this.bike.rotation.y += steering * steeringRate * (0.18 + movementFactor * 0.82) * reverseSign * dt;
    }

    const forward = new Vector3(Math.sin(this.bike.rotation.y), 0, Math.cos(this.bike.rotation.y));
    this.bike.position.addInPlace(forward.scale(this.speed * dt));
    this.bike.position.x = Math.min(trackHalfWidth, Math.max(-trackHalfWidth, this.bike.position.x));

    // A small visual lean reinforces steering without affecting the arcade handling.
    const targetLean = -steering * 0.22 * movementFactor;
    this.bike.rotation.z += (targetLean - this.bike.rotation.z) * Math.min(1, dt * 8);
  }
}
