const { expect }=require("@playwright/test");
const fs=require("node:fs"),os=require("node:os"),path=require("node:path");

// Use the application's existing server and persistence with disposable data.
async function isolatedProductServer(prefix="m3e-lane-browser-", port=0) {
 const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),prefix));
 const previousDir=process.env.M3E_DATA_DIR,previousDb=process.env.M3E_DB_FILE;
 process.env.M3E_DATA_DIR=dataDir;process.env.M3E_DB_FILE="review.sqlite";
 const entry=require.resolve("../../dist/node/start_viewer.js");delete require.cache[entry];
 const server=require(entry).createAppServer();
 const listen=p=>new Promise((resolve,reject)=>{server.once("error",reject);server.listen(p,"127.0.0.1",()=>{server.removeListener("error",reject);resolve();});});
 const close=async()=>{
  if(server.listening)await new Promise(resolve=>server.close(resolve));
  if(previousDir===undefined)delete process.env.M3E_DATA_DIR;else process.env.M3E_DATA_DIR=previousDir;
  if(previousDb===undefined)delete process.env.M3E_DB_FILE;else process.env.M3E_DB_FILE=previousDb;
  fs.rmSync(dataDir,{recursive:true,force:true});
 };
 try {try {await listen(port);} catch(error) {if(error.code!=="EADDRINUSE")throw error;await listen(0);}}
 catch(error){await close();throw error;}
 return {server,dataDir,baseUrl:`http://127.0.0.1:${server.address().port}`,close};
}
function laneServer(test){
 let running,baseUrl,Model;
 test.beforeAll(async()=>{running=await isolatedProductServer();baseUrl=running.baseUrl;Model=require("../../dist/node/rapid_mvp.js").RapidMvpModel;});
 test.afterAll(async()=>{await running?.close();});
 return async function open(page,payload=require("../fixtures/lane_view.json"),options={}){
  const state=Model.fromJSON(structuredClone(payload.state)).toJSON(),mapId=`lane-${crypto.randomUUID()}`,url=`${baseUrl}/api/maps/${mapId}`;
  expect((await page.request.post(url,{data:{state}})).status()).toBe(200);
  await page.goto(`${baseUrl}/viewer.html?map=${mapId}&renderer=${options.renderer||"svg"}${options.scope?`&scope=${encodeURIComponent(options.scope)}`:""}`);
  await expect(page.locator("#board")).toHaveAttribute("data-ready","true");
  const initialNode=state.nodes.diagram ? "diagram" : state.rootId;
  if(!options.surfaceReady)await expect(page.locator(`.node-hit[data-node-id="${initialNode}"]`)).toBeVisible();
  return {url,read:async()=> (await (await page.request.get(url)).json()).state};
 };
}
async function surfaceAction(page,...path){
 const nav=page.getByTestId("progressive-navigation");
 await page.getByRole("button",{name:"Surface PN root",exact:true}).click();
 await expect(nav).toHaveClass(/\bis-open\b/);
 for(const id of path.slice(0,-1)){
  await page.locator(`[data-pn-node="${id}"]`).hover();
  await expect(nav).toHaveAttribute("data-active-pn-node",id);
 }
 await page.locator(`[data-pn-node="${path.at(-1)}"]`).click();
}
/** Lane is a Surface View of the current scope: switch it from Surface PN. */
async function applyLane(page,direction="right"){
 await surfaceAction(page,"view","lane-surface","lane-direction",`lane-direction-${direction}`);await ready(page);
}
async function ready(page){await expect(page.locator("#board")).toHaveAttribute("data-lane-state","ready");}
module.exports={laneServer,surfaceAction,applyLane,ready,isolatedProductServer};
