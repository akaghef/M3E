import type { AppState, GraphLink } from '../shared/types';
import type { LayoutResult } from '../shared/layout_port';
import { editIntent, formatStatus, presented, reconcileSelection, selectionHighlight, selectionReason, selectionTransition,
  type Endpoint, type KeyInput, type NotDrawnReason, type Point, type Presented, type Scene, type Selection } from '../shared/edge_graphlink_selection';

type View = {selectedNodeId:string;selectedNodeIds:Set<string>;selectedLinkId:string;selectionAnchorId:string|null;cameraX:number;cameraY:number;zoom:number;collapsedIds:Set<string>};
type Bridge = {state:()=>AppState|null;view:()=>View;canvas:SVGSVGElement;board:HTMLElement;scope:()=>string;inScope:(id:string)=>boolean;
  label:(id:string)=>string|null;single:(id:string)=>void;link:(id:string|null)=>void;render:()=>void;status:(text:string)=>void;clearNodeActions:()=>void;owns:()=>boolean;editing:()=>boolean};

/** Records identities at the existing renderer's acceptance points, never reconstructing its filtering or geometry. */
export class EdgeGraphLinkSelectionAdapter {
  private selection: Selection|null=null;
  private layout: LayoutResult|null=null;
  private records: Presented[]=[];
  private graphRecords=new Map<string,Presented>();
  private revision=0;
  private highlighted:readonly string[]=[];
  private context='';
  private camera='';
  private pendingReason:string|null=null;
  private visible:string[]=[];
  private reasons:Record<string,NotDrawnReason>={};
  constructor(private bridge:Bridge) {
    // Read-only inspection for integration tests; identities never enter GUI text.
    Object.defineProperty(bridge.board, 'edgeGraphlinkSelection', {value:()=>structuredClone({selection:this.current(),scene:this.scene()})});
  }
  begin(layout:LayoutResult, context:string):void {
    if(this.context!==context) {this.pendingReason=null;this.selection=null;this.bridge.link(null);this.context=context;}
    this.highlighted=selectionHighlight(this.current(),this.scene()).nodeIds;this.project();
    this.layout=layout;this.records=[];this.graphRecords.clear();this.revision++;
  }
  private endpoint(id:string):Endpoint {
    const p=this.layout!.pos[id]!;
    return {nodeId:id,renderedNodeId:id,center:{x:p.x+p.w/2,y:p.y}};
  }
  graph(key:string,link:GraphLink,source:string,target:string):void {
    const prior=this.graphRecords.get(key);
    if(prior && prior.ref.kind==='graph-link') {
      const ref={...prior.ref,linkIds:[...prior.ref.linkIds,link.id] as [string,...string[]]};
      const next={...prior,ref};this.records[this.records.indexOf(prior)]=next;this.graphRecords.set(key,next);return;
    }
    const item:Presented={ref:{kind:'graph-link',renderKey:link.id,linkIds:[link.id]},source:this.endpoint(source),target:this.endpoint(target),
      presentation:{kind:'line',renderKey:link.id,labelAnchor:this.endpoint(target).center}};
    this.records.push(item);this.graphRecords.set(key,item);
  }
  parent(parent:string,child:string):void {
    if(!this.layout?.pos[parent]||!this.layout.pos[child]) return;
    this.records.push({ref:{kind:'parent-child',parentNodeId:parent,childNodeId:child},source:this.endpoint(parent),target:this.endpoint(child),
      presentation:{kind:'line',renderKey:`edge:${parent}:${child}`,labelAnchor:this.endpoint(child).center}});
  }
  private elements(id:string):SVGElement[] {
    const escaped=CSS.escape(id);
    return [...this.bridge.canvas.querySelectorAll<SVGElement>(`.node-hit[data-node-id="${escaped}"], [data-lane-header][data-node-id="${escaped}"]`)];
  }
  finish():void {
    const state=this.bridge.state(),layout=this.layout;
    if(!state||!layout) return;
    // Only explicit node presentations supply visibility, including Lane's editable headings.
    const hidden=this.bridge.canvas.hasAttribute("hidden");this.bridge.canvas.removeAttribute("hidden");
    this.visible=[...new Set([...this.bridge.canvas.querySelectorAll<SVGElement>('.node-hit[data-node-id], [data-lane-header][data-node-id]')].map(el=>el.dataset.nodeId!))];
    for(const id of this.visible) {
      const parent=state.nodes[id]?.parentId;
      if(!parent||!this.visible.includes(parent)) continue;
      const owner=layout.lane ? (parent===layout.lane.rootId?id:parent) : parent;
      const frame=layout.lane ? this.bridge.canvas.querySelector(`[data-lane-node-id="${CSS.escape(owner)}"]`)
        : this.bridge.canvas.querySelector(`.disperse-group[data-group-id="${CSS.escape(owner)}"]`);
      if(!frame) continue;
      this.records.push({ref:{kind:'parent-child',parentNodeId:parent,childNodeId:id},source:this.endpoint(parent),target:this.endpoint(id),
        presentation:{kind:layout.lane?'lane-band':'group-frame',renderKey:owner,ownerNodeId:owner,labelAnchor:this.endpoint(id).center}});
    }
    this.records=this.records.map(item=>{
      const measured=(end:Endpoint):Endpoint=>{
        const element=this.elements(end.renderedNodeId)[0] as SVGGraphicsElement|undefined;
        if(!element?.hasAttribute('data-lane-header'))return end;
        const box=element.getBBox();return {...end,center:{x:box.x+box.width/2,y:box.y+box.height/2}};
      };
      const labelSelector=item.ref.kind==='graph-link'?`.graph-link-label[data-link-id="${CSS.escape(item.ref.renderKey)}"]`:`.edge-label[data-node-id="${CSS.escape(item.ref.childNodeId)}"]`;
      const label=this.bridge.canvas.querySelector(labelSelector);
      let labelAnchor=label?{x:Number(label.getAttribute('x')),y:Number(label.getAttribute('y'))}:item.presentation.labelAnchor;
      if(!label && item.presentation.kind==='line') {
        const selector=item.ref.kind==='graph-link'?`.graph-link[data-link-id="${CSS.escape(item.ref.renderKey)}"]`:`.edge[data-source-node-id="${CSS.escape(item.ref.parentNodeId)}"][data-target-node-id="${CSS.escape(item.ref.childNodeId)}"]`;
        const geometry=this.bridge.canvas.querySelector<SVGGeometryElement>(selector);
        if(geometry && typeof geometry.getPointAtLength==='function') {
          const midpoint=geometry.getPointAtLength(geometry.getTotalLength()/2);labelAnchor={x:midpoint.x,y:midpoint.y};
        }
      }
      return {...item,source:measured(item.source),target:measured(item.target),presentation:{...item.presentation,labelAnchor}};
    });
    if(hidden)this.bridge.canvas.setAttribute("hidden", "");
    this.reasons={};
    for(const node of Object.values(state.nodes)) {
      if(this.visible.includes(node.id)) continue;
      let reason:NotDrawnReason='not-drawn';
      if(!this.bridge.inScope(node.id)) reason='outside-scope';
      else if(layout.lane && ![layout.lane.rootId,...(state.nodes[layout.lane.rootId]?.children??[])].includes(node.id)
        && !state.nodes[layout.lane.rootId]?.children.includes(node.parentId??'')) reason='below-drawn-depth';
      else { let id=node.parentId; const seen=new Set<string>(); while(id&&!seen.has(id)) {seen.add(id);if(this.bridge.view().collapsedIds.has(id)) {reason='collapsed';break;}id=state.nodes[id]?.parentId??null;} }
      this.reasons[node.id]=reason;
    }
    if(this.selection) {
      const previous=this.selection;
      this.selection=reconcileSelection(previous,state,state.links??{},this.scene(),this.bridge.scope());
      if(previous.kind!=='node'&&this.selection?.kind==='node') {this.bridge.single(this.selection.nodeId);this.bridge.status(selectionReason('origin-unavailable'));}
      this.project();
    }
    this.paint();
    if(this.pendingReason!==null) {this.bridge.status(this.pendingReason);this.pendingReason=null;}
    else if(this.selection&&this.selection.kind!=='node')this.bridge.status(this.status());
  }
  scene():Scene {
    const v=this.bridge.view(),rect=this.bridge.board.getBoundingClientRect();
    const camera=JSON.stringify([v.zoom,v.cameraX,v.cameraY,rect.left,rect.top]);
    if(camera!==this.camera){this.camera=camera;this.revision++;}
    const point=(p:Point):Point=>({x:rect.left+this.bridge.board.clientLeft+v.cameraX+p.x*v.zoom,y:rect.top+this.bridge.board.clientTop+v.cameraY+p.y*v.zoom});
    const items=this.records.map(item=>({...item,source:{...item.source,center:point(item.source.center)},target:{...item.target,center:point(item.target.center)},presentation:{...item.presentation,labelAnchor:point(item.presentation.labelAnchor)}}));
    return {revision:this.revision,items,visibleNodeIds:this.visible,notDrawnReasons:this.reasons};
  }
  private current():Selection {return this.selection&&this.selection.kind!=='node'?this.selection:{kind:'node',nodeId:this.bridge.view().selectedNodeId};}
  private project():void {
    const selection=this.selection;
    this.bridge.link(selection?.kind==='graph-link'&&selection.linkIds.length===1?selection.linkIds[0]:null);
    if(selection&&selection.kind!=='node') {this.bridge.view().selectedNodeIds=new Set();this.bridge.view().selectionAnchorId=null;}
  }
  node(id:string):void {this.pendingReason=null;const previous=this.selection;this.selection={kind:'node',nodeId:id};this.highlighted=[];this.bridge.link(null);this.paint();if(previous&&previous.kind!=='node')this.bridge.render();}
  portControls(_id:string):boolean {return false;}
  click(id:string):void {
    const item=this.records.find(item=>item.ref.kind==='graph-link'&&item.ref.linkIds.includes(id));
    if(!item) return;
    const primary=this.bridge.view().selectedNodeId;
    this.select({...item.ref,originNodeId:this.visible.includes(primary)?primary:item.source.renderedNodeId});
    this.bridge.board.focus({preventScroll:true});
  }
  private select(selection:Selection|null):void {
    this.pendingReason=null;
    if(selection&&selection.kind!=='node')this.bridge.clearNodeActions();
    this.selection=selection;this.highlighted=selection?selectionHighlight(selection,this.scene()).nodeIds:[];
    if(selection?.kind==='node') this.bridge.single(selection.nodeId);
    this.project();this.bridge.status(this.status());this.bridge.render();
  }
  key(event:KeyboardEvent):boolean {
    const text=(element:EventTarget|null)=>element instanceof Element && Boolean(element.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])'));
    const key:KeyInput={key:event.key,alt:event.altKey,shift:event.shiftKey,ctrl:event.ctrlKey,meta:event.metaKey,repeat:event.repeat,composing:event.isComposing,
      textEditing:text(event.target)||text(document.activeElement)||this.bridge.editing(),boardOwnsInput:this.bridge.owns()&&!document.querySelector('.wb-progressive-nav.is-open, [role="dialog"][aria-modal="true"]')};
    const state=this.bridge.state();if(!state)return false;
    const scene=this.scene(),selection=this.current();
    const result=selectionTransition({selection,key,topology:state,scene,scopeRootId:this.bridge.scope()});
    if(result.kind==='consume') {event.preventDefault();this.select(result.next);if(result.reason){this.pendingReason=selectionReason(result.reason);this.bridge.status(this.pendingReason);}return true;}
    const edit=editIntent(selection,key,scene);
    if(edit.kind==='blocked') {event.preventDefault();this.bridge.status(edit.reason);return true;}
    return false;
  }
  nodeView(id:string,view:{selected:boolean;multiSelected:boolean;primarySelected:boolean}) {
    if(!this.selection||this.selection.kind==='node')return view;
    const selected=this.highlighted.includes(id)||selectionHighlight(this.selection,this.scene()).nodeIds.includes(id);
    return {selected,multiSelected:false,primarySelected:selected};
  }
  status():string {
    const item=presented(this.current(),this.scene()),state=this.bridge.state();if(!item||!state)return '';
    const link=item.ref.kind==='graph-link'?state.links?.[item.ref.linkIds[0]]:null;
    return formatStatus({kind:item.ref.kind,sourceLabel:this.bridge.label(item.source.renderedNodeId),targetLabel:this.bridge.label(item.target.renderedNodeId),
      label:item.ref.kind==='parent-child'?state.nodes[item.ref.childNodeId]?.attributes['m3e:edge-label']:link?.label,relationType:link?.relationType,graphLinkCount:item.ref.kind==='graph-link'?item.ref.linkIds.length:undefined});
  }
  paint():void {
    const canvas=this.bridge.canvas;
    canvas.querySelectorAll('.relation-endpoint, .relation-selected').forEach(el=>el.classList.remove('relation-endpoint','relation-selected'));
    const selection=this.current(),highlight=selectionHighlight(selection,this.scene());
    for(const id of highlight.nodeIds) {
      canvas.querySelectorAll(`[data-node-id="${CSS.escape(id)}"]`).forEach(el=>el.classList.add('relation-endpoint'));
    }
    const item=presented(selection,this.scene());if(!item)return;
    const p=item.presentation;
    const selector=p.kind==='lane-band'?`[data-lane-node-id="${CSS.escape(p.ownerNodeId)}"], [data-lane-header][data-node-id="${CSS.escape(p.ownerNodeId)}"]`
      :p.kind==='group-frame'?`.disperse-group[data-group-id="${CSS.escape(p.ownerNodeId)}"]`
      :item.ref.kind==='graph-link'?`.graph-link[data-link-id="${CSS.escape(item.ref.renderKey)}"]`
      :`.edge[data-source-node-id="${CSS.escape(item.ref.parentNodeId)}"][data-target-node-id="${CSS.escape(item.ref.childNodeId)}"]`;
    canvas.querySelectorAll(selector).forEach(el=>el.classList.add('relation-selected'));
  }
}
