import type { SaveTouches } from './save_command';

type Bag = Record<string, any>;
export interface ArrayRange { id: string; index: number; values: string[] }
export interface StatePatch { touches: SaveTouches; records: Array<{ collection: string; id: string; value?: unknown; present: boolean }>; children?: ArrayRange[] }
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
  for (const range of patch.children || []) {
    const children = target.nodes[range.id].children;
    range.values.forEach((value, index) => { children[range.index + index] = value; });
  }
}

export function inverseStatePatch(state: object, patch: StatePatch): StatePatch {
  const source = state as Bag;
  return {touches: copy(patch.touches),
    records: patch.records.map(record => {
      const bag = record.collection === '$map' ? source : source[record.collection];
      return {...record,present:!!bag && Object.prototype.hasOwnProperty.call(bag,record.id),value:copy(bag?.[record.id])};
    }),
    children: patch.children?.map(range => ({...range,values:source.nodes[range.id].children.slice(range.index,range.index+range.values.length)})),
  };
}

/** Before images of overwritten child slots, accumulated once across a Grab. */
export class ChildOrderHistory {
  private parents = new Map<string, Map<number,string>>();
  record(id: string, values: readonly string[], from: number, to: number): void {
    const entries = this.parents.get(id) ?? new Map<number,string>();
    for(let i=Math.min(from,to);i<=Math.max(from,to);i++) if(!entries.has(i)) entries.set(i,values[i]!);
    this.parents.set(id,entries);
  }
  patch(): StatePatch {
    const children: ArrayRange[] = [];
    for(const [id,entries] of this.parents) for(const index of [...entries.keys()].sort((a,b)=>a-b)) {
      const last=children[children.length-1];
      if(last?.id===id&&last.index+last.values.length===index)last.values.push(entries.get(index)!);
      else children.push({id,index,values:[entries.get(index)!]});
    }
    return {touches:{nodes:[...this.parents.keys()]},records:[],children};
  }
  changed(nodes: Record<string,{children:string[]}>): boolean {
    for(const [id,entries] of this.parents) for(const [index,value] of entries) if(nodes[id]?.children[index]!==value)return true;
    return false;
  }
}
