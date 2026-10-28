import { Color3 } from '@babylonjs/core/Maths/math.color';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Scene } from '@babylonjs/core/scene';

/** Brief cartoon spark bursts; no injury imagery. */
export class CombatEffects {
  private readonly surface: StandardMaterial;
  private readonly active: Array<{ root: TransformNode; remaining: number }> = [];

  constructor(private readonly scene: Scene) {
    this.surface = new StandardMaterial('cartoon-impact', scene);
    this.surface.emissiveColor = Color3.FromHexString('#ffcc62');
    this.surface.disableLighting = true;
  }

  hit(target: TransformNode, direction: -1 | 1): void {
    const root = new TransformNode('impact-burst', this.scene);
    root.position.copyFrom(target.position);
    root.position.y = 1.45;
    root.position.x += Math.cos(target.rotation.y) * direction * 0.5;
    root.position.z -= Math.sin(target.rotation.y) * direction * 0.5;
    root.rotation.y = target.rotation.y;
    for (let i = 0; i < 8; i += 1) {
      const angle = i / 8 * Math.PI * 2;
      const ray = MeshBuilder.CreateBox(`impact-ray-${i}`, { width: 0.045, height: 0.38, depth: 0.045 }, this.scene);
      ray.parent = root;
      ray.position.set(Math.sin(angle) * 0.36, Math.cos(angle) * 0.36, 0);
      ray.rotation.z = -angle;
      ray.material = this.surface;
      ray.isPickable = false;
    }
    this.active.push({ root, remaining: 0.3 });
  }

  update(dt: number): void {
    for (let i = this.active.length - 1; i >= 0; i -= 1) {
      const effect = this.active[i];
      if (!effect) continue;
      effect.remaining -= dt;
      if (effect.remaining <= 0) { effect.root.dispose(); this.active.splice(i, 1); continue; }
      const scale = 0.3 + (1 - effect.remaining / 0.3) * 1.3;
      effect.root.scaling.setAll(scale);
    }
  }
}
