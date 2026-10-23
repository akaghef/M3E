const {expect}=require('@playwright/test');
const research = new Set(['res','obsidian','chrome','miro','mac','dell','ipad','gd','chats','codex','ha','akos'].map(id=>'item_'+id));
const bar = page => page.getByRole('toolbar',{name:'フィルタ',exact:true});
const chip = (page,label) => bar(page).getByRole('button',{name:new RegExp('^'+label)});
async function choose(page,label,value){await chip(page,label).click();await bar(page).getByRole('menuitemradio',{name:new RegExp(value)}).click();}
async function domain(page,name){await chip(page,'所属').click();await bar(page).getByRole('menuitemcheckbox',{name,exact:true}).click();await bar(page).getByRole('button',{name:'閉じる',exact:true}).click();}
async function geometry(page){return page.locator('#canvas').evaluate(svg=>Array.from(svg.querySelectorAll('.node-hit,.graph-link,.edge,.scatter-guide,.timeline-stem')).map(e=>({tag:e.tagName,id:e.getAttribute('data-node-id')||e.getAttribute('data-link-id'),attrs:['x','y','width','height','cx','cy','r','d','x1','y1','x2','y2'].map(a=>e.getAttribute(a))})));}
async function paint(page){return page.locator('#canvas').evaluate(svg=>Object.fromEntries(Array.from(svg.querySelectorAll('.node-shape,.root-box,.folder-box,.graph-link,.edge,.edge-label,text[data-node-id],.graph-link-label')).map((e,i)=>[`${e.tagName}:${e.getAttribute('class')}:${e.getAttribute('data-node-id')||e.getAttribute('data-link-id')||i}`,Number(getComputedStyle(e).opacity)])));}
async function laneSets(page,nodes,links){
 const actual=await page.locator('#canvas').evaluate(svg=>({nodes:Array.from(svg.querySelectorAll('.node-shape')).filter(e=>Number(getComputedStyle(e).opacity)>.9).map(e=>e.getAttribute('data-node-id')).sort(),links:Array.from(svg.querySelectorAll('.graph-link')).filter(e=>Number(getComputedStyle(e).opacity)>.9).map(e=>e.getAttribute('data-link-id')).sort()}));
 expect(actual).toEqual({nodes:[...nodes].sort(),links:[...links].sort()});
 await expect(page.locator('.viewer-filter-count')).toHaveText(`node ${nodes.size}/25 · GraphLink ${links.size}/82`);
}
// Install before navigation so saves already in flight at settled() are observed.
const mapSaves=new WeakMap();
function trackMapSaves(page){
 if(mapSaves.has(page))return mapSaves.get(page);
 const saves={pending:new Set(),activity:0};mapSaves.set(page,saves);
 page.on('request',request=>{
  if(request.method()==='POST'&&new URL(request.url()).pathname.startsWith('/api/maps/')){
   saves.pending.add(request);saves.activity++;
  }
 });
 const finished=request=>{if(saves.pending.delete(request))saves.activity++;};
 page.on('requestfinished',finished);page.on('requestfailed',finished);
 return saves;
}
async function settled(page){
 const saves=trackMapSaves(page);
 await page.evaluate(()=>document.fonts.ready);
 // Observe the real force lifecycle without pausing it or requiring an autosave.
 await page.waitForFunction(()=>{
  if(document.documentElement.dataset.surfaceViewMode!=='scatter')return true;
  const force=window.disperseDiagnostics?.();
  return !force || (!force.pendingFrame && force.snapshot?.status!=='running');
 });
 await expect(page.locator('#board')).not.toHaveAttribute('data-camera-moving','true');
 await expect(page.locator('#board')).not.toHaveAttribute('data-render-pending','true');
 // Hidden SVG hit rectangles have zero screen bounds in WebGL mode. Observe
 // the camera that actually presents the pixels before fixing a screenshot clip.
 // 900 ms covers the current 700 ms autosave debounce. Any save, revision,
 // pending render, camera or geometry activity restarts the quiet period; no POST is required.
 let previous=null,quietSince=0;
 await expect.poll(async()=>{
  const state=await page.evaluate(()=>{
   const board=document.querySelector('#board'),force=window.disperseDiagnostics?.();
   return {revision:board.dataset.renderRevision,renderPending:board.dataset.renderPending==='true',cameraMoving:board.dataset.cameraMoving==='true',
    forceRunning:document.documentElement.dataset.surfaceViewMode==='scatter'&&Boolean(force?.pendingFrame||force?.snapshot?.status==='running'),
    camera:window.__m3eWebGLProjection?.getDebugState()?.camera,
    screen:Array.from(document.querySelectorAll('#canvas .node-hit')).map(e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height];})};
  });
  const sample=JSON.stringify({state,geometry:await geometry(page),saveActivity:saves.activity});
  if(saves.pending.size||state.renderPending||state.forceRunning||state.cameraMoving){previous=null;quietSince=0;return false;}
  if(sample!==previous){previous=sample;quietSince=Date.now();return false;}
  return Date.now()-quietSince>=900;
 },{timeout:10000,intervals:[50,100]}).toBe(true);
}
module.exports={research,bar,chip,choose,domain,geometry,paint,laneSets,settled,trackMapSaves};

// Compare actual browser hit routing, including the transparent hit margin.
async function hitTargets(page){return page.locator('#canvas').evaluate(svg=>Array.from(svg.querySelectorAll('.node-hit')).map(e=>{
 const r=e.getBoundingClientRect();return [.1,.5,.9].map(f=>{const target=document.elementFromPoint(r.x+r.width*f,r.y+r.height/2);return {node:target?.closest('[data-node-id]')?.getAttribute('data-node-id'),tag:target?.tagName,hit:target?.classList.contains('node-hit')};});
}));}
module.exports.hitTargets=hitTargets;
