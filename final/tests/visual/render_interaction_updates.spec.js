const {test,expect}=require("@playwright/test");
const fixture=require("../fixtures/reorder-five-siblings.json");
test.use({launchOptions:{args:["--use-angle=swiftshader","--enable-unsafe-swiftshader"]}});

async function load(page,renderer,surface="tree",{payload=fixture,access="edit"}={}) {
  let saved = structuredClone(payload);
  const writes = [];
  await page.route("**/api/**",route=>{
    const url=new URL(route.request().url());
    if(url.pathname==="/api/maps/interaction-fixture") {
      if (route.request().method()==="POST") {
        saved = route.request().postDataJSON();
        writes.push(saved);
        return route.fulfill({json:{ok:true,savedAt:saved.savedAt}});
      }
      return route.fulfill({json:saved});
    }
    return route.fulfill({json:{ok:true,enabled:false,available:false}});
  });
  await page.addInitScript(()=>Object.defineProperty(navigator,"platform",{get:()=>"MacIntel"}));
  await page.goto(`/viewer.html?${renderer === "default" ? "" : `renderer=${renderer}&`}surface=${surface}&access=${access}&map=interaction-fixture&testRun=interaction-${renderer}-${Date.now()}`);
  await expect(page.locator("#board")).toHaveAttribute("data-ready","true");
  await page.getByRole("button",{name:"Hide inspector",exact:true}).click();
  await page.locator("#board").focus();
  await page.keyboard.press("Meta+0");
  await waitForViewSettled(page);
  return { writes, saved: () => saved };
}

async function waitForViewSettled(page) {
  // WebGL has no DOM node locator whose actionability check waits for movement
  // to stop. Measure coordinates only after the fit/inspector animation settles.
  let previousTransform;
  await expect.poll(async () => {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const transform = await page.evaluate(() => JSON.stringify({
      camera: window.__m3eWebGLProjection?.getDebugState().active
        ? window.__m3eWebGLProjection.getDebugState().camera : document.querySelector("#canvas").style.transform,
      width: document.querySelector("#board").getBoundingClientRect().width,
    }));
    const stable = transform === previousTransform;
    previousTransform = transform;
    return stable;
  }).toBe(true);
}

async function nodeBounds(page, renderer, id) {
  // Undo updates the tree before the next WebGL projection frame is presented.
  await waitForViewSettled(page);
  if (renderer === "svg") return page.locator(`.node-hit[data-node-id="${id}"]`).boundingBox();
  await expect(page.locator("#webgl-canvas")).toBeVisible();
  return page.evaluate(id => {
    const projection = window.__m3eWebGLProjection;
    const node = projection.getSnapshot().nodes.find(node => node.id === id);
    const { camera } = projection.getDebugState();
    const rect = document.querySelector("#webgl-canvas").getBoundingClientRect();
    return { x: rect.left + camera.x + node.x * camera.zoom, y: rect.top + camera.y + node.y * camera.zoom,
      width: node.width * camera.zoom, height: node.height * camera.zoom };
  }, id);
}

async function dragOnto(page, renderer, source, target) {
  const a = await nodeBounds(page, renderer, source), b = await nodeBounds(page, renderer, target);
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 });
}

const treeEdges = page => page.locator("#canvas .edge").evaluateAll(elements => elements.map(el =>
  [el.dataset.sourceNodeId, el.dataset.targetNodeId]));

for (const renderer of ["svg", "webgl", "default"]) {
  test(`${renderer} Tree drag starts, reparents, and Undo restores the parent`, async ({ page }, testInfo) => {
    const errors = []; page.on("pageerror", error => errors.push(error.message));
    await load(page, renderer);
    const before = await treeEdges(page);
    const revision = await page.locator("#board").getAttribute("data-render-revision");
    await dragOnto(page, renderer, "1", "5");
    await expect(page.locator("#meta")).toContainText("drop-target: child of 5");
    if (renderer !== "svg") {
      const preview = await page.evaluate(() => window.__m3eWebGLProjection.getDebugState());
      expect(preview.dragSourceNodeIds).toEqual(["1"]);
      expect(preview.dropTargetNodeId).toBe("5");
    }
    expect(await page.locator("#board").getAttribute("data-render-revision")).toBe(revision);
    await page.screenshot({ path: testInfo.outputPath("tree-reparent-preview.png") });
    await page.mouse.up();
    await expect.poll(() => treeEdges(page)).toContainEqual(["5", "1"]);
    expect(await treeEdges(page)).not.toContainEqual(["root", "1"]);
    await page.keyboard.press("Meta+z");
    await expect.poll(() => treeEdges(page)).toEqual(before);
    expect(errors).toEqual([]);
  });
}

for (const renderer of ["svg", "webgl"]) {
  test(`${renderer} Tree reorder reaches last, first and middle slots`, async ({ page }, testInfo) => {
    await load(page, renderer);
    const order = () => treeEdges(page).then(edges => edges.filter(([parent]) => parent === "root").map(([,id]) => id));
    for (const { source, target, fraction, expected } of [
      { source:"1", target:"5", fraction:1.25, expected:["2","3","4","5","1"] },
      { source:"5", target:"1", fraction:0.05, expected:["5","1","2","3","4"] },
      { source:"1", target:"3", fraction:0.05, expected:["2","1","3","4","5"] },
    ]) {
      const a = await nodeBounds(page,renderer,source), b = await nodeBounds(page,renderer,target);
      await page.mouse.move(a.x+a.width/2,a.y+a.height/2); await page.mouse.down();
      await page.mouse.move(b.x+b.width/2,b.y+b.height*fraction,{steps:12});
      await expect(page.locator("#meta")).toContainText("drop-target: reorder in");
      if (renderer === "webgl") {
        await expect.poll(() => page.evaluate(() => window.__m3eWebGLProjection.getDebugState().reorderLine)).not.toBeNull();
      } else await expect(page.locator(".reorder-line")).toHaveCount(1);
      await page.screenshot({path:testInfo.outputPath(`reorder-${source}-${target}.png`)});
      await page.mouse.up();
      await expect.poll(order).toEqual(expected);
      await page.keyboard.press("Meta+z");
      await expect.poll(order).toEqual(["1","2","3","4","5"]);
    }
  });

  test(`${renderer} Tree multi-selection moves together and one Undo restores both`, async ({ page }) => {
    await load(page,renderer);
    const before=await treeEdges(page);
    const a=await nodeBounds(page,renderer,"1"), b=await nodeBounds(page,renderer,"2");
    await page.mouse.click(a.x+a.width/2,a.y+a.height/2);
    await page.keyboard.down("Meta"); await page.mouse.click(b.x+b.width/2,b.y+b.height/2); await page.keyboard.up("Meta");
    await expect(page.locator("#meta")).toContainText("(2)");
    await dragOnto(page,renderer,"1","5");
    await expect(page.locator("#meta")).toContainText("drop-target: child of 5");
    await page.mouse.up();
    await expect.poll(() => treeEdges(page)).toContainEqual(["5","1"]);
    await expect.poll(() => treeEdges(page)).toContainEqual(["5","2"]);
    await page.keyboard.press("Meta+z");
    await expect.poll(() => treeEdges(page)).toEqual(before);
  });

  test(`${renderer} Escape cancels a pending drop, root cannot move, and the next drag works`, async ({ page }) => {
    const storage=await load(page,renderer);
    const before=await treeEdges(page);
    await dragOnto(page,renderer,"1","5");
    await expect(page.locator("#meta")).toContainText("drop-target: child of 5");
    await page.keyboard.press("Escape"); await page.mouse.up();
    await expect(page.locator("#meta")).toContainText("drop-target: none");
    expect(await treeEdges(page)).toEqual(before);
    await dragOnto(page,renderer,"root","5"); await page.mouse.up();
    expect(await treeEdges(page)).toEqual(before);
    expect(storage.writes).toHaveLength(0);
    await dragOnto(page,renderer,"1","5"); await page.mouse.up();
    await expect.poll(() => treeEdges(page)).toContainEqual(["5","1"]);
  });
}

test("default Tree drag sends the new parent/order to autosave and reload restores it", async ({ page }) => {
  const storage=await load(page,"default");
  await dragOnto(page,"default","1","5"); await page.mouse.up();
  await expect.poll(() => storage.saved().state.nodes["1"].parentId).toBe("5");
  expect(storage.saved().state.nodes.root.children).toEqual(["2","3","4","5"]);
  expect(storage.saved().state.nodes["5"].children).toEqual(["1"]);
  await page.reload();
  await expect(page.locator("#board")).toHaveAttribute("data-ready","true");
  await expect.poll(() => treeEdges(page)).toContainEqual(["5","1"]);
});

test("WebGL read-only Tree allows selection without moving nodes", async ({ page }) => {
  const storage=await load(page,"webgl","tree",{access:"view"});
  const before=await treeEdges(page);
  await dragOnto(page,"webgl","1","5"); await page.mouse.up();
  expect(await treeEdges(page)).toEqual(before);
  expect(storage.writes).toHaveLength(0);
  await expect(page.locator("#meta")).toHaveAttribute("data-selected-node-id","1");
});

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
