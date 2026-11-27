import type { PaintCommand, PaintScene } from './webgl_scene_tiles';

/** Stable slots are spatial-index handles, not paint order. New primitives of an
 * existing owner are ordered after its last original slot without shifting any
 * other owner's slots. Whole-scene consumers materialize explicitly/lazily. */
export class PaintSlots {
  readonly commands: PaintCommand[];
  readonly owners = new Map<string, number[]>();
  private order = new Map<number, [number, number]>();
  private free: number[] = [];
  private ownerOrder = new Map<string, Array<[number, number]>>();
  private tail = 0;
  private dense: PaintCommand[] | undefined;
  readonly scene: PaintScene;
  constructor(commands: PaintCommand[]) {
    this.commands = commands;
    commands.forEach((command, slot) => {
      this.order.set(slot, [slot, 0]);
      if (command.nodeId) {
        const slots = this.owners.get(command.nodeId) ?? [];
        slots.push(slot); this.owners.set(command.nodeId, slots);
        const order = this.ownerOrder.get(command.nodeId) ?? []; order.push([slot, 0]); this.ownerOrder.set(command.nodeId, order);
      }
    });
    this.tail = commands.length;
    const self = this;
    this.scene = { get commands() { return self.materialize(); } };
  }
  compare = (a: number, b: number): number => {
    const left = this.order.get(a)!, right = this.order.get(b)!;
    return left[0] - right[0] || left[1] - right[1];
  };
  set(slot: number, command: PaintCommand): void {
    this.commands[slot] = command; this.dense = undefined;
  }
  /** Callbacks update only changed spatial memberships and path caches. */
  replace(id: string, commands: PaintCommand[], write: (slot: number, command: PaintCommand) => void,
    remove: (slot: number) => void): void {
    const old = this.owners.get(id) ?? [];
    const saved = this.ownerOrder.get(id) ?? [];
    const anchor = saved.length ? saved[saved.length - 1]![0] : this.tail++;
    let ordinal = saved.length ? saved[saved.length - 1]![1] : 0;
    const next: number[] = [];
    commands.forEach((command, i) => {
      const slot = old[i] ?? this.free.pop() ?? this.commands.length;
      const rank = saved[i] ?? [anchor, ++ordinal] as [number, number];
      saved[i] = rank; this.order.set(slot, rank);
      next.push(slot); write(slot, command); this.set(slot, command);
    });
    for (let i = commands.length; i < old.length; i++) {
      const slot = old[i]!;
      remove(slot); delete this.commands[slot]; this.order.delete(slot); this.free.push(slot);
    }
    this.ownerOrder.set(id, saved);
    if (next.length) this.owners.set(id, next); else this.owners.delete(id);
    this.dense = undefined;
  }
  private materialize(): PaintCommand[] {
    return this.dense ??= [...this.order.keys()].sort(this.compare).map(slot => this.commands[slot]!);
  }
}
