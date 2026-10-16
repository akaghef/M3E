const {test,expect}=require("@playwright/test");
const fixture=require("../fixtures/shortcut_test.json");
test.use({launchOptions:{args:["--use-angle=swiftshader","--enable-unsafe-swiftshader"]}});
test.beforeEach(async ({page},testInfo)=>{
  const errors=[];
  page.on("pageerror",error=>errors.push(error.stack || error.message));
  page.on("console",message=>{if(message.type()==="error") errors.push(message.text());});
  testInfo.attachBrowserErrors=()=>testInfo.attach("browser-errors",{body:JSON.stringify(errors,null,2),contentType:"application/json"});
});
test.afterEach(async ({},testInfo)=>{await testInfo.attachBrowserErrors();});

const edges=page=>page.locator("#canvas .edge").evaluateAll(es=>es.map(e=>[e.dataset.sourceNodeId,e.dataset.targetNodeId]));
const order=page=>edges(page).then(es=>es.filter(([p])=>p==="root").map(([,id])=>id));
async function load(page,renderer,platform="MacIntel",direction="right",access="edit",collapsed=false) {
  let saved=structuredClone(fixture); const writes=[];
  saved.state.nodes["child-a"].collapsed=collapsed;
  saved.state.nodes["child-b"].collapsed=collapsed;
  saved.state.nodes.root.attributes["m3e:branch-direction"]=direction;
  await page.addInitScript(platform=>Object.defineProperty(navigator,"platform",{get:()=>platform}),platform);
  await page.route("**/api/**",route=>{
    if(new URL(route.request().url()).pathname==="/api/maps/grab-fixture") {
      if(route.request().method()==="POST") {saved=route.request().postDataJSON();writes.push(saved);return route.fulfill({json:{ok:true,savedAt:saved.savedAt}});}
      return route.fulfill({json:saved});
    }
    return route.fulfill({json:{ok:true,enabled:false,available:false}});
  });
  await page.goto(`/viewer.html?renderer=${renderer}&access=${access}&map=grab-fixture&testRun=grab-${Date.now()}`);
  await expect(page.locator("#board")).toHaveAttribute("data-ready","true");
  if(renderer==="webgl") await expect.poll(()=>page.evaluate(()=>window.__m3eWebGLProjection?.getDebugState().active)).toBe(true);
  await expect(page.locator("html")).toHaveAttribute("data-surface-layout-direction",direction);
  await page.locator("#board").focus(); await page.keyboard.press("ArrowRight");
  await expect(page.locator("#meta")).toHaveAttribute("data-selected-node-id","child-a");
  return {writes,saved:()=>saved};
}

for(const platform of ["MacIntel","Win32"]) for(const renderer of ["svg","webgl"]) {
  const primary=platform==="MacIntel"?"Meta":"Control";
  test(`${platform} ${renderer}: held Grab, repeated moves, one Undo and save/reload`,async({page},testInfo)=>{
    const storage=await load(page,renderer,platform), before=await edges(page);
    const board=page.locator("#board");
    await page.keyboard.down("m");
    await expect(board).toHaveAttribute("data-keyboard-mode","grab");
    await expect(page.getByLabel("Node operation mode")).toHaveText("Grab");
    await expect(page.locator("#status")).toContainText("Grab");
    // First-sibling exception: A goes under B, taking both children with it.
    await page.keyboard.press("ArrowRight");
    await expect.poll(()=>edges(page)).toContainEqual(["child-b","child-a"]);
    for(const id of ["grandchild-a1","grandchild-a2"]) await expect.poll(()=>edges(page)).toContainEqual(["child-a",id]);
    await page.keyboard.press("ArrowLeft"); // after B
    await page.keyboard.press("ArrowDown"); // after C, final slot
    await expect.poll(()=>order(page)).toEqual(["child-b","child-c","child-a"]);
    await expect(page.locator("#meta")).toHaveAttribute("data-selected-node-id","child-a");
    await page.waitForTimeout(850); // Cross the existing 700ms autosave boundary.
    expect(storage.writes).toHaveLength(0);
    await page.screenshot({path:testInfo.outputPath("grab-held.png")});
    await page.keyboard.up("m");
    await expect(board).toHaveAttribute("data-keyboard-mode","navigate");
    await expect.poll(()=>storage.writes.length).toBe(1);
    expect(storage.saved().state.nodes.root.children).toEqual(["child-b","child-c","child-a"]);
    expect(storage.saved().state.nodes["child-a"].children).toEqual(["grandchild-a1","grandchild-a2"]);
    await page.keyboard.press("ArrowUp");
    await expect(page.locator("#meta")).toHaveAttribute("data-selected-node-id","child-c");
    await page.keyboard.press(`${primary}+z`);
    await expect.poll(()=>edges(page)).toEqual(before);
    await page.keyboard.press(`${primary}+Shift+z`);
    await expect.poll(()=>order(page)).toEqual(["child-b","child-c","child-a"]);
    await expect.poll(()=>storage.writes.length).toBe(2);
    await page.reload();
    await expect(page.locator("#board")).toHaveAttribute("data-ready","true");
    await expect.poll(()=>order(page)).toEqual(["child-b","child-c","child-a"]);
  });

  test(`${platform} ${renderer}: Escape rolls back, blur commits, Edit owns M`,async({page})=>{
    const storage=await load(page,renderer,platform), before=await edges(page);
    await page.keyboard.down("m"); await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Escape"); await page.keyboard.up("m");
    await expect(page.locator("#board")).toHaveAttribute("data-keyboard-mode","navigate");
    await expect.poll(()=>edges(page)).toEqual(before);
    await page.waitForTimeout(850); expect(storage.writes).toHaveLength(0);
    await page.keyboard.down("m"); await page.keyboard.press("ArrowRight");
    // Event-contract coverage; this does not claim OS window-manager automation.
    await page.evaluate(()=>window.dispatchEvent(new Event("blur")));
    await page.keyboard.up("m");
    await expect(page.locator("#board")).toHaveAttribute("data-keyboard-mode","navigate");
    await expect.poll(()=>storage.saved().state.nodes["child-a"].parentId).toBe("child-b");
    await page.keyboard.press(`${primary}+z`);
    await expect.poll(()=>edges(page)).toEqual(before);
    await page.keyboard.press("Enter");
    const editor=page.locator("textarea.inline-node-editor");
    await expect(editor).toBeFocused();
    await page.keyboard.press("m");
    await expect(editor).toHaveValue("Child Am");
    await expect(page.locator("#board")).toHaveAttribute("data-keyboard-mode","edit");
    await page.keyboard.press("Escape");
    // Existing modified mark-and-apply remains available; bare M no longer marks.
    await page.keyboard.press(`${primary}+m`); await page.keyboard.press("ArrowDown"); await page.keyboard.press("p");
    await expect.poll(()=>edges(page)).toContainEqual(["child-b","child-a"]);
  });
}

for(const [direction,depth] of [["left","ArrowLeft"],["down","ArrowDown"],["up","ArrowUp"],["left/right",null],["up/down",null]]) {
  test(`WebGL ${direction} respects the displayed child direction`,async({page})=>{
    await load(page,"webgl","MacIntel",direction);
    const geometry=await page.evaluate(()=>window.__m3eWebGLProjection.getSnapshot().nodes.map(n=>({id:n.id,x:n.x+n.width/2,y:n.y+n.height/2})));
    let source="child-a", target="child-b", key=depth;
    if(!key) {
      const vertical=direction==="up/down", root=geometry.find(n=>n.id==="root");
      const siblings=geometry.filter(n=>["child-a","child-b","child-c"].includes(n.id));
      const axis=vertical?"y":"x", breadth=vertical?"x":"y";
      const groups=[siblings.filter(n=>n[axis]<root[axis]),siblings.filter(n=>n[axis]>root[axis])];
      const pair=groups.find(g=>g.length>=2).sort((a,b)=>a[breadth]-b[breadth]);
      source=pair[0].id; target=pair[1].id;
      key=vertical?(pair[0].y<root.y?"ArrowUp":"ArrowDown"):(pair[0].x<root.x?"ArrowLeft":"ArrowRight");
      if(source!=="child-a") {
        await page.keyboard.press("ArrowLeft");await page.keyboard.press("ArrowRight");
        for(let i=0;i<2 && await page.locator("#meta").getAttribute("data-selected-node-id")!==source;i++) await page.keyboard.press("ArrowDown");
        await expect(page.locator("#meta")).toHaveAttribute("data-selected-node-id",source);
      }
    }
    await page.keyboard.down("m"); await page.keyboard.press(key); await page.keyboard.up("m");
    await expect.poll(()=>edges(page)).toContainEqual([target,source]);
  });
}

test("WebGL root and read-only protection and bare M/P does not mark a source",async({page})=>{
  const storage=await load(page,"webgl"),before=await edges(page);
  await page.keyboard.press("m"); await page.keyboard.press("ArrowDown"); await page.keyboard.press("p");
  expect(await edges(page)).toEqual(before);
  await page.keyboard.press("ArrowLeft"); await page.keyboard.down("m"); await page.keyboard.press("ArrowDown"); await page.keyboard.up("m");
  expect(await edges(page)).toEqual(before); expect(storage.writes).toHaveLength(0);
  await page.unrouteAll();
  const readOnly=await load(page,"webgl","MacIntel","right","view");
  await page.keyboard.down("m"); await page.keyboard.press("ArrowRight"); await page.keyboard.up("m");
  expect(await edges(page)).toEqual(before); expect(readOnly.writes).toHaveLength(0);
});

for(const renderer of ["svg","webgl"]) test(`${renderer} Grab keeps hidden descendants and Undo restores collapse`,async({page})=>{
  const storage=await load(page,renderer,"MacIntel","right","edit",true),before=await edges(page);
  expect(before).not.toContainEqual(["child-a","grandchild-a1"]);
  await page.keyboard.down("m");await page.keyboard.press("ArrowRight");await page.keyboard.up("m");
  await expect.poll(()=>storage.writes.length).toBe(1);
  const state=storage.saved().state;
  expect(state.nodes["child-a"].parentId).toBe("child-b");
  expect(state.nodes["child-a"].children).toEqual(["grandchild-a1","grandchild-a2"]);
  expect(state.nodes["grandchild-a1"].parentId).toBe("child-a");
  expect(state.nodes["child-b"].collapsed).toBe(false);
  await page.keyboard.press("Meta+z");
  await expect.poll(()=>edges(page)).toEqual(before);
  await expect.poll(()=>storage.saved().state.nodes["child-b"].collapsed).toBe(true);
});

test("WebGL external update cancels an uncommitted Grab without later restoring stale state",async({page})=>{
  const storage=await load(page,"webgl");
  await page.keyboard.down("m");await page.keyboard.press("ArrowRight");
  const remote=structuredClone(fixture.state);
  remote.nodes.root.children=["child-c","child-b","child-a"];
  await page.evaluate(state=>{const channel=new BroadcastChannel("m3e-map-grab-fixture");channel.postMessage({type:"STATE_UPDATE",fromTabId:"other-test-tab",state,savedAt:"2026-10-16T00:00:00Z"});channel.close();},remote);
  await expect(page.locator("#board")).toHaveAttribute("data-keyboard-mode","navigate");
  await page.keyboard.up("m");
  await expect.poll(()=>order(page)).toEqual(["child-c","child-b","child-a"]);
  await expect.poll(()=>edges(page)).toContainEqual(["root","child-a"]);
  expect(storage.writes).toHaveLength(0);
});
