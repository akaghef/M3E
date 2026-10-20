// @vitest-environment jsdom
// Adapter contract tests, not browser acceptance or renderer measurements.
import {beforeEach,describe,it,expect,vi} from 'vitest';
import {EdgeGraphLinkSelectionAdapter} from '../../src/browser/edge_graphlink_selection_adapter';
import type {AppState} from '../../src/shared/types';
import type {LayoutResult} from '../../src/shared/layout_port';
let adapter:EdgeGraphLinkSelectionAdapter,board:HTMLElement,canvas:SVGSVGElement,state:AppState,view:any,status:ReturnType<typeof vi.fn>,project:ReturnType<typeof vi.fn>;
const layout={pos:{root:{x:0,y:0,w:20,h:10},a:{x:30,y:40,w:20,h:10},b:{x:90,y:80,w:20,h:10}},order:['root','a','b'],totalWidth:120,totalHeight:100} as LayoutResult;
const send=(key:string,extra:KeyboardEventInit={})=>{const e=new KeyboardEvent('keydown',{key,cancelable:true,...extra});const consumed=adapter.key(e);return {consumed,prevented:e.defaultPrevented};};
const inspect=()=> (board as any).edgeGraphlinkSelection();
beforeEach(()=>{
 document.body.innerHTML='<div id="board"><svg id="canvas"><rect class="node-hit" data-node-id="root" x="0" y="-5" width="20" height="10"/><rect class="node-hit" data-node-id="a" x="30" y="35" width="20" height="10"/><rect class="node-hit" data-node-id="b" x="90" y="75" width="20" height="10"/><path class="edge" data-source-node-id="root" data-target-node-id="a"/><path class="graph-link" data-link-id="one"/><text class="graph-link-label" data-link-id="one" x="60" y="50">関係</text></svg></div>';
 vi.stubGlobal('CSS',{escape:(text:string)=>text});
 board=document.getElementById('board')!;canvas=document.getElementById('canvas') as unknown as SVGSVGElement;
 canvas.querySelectorAll('rect').forEach(el=>{(el as any).getBBox=()=>({x:Number(el.getAttribute('x')),y:Number(el.getAttribute('y')),width:20,height:10});});
 state={rootId:'root',nodes:Object.fromEntries(['root','a','b'].map(id=>[id,{id,text:id==='a'?'計画':id==='b'?'実行':'全体',parentId:id==='root'?null:'root',children:id==='root'?['a','b']:[],attributes:{},collapsed:false,details:'',note:'',link:''}])),links:{one:{id:'one',sourceNodeId:'a',targetNodeId:'b',label:'関係'},two:{id:'two',sourceNodeId:'a',targetNodeId:'b'},three:{id:'three',sourceNodeId:'a',targetNodeId:'b'}}};
 view={selectedNodeId:'a',selectedNodeIds:new Set(['a']),selectedLinkId:'',selectionAnchorId:null,cameraX:10,cameraY:20,zoom:2,collapsedIds:new Set()};status=vi.fn();project=vi.fn();
 adapter=new EdgeGraphLinkSelectionAdapter({state:()=>state,view:()=>view,canvas,board,scope:()=>state.rootId,inScope:()=>true,label:id=>state.nodes[id]?.text??null,
 single:id=>{view.selectedNodeId=id;view.selectedNodeIds=new Set([id]);adapter.node(id);},link:project,render:vi.fn(),status,clearNodeActions:vi.fn(),owns:()=>true,editing:()=>false});
 adapter.begin(layout,'map:root');adapter.parent('root','a');adapter.graph('same',state.links!.one!,'a','b');adapter.finish();
});
describe('renderer registration bridge',()=>{
 it('uses measured endpoints and camera CSS pixels; label anchor is the drawn label',()=>{
  const graph=inspect().scene.items.find((i:any)=>i.ref.kind==='graph-link');
  expect(graph.source.center).toEqual({x:90,y:100});expect(graph.target.center).toEqual({x:210,y:180});expect(graph.presentation.labelAnchor).toEqual({x:130,y:120});
 });
 it('camera changes advance snapshot revision and CSS coordinate scale',()=>{
  const first=inspect().scene;view.zoom=3;const next=inspect().scene;expect(next.revision).toBeGreaterThan(first.revision);expect(next.items[0].target.center).toEqual({x:130,y:140});
 });
 it('keyboard and click share origin, project compatibility, highlight both endpoints, clear on node click',()=>{
  expect(send('ArrowRight',{altKey:true})).toEqual({consumed:true,prevented:true});
  expect(inspect().selection).toMatchObject({kind:'graph-link',originNodeId:'a',linkIds:['one']});expect(project).toHaveBeenLastCalledWith('one');
  adapter.paint();expect(canvas.querySelectorAll('.node-hit.relation-endpoint')).toHaveLength(2);expect(canvas.querySelectorAll('.graph-link.relation-selected')).toHaveLength(1);
  expect(adapter.nodeView('a',{selected:false,multiSelected:false,primarySelected:false})).toEqual({selected:true,multiSelected:false,primarySelected:true});
  expect(status).toHaveBeenLastCalledWith('計画 → 実行（関係）');
  send('Escape');expect(inspect().selection).toEqual({kind:'node',nodeId:'a'});
  adapter.click('one');expect(inspect().selection.originNodeId).toBe('a');adapter.node('b');expect(project).toHaveBeenLastCalledWith(null);expect(canvas.querySelectorAll('.relation-selected')).toHaveLength(0);
 });
 it('dedup records retain all members without exposing singleton controls or mutating map',()=>{
  const before=JSON.stringify(state);adapter.begin(layout,'map:root');for(const link of Object.values(state.links!))adapter.graph('same',link,'a','b');adapter.finish();
  expect(inspect().scene.items).toHaveLength(1);adapter.click('two');expect(inspect().selection.linkIds).toEqual(['one','two','three']);expect(project).toHaveBeenLastCalledWith(null);
  expect(status).toHaveBeenLastCalledWith('計画 → 実行（GraphLink 3 本）');expect(adapter.portControls('one')).toBe(false);
  for(const key of ['F2','[',']','Delete','Backspace'])expect(send(key).consumed).toBe(true);
  expect(JSON.stringify(state)).toBe(before);
 });
 it('active editor and IME do not prevent Alt arrows, even with board event target',()=>{
  const input=document.createElement('textarea');document.body.append(input);input.focus();
  expect(send('ArrowRight',{altKey:true})).toEqual({consumed:false,prevented:false});input.blur();
  expect(send('ArrowRight',{altKey:true,isComposing:true})).toEqual({consumed:false,prevented:false});
 });
 it('records the Lane band with root and heading endpoints without inventing a line',()=>{
  canvas.innerHTML='<text data-lane-header="true" data-node-id="root">全体</text><text data-lane-header="true" data-node-id="a">計画</text><rect class="lane-boundary" data-lane-node-id="a"/>';
  canvas.querySelectorAll('text').forEach(el=>{(el as any).getBBox=()=>({x:0,y:0,width:20,height:10});});
  adapter.begin({...layout,lane:{rootId:'root',direction:'down',boundaries:[],hiddenCounts:{},omittedLinkCount:0}},'map:root');adapter.finish();send('ArrowUp',{altKey:true});adapter.paint();
  expect(inspect().selection).toMatchObject({kind:'parent-child',parentNodeId:'root',childNodeId:'a'});expect(canvas.querySelectorAll('.lane-boundary.relation-selected')).toHaveLength(1);expect(canvas.querySelectorAll('[data-lane-header].relation-endpoint')).toHaveLength(2);
 });
});
