import type { SaveTouches } from './save_command';
import { captureStatePatch, type StatePatch } from './viewer_delta_state';

type Message<T> = { type: 'STATE_UPDATE'; fromTabId: string; state: T; savedAt: string; sequence?: number; to?: string }
  | { type: 'STATE_DELTA'; fromTabId: string; patch: StatePatch; savedAt: string; sequence: number }
  | { type: 'STATE_REQUEST'; fromTabId: string; to?: string };
/** Per-sender sequence and explicit snapshot recovery for a new/missing baseline.
 * No subscription polling; an edit serializes only its declared write set. */
export class DeltaBroadcast<T extends object> {
  private sequence = 0;
  private peers = new Map<string, number>();
  private pending: SaveTouches | undefined = {};
  constructor(private channel: Pick<BroadcastChannel, 'postMessage'>, private id: string,
    private read: () => { state: T; savedAt: string } | null,
    private receive: (message: { state?: T; patch?: StatePatch; savedAt: string }) => void) {}
  start(): void { this.channel.postMessage({ type: 'STATE_REQUEST', fromTabId: this.id }); }
  mark(touches?: SaveTouches): void {
    if (!touches) { this.pending = undefined; return; }
    if (!this.pending) return;
    for (const [field, ids] of Object.entries(touches)) {
      const key = field as keyof SaveTouches;
      this.pending[key] = [...new Set([...(this.pending[key] || []), ...ids])];
    }
  }
  send(): void {
    const value = this.read(); if (!value) return;
    const sequence = ++this.sequence;
    this.channel.postMessage(this.pending
      ? { type: 'STATE_DELTA', fromTabId: this.id, patch: captureStatePatch(value.state, this.pending), savedAt: value.savedAt, sequence }
      : { type: 'STATE_UPDATE', fromTabId: this.id, ...value, sequence });
    this.pending = {};
  }
  accept(message: Message<T>): void {
    if (message.fromTabId === this.id || ('to' in message && message.to && message.to !== this.id)) return;
    if (message.type === 'STATE_REQUEST') {
      const value = this.read();
      if (value) this.channel.postMessage({ type: 'STATE_UPDATE', fromTabId: this.id, to: message.fromTabId, ...value, sequence: this.sequence });
      return;
    }
    if (message.type === 'STATE_UPDATE') {
      this.peers.set(message.fromTabId, message.sequence ?? 0);
      this.receive(message); return;
    }
    const previous = this.peers.get(message.fromTabId);
    if (previous === undefined || message.sequence !== previous + 1) {
      if (previous !== undefined && message.sequence <= previous) return;
      this.channel.postMessage({ type: 'STATE_REQUEST', fromTabId: this.id, to: message.fromTabId }); return;
    }
    this.peers.set(message.fromTabId, message.sequence);
    this.receive(message);
  }
}
