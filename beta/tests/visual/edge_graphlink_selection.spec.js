const {test,expect}=require('@playwright/test');
const {laneServer}=require('./lane_helpers');
const {withSurface}=require('../selection_review_server');
const fixture=require('../fixtures/edge_graphlink_selection.json');
const open=laneServer(test);
test.use({launchOptions:{args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}});
const inspect=page=>page.locator('#board').evaluate(board=>board.edgeGraphlinkSelection());
const identity=selection=>selection.kind==='parent-child'?`parent:${selection.parentNodeId}:${selection.childNodeId}`:selection.kind==='graph-link'?selection.renderKey:`node:${selection.nodeId}`;
async function boardFocus(page){
 for(let n=0;n<100;n++) {if(await page.locator('#board').evaluate(el=>el===document.activeElement))return;await page.keyboard.press('Tab');}
 throw new Error('Board not reachable with Tab');
}
async function press(page,key){await page.keyboard.press(key);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await expect.poll(()=>page.locator('#board').getAttribute('data-ready')).toBe('true');}
async function selected(page,kind){await expect.poll(async()=>(await inspect(page)).selection.kind).toBe(kind);return (await inspect(page)).selection;}
async function highlighted(page,presentation){
 await expect(page.locator(`.${presentation}.relation-selected`)).toHaveCount(1);
 const {selection,scene}=await inspect(page);
 const i=scene.items.find(i=>identity(i.ref)===identity(selection));
 expect(i).toBeTruthy();
 for(const end of [i.source,i.target]) await expect(page.locator(`[data-node-id="${end.renderedNodeId}"].relation-endpoint`).first()).toHaveCount(1);
}
const cases=[['tree','right'],['timeline','right'],['scatter','right'],['system','right'],['lane','down'],['lane','right']];
for(const renderer of ['svg','webgl'])for(const [kind,direction] of cases){
 test(`${kind} ${direction} ${renderer}: keyboard selection, full wrap, endpoints, editor boundary`,async({page})=>{
  const {read}=await open(page,withSurface(fixture,kind,direction),{surfaceReady:true,renderer});
  const before=await read();
  if(renderer==='webgl')await expect.poll(()=>page.evaluate(()=>Boolean(window.__m3eWebGLProjection?.getDebugState().active))).toBe(true);
  // Independent expected renderer set, not candidates fed back as their own oracle.
  const expected=fixture.expected[kind];
  await expect.poll(()=>page.locator('.graph-link').evaluateAll(els=>els.map(el=>el.dataset.linkId).sort())).toEqual([...expected.graphLinks].sort());
  await expect(page.locator('path.edge')).toHaveCount(expected.parentChildCount);
  const snapshot=(await inspect(page)).scene;
  expect(snapshot.items.filter(i=>i.ref.kind==='graph-link').map(i=>i.ref.renderKey).sort()).toEqual([...expected.graphLinks].sort());
  if(renderer==='svg') {
   const errors=await page.locator('#board').evaluate(board=>{
    const {scene}=board.edgeGraphlinkSelection();return scene.items.flatMap(item=>[item.source,item.target]).map(end=>{
     const el=document.querySelector(`.node-hit[data-node-id="${end.renderedNodeId}"], [data-lane-header][data-node-id="${end.renderedNodeId}"]`);
     const box=el.getBoundingClientRect();return Math.hypot(end.center.x-box.x-box.width/2,end.center.y-box.y-box.height/2);
    });
   });
   expect(Math.max(0,...errors)).toBeLessThan(2);
  }
  await boardFocus(page);
  // Setup ended. Selection is changed only by keyboard from here on.
  if(kind==='tree'||kind==='timeline'||kind==='scatter')await press(page,'ArrowRight'); // root -> 計画
  if(kind==='lane') {
   // Lane's initial primary can be the heading or first item; reach root using existing navigation.
   for(let n=0;n<3&&(await inspect(page)).selection.nodeId!=='root';n++)await press(page,direction==='down'?'ArrowLeft':'ArrowUp');
   await press(page,direction==='down'?'ArrowRight':'ArrowDown');
  }
  const origin=(await inspect(page)).selection.nodeId;
  expect(origin).toBe('plan');
  await press(page,'Alt+ArrowUp');
  if(kind==='system'||kind==='scatter')await selected(page,'node'); // root is not drawn in these views (OP41).
  else {await selected(page,'parent-child');await highlighted(page,kind==='lane'?'lane-boundary':'edge');}
  await press(page,'Escape');await selected(page,'node');
  await press(page,'Alt+ArrowDown');
  if(kind==='system')await selected(page,'node'); // children represented by the top-level card, not endpoints.
  else {
   await selected(page,'parent-child');await highlighted(page,kind==='lane'?'lane-boundary':kind==='scatter'?'disperse-group':'edge');
   // Move to 整理 using a corresponding bare arrow, then Esc has ordinary node behavior.
   const {selection,scene}=await inspect(page),i=scene.items.find(i=>identity(i.ref)===identity(selection));
   const dx=i.target.center.x-i.source.center.x,dy=i.target.center.y-i.source.center.y;
   await press(page,Math.abs(dx)>=Math.abs(dy)?(dx>=0?'ArrowRight':'ArrowLeft'):(dy>=0?'ArrowDown':'ArrowUp'));
   await selected(page,'node');expect((await inspect(page)).selection.nodeId).toBe('sort');
  }
  await test.info().attach(`${kind}-${direction}-${renderer}-selection`,{body:await page.screenshot(),contentType:'image/png'});
  const expectedCount=kind==='system'?6:kind==='tree'||kind==='timeline'?6:5;
  await press(page,'Alt+ArrowRight');await expect.poll(async()=>(await inspect(page)).selection.kind).not.toBe('node');
  const first=identity((await inspect(page)).selection),seen=[first];
  for(let n=1;n<expectedCount;n++){await press(page,'Alt+ArrowRight');seen.push(identity((await inspect(page)).selection));}
  expect(new Set(seen).size).toBe(expectedCount);
  await press(page,'Alt+ArrowRight');expect(identity((await inspect(page)).selection)).toBe(first);
  await press(page,'Alt+ArrowLeft');expect(identity((await inspect(page)).selection)).toBe(seen.at(-1));
  const {selection,scene}=await inspect(page),i=scene.items.find(i=>identity(i.ref)===identity(selection));
  const dx=i.target.center.x-i.source.center.x,dy=i.target.center.y-i.source.center.y;
  const arrow=Math.abs(dx)>=Math.abs(dy)?(dx>=0?'ArrowRight':'ArrowLeft'):(dy>=0?'ArrowDown':'ArrowUp');
  await press(page,arrow);await selected(page,'node');expect((await inspect(page)).selection.nodeId).toBe(i.target.renderedNodeId);
  const nextOrigin=(await inspect(page)).selection.nodeId;
  await press(page,'Alt+ArrowRight');await press(page,'Escape');await selected(page,'node');expect((await inspect(page)).selection.nodeId).toBe(nextOrigin);
  // First left is the last candidate; all mutation keys are consumed in this slice.
  await press(page,'Alt+ArrowLeft');await expect.poll(async()=>(await inspect(page)).selection.kind).not.toBe('node');
  const fixed=identity((await inspect(page)).selection);
  for(const key of ['F2','[',']','Shift+S','Shift+B','Delete','Backspace','Enter','Tab','m','Control+x','Control+v']){
   await press(page,key);expect(identity((await inspect(page)).selection)).toBe(fixed);await expect(page.locator('textarea.inline-node-editor')).toHaveCount(0);
  }
  await press(page,'Escape');await press(page,'F2');
  const editor=page.locator('textarea.inline-node-editor');await expect(editor).toBeFocused();
  await editor.evaluate(el=>{window.altDefaults=[];el.addEventListener('keydown',event=>{if(event.altKey)queueMicrotask(()=>window.altDefaults.push(event.defaultPrevented));});});
  for(const arrow of ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'])await page.keyboard.press(`Alt+${arrow}`);
  expect(await page.evaluate(()=>window.altDefaults)).toEqual([false,false,false,false]);
  await press(page,'Escape');
  const after=await read();expect(after.nodes).toEqual(before.nodes);expect(after.links).toEqual(before.links);
  expect(await page.locator('#status').textContent()).not.toMatch(/aggregate-|handoff|root|sort|[0-9a-f]{8}-[0-9a-f]{4}/);
 });
}

test('System aggregate has three members, one candidate, count status and no port controls or edits',async({page})=>{
 const {read}=await open(page,withSurface(fixture,'system'),{surfaceReady:true});const before=await read();await boardFocus(page);
 const scene=(await inspect(page)).scene;
 const aggregate=scene.items.filter(i=>i.ref.kind==='graph-link'&&i.ref.linkIds.length>1);
 expect(aggregate).toHaveLength(1);expect([...aggregate[0].ref.linkIds].sort()).toEqual([...fixture.expected.system.aggregateIds].sort());
 for(let n=0;n<6;n++){await press(page,'Alt+ArrowRight');if((await inspect(page)).selection.linkIds?.length===3)break;}
 expect((await inspect(page)).selection.linkIds).toHaveLength(3);await expect(page.locator('#status')).toContainText('GraphLink 3 本');
 for(const key of ['F2','[',']','Shift+S','Shift+B','Delete','Backspace']){
  await press(page,key);await expect(page.locator('#status')).toHaveText('複数の GraphLink を表す線は編集できません');
 }
 await expect(page.locator('.link-port-controls')).toHaveCount(0);expect((await read()).links).toEqual(before.links);
 await expect(page.locator('#status')).toContainText('GraphLink 3 本',{timeout:5000});
});

test('OP41 collapsed child, Lane depth and scope parent remain unselected',async({page})=>{
 const collapsed=withSurface(fixture,'tree');collapsed.state.nodes.sort.collapsed=true;
 await open(page,collapsed,{surfaceReady:true});await boardFocus(page);await press(page,'ArrowRight');await press(page,'ArrowRight');
 await press(page,'Alt+ArrowDown');await expect(page.locator('#status')).toHaveText('子は折り畳まれています');expect((await inspect(page)).selection).toEqual({kind:'node',nodeId:'sort'});
 await open(page,withSurface(fixture,'lane','down'),{surfaceReady:true});await boardFocus(page);
 for(let n=0;n<3&&(await inspect(page)).selection.nodeId!=='root';n++)await press(page,'ArrowLeft');
 await press(page,'ArrowRight');await press(page,'ArrowRight');await press(page,'Alt+ArrowDown');
 await expect(page.locator('#status')).toHaveText('Lane では孫より深い node を描きません');expect((await inspect(page)).selection).toEqual({kind:'node',nodeId:'sort'});
 await open(page,withSurface(fixture,'tree'),{surfaceReady:true,scope:'plan'});await boardFocus(page);await press(page,'Alt+ArrowUp');
 await expect(page.locator('#status')).toHaveText('親は scope の外です');expect((await inspect(page)).selection).toEqual({kind:'node',nodeId:'plan'});
});
