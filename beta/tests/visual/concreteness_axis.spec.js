const {test,expect}=require('@playwright/test');
const {laneServer}=require('./lane_helpers');
const open=laneServer(test);
test.use({launchOptions:{args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}});
const node=(id,parentId,children,scope=false)=>({id,parentId,children,text:id,nodeType:scope?'folder':'text',attributes:{},collapsed:false,details:'',note:'',link:''});
const fixture=()=>({version:1,state:{rootId:'root',nodes:{
 root:node('root',null,['X','Y']),X:node('X','root',['A','C']),Y:node('Y','root',['B','D']),
 A:node('A','X',['a'],true),a:node('a','A',[]),C:node('C','X',['c'],true),c:node('c','C',[]),
 B:node('B','Y',['b'],true),b:node('b','B',[]),D:node('D','Y',[],true),
},links:{hidden:{id:'hidden',sourceNodeId:'b',targetNodeId:'c',label:'Retain'}}}});
const hits=page=>page.locator('#canvas .node-hit').evaluateAll(es=>es.map(e=>e.dataset.nodeId).sort());
async function key(page,k,level){await page.locator('#board').focus();await page.keyboard.press(k);if(level!==undefined)await expect(page.locator('#board')).toHaveAttribute('data-concreteness-level',String(level));}
for(const renderer of ['svg','webgl']){
 test(`${renderer}: j/k changes concreteness on the normal Tree without saving topology`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const {read}=await open(page,fixture(),{renderer,surfaceReady:renderer==='webgl'});const before=await read();
  const rendered=async()=>{
   if(renderer==='svg') {await expect(page.locator('#canvas')).toBeVisible();return hits(page);}
   await expect(page.locator('#webgl-canvas')).toBeVisible();
   await expect.poll(()=>page.evaluate(()=>window.__m3eWebGLProjection?.getDebugState()?.active)).toBe(true);
   return page.evaluate(()=>window.__m3eWebGLProjection.getSnapshot().nodes.map(n=>n.id).sort());
  };
  await expect.poll(rendered).toEqual(['A','B','C','D','X','Y','root']);
  await key(page,'k',-1);await expect.poll(rendered).toEqual(['A','B','C','D','root']);
  await expect(page.locator('.wb-board-title')).toContainText('level -1');
  await key(page,'j',0);await expect.poll(rendered).toEqual(['A','B','C','D','X','Y','root']);
  await key(page,'j',1);await expect.poll(rendered).toContain('b');
  await key(page,'k',0);await expect.poll(rendered).not.toContain('b');
  expect(await read()).toEqual(before);expect(errors).toEqual([]);
 });
}
test('cross-parent grouping and recursive scopes persist, undo, and reopen without changing level 0',async({page})=>{
 const {read,url}=await open(page,fixture());
 await key(page,'k',-1);
 await page.locator('.node-hit[data-node-id="C"]').click();
 await page.locator('.node-hit[data-node-id="B"]').click({modifiers:['Shift']});
 await page.keyboard.press('ControlOrMeta+g');
 const editor=page.locator('.inline-node-editor');await expect(editor).toBeVisible();await editor.fill('Group');await editor.press('Escape');await expect(editor).toHaveCount(0);
 const id=await page.locator('#meta').getAttribute('data-selected-node-id');
 await key(page,'f');
 await expect.poll(async()=> (await read()).nodes[id]?.attributes['m3e:concreteness:scope:-1']).toBe('true');
 const grouped=await read();expect(grouped.nodes[id].text).toBe('Group');
 expect(grouped.nodes.B.attributes['m3e:concreteness:parent:-1']).toBe(id);
 expect(grouped.nodes.C.attributes['m3e:concreteness:parent:-1']).toBe(id);
 await key(page,'k',-2);expect(await hits(page)).toEqual([id,'root'].sort());
 await page.locator(`.node-shape[data-node-id="${id}"]`).click();await key(page,'f');
 await key(page,'k',-3);expect(await hits(page)).toEqual([id,'root'].sort());
 await key(page,'j',-2);await key(page,'ControlOrMeta+z',-2);
 await expect.poll(async()=> (await read()).nodes[id]?.attributes['m3e:concreteness:scope:-2']).not.toBe('true');
 await key(page,'j',-1);await key(page,'j',0);
 expect(await hits(page)).toEqual(['A','B','C','D','X','Y','root']);
 const saved=await read();expect(saved.nodes.C.parentId).toBe('X');expect(saved.nodes.B.parentId).toBe('Y');
 expect(saved.nodes.b.text).toBe('b');expect(saved.nodes.c.text).toBe('c');expect(saved.links.hidden.label).toBe('Retain');
 await page.reload();await expect(page.locator('#board')).toHaveAttribute('data-ready','true');
 await key(page,'k',-1);expect(await hits(page)).toContain(id);
 await key(page,'k',-2);expect(await hits(page)).toEqual([id,'root'].sort());
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
 const vaultPath=fs.mkdtempSync(path.join(os.tmpdir(),'m3e-concreteness-export-'));
 try {
  const api=new URL(url),mapId=api.pathname.split('/').at(-1);
  const response=await page.request.post(`${api.origin}/api/vault/export`,{data:{mapId,vaultPath,nodeId:id,concretenessLevel:-1,options:{skipAiTransform:true}}});
  expect(await response.text()).toContain('vault-export-complete');
  const output=fs.readFileSync(path.join(vaultPath,'Group.md'),'utf8');
  expect(output).toMatch(/\bb\b/);expect(output).toMatch(/\bc\b/);
 } finally {fs.rmSync(vaultPath,{recursive:true,force:true});}
});

test('copy, paste, export and undo retain contents hidden by a negative level',async({page})=>{
 await page.route('**/api/system-clipboard/**',route=>route.fulfill({json:{ok:false}}));
 await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{},readText:async()=>''},configurable:true}));
 const {read}=await open(page,fixture());
 await key(page,'k',-1);
 await page.locator('.node-hit[data-node-id="B"]').click();
 const downloadPromise=page.waitForEvent('download');
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('m3e:export-subtree',{detail:{format:'json'}})));
 const download=await downloadPromise;
 const exported=JSON.parse(require('node:fs').readFileSync(await download.path(),'utf8')).state;
 expect(Object.keys(exported.nodes).sort()).toEqual(['B','b']);
 await key(page,'ControlOrMeta+c');
 await page.locator('.node-hit[data-node-id="D"]').click();await key(page,'ControlOrMeta+v');
 await expect.poll(async()=>Object.values((await read()).nodes).filter(n=>n.text==='b').length).toBe(2);
 const saved=await read(),copy=Object.values(saved.nodes).find(n=>n.text==='B'&&n.id!=='B');
 expect(saved.nodes[copy.children[0]].text).toBe('b');expect(copy.parentId).toBe('D');
 await key(page,'ControlOrMeta+z',-1);
 await expect.poll(async()=>Object.values((await read()).nodes).filter(n=>n.text==='b').length).toBe(1);
 expect((await read()).nodes.b.text).toBe('b');
});

test('returning to level zero restores an entered scope and its selected content',async({page})=>{
 await open(page,fixture(),{scope:'B',surfaceReady:true});
 await expect(page.locator('.node-hit[data-node-id="b"]')).toBeVisible();
 await page.locator('.node-hit[data-node-id="b"]').click();
 await key(page,'k',-1);expect(await hits(page)).toContain('B');
 await key(page,'j',0);expect(await hits(page)).toEqual(['B','b']);
 await expect(page.locator('#meta')).toHaveAttribute('data-selected-node-id','b');
 await key(page,'[',0);expect(await hits(page)).toEqual(['A','B','C','D','X','Y','root']);
});
