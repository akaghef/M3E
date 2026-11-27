import { isOrderKey } from '../shared/record_model/order_key';
import type { SaveTouches } from './save_command';

type Bag = Record<string, any>;
export interface ArrayRange { id: string; index: number; values: string[]; deleteCount?: number }
export interface StateField { collection:string; id:string; key:string; present:boolean; value?:unknown }
export interface StatePatch { touches: SaveTouches; records: Array<{ collection: string; id: string; value?: unknown; present: boolean }>; children?: ArrayRange[]; fields?: StateField[] }
export const cloneState = <T>(value: T): T => value === undefined ? value : JSON.parse(JSON.stringify(value));
/** Ordinary object reads; no Proxy and no whole-map dictionary clone. */
export function captureStatePatch(state: object, touches: SaveTouches): StatePatch {
  const source = state as Bag;
  const records: StatePatch['records'] = [];
  for (const [collection, ids] of Object.entries(touches)) {
    if (collection === 'edges') continue; // Save hint, not an AppState collection.
    const bag = collection === '$map' ? source : source[collection];
    for (const id of new Set(ids)) records.push({ collection, id, present: !!bag && Object.prototype.hasOwnProperty.call(bag, id), value: cloneState(bag?.[id]) });
  }
  return { touches: cloneState(touches), records };
}
export function applyStatePatch(state: object, patch: StatePatch, skipChildren = false): void {
  const target = state as Bag;
  for (const record of patch.records) {
    const bag = record.collection === '$map' ? target : (target[record.collection] ??= {});
    if (record.present) bag[record.id] = cloneState(record.value); else delete bag[record.id];
  }
  for (const field of patch.fields || []) {
    const record = target[field.collection][field.id];
    if(field.present) record[field.key]=cloneState(field.value); else delete record[field.key];
  }
  for (const range of skipChildren ? [] : patch.children || []) {
    const children = target.nodes[range.id].children;
    if (range.deleteCount !== undefined) children.splice(range.index, range.deleteCount, ...range.values);
    else range.values.forEach((value, index) => { children[range.index + index] = value; });
  }
}

export function inverseStatePatch(state: object, patch: StatePatch): StatePatch {
  const source = state as Bag;
  return {touches: cloneState(patch.touches),
    records: patch.records.map(record => {
      const bag = record.collection === '$map' ? source : source[record.collection];
      return {...record,present:!!bag && Object.prototype.hasOwnProperty.call(bag,record.id),value:cloneState(bag?.[record.id])};
    }),
    fields: patch.fields?.map(field=>captureField(state,field.collection,field.id,field.key)),
    children: patch.children?.map(range => ({...range,
      ...(range.deleteCount === undefined ? {} : {deleteCount:range.values.length}),
      values:source.nodes[range.id].children.slice(range.index,range.index+(range.deleteCount ?? range.values.length))})),
  };
}

function captureField(state:object,collection:string,id:string,key:string):StateField {
  const record=(state as Bag)[collection][id];
  return {collection,id,key,present:Object.prototype.hasOwnProperty.call(record,key),value:cloneState(record[key])};
}

/** Before images of overwritten child slots, accumulated once across a Grab. */
export class ChildOrderHistory {
  private parents = new Map<string, Map<number,string>>();
  private fields = new Map<string,StateField>();
  recordField(state:object,collection:string,id:string,key:string):void {
    const token=JSON.stringify([collection,id,key]);
    if(!this.fields.has(token))this.fields.set(token,captureField(state,collection,id,key));
  }
  recordEdgeOrders(state: object, id: string, index: number): void {
    const nodes = (state as Bag).nodes, list = nodes[nodes[id].parentId].children;
    let lo = index, hi = index;
    while (lo > 0 && !isOrderKey(nodes[list[lo - 1]]?.edgeOrder)) lo--;
    while (hi + 1 < list.length && !isOrderKey(nodes[list[hi + 1]]?.edgeOrder)) hi++;
    for (let i = lo; i <= hi; i++) this.recordField(state, 'nodes', list[i], 'edgeOrder');
  }
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
    const fields=[...this.fields.values()];
    return {touches:{nodes:[...new Set([...this.parents.keys(),...fields.map(field=>field.id)])],edges:fields.map(field=>field.id)},records:[],children,fields};
  }
  changed(nodes: Record<string,{children:string[]}>): boolean {
    for(const [id,entries] of this.parents) for(const [index,value] of entries) if(nodes[id]?.children[index]!==value)return true;
    return false;
  }
}

/** Property edits do not copy an owner's potentially large children array. */
export function captureNodeFields(state: object, ids: readonly string[], keys: readonly string[]): StatePatch {
  const nodes=[...new Set(ids)];
  return {touches:{nodes,edges:[]},records:[],fields:nodes.flatMap(id=>keys.map(key=>captureField(state,'nodes',id,key)))};
}

/** Before image for insertion of one fresh leaf. The parent's children are not
 * copied: undo removes the inserted slot; redo captures that slot and leaf. */
export function captureNodeInsertion(state: object, parent: string, id: string, index: number): StatePatch {
  const patch = captureStatePatch(state, {nodes:[id],edges:[id]});
  patch.fields = captureNodeFields(state, [parent], ['collapsed']).fields;
  patch.children = [{id:parent,index,values:[],deleteCount:1}];
  patch.touches.nodes = [id,parent];
  return patch;
}

/** Keep the key-assignment write set in the same insertion history, including
 * any not-yet-keyed neighbouring leaves. The fresh leaf is already a record. */
export function assignInsertionOrder(state: object, patch: StatePatch, id: string, index: number, assign: () => void): void {
  const history = new ChildOrderHistory(); history.recordEdgeOrders(state, id, index);
  const fields = history.patch().fields!.filter(field=>field.id!==id);
  patch.fields!.push(...fields);
  patch.touches.nodes = [...new Set([...patch.touches.nodes!,...fields.map(field=>field.id)])];
  patch.touches.edges = [id,...fields.map(field=>field.id)];
  assign();
}
