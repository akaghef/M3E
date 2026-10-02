const {test,expect}=require("@playwright/test");
const fixture=require("../fixtures/reorder-five-siblings.json");
test.use({launchOptions:{args:["--use-angle=swiftshader","--enable-unsafe-swiftshader"]}});

async function load(page,renderer,surface="tree") {
  await page.route("**/api/**",route=>{
    const url=new URL(route.request().url());
    if(url.pathname==="/api/maps/interaction-fixture" && route.request().method()==="GET") return route.fulfill({json:fixture});
    return route.fulfill({json:{ok:true,enabled:false,available:false}});
  });
  await page.addInitScript(()=>Object.defineProperty(navigator,"platform",{get:()=>"MacIntel"}));
  await page.goto(`/viewer.html?renderer=${renderer}&surface=${surface}&map=interaction-fixture&testRun=interaction-${renderer}-${Date.now()}`);
  await expect(page.locator("#board")).toHaveAttribute("data-ready","true");
  await page.getByRole("button",{name:"Hide inspector",exact:true}).click();
  await page.locator("#board").focus();
  await page.keyboard.press("Meta+0");
}

test("SVG reorder preview preserves layout, reaches the final slot, and supports Undo",async({page},testInfo)=>{
  const errors=[];page.on("pageerror",error=>errors.push(error.message));
  await load(page,"svg");
  const ids=fixture.state.nodes[fixture.state.rootId].children;
  const hit=id=>page.locator(`.node-hit[data-node-id="${id}"]`);
  await hit(ids[0]).click({trial:true});
  const a=await hit(ids[0]).boundingBox(),z=await hit(ids.at(-1)).boundingBox();
  const revision=await page.locator("#board").getAttribute("data-render-revision");
  // Siblings crossed by the pointer legitimately gain/lose drop-target paint.
  // The root is outside this gesture's source/target working set.
  await page.evaluate(id=>{window.unrelatedDragLabel=document.querySelector(`text[data-node-id="${id}"]`);},fixture.state.rootId);
  await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();
  await page.mouse.move(z.x+z.width/2,z.y+z.height*1.25,{steps:12});
  // Horizontal SVG lines have a zero-height bounding box; Playwright's
  // toBeVisible is false despite their painted stroke. Check paint + screenshot.
  await expect(page.locator(".reorder-line")).toHaveCount(1);
  expect(await page.locator(".reorder-line").evaluate(el=>getComputedStyle(el).stroke)).not.toBe("none");
  expect(await page.locator("#board").getAttribute("data-render-revision")).toBe(revision);
  expect(await page.evaluate(id=>window.unrelatedDragLabel===document.querySelector(`text[data-node-id="${id}"]`),fixture.state.rootId)).toBe(true);
  await page.screenshot({path:testInfo.outputPath("reorder-preview.png")});
  await page.mouse.up();
  const order=()=>page.locator("#canvas .node-hit").evaluateAll(elements=>elements.map(el=>el.dataset.nodeId));
  await expect.poll(order).toEqual([fixture.state.rootId,...ids.slice(1),ids[0]]);
  await expect(page.locator(".reorder-line")).toHaveCount(0);
  await page.keyboard.press("Meta+z");
  await expect.poll(order).toEqual([fixture.state.rootId,...ids]);
  expect(errors).toEqual([]);
});

test("WebGL Disperse preview retains snapshot geometry until commit and Undo restores it",async({page},testInfo)=>{
  const errors=[];page.on("pageerror",error=>errors.push(error.message));
  await load(page,"webgl","scatter");
  await expect.poll(()=>page.evaluate(()=>window.__m3eWebGLProjection?.getDebugState().active)).toBe(true);
  await page.locator("#board").focus();await page.keyboard.press("Meta+0");
  await page.locator("#webgl-canvas").click({trial:true});
  const id=fixture.state.nodes[fixture.state.rootId].children[0];
  const before=await page.evaluate(id=>{
    const p=window.__m3eWebGLProjection,s=p.getSnapshot(),d=p.getDebugState();
    const n=s.nodes.find(n=>n.id===id),r=document.querySelector("#webgl-canvas").getBoundingClientRect();
    return {node:n,uploads:d.geometryUploads,x:r.left+d.camera.x+(n.x+n.width/2)*d.camera.zoom,y:r.top+d.camera.y+(n.y+n.height/2)*d.camera.zoom};
  },id);
  const revision=await page.locator("#board").getAttribute("data-render-revision");
  await page.mouse.move(before.x,before.y);await page.mouse.down();
  await page.mouse.move(before.x+70,before.y+50,{steps:15});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  expect(await page.locator("#board").getAttribute("data-render-revision")).toBe(revision);
  expect(await page.evaluate(()=>window.__m3eWebGLProjection.getDebugState().geometryUploads)).toBe(before.uploads);
  await page.screenshot({path:testInfo.outputPath("disperse-preview.png")});
  await page.mouse.up();
  const position=()=>page.evaluate(id=>{const n=window.__m3eWebGLProjection.getSnapshot().nodes.find(n=>n.id===id);return {x:n.x,y:n.y};},id);
  await expect.poll(position).not.toEqual({x:before.node.x,y:before.node.y});
  await page.keyboard.press("Meta+z");
  await expect.poll(position).toEqual({x:before.node.x,y:before.node.y});
  expect(errors).toEqual([]);
});

test("WebGL context restoration rebuilds GPU resources without changing geometry or selection",async({page})=>{
  await load(page,"webgl");
  await expect.poll(()=>page.evaluate(()=>window.__m3eWebGLProjection?.getDebugState().active)).toBe(true);
  await page.locator("#board").focus();await page.keyboard.press("ArrowRight");
  await expect(page.locator("#meta")).toHaveAttribute("data-selected-node-id","1");
  const before=await page.evaluate(()=>window.__m3eWebGLProjection.getSnapshot());
  const supported=await page.evaluate(()=>{
    window.contextLossExtension=document.querySelector("#webgl-canvas").getContext("webgl2").getExtension("WEBGL_lose_context");
    if(!window.contextLossExtension)return false;
    window.contextLossExtension.loseContext();return true;
  });
  expect(supported).toBe(true);
  await expect(page.locator("#canvas")).toBeVisible();
  await page.evaluate(()=>window.contextLossExtension.restoreContext());
  await expect(page.locator("#webgl-canvas")).toBeVisible();
  await expect(page.locator("#canvas")).toBeHidden();
  const after=await page.evaluate(()=>window.__m3eWebGLProjection.getSnapshot());
  expect(after.nodes).toEqual(before.nodes);
  expect(after.edges).toEqual(before.edges);
  expect(await page.evaluate(()=>window.__m3eWebGLProjection.getDebugState().selectedNodeIds)).toEqual(["1"]);
});
