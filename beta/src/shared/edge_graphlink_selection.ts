import type { GraphLink } from './types';
import type { ParentChildEdgeRef } from './parent_child_edge_adapter';

export type Arrow = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight';
export type GraphLinkRef = Readonly<{ kind: 'graph-link'; renderKey: string; linkIds: readonly [string, ...string[]] }>;
export type Ref = ParentChildEdgeRef | GraphLinkRef;
export type Point = Readonly<{ x: number; y: number }>;
export type Endpoint = Readonly<{ nodeId: string; renderedNodeId: string; center: Point }>;
export type Presentation = { kind: 'line'; renderKey: string; labelAnchor: Point }
  | { kind: 'lane-band' | 'group-frame'; renderKey: string; ownerNodeId: string; labelAnchor: Point };
export type Presented = Readonly<{ ref: Ref; source: Endpoint; target: Endpoint; presentation: Presentation }>;
export type NotDrawnReason = 'collapsed' | 'below-drawn-depth' | 'outside-scope' | 'not-drawn';
export type Scene = Readonly<{ revision: number; items: readonly Presented[]; visibleNodeIds: readonly string[]; notDrawnReasons: Readonly<Record<string, NotDrawnReason>> }>;
export type Topology = Readonly<{ nodes: Readonly<Record<string, Readonly<{ parentId: string | null; children: readonly string[] }>>> }>;
export type Selection = { kind: 'node'; nodeId: string } | (Ref & { originNodeId: string });
export type TargetResult = { kind: 'selected'; ref: Ref } | { kind: 'none'; reason: 'no-parent' | 'no-child' | 'no-lines' | NotDrawnReason };
export type KeyInput = Readonly<{ key: string; shift: boolean; alt: boolean; ctrl: boolean; meta: boolean; repeat: boolean; composing: boolean; textEditing: boolean; boardOwnsInput: boolean }>;
export type SelectionReason = Extract<TargetResult, {kind:'none'}>['reason'] | 'origin-unavailable';
export type SelectionResult = { kind: 'pass' } | { kind: 'consume'; next: Selection | null; reason?: SelectionReason };
export type Highlight = Readonly<{ nodeIds: readonly string[]; presentation: Presentation | null }>;
const lexical = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
export function refKey(ref: Ref): string {
  return ref.kind === 'parent-child' ? JSON.stringify([0, ref.parentNodeId, ref.childNodeId]) : JSON.stringify([1, ref.renderKey, [...ref.linkIds].sort(lexical)]);
}
export function presented(selection: Selection, scene: Scene): Presented | undefined {
  return selection.kind === 'node' ? undefined : scene.items.find(item => refKey(item.ref) === refKey(selection));
}
export function enumerateDrawn(originNodeId: string, topology: Topology, scene: Scene): readonly Presented[] {
  const seen = new Set<string>();
  return scene.items.filter(item => {
    const eligible = item.ref.kind === 'parent-child'
      ? item.presentation.kind === 'line' && item.ref.parentNodeId === originNodeId && topology.nodes[originNodeId]?.children.includes(item.ref.childNodeId)
      : item.source.renderedNodeId === originNodeId || item.target.renderedNodeId === originNodeId;
    const key = refKey(item.ref);
    if (!eligible || seen.has(key)) return false;
    seen.add(key); return true;
  });
}
export function orderDrawn(originNodeId: string, candidates: readonly Presented[], tolerancePx = 6): readonly Presented[] {
  const point = (item: Presented) => (item.source.renderedNodeId === originNodeId ? item.target : item.source).center;
  const tie = (a: Presented, b: Presented) => lexical(refKey(a.ref), refKey(b.ref));
  const remaining = [...candidates].sort((a,b) => point(a).y-point(b).y || point(a).x-point(b).x || tie(a,b));
  const ordered: Presented[] = [];
  while (remaining.length) {
    const rowY = point(remaining[0]!).y;
    let end = 1;
    while (end < remaining.length && point(remaining[end]!).y - rowY <= tolerancePx) end++;
    ordered.push(...remaining.splice(0,end).sort((a,b) => point(a).x-point(b).x || point(a).y-point(b).y || tie(a,b)));
  }
  return ordered;
}
export function parentChildTarget(origin: string, key: 'ArrowUp' | 'ArrowDown', topology: Topology, scene: Scene): TargetResult {
  const node = topology.nodes[origin];
  const other = key === 'ArrowUp' ? node?.parentId : node?.children[0];
  if (!other) return {kind:'none', reason:key === 'ArrowUp' ? 'no-parent' : 'no-child'};
  const ref: ParentChildEdgeRef = {kind:'parent-child',parentNodeId:key === 'ArrowUp' ? other : origin,childNodeId:key === 'ArrowUp' ? origin : other};
  const item = scene.items.find(item => refKey(item.ref) === refKey(ref));
  return item && scene.visibleNodeIds.includes(other) && scene.visibleNodeIds.includes(origin)
    ? {kind:'selected',ref} : {kind:'none',reason:scene.notDrawnReasons[other] ?? 'not-drawn'};
}
export function cycleDrawn(ordered: readonly Presented[], current: Ref | null, step: -1 | 1): TargetResult {
  if (!ordered.length) return {kind:'none',reason:'no-lines'};
  const index = current ? ordered.findIndex(item => refKey(item.ref) === refKey(current)) : -1;
  const next = index < 0 ? (step === 1 ? 0 : ordered.length-1) : (index+step+ordered.length)%ordered.length;
  return {kind:'selected',ref:ordered[next]!.ref};
}
export function arrowEndpoint(item: Presented, key: Arrow): string | null {
  const dx=item.target.center.x-item.source.center.x, dy=item.target.center.y-item.source.center.y;
  if (Math.hypot(dx,dy)<1) return null;
  const horizontal=Math.abs(dx)>=Math.abs(dy);
  const positive=horizontal?'ArrowRight':'ArrowDown', negative=horizontal?'ArrowLeft':'ArrowUp';
  if(key!==positive && key!==negative) return null;
  return ((key===positive)===((horizontal?dx:dy)>0) ? item.target : item.source).renderedNodeId;
}
export function escapeNode(origin: string, topology: Topology, visible: readonly string[], scopeRootId: string): string | null {
  const seen=new Set<string>(); let id: string | null=origin;
  while(id && !seen.has(id)) { if(topology.nodes[id] && visible.includes(id)) return id; seen.add(id); id=topology.nodes[id]?.parentId ?? null; }
  return topology.nodes[scopeRootId] && visible.includes(scopeRootId) ? scopeRootId : null;
}
export function reconcileSelection(selection: Selection, topology: Topology, links: Readonly<Record<string,GraphLink>>, scene: Scene, scopeRootId: string): Selection | null {
  const origin=selection.kind==='node'?selection.nodeId:selection.originNodeId;
  const fallback=escapeNode(origin,topology,scene.visibleNodeIds,scopeRootId);
  if(selection.kind==='node') return fallback?{kind:'node',nodeId:fallback}:null;
  const item=presented(selection,scene);
  const valid=item && scene.visibleNodeIds.includes(origin) && (selection.kind==='parent-child'
    ? topology.nodes[selection.childNodeId]?.parentId===selection.parentNodeId
    : selection.linkIds.every(id=>Boolean(links[id])));
  return valid ? {...item.ref,originNodeId:origin} : fallback?{kind:'node',nodeId:fallback}:null;
}
export function selectionHighlight(selection: Selection, scene: Scene): Highlight {
  const item=presented(selection,scene);
  return item?{nodeIds:[item.source.renderedNodeId,item.target.renderedNodeId],presentation:item.presentation}:{nodeIds:[],presentation:null};
}
export function selectionTransition({selection,key,topology,scene,scopeRootId}: Readonly<{selection:Selection;key:KeyInput;topology:Topology;scene:Scene;scopeRootId:string}>): SelectionResult {
  if(key.textEditing || key.composing || !key.boardOwnsInput) return {kind:'pass'};
  const origin=selection.kind==='node'?selection.nodeId:selection.originNodeId;
  const fallback=escapeNode(origin,topology,scene.visibleNodeIds,scopeRootId);
  const node: Selection|null=fallback?{kind:'node',nodeId:fallback}:null;
  if(key.alt && !key.ctrl && !key.meta && !key.shift && key.key.startsWith('Arrow')) {
    if(fallback!==origin) return {kind:'consume',next:node,reason:'origin-unavailable'};
    const target=key.key==='ArrowUp'||key.key==='ArrowDown' ? parentChildTarget(origin,key.key,topology,scene)
      : cycleDrawn(orderDrawn(origin,enumerateDrawn(origin,topology,scene)),selection.kind==='node'?null:selection,key.key==='ArrowRight'?1:-1);
    return target.kind==='selected'?{kind:'consume',next:{...target.ref,originNodeId:origin}}:{kind:'consume',next:node,reason:target.reason};
  }
  if(selection.kind!=='node' && !key.ctrl && !key.meta && !key.alt && !key.shift) {
    if(key.key==='Escape') return {kind:'consume',next:node,...(fallback!==origin?{reason:'origin-unavailable' as const}:{})};
    if(key.key.startsWith('Arrow')) {
      const item=presented(selection,scene); const id=item?arrowEndpoint(item,key.key as Arrow):null;
      return {kind:'consume',next:id?{kind:'node',nodeId:id}:selection};
    }
  }
  return {kind:'pass'};
}

/** Selection-only slice: all mutation requests are refused before node dispatch. */
export function editIntent(selection: Selection, key: KeyInput, scene: Scene): {kind:'pass'} | {kind:'blocked';reason:string} {
  if(selection.kind==='node'||key.textEditing||key.composing||!key.boardOwnsInput) return {kind:'pass'};
  const editKeys=['F2','[',']','Delete','Backspace','Enter','Tab',' '];
  const mutation=editKeys.includes(key.key) || key.key.length===1 || (key.key.startsWith('Arrow') && (key.shift||key.ctrl||key.meta));
  if(!mutation) return {kind:'pass'};
  const item=presented(selection,scene);
  const aggregate=item?.ref.kind==='graph-link' && item.ref.linkIds.length>1;
  const reason=aggregate?'複数の GraphLink を表す線は編集できません'
    : selection.kind==='parent-child' && ['Delete','Backspace'].includes(key.key)?'親子 edge は Delete で削除できません'
    : 'node を選択してから操作してください';
  return {kind:'blocked',reason};
}
export function canDelete(ref: Ref, scene: Scene, writable: boolean): {allowed:true}|{allowed:false;reason:string} {
  if(!writable) return {allowed:false,reason:'読み取り専用です'};
  if(ref.kind==='parent-child') return {allowed:false,reason:'親子 edge は Delete で削除できません'};
  const item=scene.items.find(item=>refKey(item.ref)===refKey(ref));
  if(!item) return {allowed:false,reason:'選択対象がありません'};
  if(ref.linkIds.length>1) return {allowed:false,reason:'複数の GraphLink を表す線は編集できません'};
  return {allowed:true};
}
export function formatStatus(input: Readonly<{kind:Ref['kind'];sourceLabel:string|null;targetLabel:string|null;label?:string;relationType?:string;graphLinkCount?:number}>): string {
  const name=(label:string|null)=>label===null?'参照先がありません':label.trim()||'名称未設定';
  const relation=input.kind==='parent-child' ? input.label?.trim()||'親子' : (input.graphLinkCount??0)>1
    ? `GraphLink ${input.graphLinkCount} 本` : [input.label?.trim(),input.relationType?.trim()].filter(Boolean).join(' / ')||'GraphLink';
  return `${name(input.sourceLabel)} → ${name(input.targetLabel)}（${relation}）`;
}
export function selectionReason(reason: NonNullable<Extract<SelectionResult,{kind:'consume'}>['reason']>): string {
  return {'no-parent':'親がありません','no-child':'子がありません','no-lines':'選択できる線がありません',collapsed:'子は折り畳まれています','below-drawn-depth':'Lane では孫より深い node を描きません','outside-scope':'親は scope の外です','not-drawn':'端の node は描画されていません','origin-unavailable':'開始 node が表示されないため、可視の先祖へ戻りました'}[reason];
}
