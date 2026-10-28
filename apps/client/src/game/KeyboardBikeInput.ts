import type { PlayerInput } from '@rival/shared';
import type { BikeInput } from './BikeController';

/** Keyboard bindings for local arcade controls and the server input protocol. */
export class KeyboardBikeInput implements BikeInput {
  accelerate = false;
  brake = false;
  steerLeft = false;
  steerRight = false;
  reset = false;
  boost = false;
  punch = false;
  recover: -1 | 0 | 1 = 0;

  private readonly pressed = new Set<string>();
  private readonly virtual = new Map<number, string>();
  private readonly virtualCleanup: Array<() => void> = [];
  private strikeLatchUntil = 0;
  private readonly onKeyDown = (event: KeyboardEvent): void => {
    const menu = document.getElementById('flow-shade');
    if (menu && !menu.hidden) return;
    if (this.isEditingText(event.target) || document.querySelector('dialog[open]')) return;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) event.preventDefault();
    const key = event.key.toLowerCase();
    if ((key === ' ' || key === 'j') && !this.pressed.has(key)) this.strikeLatchUntil = performance.now() + 120;
    this.pressed.add(key);
    this.sync();
  };
  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.pressed.delete(event.key.toLowerCase());
    this.sync();
  };
  private readonly onBlur = (): void => {
    this.strikeLatchUntil = 0;
    this.pressed.clear();
    this.virtual.clear();
    this.sync();
  };

  constructor() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-control]')) {
      const down = (event: PointerEvent): void => {
        event.preventDefault();
        button.setPointerCapture(event.pointerId);
        this.virtual.set(event.pointerId, button.dataset.control ?? ''); this.sync();
      };
      const click = (): void => { if (button.dataset.control === ' ') { this.strikeLatchUntil = performance.now() + 120; this.sync(); } };
      const up = (event: PointerEvent): void => { this.virtual.delete(event.pointerId); this.sync(); };
      button.addEventListener('pointerdown', down); button.addEventListener('pointerup', up); button.addEventListener('pointercancel', up); button.addEventListener('click', click);
      this.virtualCleanup.push(() => { button.removeEventListener('pointerdown', down); button.removeEventListener('pointerup', up); button.removeEventListener('pointercancel', up); button.removeEventListener('click', click); });
    }
  }

  clear(): void {
    this.strikeLatchUntil = 0;
    this.pressed.clear();
    this.virtual.clear();
    this.sync();
  }

  dispose(): void {
    for (const cleanup of this.virtualCleanup) cleanup();
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
  }

  private sync(): void {
    const held = (key: string): boolean => this.pressed.has(key) || [...this.virtual.values()].includes(key);
    this.accelerate = held('w') || held('arrowup');
    this.brake = held('s') || held('arrowdown');
    this.steerLeft = held('a') || held('arrowleft');
    this.steerRight = held('d') || held('arrowright');
    this.reset = held('r'); this.boost = held('shift');
    this.punch = held(' ') || held('j') || performance.now() < this.strikeLatchUntil;
    this.recover = held('e') ? (held('q') ? 0 : 1) : (held('q') ? -1 : 0);
  }

  private isEditingText(target: EventTarget | null): boolean {
    return target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable="true"]') !== null;
  }

  toPlayerInput(sequence: number): PlayerInput {
    this.sync();
    const direction = Number(this.steerRight) - Number(this.steerLeft);
    return {
      sequence,
      throttle: this.accelerate ? 1 : 0,
      steer: direction > 0 ? 1 : direction < 0 ? -1 : 0,
      brake: this.brake,
      punch: this.punch,
      boost: this.boost,
      recover: this.recover,
    };
  }
}
