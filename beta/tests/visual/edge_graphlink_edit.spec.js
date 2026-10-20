const {test,expect}=require('@playwright/test');
const {laneServer}=require('./lane_helpers');
const {withSurface}=require('../selection_review_server');
const fixture=require('../fixtures/edge_graphlink_selection.json');
const open=laneServer(test);
test.use({launchOptions:{args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}});
const inspect=page=>page.locator('#board').evaluate(board=>board.edgeGraphlinkSelection());
async function press(page,key){
 await page.keyboard.press(key);
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
}
async function choose(page,kind,id){
 await page.locator('#board').focus();
 // Use the same real node click for initial setup, then keyboard-only line selection.
 const endpoint=(await inspect(page)).scene.items.flatMap(item=>[item.source,item.target]).find(end=>end.renderedNodeId===id);
 expect(endpoint).toBeTruthy();
 await page.mouse.click(endpoint.center.x,endpoint.center.y);
 await page.locator('#board').focus();
 if(kind==='parent-child')await press(page,'Alt+ArrowUp');
 else {
  for(let n=0;n<16;n++){
   await press(page,'Alt+ArrowRight');
   const s=(await inspect(page)).selection;
   if(s.kind==='graph-link'&&s.linkIds.length===1)return s.linkIds[0];
  }
  throw new Error('No editable GraphLink reached');
 }
 expect((await inspect(page)).selection.kind).toBe(kind);
}
for(const [kind,direction,renderer] of [
 ['tree','right','svg'],['tree','right','webgl'],['timeline','right','svg'],
 ['scatter','right','svg'],['scatter','right','webgl'],['system','right','svg'],
 ['lane','down','svg'],['lane','right','svg'],
]){
 test(`${kind} ${direction} ${renderer}: line label, cycles, undo, redo, reload`,async({page})=>{
  const {read}=await open(page,withSurface(fixture,kind,direction),{surfaceReady:true,renderer});
  const before=await read();
  const id=await choose(page,'graph-link',kind==='system'?'plan':'sort');
  const original=before.links[id];
  await press(page,'F2');
  const editor=page.getByRole('textbox',{name:'Edit selected line label',exact:true});
  await expect(editor).toBeFocused();
  await editor.fill('  edited relationship  ');await press(page,'Enter');
  await expect(editor).toHaveCount(0);
  await expect.poll(async()=>(await read()).links[id].label).toBe('edited relationship');
  await press(page,'ControlOrMeta+z');
  await expect.poll(async()=>(await read()).links[id].label??'').toBe(original.label??'');
  await press(page,'ControlOrMeta+Shift+z');
  await expect.poll(async()=>(await read()).links[id].label).toBe('edited relationship');
  await press(page,'F2');await editor.fill('cancelled');await press(page,'Escape');
  await press(page,'F2');await editor.fill(' edited relationship ');await press(page,'Enter');
  await press(page,'ControlOrMeta+z');
  await expect.poll(async()=>(await read()).links[id].label??'').toBe(original.label??'');
  await press(page,'ControlOrMeta+Shift+z');
  await expect.poll(async()=>(await read()).links[id].label).toBe('edited relationship');
  await press(page,'[');await expect.poll(async()=>(await read()).links[id].sourcePort).toBe('right');
  for(const value of ['bottom','left','top','right']){
   await press(page,'[');await expect.poll(async()=>(await read()).links[id].sourcePort).toBe(value);
  }
  for(const value of ['right','bottom','left','top','right']){
   await press(page,']');await expect.poll(async()=>(await read()).links[id].targetPort).toBe(value);
  }
  for(const value of ['dashed','soft','emphasis','default']){
   await press(page,'Shift+s');await expect.poll(async()=>(await read()).links[id].style).toBe(value);
  }
  // The independent fixture starts at forward; traverse the accepted cycle from that value.
  expect(original.direction).toBe('forward');
  for(const value of ['backward','both','none','forward']){
   await press(page,'Shift+b');await expect.poll(async()=>(await read()).links[id].direction).toBe(value);
  }
  const after=await read();
  expect(after.nodes).toEqual(before.nodes);
  expect(after.links[id]).toMatchObject({sourceNodeId:original.sourceNodeId,targetNodeId:original.targetNodeId,label:'edited relationship'});
  for(const other of Object.keys(before.links).filter(key=>key!==id))expect(after.links[other]).toEqual(before.links[other]);
  await page.reload();await expect(page.locator('#board')).toHaveAttribute('data-ready','true');
  expect((await read()).links[id]).toEqual(after.links[id]);
 });
}
test('GraphLink blur commits, IME and Alt arrows stay in editor, Delete and undo preserve nodes',async({page})=>{
 const {read}=await open(page,withSurface(fixture,'tree','right'),{surfaceReady:true});
 const before=await read(),id=await choose(page,'graph-link','sort');
 const editor=page.getByRole('textbox',{name:'Edit selected line label',exact:true});
 await press(page,'F2');await editor.fill('IME edit');
 expect(await editor.evaluate(el=>{
  const event=new KeyboardEvent('keydown',{key:'Enter',isComposing:true,bubbles:true,cancelable:true});
  el.dispatchEvent(event);return event.defaultPrevented;
 })).toBe(false);
 await expect(editor).toBeFocused();
 await editor.evaluate(el=>{window.lineAltDefaults=[];el.addEventListener('keydown',event=>{if(event.altKey&&event.key==='ArrowLeft')queueMicrotask(()=>window.lineAltDefaults.push(event.defaultPrevented));});});
 await press(page,'Alt+ArrowLeft');
 expect(await page.evaluate(()=>window.lineAltDefaults)).toEqual([false]);
 await page.locator('#board').focus();
 await expect.poll(async()=>(await read()).links[id].label).toBe('IME edit');
 await press(page,'F2');await editor.fill('');await press(page,'Enter');
 await expect.poll(async()=>(await read()).links[id].label??'').toBe('');
 await press(page,'Delete');
 await expect.poll(async()=>Boolean((await read()).links[id])).toBe(false);
 await expect.poll(async()=>(await inspect(page)).selection).toEqual({kind:'node',nodeId:'sort'});
 await press(page,'ControlOrMeta+z');
 await expect.poll(async()=>Boolean((await read()).links[id])).toBe(true);
 expect((await read()).nodes).toEqual(before.nodes);
});
test('read-only line selection refuses all edit keys without writes',async({page})=>{
 const {read}=await open(page,withSurface(fixture,'tree','right'),{surfaceReady:true});
 const url=new URL(page.url());url.searchParams.set('access','view');
 await page.goto(url.href);await expect(page.locator('#board')).toHaveAttribute('data-ready','true');
 const before=await read(),writes=[];
 page.on('request',request=>{if(request.method()==='POST'&&request.url().includes('/api/maps/'))writes.push(request.url());});
 await choose(page,'graph-link','sort');
 for(const key of ['F2','[',']','Shift+s','Shift+b','Delete','Backspace']){
  await press(page,key);await expect(page.locator('#status')).toContainText('読み取り専用');
 }
 await expect(page.locator('textarea.inline-edge-label-editor')).toHaveCount(0);
 expect(await read()).toEqual(before);expect(writes).toEqual([]);
});
for(const [kind,direction] of [['tree','right'],['timeline','right'],['scatter','right'],['lane','down'],['lane','right']])
test(`${kind} ${direction}: parent label clears, cancellation has no undo entry, Delete preserves children`,async({page})=>{
 const {read}=await open(page,withSurface(fixture,kind,direction),{surfaceReady:true});
 const before=await read();await choose(page,'parent-child','sort');
 const editor=page.getByRole('textbox',{name:'Edit selected line label',exact:true});
 await press(page,'F2');await editor.fill('edge text');await press(page,'Enter');
 await expect.poll(async()=>(await read()).nodes.sort.attributes['m3e:edge-label']).toBe('edge text');
 await press(page,'F2');await editor.fill('discard');await press(page,'Escape');
 await press(page,'ControlOrMeta+z');
 await expect.poll(async()=>(await read()).nodes.sort.attributes['m3e:edge-label']??'').toBe(before.nodes.sort.attributes['m3e:edge-label']??'');
 await press(page,'ControlOrMeta+Shift+z');
 await expect.poll(async()=>(await read()).nodes.sort.attributes['m3e:edge-label']).toBe('edge text');
 await press(page,'F2');await editor.fill('  ');await press(page,'Enter');
 await expect.poll(async()=>(await read()).nodes.sort.attributes['m3e:edge-label']??'').toBe('');
 await press(page,'Delete');
 expect((await read()).nodes.plan.children).toEqual(before.nodes.plan.children);
 await expect(page.locator('#status')).toContainText('削除できません');
});
