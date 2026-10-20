import type { GraphLink, LinkDirection, LinkPort, LinkStyle } from './types';
import type { ParentChildEdgeRef } from './parent_child_edge_adapter';
import { canDelete, presented, type KeyInput, type Scene, type Selection } from './edge_graphlink_selection';
export { canDelete, formatStatus } from './edge_graphlink_selection';
export type EditableRef = ParentChildEdgeRef | Readonly<{kind:'graph-link';linkId:string}>;
export type EditIntent = {kind:'label';ref:EditableRef}
 | {kind:'port';linkId:string;endpoint:'source'|'target';value:LinkPort}
 | {kind:'style';linkId:string;value:LinkStyle}
 | {kind:'direction';linkId:string;value:LinkDirection}
 | {kind:'delete';linkId:string};
export type EditResult = {kind:'pass'} | {kind:'blocked';reason:string} | {kind:'edit';intent:EditIntent};
const blocked=(reason:string):EditResult=>({kind:'blocked',reason});
const cycle=<T extends string>(values:readonly T[],current:unknown):T=>values[(values.indexOf(current as T)+1)%values.length]!;
export const nextPort=(value?:LinkPort):LinkPort=>cycle(['right','bottom','left','top'] as const,value);
export const nextStyle=(value?:LinkStyle):LinkStyle=>cycle(['default','dashed','soft','emphasis'] as const,value??'default');
export const nextDirection=(value?:LinkDirection):LinkDirection=>cycle(['none','forward','backward','both'] as const,value??'none');
/** Null denotes unchanged normalized text; empty string denotes removal. */
export function labelChange(before:string|undefined,input:string):string|null {
 const value=input.trim();return value===(before??'')?null:value;
}
/** Resolve current rendered membership before proposing any mutation. */
export function editIntent(selection:Selection,key:KeyInput,scene:Scene,links:Readonly<Record<string,GraphLink>>,writable:boolean):EditResult {
 if(selection.kind==='node'||key.textEditing||key.composing||!key.boardOwnsInput)return {kind:'pass'};
 if(!key.alt&&(key.ctrl!==key.meta)&&key.key.toLowerCase()==='z')return {kind:'pass'};
 const ordinary=!key.alt&&!key.ctrl&&!key.meta&&!key.shift,shifted=!key.alt&&!key.ctrl&&!key.meta&&key.shift;
 const action=ordinary&&key.key==='F2'?'label':ordinary&&key.key==='['?'source':ordinary&&key.key===']'?'target'
  :ordinary&&['Delete','Backspace'].includes(key.key)?'delete':shifted&&key.key.toLowerCase()==='s'?'style':shifted&&key.key.toLowerCase()==='b'?'direction':null;
 const mutation=['F2','Delete','Backspace','Enter','Tab',' '].includes(key.key)||key.key.length===1||(key.key.startsWith('Arrow')&&(key.shift||key.ctrl||key.meta));
 if(!action&&!mutation)return {kind:'pass'};
 const item=presented(selection,scene);
 if(!item)return blocked('選択対象がありません');
 if(item.ref.kind==='graph-link'&&item.ref.linkIds.length>1)return blocked('複数の GraphLink を表す線は編集できません');
 if(!action)return blocked('node を選択してから操作してください');
 if(!writable)return blocked('読み取り専用です');
 if(key.repeat)return blocked('キーを離してから操作してください');
 if(selection.kind==='parent-child') {
  if(action==='label')return {kind:'edit',intent:{kind:'label',ref:{kind:'parent-child',parentNodeId:selection.parentNodeId,childNodeId:selection.childNodeId}}};
  return blocked(action==='delete'?'親子 edge は Delete で削除できません':'この操作は GraphLink 専用です');
 }
 const linkId=selection.linkIds[0],link=links[linkId];
 if(!link)return blocked('選択対象がありません');
 if(action==='label')return {kind:'edit',intent:{kind:'label',ref:{kind:'graph-link',linkId}}};
 if(action==='delete'){const allowed=canDelete(selection,scene,writable);return allowed.allowed?{kind:'edit',intent:{kind:'delete',linkId}}:blocked(allowed.reason);}
 if(action==='source'||action==='target')return {kind:'edit',intent:{kind:'port',linkId,endpoint:action,value:nextPort(action==='source'?link.sourcePort:link.targetPort)}};
 if(action==='style')return {kind:'edit',intent:{kind:'style',linkId,value:nextStyle(link.style)}};
 return {kind:'edit',intent:{kind:'direction',linkId,value:nextDirection(link.direction)}};
}
