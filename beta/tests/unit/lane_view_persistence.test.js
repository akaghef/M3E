import { afterAll, beforeAll, expect, test } from "vitest";
const fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const fixture=require("../fixtures/lane_view.json");
const {selectLaneSurface}=require("../../dist/shared/lane_view.js");
const {RapidMvpModel}=require("../../dist/node/rapid_mvp.js");
let server,baseUrl,dataDir;
const oldDir=process.env.M3E_DATA_DIR,oldDb=process.env.M3E_DB_FILE;
beforeAll(async()=>{
 dataDir=fs.mkdtempSync(path.join(os.tmpdir(),"m3e-lane-persistence-"));process.env.M3E_DATA_DIR=dataDir;process.env.M3E_DB_FILE="lane.sqlite";
 const entry=require.resolve("../../dist/node/start_viewer.js");delete require.cache[entry];server=require(entry).createAppServer();
 await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve);});baseUrl=`http://127.0.0.1:${server.address().port}`;
});
afterAll(async()=>{
 if(server?.listening)await new Promise(resolve=>server.close(resolve));
 if(oldDir===undefined)delete process.env.M3E_DATA_DIR;else process.env.M3E_DATA_DIR=oldDir;
 if(oldDb===undefined)delete process.env.M3E_DB_FILE;else process.env.M3E_DB_FILE=oldDb;
 if(dataDir)fs.rmSync(dataDir,{recursive:true,force:true});
});
function seed(){const state=structuredClone(fixture.state);state.scopes={"scope:workspace":{id:"scope:workspace",label:"Workspace",rootNodeIds:["workspace"],relationIds:[]}};return state;}
test("existing map API and SQLite retain Lane root, direction and spacing",async()=>{
 const state=RapidMvpModel.fromJSON(seed()).toJSON(),nodes=structuredClone(state.nodes),links=structuredClone(state.links);
 const surface=selectLaneSurface(state,"workspace","diagram");surface.surfaceView={direction:"down",space:"loose"};
 const response=await fetch(`${baseUrl}/api/maps/lane`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({state})});expect(response.status).toBe(200);
 const read=await (await fetch(`${baseUrl}/api/maps/lane`)).json();expect(read.state.surfaces[surface.id]).toEqual(surface);
 expect(read.state.scopes["scope:workspace"].primarySurfaceId).toBe(surface.id);
 expect(read.state.nodes).toEqual(nodes);expect(read.state.links).toEqual(links);expect(read.state.nodes.diagram.nodeType).toBe("text");
 const db=RapidMvpModel.loadFromSqlite(path.join(dataDir,"lane.sqlite"),"lane");expect(db.toJSON().surfaces[surface.id]).toEqual(surface);
});
test("existing subtree copy remaps display root into copied topology",()=>{
 const state=seed();selectLaneSurface(state,"workspace","diagram");
 const target=new RapidMvpModel("Destination"),ids=target.copySubtree(state,"workspace",target.state.rootId);
 const displayRoot=ids.find(id=>target.state.nodes[id].text==="Project structure");
 const surface=Object.values(target.state.surfaces).find(surface=>surface.kind==="lane");
 expect(surface.displayRootId).toBe(displayRoot);expect(surface.displayRootId).not.toBe("diagram");
 expect(target.validate()).toEqual([]);
});
test("scoped SQLite read and write retain Lane selection and reject roots outside the boundary",()=>{
 const db=path.join(dataDir,"scope.sqlite"),state=seed();selectLaneSurface(state,"workspace","diagram");RapidMvpModel.fromJSON(state).saveToSqlite(db,"scope");
 const read=RapidMvpModel.readScopedState(db,"scope","workspace");expect(read.ok).toBe(true);
 const scoped=read.map.state,surface=scoped.surfaces["surface:workspace:lane"];
 expect(surface.displayRootId).toBe("diagram");surface.surfaceView={direction:"down",space:"tight"};
 expect(RapidMvpModel.writeScopedState(db,"scope","workspace",scoped).ok).toBe(true);
 const before=RapidMvpModel.loadFromSqlite(db,"scope").toJSON();expect(before.surfaces[surface.id].surfaceView).toEqual({direction:"down",space:"tight"});
 surface.displayRootId="missing";expect(RapidMvpModel.writeScopedState(db,"scope","workspace",scoped).ok).toBe(false);
 expect(RapidMvpModel.loadFromSqlite(db,"scope").toJSON()).toEqual(before);
});
