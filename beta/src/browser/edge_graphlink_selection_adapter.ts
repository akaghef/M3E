import { SelectionRecords, screenPresentation, focusBoard, modalInputOwner } from "./viewer_delta_selection";
import { pathMidpoint } from "./markup_bounds";
import type { AppState, GraphLink } from '../shared/types';
import type { LayoutResult } from '../shared/layout_port';
import { disperseGuideEndpoints } from './disperse_frame';
import { editIntent, labelChange, type EditableRef, type EditIntent } from '../shared/edge_graphlink_edit';
import { formatStatus, presented, reconcileSelection, selectionHighlight, selectionReason, selectionTransition,
  type Endpoint, type KeyInput, type NotDrawnReason, type Point, type Presented, type Scene, type Selection } from '../shared/edge_graphlink_selection';

type View = {selectedNodeId:string;selectedNodeIds:Set<string>;selectedLinkId:string;selectionAnchorId:string|null;cameraX:number;cameraY:number;zoom:number;collapsedIds:Set<string>};
type Bridge = {state:()=>AppState|null;view:()=>View;canvas:SVGSVGElement;board:HTMLElement;scope:()=>string;inScope:(id:string)=>boolean;
  label:(id:string)=>string|null;single:(id:string)=>void;link:(id:string|null)=>void;render:()=>void;status:(text:string)=>void;clearNodeActions:()=>void;owns:()=>boolean;editing:()=>boolean;
  writable:()=>boolean;undo:()=>void;touch:()=>void;port:(endpoint:'source'|'target')=>boolean;
  parentLabel:(child:string,value:string)=>boolean;deleteLink:()=>boolean;
  editor:(options:{value:string;anchor:()=>Point|null;commit:(value:string)=>void})=>void};

/** Records identities at the existing renderer's acceptance points, never reconstructing its filtering or geometry. */
export class EdgeGraphLinkSelectionAdapter {
  private selection: Selection|null=null;
  private layout: LayoutResult|null=null;
  private records: Presented[]=[];
  private graphRecords=new Map<string,Presented>();
  private graphSlots=new Map<string,number>();
  private revision=0;
  private highlighted:readonly string[]=[];
  private context='';
  private camera='';
  private pendingReason:string|null=null;
  private visible:string[]=[];
  private visibleSet = new Set<string>();
  private index = new SelectionRecords();
  private paintTargets = new Map<string, Element[]>();
  private painted = new Set<Element>();
  private guide: SVGElement | null = null;
  private guideLayer: Element | null = null;
  private modalOwnsInput: () => boolean;
  constructor(private bridge:Bridge) {
    this.modalOwnsInput = modalInputOwner(bridge.board.ownerDocument);
    // Read-only inspection for integration tests; identities never enter GUI text.
    Object.defineProperty(bridge.board, 'edgeGraphlinkSelection', {value:()=>{
      const {revision,items,visibleNodeIds,notDrawnReasons}=this.scene();
      return structuredClone({selection:this.current(),scene:{revision,items,visibleNodeIds,notDrawnReasons}});
    }});
  }
  begin(layout:LayoutResult, context:string):void {
    if(this.context!==context) {this.pendingReason=null;this.selection=null;this.bridge.link(null);this.context=context;}
    this.highlighted=selectionHighlight(this.current(),this.scene()).nodeIds;this.project();
    this.layout=layout;this.records=[];this.graphRecords.clear();this.graphSlots.clear();this.index.reset([]);this.revision++;
  }
  private endpoint(id:string):Endpoint {
    const p=this.layout!.pos[id]!;
    return {nodeId:id,renderedNodeId:id,center:{x:p.x+p.w/2,y:p.y}};
  }
  graph(key:string,link:GraphLink,source:string,target:string):void {
    const prior=this.graphRecords.get(key);
    if(prior && prior.ref.kind==='graph-link') {
      const ref={...prior.ref,linkIds:[...prior.ref.linkIds,link.id] as [string,...string[]]};
      const next={...prior,ref};this.records[this.graphSlots.get(key)!]=next;this.graphRecords.set(key,next);this.index.add(next,prior);return;
    }
    const item:Presented={ref:{kind:'graph-link',renderKey:link.id,linkIds:[link.id]},source:this.endpoint(source),target:this.endpoint(target),
      presentation:{kind:'line',renderKey:link.id,labelAnchor:this.endpoint(target).center}};
    this.graphSlots.set(key,this.records.length);this.records.push(item);this.graphRecords.set(key,item);this.index.add(item);
  }
  parent(parent:string,child:string):void {
    if(!this.layout?.pos[parent]||!this.layout.pos[child]) return;
    const item:Presented={ref:{kind:'parent-child',parentNodeId:parent,childNodeId:child},source:this.endpoint(parent),target:this.endpoint(child),
      presentation:{kind:'line',renderKey:`edge:${parent}:${child}`,labelAnchor:this.endpoint(child).center}};
    this.records.push(item);this.index.add(item);
  }
  finish():void {
    const state=this.bridge.state(),layout=this.layout;
    if(!state||!layout) return;
    // Only explicit node presentations supply visibility, including Lane's editable headings.
    const hidden=this.bridge.canvas.hasAttribute("hidden");this.bridge.canvas.removeAttribute("hidden");
    // One pass over the drawn elements. A lookup per record or per node made this quadratic in the drawn size.
    const canvas=this.bridge.canvas,firstNodeElement=new Map<string,SVGElement>();
    for(const el of canvas.querySelectorAll<SVGElement>('.node-hit[data-node-id], [data-lane-header][data-node-id]')) if(!firstNodeElement.has(el.dataset.nodeId!)) firstNodeElement.set(el.dataset.nodeId!,el);
    const firstBy=<T extends Element>(selector:string,key:(el:T)=>string):Map<string,T> => { const map=new Map<string,T>(); for(const el of canvas.querySelectorAll<T>(selector)) { const k=key(el); if(!map.has(k)) map.set(k,el); } return map; };
    const pairKey=(source:string,target:string):string => JSON.stringify([source,target]);
    const graphLabels=firstBy<Element>('.graph-link-label[data-link-id]',el=>el.getAttribute('data-link-id')!);
    const edgeLabels=firstBy<Element>('.edge-label[data-node-id]',el=>el.getAttribute('data-node-id')!);
    const graphLines=firstBy<SVGGeometryElement>('.graph-link[data-link-id]',el=>el.getAttribute('data-link-id')!);
    const edgeLines=firstBy<SVGGeometryElement>('.edge[data-source-node-id][data-target-node-id]',el=>pairKey(el.getAttribute('data-source-node-id')!,el.getAttribute('data-target-node-id')!));
    this.visible=[...firstNodeElement.keys()];
    const visibleSet=this.visibleSet=new Set(this.visible);
    const laneFrames=firstBy<Element>('[data-lane-node-id]',el=>el.getAttribute('data-lane-node-id')!);
    const groupFrames=firstBy<Element>('.disperse-group[data-group-id]',el=>el.getAttribute('data-group-id')!);
    for(const id of this.visible) {
      const parent=state.nodes[id]?.parentId;
      if(!parent||!visibleSet.has(parent)) continue;
      const owner=layout.lane ? (parent===layout.lane.rootId?id:parent) : parent;
      const frame=layout.lane ? laneFrames.get(owner) : groupFrames.get(owner);
      if(!frame) continue;
      this.records.push({ref:{kind:'parent-child',parentNodeId:parent,childNodeId:id},source:this.endpoint(parent),target:this.endpoint(id),
        presentation:{kind:layout.lane?'lane-band':'group-frame',renderKey:owner,ownerNodeId:owner,labelAnchor:this.endpoint(id).center}});
    }
    this.records=this.records.map(item=>{
      const measured=(end:Endpoint):Endpoint=>{
        const element=firstNodeElement.get(end.renderedNodeId) as SVGGraphicsElement|undefined;
        if(!element?.hasAttribute('data-lane-header'))return end;
        const box=element.getBBox();return {...end,center:{x:box.x+box.width/2,y:box.y+box.height/2}};
      };
      const label=item.ref.kind==='graph-link'?graphLabels.get(item.ref.renderKey):edgeLabels.get(item.ref.childNodeId);
      let labelAnchor=label?{x:Number(label.getAttribute('x')),y:Number(label.getAttribute('y'))}:item.presentation.labelAnchor;
      if(!label && item.presentation.kind==='line') {
        const geometry=item.ref.kind==='graph-link'?graphLines.get(item.ref.renderKey):edgeLines.get(pairKey(item.ref.parentNodeId,item.ref.childNodeId));
        // Half way along the line, from the path numbers; the browser is asked only for a path this cannot read.
        const computed=geometry?pathMidpoint(geometry.getAttribute('d')||''):null;
        if(computed) labelAnchor=computed;
        else if(geometry && typeof geometry.getPointAtLength==='function') {
          const midpoint=geometry.getPointAtLength(geometry.getTotalLength()/2);labelAnchor={x:midpoint.x,y:midpoint.y};
        }
      }
      return {...item,source:measured(item.source),target:measured(item.target),presentation:{...item.presentation,labelAnchor}};
    });
    if(hidden)this.bridge.canvas.setAttribute("hidden", "");
    this.index.reset(this.records);
    this.paintTargets.clear();
    const register=(key:string,el:Element)=>{const list=this.paintTargets.get(key)??[];list.push(el);this.paintTargets.set(key,list);};
    for(const el of canvas.querySelectorAll('[data-node-id],.graph-link[data-link-id],.edge[data-source-node-id][data-target-node-id],[data-lane-node-id],.disperse-group[data-group-id]')) {
      const node=el.getAttribute('data-node-id'); if(node) register(`node:${node}`,el);
      if(el.matches('.graph-link[data-link-id]')) register(`graph:${el.getAttribute('data-link-id')}`,el);
      if(el.matches('.edge[data-source-node-id][data-target-node-id]')) register(`edge:${pairKey(el.getAttribute('data-source-node-id')!,el.getAttribute('data-target-node-id')!)}`,el);
      if(el.hasAttribute('data-lane-node-id')) register(`lane:${el.getAttribute('data-lane-node-id')}`,el);
      if(el.hasAttribute('data-lane-header')&&node) register(`lane:${node}`,el);
      if(el.matches('.disperse-group[data-group-id]')) register(`group:${el.getAttribute('data-group-id')}`,el);
    }
    this.guideLayer=canvas.querySelector('[data-render-key="guides"]');
    if(this.selection) {
      const previous=this.selection;
      this.selection=reconcileSelection(previous,state,state.links??{},this.scene(),this.bridge.scope());
      if(previous.kind!=='node'&&this.selection?.kind==='node') {this.bridge.single(this.selection.nodeId);this.bridge.status(selectionReason('origin-unavailable'));}
      this.project();
    }
    this.highlighted=selectionHighlight(this.current(),this.scene()).nodeIds;
    this.paint();
    if(this.pendingReason!==null) {this.bridge.status(this.pendingReason);this.pendingReason=null;}
    else if(this.selection&&this.selection.kind!=='node')this.bridge.status(this.status());
  }
  private reason(id:string):NotDrawnReason|undefined {
    const state=this.bridge.state(),layout=this.layout,node=state?.nodes[id];
    if(!node||!state||!layout||this.visibleSet.has(id)) return undefined;
    if(!this.bridge.inScope(id)) return 'outside-scope';
    if(layout.lane && node.id!==layout.lane.rootId && node.parentId!==layout.lane.rootId
      && state.nodes[node.parentId??'']?.parentId!==layout.lane.rootId) return 'below-drawn-depth';
    let parent=node.parentId; const seen=new Set<string>();
    while(parent&&!seen.has(parent)) {
      seen.add(parent); if(this.bridge.view().collapsedIds.has(parent)) return 'collapsed';
      parent=state.nodes[parent]?.parentId??null;
    }
    return 'not-drawn';
  }
  scene():Scene {
    const v=this.bridge.view();
    let rect:DOMRect|undefined,clientLeft=0,clientTop=0;
    const viewport=():DOMRect=>{
      if(!rect) {
        rect=this.bridge.board.getBoundingClientRect();clientLeft=this.bridge.board.clientLeft;clientTop=this.bridge.board.clientTop;
        const camera=JSON.stringify([v.zoom,v.cameraX,v.cameraY,rect.left,rect.top,clientLeft,clientTop]);
        if(camera!==this.camera){this.camera=camera;this.revision++;}
      }
      return rect;
    };
    const point=(p:Point):Point=>{const rect=viewport();return {x:rect.left+clientLeft+v.cameraX+p.x*v.zoom,y:rect.top+clientTop+v.cameraY+p.y*v.zoom};};
    const projected=new Map<Presented,Presented>();
    const project=(item:Presented):Presented=>{
      let value=projected.get(item);
      if(!value) {value=screenPresentation(item,point);projected.set(item,value);}return value;
    };
    const self=this;
    return {get revision(){viewport();return self.revision;},
      get items(){return self.records.map(project);},visibleNodeIds:this.visible,
      get notDrawnReasons(){
        const reasons:Record<string,NotDrawnReason>={};
        for(const id of Object.keys(self.bridge.state()?.nodes??{})) {const reason=self.reason(id);if(reason)reasons[id]=reason;}
        return reasons;
      },
      lookup:{presented:ref=>{const item=this.index.presented(ref);return item?project(item):undefined;},
        incident:id=>this.index.at(id).map(project),visible:id=>this.visibleSet.has(id),reason:id=>this.reason(id)}};
  }
  private current():Selection {return this.selection&&this.selection.kind!=='node'?this.selection:{kind:'node',nodeId:this.bridge.view().selectedNodeId};}
  private project():void {
    const selection=this.selection;
    this.bridge.link(selection?.kind==='graph-link'&&selection.linkIds.length===1?selection.linkIds[0]:null);
    if(selection&&selection.kind!=='node') {this.bridge.view().selectedNodeIds=new Set();this.bridge.view().selectionAnchorId=null;}
  }
  node(id:string):void {this.pendingReason=null;const previous=this.selection;this.selection={kind:'node',nodeId:id};this.highlighted=[];this.bridge.link(null);this.paint();if(previous&&previous.kind!=='node')this.bridge.render();}
  portControls(id:string):boolean {
    const item=presented(this.current(),this.scene());
    return this.bridge.writable()&&item?.ref.kind==='graph-link'&&item.ref.linkIds.length===1&&item.ref.linkIds[0]===id;
  }
  click(id:string):void {
    const item=this.index.link(id);
    if(!item) return;
    const primary=this.bridge.view().selectedNodeId;
    this.select({...item.ref,originNodeId:this.visibleSet.has(primary)?primary:item.source.renderedNodeId});
    focusBoard(this.bridge.board);
  }
  private select(selection:Selection|null):void {
    this.pendingReason=null;
    if(selection&&selection.kind!=='node')this.bridge.clearNodeActions();
    this.selection=selection;this.highlighted=selection?selectionHighlight(selection,this.scene()).nodeIds:[];
    if(selection?.kind==='node') this.bridge.single(selection.nodeId);
    this.project();this.bridge.status(this.status());this.bridge.render();
  }
  key(event:KeyboardEvent):boolean {
    // Node input belongs to the viewer except explicit line-navigation keys.
    if(this.current().kind==='node' && !(event.altKey&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&event.key.startsWith('Arrow'))) return false;
    const text=(element:EventTarget|null)=>element instanceof Element && Boolean(element.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])'));
    const key:KeyInput={key:event.key,alt:event.altKey,shift:event.shiftKey,ctrl:event.ctrlKey,meta:event.metaKey,repeat:event.repeat,composing:event.isComposing,
      textEditing:text(event.target)||text(document.activeElement)||this.bridge.editing(),boardOwnsInput:this.bridge.owns()&&!this.modalOwnsInput()};
    const state=this.bridge.state();if(!state)return false;
    const scene=this.scene(),selection=this.current();
    const result=selectionTransition({selection,key,topology:state,scene,scopeRootId:this.bridge.scope()});
    if(result.kind==='consume') {event.preventDefault();this.select(result.next);if(result.reason){this.pendingReason=selectionReason(result.reason);this.bridge.status(this.pendingReason);}return true;}
    const edit=editIntent(selection,key,scene,state.links??{},this.bridge.writable());
    if(edit.kind==='blocked') {event.preventDefault();this.bridge.status(edit.reason);return true;}
    if(edit.kind==='edit') {event.preventDefault();this.edit(edit.intent,selection);return true;}
    return false;
  }
  private edit(intent:EditIntent, selection:Selection):void {
    const state=this.bridge.state();if(!state||!this.bridge.writable())return;
    const context=this.context;
    const target=(ref:EditableRef)=>{
      if(this.bridge.state()!==state||this.context!==context||!this.bridge.writable())return null;
      if(ref.kind==='graph-link')return state.links?.[ref.linkId]??null;
      const child=state.nodes[ref.childNodeId];
      return child?.parentId===ref.parentNodeId?child:null;
    };
    if(intent.kind==='label') {
      const ref=intent.ref,obj=target(ref);if(!obj)return;
      const before=ref.kind==='parent-child'?state.nodes[ref.childNodeId]!.attributes['m3e:edge-label']:state.links![ref.linkId]!.label;
      this.bridge.editor({value:before??'',anchor:()=>this.context===context&&this.bridge.state()===state?presented(selection,this.scene())?.presentation.labelAnchor??null:null,
        commit:value=>{
          if(!target(ref)||!presented(selection,this.scene()))return;
          const current=ref.kind==='parent-child'?state.nodes[ref.childNodeId]!.attributes['m3e:edge-label']:state.links![ref.linkId]!.label;
          const next=labelChange(current,value);if(next===null)return;
          if(ref.kind==='parent-child'){this.bridge.parentLabel(ref.childNodeId,next);return;}
          this.bridge.undo();
          const link=state.links![ref.linkId]!;if(next)link.label=next;else delete link.label;
          this.bridge.touch();
        }});
      return;
    }
    const link=state.links?.[intent.linkId];if(!link)return;
    if(intent.kind==='port'){this.bridge.port(intent.endpoint);return;}
    if(intent.kind==='delete'){this.bridge.deleteLink();return;}
    this.bridge.undo();
    if(intent.kind==='style')link.style=intent.value;
    else link.direction=intent.value;
    this.bridge.touch();
  }
  nodeView(id:string,view:{selected:boolean;multiSelected:boolean;primarySelected:boolean}) {
    if(!this.selection||this.selection.kind==='node')return view;
    const selected=this.highlighted.includes(id);
    return {selected,multiSelected:false,primarySelected:selected};
  }
  status():string {
    const item=presented(this.current(),this.scene()),state=this.bridge.state();if(!item||!state)return '';
    const link=item.ref.kind==='graph-link'?state.links?.[item.ref.linkIds[0]]:null;
    return formatStatus({kind:item.ref.kind,sourceLabel:this.bridge.label(item.source.renderedNodeId),targetLabel:this.bridge.label(item.target.renderedNodeId),
      label:item.ref.kind==='parent-child'?state.nodes[item.ref.childNodeId]?.attributes['m3e:edge-label']:link?.label,relationType:link?.relationType,graphLinkCount:item.ref.kind==='graph-link'?item.ref.linkIds.length:undefined});
  }
  /** A retained node patch replaces only that fragment's highlight targets. */
  refreshNode(id:string,fragment:SVGGElement):void {
    const key=`node:${id}`,elements=(this.paintTargets.get(key)??[]).filter(el=>el.isConnected&&!fragment.contains(el));
    for(const el of fragment.querySelectorAll('[data-node-id]')) if(el.getAttribute('data-node-id')===id) elements.push(el);
    this.paintTargets.set(key,elements);
  }
  paint():void {
    this.guide?.remove();this.guide=null;
    for(const el of this.painted) el.classList.remove('relation-endpoint','relation-selected');
    this.painted.clear();
    const paint=(key:string,name:string)=>{for(const el of this.paintTargets.get(key)??[]) {el.classList.add(name);this.painted.add(el);}};
    const selection=this.current(),highlight=selectionHighlight(selection,this.scene());
    if(highlight.guide) {
      const {parentNodeId,childNodeId}=highlight.guide;
      const parent=this.layout?.pos[parentNodeId],child=this.layout?.pos[childNodeId];
      const layer=this.guideLayer;
      if(parent&&child&&layer) {
        const line=document.createElementNS('http://www.w3.org/2000/svg','line');
        const {x1,y1,x2,y2}=disperseGuideEndpoints(parent,child);
        line.setAttribute('class','scatter-guide');
        line.dataset.parentNodeId=parentNodeId;line.dataset.childNodeId=childNodeId;
        for(const [key,value] of Object.entries({x1,y1,x2,y2}))line.setAttribute(key,String(value));
        layer.append(line);this.guide=line;
      }
    }
    for(const id of highlight.nodeIds) {
      paint(`node:${id}`,'relation-endpoint');
    }
    const item=presented(selection,this.scene());if(!item)return;
    const p=item.presentation;
    const key=p.kind==='lane-band'?`lane:${p.ownerNodeId}`:p.kind==='group-frame'?`group:${p.ownerNodeId}`
      :item.ref.kind==='graph-link'?`graph:${item.ref.renderKey}`:`edge:${JSON.stringify([item.ref.parentNodeId,item.ref.childNodeId])}`;
    paint(key,'relation-selected');
  }
}
