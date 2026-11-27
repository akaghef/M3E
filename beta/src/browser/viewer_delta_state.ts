import type { SaveTouches } from './save_command';

type Bag = Record<string, any>;
export interface StatePatch { touches: SaveTouches; records: Array<{ collection: string; id: string; value?: unknown; present: boolean }> }
const copy = <T>(value: T): T => value === undefined ? value : JSON.parse(JSON.stringify(value));
/** Ordinary object reads; no Proxy and no whole-map dictionary clone. */
export function captureStatePatch(state: object, touches: SaveTouches): StatePatch {
  const source = state as Bag;
  const records: StatePatch['records'] = [];
  for (const [collection, ids] of Object.entries(touches)) {
    const bag = collection === '$map' ? source : source[collection];
    for (const id of new Set(ids)) records.push({ collection, id, present: !!bag && Object.prototype.hasOwnProperty.call(bag, id), value: copy(bag?.[id]) });
  }
  return { touches: copy(touches), records };
}
export function applyStatePatch(state: object, patch: StatePatch): void {
  const target = state as Bag;
  for (const record of patch.records) {
    const bag = record.collection === '$map' ? target : (target[record.collection] ??= {});
    if (record.present) bag[record.id] = copy(record.value); else delete bag[record.id];
  }
}
