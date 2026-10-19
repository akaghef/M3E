const { expect }=require("@playwright/test");
const fs=require("node:fs"),os=require("node:os"),path=require("node:path");

// Use the application's existing server and persistence with disposable data.
function laneServer(test){
 let server,baseUrl,dataDir,Model;
 const previousDir=process.env.M3E_DATA_DIR,previousDb=process.env.M3E_DB_FILE;
 test.beforeAll(async()=>{
  dataDir=fs.mkdtempSync(path.join(os.tmpdir(),"m3e-lane-browser-"));process.env.M3E_DATA_DIR=dataDir;process.env.M3E_DB_FILE="lane.sqlite";
  const entry=require.resolve("../../dist/node/start_viewer.js");delete require.cache[entry];server=require(entry).createAppServer();Model=require("../../dist/node/rapid_mvp.js").RapidMvpModel;
  await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve);});baseUrl=`http://127.0.0.1:${server.address().port}`;
 });
 test.afterAll(async()=>{
  if(server?.listening)await new Promise(resolve=>server.close(resolve));
  if(previousDir===undefined)delete process.env.M3E_DATA_DIR;else process.env.M3E_DATA_DIR=previousDir;
  if(previousDb===undefined)delete process.env.M3E_DB_FILE;else process.env.M3E_DB_FILE=previousDb;
  if(dataDir)fs.rmSync(dataDir,{recursive:true,force:true});
 });
 return async function open(page,payload=require("../fixtures/lane_view.json")){
  const state=Model.fromJSON(structuredClone(payload.state)).toJSON(),mapId=`lane-${crypto.randomUUID()}`,url=`${baseUrl}/api/maps/${mapId}`;
  expect((await page.request.post(url,{data:{state}})).status()).toBe(200);
  await page.goto(`${baseUrl}/viewer.html?map=${mapId}&renderer=svg`);
  await expect(page.locator("#board")).toHaveAttribute("data-ready","true");
  const initialNode=state.nodes.diagram ? "diagram" : state.rootId;
  await expect(page.locator(`.node-hit[data-node-id="${initialNode}"]`)).toBeVisible();
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
async function applyRoot(page,id="diagram"){
 await page.locator(`.node-hit[data-node-id="${id}"]`).click();await page.keyboard.press("Space");
 await expect(page.locator('.wb-progressive-nav[data-pn-mode="active-node"].is-open')).toBeVisible();
 await page.locator('[data-pn-node="lane-root"]').click();await ready(page);
}
async function ready(page){await expect(page.locator("#board")).toHaveAttribute("data-lane-state","ready");}
module.exports={laneServer,surfaceAction,applyRoot,ready};
