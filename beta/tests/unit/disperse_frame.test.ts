import { expect, test } from 'vitest';
import { dispersePositionFrame } from '../../src/browser/disperse_frame';
import type { RenderSnapshot } from '../../src/rendering/webgl_projection';
import type { ForceSnapshot } from '../../src/shared/force_seam_interface';
import type { PaintStyle } from '../../src/rendering/webgl_scene_tiles';
const style: PaintStyle={fill:'#123456',stroke:'#abcdef',width:2,dash:[],opacity:1,fillOpacity:1,strokeOpacity:1,cap:'round',join:'round',dashOffset:0,fillRule:'nonzero',strokeFirst:false};
function input(){
 const scene: RenderSnapshot={revision:'original',nodes:[{id:'a',x:0,y:-10,width:20,height:20,label:'Alpha',labelLines:['Alpha'],fontSize:13,textColor:'#123456',shape:'circle',fill:'#123456',stroke:'#abcdef'}],edges:[],graphLinks:[],groups:[{id:'a',memberIds:['a'],x:-20,y:-20,width:80,height:60}],bounds:{minX:-20,minY:-20,maxX:60,maxY:40},paintScene:{commands:[
  {kind:'text',nodeId:'a',text:'Alpha',x:27,y:0,font:'450 13px system-ui',fontSize:13,bounds:{x:27,y:-8,width:50,height:16},matrix:[1,0,0,1,0,0],style},
  {kind:'path',groupId:'a',path:'M-20 -20H60V40H-20Z',bounds:{x:-20,y:-20,width:80,height:60},matrix:[1,0,0,1,0,0],style},
 ]}};
 const layout={pos:{a:{x:0,y:0,w:20,h:20,depth:1}},order:['a'],totalWidth:100,totalHeight:100};
 const force: ForceSnapshot={nodes:[{id:'a',label:'Alpha',x:60,y:40,w:100,h:20,collapsed:false,hiddenCount:0}],groups:[{id:'a',label:'Alpha',members:['a'],x:0,y:10,w:140,h:60}],links:[],mode:'Disperse',parameters:{repulsion:2600,length:110,spring:.012,gravity:.012},status:'running',steps:3,remaining:237,maxMove:10,violations:0};
 return{scene,layout,force};
}
test('position frames preserve canonical font/color/path paint and update group geometry without DOM',()=>{
 const {scene,layout,force}=input(), before=structuredClone(scene), result=dispersePositionFrame(scene,layout,force)!;
 expect(result.scene.nodes[0]).toMatchObject({x:10,y:30,shape:'circle'});
 expect(result.scene.paintScene!.commands[0]).toMatchObject({text:'Alpha',font:'450 13px system-ui',matrix:[1,0,0,1,10,40],style});
 expect(result.scene.groups[0]).toMatchObject({x:0,y:10,width:140,height:60});
 expect(result.layout.pos.a).toMatchObject({x:10,y:40,w:20,h:20}); expect(scene).toEqual(before);
 const again=dispersePositionFrame(result.scene,result.layout,force)!;
 expect(again.scene.paintScene!.commands[0].matrix).toEqual([1,0,0,1,10,40]);
});
test('GraphLinks retain their canonical route rather than approximate curves during a force frame',()=>{
 const {scene,layout,force}=input();scene.graphLinks=[{id:'relation',sourceNodeId:'a',targetNodeId:'a',points:[{x:0,y:0},{x:20,y:0}],color:'#123456',width:2,kind:'graph-link'}];
 expect(dispersePositionFrame(scene,layout,force)).toBeNull();
});
test('mismatched topology returns to the canonical full render',()=>{
 const {scene,layout,force}=input();force.nodes=[];expect(dispersePositionFrame(scene,layout,force)).toBeNull();
});
test('moving guides still terminate on the current circle boundaries',()=>{
 const {scene,layout,force}=input();
 scene.nodes.push({...scene.nodes[0],id:'b',x:150,y:-10});
 layout.pos.b={...layout.pos.a,x:150};layout.order.push('b');
 force.nodes.push({...force.nodes[0],id:'b',x:210,y:140});
 scene.edges=[{id:'guide',sourceNodeId:'a',targetNodeId:'b',kind:'edge',color:'#123456',width:1,points:[{x:20,y:0},{x:150,y:0}]}];
 scene.paintScene!.commands.push({kind:'path',sourceNodeId:'a',targetNodeId:'b',path:'M20 0L150 0',matrix:[1,0,0,1,0,0],bounds:{x:20,y:0,width:130,height:1},style});
 const result=dispersePositionFrame(scene,layout,force)!;
 const [a,b]=result.scene.edges[0].points;
 expect(Math.hypot(a.x-28,a.y-40)).toBeCloseTo(18);
 expect(Math.hypot(b.x-178,b.y-140)).toBeCloseTo(18);
 expect(result.scene.paintScene!.commands.at(-1)!.path).toBe(`M${a.x} ${a.y}L${b.x} ${b.y}`);
});
