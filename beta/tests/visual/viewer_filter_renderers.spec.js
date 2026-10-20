const {test,expect}=require('@playwright/test');
// Exercise the real WebGL2 renderer in headless Chromium, including hosts without a GPU.
test.use({launchOptions:{args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}});
const {laneServer}=require('./lane_helpers');
const {bar,choose,geometry,paint,settled,hitTargets}=require('./viewer_filter_helpers');
const open=laneServer(test);
// Dedicated input. Attributes and expected sets are explicit, independent of product predicates.
const fixture={version:1,state:{rootId:'root',nodes:{},links:{},annotations:{},scopes:{},surfaces:{}}};
for(const [id,parentId,children,importance,urgency] of [
 ['root',null,['left','right'],'3','3'],['left','root',['low','high'],'3','3'],['right','root',['mid'],'3','3'],
 ['low','left',[],'1','1'],['high','left',[],'3','3'],['mid','right',[],'2','2'],
])fixture.state.nodes[id]={id,parentId,children,nodeType:'text',text:id,collapsed:false,details:'',note:'',link:'',attributes:{importance,urgency,domain:id==='low'?'Other':'Research','m3e:style':JSON.stringify({fill:'#ffffff',border:'#333333'})}};
fixture.state.links={a:{id:'a',sourceNodeId:'low',targetNodeId:'high',relationType:'uses',label:'Uses',color:'#b91c1c',direction:'both',style:'default',attributes:{confidence:'system-evidenced'}},b:{id:'b',sourceNodeId:'high',targetNodeId:'mid',relationType:'feeds',label:'Feeds',color:'#b91c1c',direction:'forward',style:'default',attributes:{confidence:'declared'}}};
async function mode(page,mode){
 // Surface/direction changes autosave and redraw asynchronously. Finish that operation
 // before measuring filter-only render counts (the filter must never save or relayout).
 const saved=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname.startsWith('/api/maps/'));
 const revision=Number(await page.locator('#board').getAttribute('data-render-revision'));
 await page.evaluate(mode=>window.dispatchEvent(new CustomEvent('m3e:set-surface-layout',{detail:{mode,direction:'right'}})),mode);
 await expect.poll(()=>page.evaluate(()=>document.documentElement.dataset.surfaceViewMode)).toBe(mode);
 await (await saved).finished();
 await expect.poll(async()=>Number(await page.locator('#board').getAttribute('data-render-revision'))).toBeGreaterThan(revision);
 await page.mouse.move(1,1);await page.keyboard.press('Escape');await settled(page);
}
async function activeWebGL(page){await expect.poll(()=>page.evaluate(()=>Boolean(window.__m3eWebGLProjection?.getDebugState()?.active))).toBe(true);await expect(page.locator('#webgl-canvas')).toBeVisible();}
async function region(page,id){return page.evaluate(id=>{
 const p=window.__m3eWebGLProjection,n=p.getSnapshot().nodes.find(n=>n.id===id),c=p.getDebugState().camera,r=document.querySelector('#webgl-canvas').getBoundingClientRect();
 if(!n)throw new Error('Missing rendered node');
 return{x:r.x+c.x+n.x*c.zoom,y:r.y+c.y+n.y*c.zoom,width:Math.max(1,n.width*c.zoom),height:Math.max(1,n.height*c.zoom)};
},id);}
for(const surface of ['tree','timeline','logic-chart','system','scatter','lane'])test(`${surface}: filter-only geometry and render counts remain unchanged`,async({page})=>{
 await open(page,fixture);await mode(page,surface);
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
 const before=await geometry(page),clip=await region(page,'low'),pixels=await page.screenshot({clip});
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
