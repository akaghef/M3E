const {test,expect}=require('@playwright/test');
// Exercise the real WebGL2 renderer in headless Chromium, including hosts without a GPU.
test.use({launchOptions:{args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}});
const {laneServer}=require('./lane_helpers');
const {bar,choose,geometry,paint,settled,hitTargets,trackMapSaves}=require('./viewer_filter_helpers');
const open=laneServer(test);
const {fixture,mode}=require('./viewer_filter_renderer_helpers');
test.beforeEach(({page})=>{trackMapSaves(page);});
async function filterLayout(page){return page.evaluate(()=>{
 const filter=document.querySelector('.viewer-filter-bar').getBoundingClientRect();
 const rects=selector=>Array.from(document.querySelectorAll(selector),e=>e.getBoundingClientRect()).filter(r=>r.width&&r.height);
 const groups=rects('.wb-brand,.wb-top-actions'),inspectors=rects('.wb-right-panel,.wb-panel-tab');
 const overlaps=r=>filter.left<r.right&&filter.right>r.left&&filter.top<r.bottom&&filter.bottom>r.top;
 const gapCentre=(groups[0].right+groups[1].left)/2;
 const top=Math.min(...groups.map(r=>r.top));
 const fits=gapCentre-filter.width/2>=groups[0].right+8&&gapCentre+filter.width/2<=groups[1].left-8&&
  !inspectors.some(r=>gapCentre-filter.width/2<r.right&&gapCentre+filter.width/2>r.left&&top<r.bottom&&top+filter.height>r.top);
 const rowRight=Math.min(innerWidth-14,...inspectors.map(r=>r.left-8));
 return {overlaps:[...groups,...inspectors].filter(overlaps).length,inViewport:filter.left>=0&&filter.right<=innerWidth,
  fits,centred:Math.abs((filter.left+filter.right)/2-(fits?gapCentre:(14+rowRight)/2))<1,
  correctRow:fits?Math.abs(filter.top-top)<1:Math.abs(filter.top-Math.max(...groups.map(r=>r.bottom))-8)<1};
});}
async function expectFilterLayout(page){
 await expect.poll(()=>filterLayout(page)).toMatchObject({overlaps:0,inViewport:true,centred:true,correctRow:true});
}
async function clickCentre(page,selector){
 const target=page.locator(selector);await expect(target).toBeVisible();
 // Check browser hit routing, then deliver a real pointer click (no dispatchEvent/force).
 const point=await target.evaluate(button=>{
  const r=button.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
  const receives=button.contains(document.elementFromPoint(x,y));
  button.dataset.layoutClick='pending';
  button.addEventListener('click',()=>{button.dataset.layoutClick='received';},{once:true});
  return {x,y,receives};
 });
 expect(point.receives).toBe(true);await page.mouse.click(point.x,point.y);
 await expect(target).toHaveAttribute('data-layout-click','received');
}
test('Lane filter never covers top-bar controls or Inspector across window resizes',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await open(page,require('../fixtures/lane_asys_domains.json'));
 await mode(page,'lane');
 // The original regression had two disabled axes, each adding a two-line reason.
 await expect(bar(page).locator('button:disabled')).toHaveCount(2);
 await expect(page.locator('#viewer-filter-disabled-reason')).toBeVisible();
 await expect(page.locator('#viewer-filter-disabled-reason')).toHaveText('この map には値がありません');
 for(const viewport of [{width:1440,height:900},{width:1280,height:800},{width:1024,height:768},{width:1920,height:1080},{width:1440,height:900}]){
  await page.setViewportSize(viewport);await expectFilterLayout(page);
  // One shared line of explanation must not double the single control row's height.
  expect(await bar(page).evaluate(e=>e.getBoundingClientRect().height)).toBeLessThan(80);
  await clickCentre(page,'#orrery-network-toggle');
  await expect(page.locator('#orrery-network-toggle')).toHaveAttribute('aria-pressed','true');
  await clickCentre(page,'#orrery-network-toggle');
  await expect(page.locator('#orrery-network-toggle')).toHaveAttribute('aria-pressed','false');
  await clickCentre(page,'.wb-board-title');
 }
 await page.getByRole('button',{name:'Hide inspector',exact:true}).click();await expectFilterLayout(page);
 await page.getByRole('button',{name:'Show inspector',exact:true}).click();await expectFilterLayout(page);
});
test('filter remeasures changing top-bar contents without a window resize',async({page})=>{
 await page.setViewportSize({width:1920,height:1080});await open(page,fixture);await expectFilterLayout(page);
 expect((await filterLayout(page)).fits).toBe(true);
 const label=page.locator('.wb-board-title small'),original=await label.textContent();
 // Synthetic content growth isolates the ResizeObserver/mutation boundary.
 await label.evaluate(e=>{e.textContent='Lane / level 0 '+ 'expanded surface label '.repeat(6);});
 await expectFilterLayout(page);expect((await filterLayout(page)).fits).toBe(false);
 await label.evaluate((e,text)=>{e.textContent=text;},original);
 await expectFilterLayout(page);expect((await filterLayout(page)).fits).toBe(true);
});
async function activeWebGL(page){await expect.poll(()=>page.evaluate(()=>Boolean(window.__m3eWebGLProjection?.getDebugState()?.active))).toBe(true);await expect(page.locator('#webgl-canvas')).toBeVisible();}
async function region(page,id){return page.evaluate(id=>{
 const p=window.__m3eWebGLProjection,n=p.getSnapshot().nodes.find(n=>n.id===id),c=p.getDebugState().camera,r=document.querySelector('#webgl-canvas').getBoundingClientRect();
 if(!n)throw new Error('Missing rendered node');
 return{x:r.x+c.x+n.x*c.zoom,y:r.y+c.y+n.y*c.zoom,width:Math.max(1,n.width*c.zoom),height:Math.max(1,n.height*c.zoom)};
},id);}
for(const surface of ['tree','timeline','logic-chart','system','scatter','lane'])test(`${surface}: filter-only geometry and render counts remain unchanged`,async({page})=>{
 await open(page,fixture);await mode(page,surface);
 await expect(page.locator('#board')).not.toHaveAttribute('data-render-pending','true');
 const before=await geometry(page),revision=await page.locator('#board').getAttribute('data-render-revision');
 const basePaint=await paint(page),hits=await hitTargets(page);
 for(const axis of ['重要度','緊急度']){
  await choose(page,axis,'高以上');
  expect(await hitTargets(page)).toEqual(hits);expect(await geometry(page)).toEqual(before);expect(await page.locator('#board').getAttribute('data-render-revision')).toBe(revision);
  const after=await paint(page);expect(Object.values(after).some(v=>v<1)).toBe(true);
  if(surface==='scatter')expect(await page.locator('.scatter-node-circle').evaluateAll(es=>es.filter(e=>Number(getComputedStyle(e).opacity)<1).map(e=>e.getAttribute('data-node-id')).sort())).toEqual(['low','mid']);
  await bar(page).getByRole('button',{name:'解除',exact:true}).click();expect(await paint(page)).toEqual(basePaint);
 }
});
for(const renderer of ['svg','webgl'])test(`Tree ${renderer}: exact opacity sets, selection, counts, text/arrow paint and reset`,async({page})=>{
 const {read}=await open(page,fixture);const saved=await read();
 if(renderer==='webgl'){await page.goto(page.url().replace('renderer=svg','renderer=webgl'));await expect(page.locator('#board')).toHaveAttribute('data-ready','true');await activeWebGL(page);}
 await settled(page);
 await expect(page.locator('#board')).not.toHaveAttribute('data-render-pending','true');
 const initial=await geometry(page),revision=await page.locator('#board').getAttribute('data-render-revision');
 const clip=renderer==='webgl'?await region(page,'low'):null;
 const beforePixels=clip?await page.screenshot({clip}):null;
 for(const axis of ['重要度','緊急度']){
  await choose(page,axis,'高以上');
  await expect(page.locator('.viewer-filter-count')).toHaveText('node 4/6 · GraphLink 0/2');
  const actual=await page.locator('#canvas').evaluate(svg=>Array.from(svg.querySelectorAll('.node-shape,.root-box,.folder-box')).filter(e=>Number(getComputedStyle(e).opacity)<.9).map(e=>e.getAttribute('data-node-id')).sort());
  expect(actual).toEqual(['low','mid']);
  for(const selector of ['.graph-link','.edge[data-target-node-id="low"]','.edge[data-target-node-id="mid"]'])expect(await page.locator(selector).evaluateAll(es=>es.every(e=>Number(getComputedStyle(e).opacity)<1))).toBe(true);
  expect(await geometry(page)).toEqual(initial);expect(await page.locator('#board').getAttribute('data-render-revision')).toBe(revision);
  if(renderer==='webgl'){
   await activeWebGL(page);
   await expect.poll(async()=>!(await page.screenshot({clip})).equals(beforePixels)).toBe(true);
   const commands=await page.evaluate(()=>window.__m3eWebGLProjection.getSnapshot().paintScene.commands);
   expect(commands.filter(c=>c.kind==='text'&&c.nodeId==='low').every(c=>c.style.opacity<1)).toBe(true);
   expect(commands.some(c=>c.kind==='path'&&c.style.opacity<1)).toBe(true);
  }
  await bar(page).getByRole('button',{name:'解除',exact:true}).click();
  if(clip)await expect.poll(async()=> (await page.screenshot({clip})).equals(beforePixels)).toBe(true);
 }
 await choose(page,'重要度','高以上');
 if(renderer==='svg')await page.locator('.node-visual-box[data-node-id="low"]').click();
 else {const box=await region(page,'low');await page.mouse.click(box.x+box.width/2,box.y+box.height/2);}
 await expect.poll(()=>page.locator('.node-shape[data-node-id="low"]').evaluate(e=>Number(getComputedStyle(e).opacity))).toBeLessThan(1);
 if(renderer==='webgl'){
  // Sample only the selection outline outside the node body; chip/body pixels cannot satisfy this check.
  await expect.poll(()=>page.evaluate(()=>window.__m3eWebGLProjection.getDebugState().selectedNodeIds)).toEqual(['low']);
  const strip=await page.evaluate(()=>{
   const p=window.__m3eWebGLProjection,n=p.getSnapshot().nodes.find(n=>n.id==='low'),c=p.getDebugState().camera,r=document.querySelector('#webgl-canvas').getBoundingClientRect();
   return{x:r.x+c.x+n.x*c.zoom,y:r.y+c.y+(n.y-5)*c.zoom,width:n.width*c.zoom,height:Math.max(1,4*c.zoom)};
  });
  await page.mouse.move(1,1);
  const dimOutline=await page.screenshot({clip:strip});
  await bar(page).getByRole('button',{name:'解除',exact:true}).click();
  await expect.poll(async()=>!(await page.screenshot({clip:strip})).equals(dimOutline)).toBe(true);
  await choose(page,'重要度','高以上');
 }
 await page.waitForTimeout(2700);await expect(page.locator('.viewer-filter-count')).toHaveText('node 4/6 · GraphLink 0/2');
 // A transient status update cannot overwrite the independent count span.
 await page.locator('#status').evaluate(e=>{e.textContent='Transient';});await expect(page.locator('.viewer-filter-count')).toHaveText('node 4/6 · GraphLink 0/2');
 await page.locator('#status').evaluate(e=>{e.textContent='';});await expect(page.locator('.viewer-filter-count')).toHaveText('node 4/6 · GraphLink 0/2');
 await choose(page,'実現段階','CURRENT');await expect(page.locator('.viewer-filter-count')).toHaveText('node 0/6 · GraphLink 0/2');
 expect((await read()).nodes).toEqual(saved.nodes);expect((await read()).links).toEqual(saved.links);
 await page.reload();await expect(page.locator('.viewer-filter-count')).toHaveCount(0);
});
test('Disperse WebGL dims canvas pixels and preserves settled geometry',async({page})=>{
 await open(page,fixture);await page.goto(page.url().replace('renderer=svg','renderer=webgl'));await expect(page.locator('#board')).toHaveAttribute('data-ready','true');await mode(page,'scatter');await activeWebGL(page);await settled(page);
 await expect(page.locator('#board')).not.toHaveAttribute('data-render-pending','true');
 const before=await geometry(page),clip=await region(page,'low'),pixels=await page.screenshot({clip});
 await expect(page.locator('#board')).not.toHaveAttribute('data-render-pending','true');
 const revision=await page.locator('#board').getAttribute('data-render-revision');
 await choose(page,'重要度','高以上');await expect.poll(async()=>!(await page.screenshot({clip})).equals(pixels)).toBe(true);
 expect(await page.locator('.scatter-node-circle').evaluateAll(es=>es.filter(e=>Number(getComputedStyle(e).opacity)<1).map(e=>e.getAttribute('data-node-id')).sort())).toEqual(['low','mid']);
 const body=await page.evaluate(()=>window.__m3eWebGLProjection.getSnapshot().paintScene.commands.filter(c=>c.nodeId==='low'&&c.kind==='path'));expect(body.length).toBeGreaterThan(0);expect(body.every(c=>c.style.opacity<1)).toBe(true);
 expect(await geometry(page)).toEqual(before);expect(await page.locator('#board').getAttribute('data-render-revision')).toBe(revision);
 await bar(page).getByRole('button',{name:'解除',exact:true}).click();await expect.poll(async()=> (await page.screenshot({clip})).equals(pixels)).toBe(true);
});

test('same-map scope changes retain selections while missing keys disable the axis',async({page})=>{
 const scoped=structuredClone(fixture);scoped.state.nodes.left.nodeType='folder';
 for(const id of ['left','low','high'])delete scoped.state.nodes[id].attributes.urgency;
 await open(page,scoped);await choose(page,'緊急度','高以上');
 await page.locator('.folder-box[data-node-id="left"]').click();await page.keyboard.press(']');
 const chip=bar(page).getByRole('button',{name:/^緊急度/});await expect(chip).toBeDisabled();await expect(chip).toContainText('高以上');await expect(page.locator('.viewer-filter-count')).toHaveCount(0);
 await page.locator('#board').focus();await page.keyboard.press('[');await expect(chip).toBeEnabled();await expect(chip).toHaveClass(/is-active/);await expect(page.locator('.viewer-filter-count')).toBeVisible();
});

test('GraphLink selection, editing and drag redraw preserve dimming',async({page})=>{
 await open(page,fixture);await choose(page,'重要度','高以上');
 const path=page.locator('.graph-link-hit[data-link-id="a"]');
 await path.evaluate(e=>e.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0})));
 await expect(page.locator('.graph-link[data-link-id="a"]')).toHaveClass(/selected/);
 await expect.poll(()=>page.locator('.graph-link[data-link-id="a"]').evaluate(e=>Number(getComputedStyle(e).opacity))).toBeLessThan(1);
 await page.locator('.node-visual-box[data-node-id="low"]').click();
 await expect(page.locator('.node-shape[data-node-id="low"]')).toHaveClass(/primary-selected/);
 await page.keyboard.press('F2');
 const editor=page.locator('textarea.inline-node-editor');await expect(editor).toBeVisible();await editor.fill('low edited');await editor.evaluate(e=>e.blur());
 await expect.poll(()=>page.locator('text[data-node-id="low"]').evaluate(e=>Number(getComputedStyle(e).opacity))).toBeLessThan(1);
 const box=await page.locator('.node-hit[data-node-id="low"]').boundingBox();
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+12,box.y+box.height/2+12,{steps:4});await page.mouse.up();
 await expect.poll(()=>page.locator('text[data-node-id="low"]').evaluate(e=>Number(getComputedStyle(e).opacity))).toBeLessThan(1);
});
