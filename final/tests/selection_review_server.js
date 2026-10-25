// Run from this checkout after build:node and build:browser. Uses the real product server.
const {isolatedProductServer}=require('./visual/lane_helpers');
const {RapidMvpModel}=require('../dist/node/rapid_mvp');
const fixture=require('./fixtures/edge_graphlink_selection.json');
const names={tree:'親子の線',timeline:'時系列',system:'流れ',scatter:'包含',lane:'帯'};
function withSurface(payload,kind,direction='right') {
 const copy=structuredClone(payload);const state=RapidMvpModel.fromJSON(copy.state).toJSON();
 if(kind==='system')state.nodes[state.rootId].attributes['m3e:layout']='flow-lr';
 const root=state.rootId,scopeId=`scope:${root}`,surfaceId=`surface:${root}:${kind}`;
 state.scopes={...state.scopes,[scopeId]:{...state.scopes?.[scopeId],id:scopeId,label:state.nodes[root].text,rootNodeIds:[root],relationIds:[],primarySurfaceId:surfaceId}};
 state.surfaces={...state.surfaces,[surfaceId]:{id:surfaceId,scopeId,kind,layout:kind==='system'?'flow-lr':kind,displayRootId:root,surfaceView:{direction,space:'normal'},nodeViews:{}}};
 if(kind==='scatter') {
  const positions={plan:[100,140],sort:[260,100],research:[110,300],consult:[430,280],do:[640,100],implement:[780,220],test:[580,400],check:[980,370],record:[1040,520],detail:[310,190]};
  for(const [id,[x,y]] of Object.entries(positions))state.surfaces[surfaceId].nodeViews[id]={x,y};
 }
 copy.state=state;return copy;
}
async function main(){
 const running=await isolatedProductServer('m3e-edge-graphlink-review-',4188);
 const stop=async()=>{await running.close();process.exit(0);};process.once('SIGINT',stop);process.once('SIGTERM',stop);
 try {
  const maps={};
  for(const [kind,key] of [['tree','tree'],['timeline','axial'],['system','system'],['scatter','disperse']]) {
   maps[`selection-${key}`]=withSurface(fixture,kind);maps[`selection-${key}`].state.nodes.root.text=`選択確認・${names[kind]}`;
  }
  // Export the named review map through the existing product API. Never open
  // the source database or write to the source review server.
  const source=process.env.M3E_SELECTION_LANE_SOURCE_URL||'http://127.0.0.1:4187/api/maps/asys-lane';
  const exported=await fetch(source,{signal:AbortSignal.timeout(10000)});
  if(!exported.ok)throw new Error(`A-sys source export failed: ${exported.status}`);
  const payload=await exported.json();
  if(!payload?.state?.nodes?.[payload.state.rootId])throw new Error('A-sys source map is invalid');
  for(const direction of ['down','right']) {
   const copy=withSurface(payload,'lane',direction);copy.state.nodes[copy.state.rootId].text=`Akaghef-System 構成・${direction==='down'?'横':'縦'}の帯`;
   maps[`selection-asys-${direction}`]=copy;
  }
  for(const [id,payload] of Object.entries(maps)) {
   const url=`${running.baseUrl}/api/maps/${id}`;
   const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({state:payload.state})});
   if(!response.ok)throw new Error(`Seed failed: ${response.status}`);
   const saved=await(await fetch(url)).json();if(saved.state.rootId!==payload.state.rootId)throw new Error('Seed readback failed');
   console.log(`${payload.state.nodes[payload.state.rootId].text}: ${running.baseUrl}/viewer.html?map=${id}&renderer=svg`);
  }
  console.log(`Isolated data: ${running.dataDir}. Ctrl+C stops the server and removes the copy. Use renderer=webgl for WebGL review.`);
 }catch(error){await running.close();throw error;}
}
module.exports={withSurface};
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
