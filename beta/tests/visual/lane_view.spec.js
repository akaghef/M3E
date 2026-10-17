const {test,expect}=require("@playwright/test");
const {laneServer,surfaceAction,applyRoot,ready}=require("./lane_helpers");
const open=laneServer(test);

test("non-scope Lane root, links, labels and preferences survive real save and reopening",async({page})=>{
 const {read}=await open(page);await applyRoot(page);
 await expect(page.locator(".lane-title")).toHaveText(["Research","Development","Operations"]);
 await expect(page.locator(".node-hit")).toHaveCount(7);
 await expect(page.locator('.node-hit[data-node-id="diagram"]')).toHaveCount(0);
 await expect(page.locator(".lane-summary")).toHaveText("表示しない GraphLink: 1");
 await expect(page.locator(".lane-boundary")).toHaveCount(3);
 await expect(page.locator(".tree-edge, .parent-child-edge, [data-edge-id^='edge:']")).toHaveCount(0);
 await expect(page.locator(".graph-link")).toHaveCount(5);await expect(page.locator(".graph-link-label")).toHaveText(["Uses","Supports","Stores","Feeds","Checks"]);
 const links={"relation-0":["","url"],"relation-1":["url",""],"relation-2":["url","url"],"relation-3":["",""]};
 for(const [id,[start,end]] of Object.entries(links)){
  const link=page.locator(`.graph-link[data-link-id="${id}"]`);
  if(start)await expect(link).toHaveAttribute("marker-start",/^url/);else expect(await link.getAttribute("marker-start")).toBeNull();
  if(end)await expect(link).toHaveAttribute("marker-end",/^url/);else expect(await link.getAttribute("marker-end")).toBeNull();
 }
 await expect(page.locator('.graph-link[data-link-id="relation-1"]')).toHaveClass(/dashed/);
 await expect(page.locator('.graph-link[data-link-id="relation-2"]')).toHaveClass(/soft/);
 await expect(page.locator('.graph-link[data-link-id="relation-3"]')).toHaveClass(/emphasis/);
 const humanText=await page.locator("#canvas text").allTextContents();
 expect(humanText.join(" ")).not.toMatch(/relation-\d|workspace|diagram|lane-empty:|surface:|[0-9a-f]{8}-[0-9a-f]{4}/);
 await surfaceAction(page,"view","lane-surface","lane-direction","lane-direction-down");await ready(page);
 await surfaceAction(page,"view","lane-surface","lane-space","lane-space-loose");await ready(page);
 await expect.poll(async()=> (await read()).surfaces?.["surface:workspace:lane"]?.surfaceView).toEqual({direction:"down",space:"loose"});
 const saved=await read();expect(saved.nodes.diagram.nodeType).toBe("text");expect(saved.surfaces["surface:workspace:lane"].displayRootId).toBe("diagram");
 await page.reload();await ready(page);await expect(page.locator("#board")).toHaveAttribute("data-lane-root","diagram");
 await expect(page.locator("html")).toHaveAttribute("data-surface-layout-direction","down");await expect(page.locator("html")).toHaveAttribute("data-surface-space","loose");
});

test("Tree to Lane to Tree leaves all nodes and GraphLinks intact and restores Lane preferences",async({page})=>{
 const {read}=await open(page);const before=await read();await applyRoot(page);
 await surfaceAction(page,"view","lane-surface","lane-direction","lane-direction-down");await ready(page);
 await surfaceAction(page,"view","tree");
 await expect(page.locator("html")).toHaveAttribute("data-surface-view-mode","tree");
 await expect(page.locator('.node-hit[data-node-id="diagram"]')).toBeVisible();
 await expect.poll(async()=> (await read()).scopes?.["scope:workspace"]?.primarySurfaceId).toBe("surface:workspace:tree");
 const after=await read();expect(after.nodes).toEqual(before.nodes);expect(after.links).toEqual(before.links);
 await surfaceAction(page,"view","lane-surface","lane-direction","lane-direction-down");await ready(page);
 await expect(page.locator("#board")).toHaveAttribute("data-lane-root","diagram");
});

test("Lane navigation offers only right/down, has no parent-child Edge Route and retains Link Route",async({page})=>{
 await open(page);await applyRoot(page);
 const nav=page.getByTestId("progressive-navigation");
 await page.getByRole("button",{name:"Surface PN root",exact:true}).click();
 for(const id of ["view","lane-surface","lane-direction"]){await page.locator(`[data-pn-node="${id}"]`).hover();await expect(nav).toHaveAttribute("data-active-pn-node",id);}
 await expect(page.locator('[data-pn-node^="lane-direction-"]')).toHaveText(["Rightlanes from left to right","Downlanes from top to bottom"]);
 await page.locator('[data-pn-node="lane-direction-right"]').click();await ready(page);
 await page.getByRole("button",{name:"Surface PN root",exact:true}).click();
 for(const id of ["view","layout"]){await page.locator(`[data-pn-node="${id}"]`).hover();await expect(nav).toHaveAttribute("data-active-pn-node",id);}
 await expect(page.locator('[data-pn-node="layout-edge-route"]')).toHaveCount(0);await expect(page.locator('[data-pn-node="layout-link-route"]')).toBeVisible();
 await page.locator('[data-pn-node="layout-direction"]').hover();await expect(page.locator('[data-pn-node^="layout-direction-"]')).toHaveCount(2);
});
