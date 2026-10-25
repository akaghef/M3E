const {test,expect}=require("@playwright/test");
const {laneServer,surfaceAction,applyLane,ready}=require("./lane_helpers");
const open=laneServer(test);

async function openCrossing(page){
 await open(page,require("../fixtures/lane_layers.json"),{scope:"diagram"});await applyLane(page);
 await surfaceAction(page,"view","lane-surface","lane-direction","lane-direction-down");await ready(page);
 await surfaceAction(page,"view","layout","layout-link-route","layout-link-straight");
 const node=page.locator('.node-hit[data-node-id="viewer"]'),link=page.locator('.graph-link[data-link-id="crossing"]');
 await expect(link).toHaveCount(1);
 // Read actual SVG geometry. No coordinate fixture or layout result is injected.
 const geometry=await page.evaluate(()=>{
  const node=document.querySelector('.node-hit[data-node-id="viewer"]'),line=document.querySelector('.graph-link[data-link-id="crossing"]');
  const bounds=node.getBoundingClientRect(),matrix=line.getScreenCTM(),length=line.getTotalLength();
  let crossing,empty;
  for(let i=1;i<200;i++){
   const p=line.getPointAtLength(length*i/200),screen=new DOMPoint(p.x,p.y).matrixTransform(matrix);
   if(screen.x>bounds.left+4&&screen.x<bounds.right-4&&screen.y>bounds.top+4&&screen.y<bounds.bottom-4)crossing={x:screen.x,y:screen.y};
   const outsideNodes=!Array.from(document.querySelectorAll('.node-hit')).some(n=>{const r=n.getBoundingClientRect();return screen.x>=r.left&&screen.x<=r.right&&screen.y>=r.top&&screen.y<=r.bottom;});
   const top=document.elementFromPoint(screen.x,screen.y);
   // Other GraphLink hit strokes may overlap this path. Select only a point
   // where the intended link is the actual pointer target.
   if(outsideNodes&&top?.classList.contains('graph-link-hit')&&top.getAttribute('data-link-id')===line.getAttribute('data-link-id'))empty={x:screen.x,y:screen.y};
  }
  const keys=Array.from(document.querySelector('#canvas').children).map(el=>el.getAttribute('data-render-key'));
  const style=getComputedStyle(line),box=line.getBoundingClientRect();
  return {crossing,empty,keys,visibleEvents:style.pointerEvents,hitEvents:getComputedStyle(document.querySelector('.graph-link-hit[data-link-id="crossing"]')).pointerEvents,
   paint:{stroke:style.stroke,width:style.strokeWidth,opacity:style.opacity,visibility:style.visibility,display:style.display},box:{x:box.x,y:box.y,width:box.width,height:box.height}};
 });
 await test.info().attach("actual-lane-geometry",{body:JSON.stringify(geometry,null,2),contentType:"application/json"});
 // A perfectly vertical SVG path has zero geometric width. Playwright's generic
 // visibility check rejects that box even though its nonzero stroke is painted.
 expect(geometry.paint.stroke).not.toBe("none");expect(parseFloat(geometry.paint.width)).toBeGreaterThan(0);
 expect(Number(geometry.paint.opacity)).toBeGreaterThan(0);expect(geometry.paint.visibility).toBe("visible");expect(geometry.paint.display).not.toBe("none");expect(geometry.box.height).toBeGreaterThan(0);
 await test.info().attach("lane-crossing-before-interaction",{body:await page.screenshot(),contentType:"image/png"});
 expect(geometry.crossing,"real skip-lane path must cross the middle node").toBeTruthy();expect(geometry.empty).toBeTruthy();
 expect(geometry.keys.indexOf("graph-link-hits")).toBeLessThan(geometry.keys.indexOf("node:viewer"));
 expect(geometry.keys.indexOf("lane-visible-links")).toBeGreaterThan(geometry.keys.indexOf("node:viewer"));
 expect(geometry.visibleEvents).toBe("none");expect(geometry.hitEvents).not.toBe("none");
 return {node,link,geometry};
}

test("Lane crossing visible link stays above nodes while node/link selection and F2 editing work",async({page})=>{
 const {node,link,geometry}=await openCrossing(page);
 await page.mouse.click(geometry.crossing.x,geometry.crossing.y);await expect(node).toHaveClass(/\bselected\b/);
 await expect(link).not.toHaveClass(/\bselected\b/);
 const target=await page.evaluate(({x,y})=>{const top=document.elementFromPoint(x,y);return {hit:top?.classList.contains('graph-link-hit'),link:top?.getAttribute('data-link-id')};},geometry.empty);
 expect(target).toEqual({hit:true,link:"crossing"});
 await page.mouse.click(geometry.empty.x,geometry.empty.y);await expect(link).toHaveClass(/\bselected\b/);
 await page.mouse.click(geometry.crossing.x,geometry.crossing.y);await expect(node).toHaveClass(/\bselected\b/);
 await page.keyboard.press("F2");
 const editor=page.locator("textarea.inline-node-editor");await expect(editor).toBeVisible();await expect(editor).toHaveAttribute("data-node-id","viewer");
 await page.keyboard.press("Escape");
 await surfaceAction(page,"view","tree");
 const restored=await page.evaluate(()=>Array.from(document.querySelector('#canvas').children).map(el=>el.getAttribute('data-render-key')));
 expect(restored).not.toContain("lane-visible-links");expect(restored.indexOf("links")).toBeLessThan(restored.indexOf("node:viewer"));
});

test("Lane crossing visible link permits drag start on its middle node",async({page})=>{
 const {node,geometry}=await openCrossing(page);
 await page.mouse.click(geometry.crossing.x,geometry.crossing.y);await expect(node).toHaveClass(/\bselected\b/);
 await page.mouse.move(geometry.crossing.x,geometry.crossing.y);await page.mouse.down();await page.mouse.move(geometry.crossing.x+25,geometry.crossing.y+5,{steps:5});
 await expect(node).toHaveClass(/\bdrag-source\b/);
 // Cleanup only. Drag cancellation behavior is outside this acceptance case.
 await page.keyboard.press("Escape");await page.mouse.up();
});
